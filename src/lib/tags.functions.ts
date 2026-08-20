import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolvePlanUsage } from "./plans";
import { z } from "zod";

const DestinationTypeEnum = z.enum([
  "url","whatsapp","instagram","facebook","tiktok","youtube",
  "pdf","pix","wifi","phone","email","landing_page",
  "mercadolivre","shopee","amazon",
  "vcard","review_gate","ab_test","links","promo","emergency",
]);

const TagStatusEnum = z.enum(["active","paused","archived"]);

const upsertSchema = z.object({
  id: z.string().min(4).max(32),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
  status: TagStatusEnum,
  destination_type: DestinationTypeEnum,
  destination: z.record(z.string(), z.any()).default({}),
  qr_style: z.record(z.string(), z.string()).default({}),
  max_scans: z.number().int().positive().nullable().optional(),
  activate_at: z.string().nullable().optional(),
  expire_at: z.string().nullable().optional(),
  access_password: z.string().max(100).nullable().optional(),
});

export const listTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tags").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getTag = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: tag, error } = await context.supabase
      .from("tags").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return tag;
  });

export const upsertTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Distinguish create vs update to enforce plan limits and pick the event.
    const { data: existing } = await supabase
      .from("tags").select("id").eq("id", data.id).maybeSingle();
    const isCreate = !existing;

    if (isCreate) {
      const { plan, used } = await resolvePlanUsage(supabase, userId);
      if (used >= plan.max_tags) {
        throw new Error(
          `Limite do plano ${plan.name} atingido (${plan.max_tags} tags). Faça upgrade para criar mais.`,
        );
      }
    }

    const { error } = await supabase
      .from("tags")
      .upsert({ ...data, user_id: userId }, { onConflict: "id" });
    if (error) throw new Error(error.message);

    // Fire the matching webhook event (server-only helper, loaded lazily).
    const { deliverWebhooks } = await import("./webhook-delivery.server");
    await deliverWebhooks(userId, isCreate ? "tag.created" : "tag.updated", {
      id: data.id,
      name: data.name,
      status: data.status,
      destination_type: data.destination_type,
    });

    return { ok: true, created: isCreate };
  });

/** Public id allowed in URLs: letters, digits, hyphen and underscore. */
const tagIdSchema = z
  .string()
  .trim()
  .min(4)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "Use apenas letras, números, hífen e underline.");

/**
 * Rename a tag's public id. Child rows (reads, landing_pages, tag_rules) follow
 * via ON UPDATE CASCADE, so analytics history and rules are preserved.
 */
export const renameTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ oldId: tagIdSchema, newId: tagIdSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.oldId === data.newId) return { ok: true, id: data.newId };

    const { data: tag } = await supabase
      .from("tags")
      .select("id, name, status, destination_type, claim_code")
      .eq("id", data.oldId)
      .maybeSingle();
    if (!tag) throw new Error("Tag não encontrada.");

    // A pre-printed piece carries its id on the physical QR and NFC tag, so
    // renaming would silently brick it. Enforced here, not just in the UI.
    if (tag.claim_code) {
      throw new Error(
        "Esta é uma peça impressa: o ID está gravado no QR e na etiqueta NFC e não pode ser alterado.",
      );
    }

    const { error } = await supabase
      .from("tags")
      .update({ id: data.newId })
      .eq("id", data.oldId);

    if (error) {
      // 23505 = unique/PK violation: the id belongs to some tag (possibly
      // another user's). Keep the message generic so it never leaks existence.
      if (error.code === "23505") throw new Error("Esse ID já está em uso. Escolha outro.");
      throw new Error(error.message);
    }

    const { deliverWebhooks } = await import("./webhook-delivery.server");
    await deliverWebhooks(userId, "tag.updated", {
      id: data.newId,
      previous_id: data.oldId,
      name: tag.name,
      status: tag.status,
      destination_type: tag.destination_type,
    });

    return { ok: true, id: data.newId };
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tags").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) => {
    if (!Array.isArray(d?.ids) || d.ids.length === 0) throw new Error("Selecione ao menos uma tag.");
    return { ids: d.ids.slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    // RLS already scopes deletes to the caller's own tags.
    const { error } = await context.supabase.from("tags").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const tags = await supabase.from("tags").select("id, status").eq("user_id", userId);
    const tagIds = (tags.data ?? []).map((t) => t.id);

    if (tagIds.length === 0) {
      return {
        total_tags: 0, active_tags: 0,
        reads_today: 0, reads_month: 0, reads_total: 0,
        recent: [], daily: [],
      };
    }

    const startToday = new Date(); startToday.setHours(0,0,0,0);
    const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0,0,0,0);
    const start30 = new Date(Date.now() - 29 * 86400_000); start30.setHours(0,0,0,0);

    const [{ count: total }, { count: today }, { count: month }, { data: recent }, { data: last30 }] =
      await Promise.all([
        supabase.from("reads").select("id", { count: "exact", head: true }).in("tag_id", tagIds),
        supabase.from("reads").select("id", { count: "exact", head: true }).in("tag_id", tagIds).gte("created_at", startToday.toISOString()),
        supabase.from("reads").select("id", { count: "exact", head: true }).in("tag_id", tagIds).gte("created_at", startMonth.toISOString()),
        supabase.from("reads").select("id, tag_id, created_at, country, city, device, browser, os").in("tag_id", tagIds).order("created_at", { ascending: false }).limit(10),
        supabase.from("reads").select("created_at").in("tag_id", tagIds).gte("created_at", start30.toISOString()),
      ]);

    // Bucket by day
    const bucket = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start30.getTime() + i * 86400_000);
      bucket.set(d.toISOString().slice(0,10), 0);
    }
    for (const r of last30 ?? []) {
      const k = new Date(r.created_at).toISOString().slice(0,10);
      bucket.set(k, (bucket.get(k) ?? 0) + 1);
    }
    const daily = Array.from(bucket.entries()).map(([date, count]) => ({ date, count }));

    return {
      total_tags: tags.data?.length ?? 0,
      active_tags: (tags.data ?? []).filter(t => t.status === "active").length,
      reads_today: today ?? 0,
      reads_month: month ?? 0,
      reads_total: total ?? 0,
      recent: recent ?? [],
      daily,
    };
  });
