import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DestinationTypeEnum = z.enum([
  "url","whatsapp","instagram","facebook","tiktok","youtube",
  "pdf","pix","wifi","phone","email","landing_page",
  "mercadolivre","shopee","amazon",
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
    const { error } = await context.supabase
      .from("tags")
      .upsert({ ...data, user_id: context.userId }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tags").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [tagsRes, todayRes, monthRes, totalRes, recentRes, dailyRes] = await Promise.all([
      supabase.from("tags").select("id, status", { count: "exact", head: false }).eq("user_id", userId),
      supabase.rpc as unknown as never, // placeholder no-op
      null as never, null as never, null as never, null as never,
    ]).catch(() => [null, null, null, null, null, null] as const);

    // Simpler approach — sequential queries
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
