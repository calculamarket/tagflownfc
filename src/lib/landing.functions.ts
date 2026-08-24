import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { BRAND } from "./brand";
import { brandFromTenant, type TenantBrandRow } from "./tenant";

const buttonSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
  style: z.enum(["primary", "secondary"]).default("primary"),
});

const leadFormSchema = z.object({
  enabled: z.boolean().default(false),
  title: z.string().max(120).default("Deixe seu contato"),
  button_label: z.string().max(60).default("Enviar"),
  success_message: z.string().max(200).default("Obrigado! Recebemos seu contato."),
  fields: z
    .object({
      name: z.boolean().default(true),
      email: z.boolean().default(true),
      phone: z.boolean().default(false),
      message: z.boolean().default(false),
    })
    .default({ name: true, email: true, phone: false, message: false }),
});

const landingSchema = z.object({
  tag_id: z.string().min(1),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  buttons: z.array(buttonSchema).default([]),
  lead_form: leadFormSchema.optional(),
});

export type LandingButton = z.infer<typeof buttonSchema>;
export type LeadForm = z.infer<typeof leadFormSchema>;

export const DEFAULT_LEAD_FORM: LeadForm = {
  enabled: false,
  title: "Deixe seu contato",
  button_label: "Enviar",
  success_message: "Obrigado! Recebemos seu contato.",
  fields: { name: true, email: true, phone: false, message: false },
};

export const getLandingForEditor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tag_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tag } = await supabase
      .from("tags").select("id, name").eq("id", data.tag_id).eq("user_id", userId).maybeSingle();
    if (!tag) throw new Error("Tag não encontrada");
    const { data: lp } = await supabase
      .from("landing_pages").select("*").eq("tag_id", data.tag_id).maybeSingle();
    return { tag, landing: lp };
  });

export const upsertLanding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => landingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("landing_pages").upsert({
      tag_id: data.tag_id,
      user_id: userId,
      title: data.title ?? null,
      description: data.description ?? null,
      logo_url: data.logo_url ?? null,
      image_url: data.image_url ?? null,
      buttons: data.buttons,
      ...(data.lead_form ? { lead_form: data.lead_form } : {}),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function isNewKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}

export const getPublicView = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (isNewKey(key) && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: tag } = await supabase
      .from("tags")
      .select("id, name, status, destination_type, destination")
      .eq("id", data.id)
      .maybeSingle();
    if (!tag || tag.status !== "active") return { ok: false as const };
    const { data: lp } = await supabase
      .from("landing_pages").select("*").eq("tag_id", data.id).maybeSingle();

    // Marca white-label: a do tenant dono da tag. Lido via service role (o
    // cliente anon não tem acesso à tabela tenants), caindo na marca padrão.
    let brand = BRAND;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: t } = await supabaseAdmin
        .from("tags")
        .select("tenants(name, monogram, tagline, powered_by, support_email, primary_color, logo_url)")
        .eq("id", data.id)
        .maybeSingle();
      const tenant = (t as { tenants: TenantBrandRow | null } | null)?.tenants ?? null;
      brand = brandFromTenant(tenant);
    } catch {
      // mantém a marca padrão
    }

    return {
      ok: true as const,
      tag: {
        id: tag.id,
        name: tag.name,
        destination_type: tag.destination_type,
        destination: (tag.destination ?? {}) as Record<string, string>,
      },
      landing: lp,
      brand,
    };
  });
