import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { brandFromTenant, type TenantBrandRow } from "./tenant";
import { z } from "zod";

/** Auth + gate de super-admin (mesmo padrão do admin.functions). */
const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw new Error("Acesso restrito a administradores.");
    return next();
  });

const BRAND_COLS = "name, monogram, tagline, powered_by, support_email";

/**
 * Marca do usuário logado = a do tenant onde ele é staff. Cai na marca padrão
 * (BRAND) se ele não for membro de nenhum tenant (ex.: cliente final puro).
 */
export const getMyBrand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("tenant_members")
      .select(`tenants(${BRAND_COLS})`)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const tenant = (data as { tenants: TenantBrandRow | null } | null)?.tenants ?? null;
    return brandFromTenant(tenant);
  });

// ---- Console de super-admin: gerir revendedores (tenants) -----------------

const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9-]+$/, "Use apenas minúsculas, números e hífen.");

const tenantInput = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(80),
  monogram: z.string().trim().max(4).default(""),
  tagline: z.string().trim().max(120).default(""),
  powered_by: z.boolean().default(true),
  support_email: z.string().trim().email().nullable().optional(),
});

export const adminListTenants = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: tenants, error }, { data: members }, { data: profiles }, { data: tagRows }] =
      await Promise.all([
        supabaseAdmin.from("tenants").select("*").order("created_at", { ascending: true }),
        supabaseAdmin.from("tenant_members").select("id, tenant_id, user_id, role, created_at"),
        supabaseAdmin.from("profiles").select("id, email, full_name"),
        supabaseAdmin.from("tags").select("user_id"),
      ]);
    if (error) throw new Error(error.message);

    const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
    // `tags` não guarda tenant: o vínculo vem da associação do dono ao tenant.
    const tenantByUser = new Map((members ?? []).map((m) => [m.user_id, m.tenant_id]));
    const tagCount = new Map<string, number>();
    for (const t of tagRows ?? []) {
      const tenantId = t.user_id ? tenantByUser.get(t.user_id) : undefined;
      if (tenantId) tagCount.set(tenantId, (tagCount.get(tenantId) ?? 0) + 1);
    }


    return (tenants ?? []).map((t) => ({
      ...t,
      tag_count: tagCount.get(t.id) ?? 0,
      members: (members ?? [])
        .filter((m) => m.tenant_id === t.id)
        .map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          email: profById.get(m.user_id)?.email ?? null,
          full_name: profById.get(m.user_id)?.full_name ?? null,
        })),
    }));
  });

export const adminCreateTenant = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => tenantInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tenants")
      .insert({
        slug: data.slug,
        name: data.name,
        monogram: data.monogram,
        tagline: data.tagline,
        powered_by: data.powered_by,
        support_email: data.support_email ?? null,
      })
      .select("id")
      .single();
    if (error) {
      throw new Error(/duplicate|unique/i.test(error.message) ? "Slug já em uso." : error.message);
    }
    return row;
  });

export const adminUpdateTenant = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => tenantInput.partial().extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { id, ...patch } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tenants").update(patch).eq("id", id);
    if (error) {
      throw new Error(/duplicate|unique/i.test(error.message) ? "Slug já em uso." : error.message);
    }
    return { ok: true };
  });

export const adminAddTenantMember = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenant_id: z.string().uuid(),
        email: z.string().trim().email(),
        role: z.enum(["owner", "member"]).default("owner"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (!prof) throw new Error("Nenhum usuário com esse e-mail. Ele precisa se cadastrar primeiro.");
    const { error } = await supabaseAdmin
      .from("tenant_members")
      .insert({ tenant_id: data.tenant_id, user_id: prof.id, role: data.role });
    if (error) {
      throw new Error(/duplicate|unique/i.test(error.message) ? "Já é membro deste tenant." : error.message);
    }
    return { ok: true };
  });

export const adminRemoveTenantMember = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tenant_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
