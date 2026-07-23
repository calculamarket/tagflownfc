import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const rangeSchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
  tagId: z.string().optional().nullable(),
});

export const analyticsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tags = await supabase.from("tags").select("id, name").eq("user_id", userId);
    const allIds = (tags.data ?? []).map((t) => t.id);
    const scoped = data.tagId ? [data.tagId].filter((id) => allIds.includes(id)) : allIds;

    const empty = {
      tags: tags.data ?? [],
      totals: { reads: 0, unique_days: 0 },
      daily: [] as { date: string; count: number }[],
      by_country: [] as { key: string; count: number }[],
      by_city: [] as { key: string; count: number }[],
      by_device: [] as { key: string; count: number }[],
      by_browser: [] as { key: string; count: number }[],
      by_os: [] as { key: string; count: number }[],
      by_referrer: [] as { key: string; count: number }[],
      by_variant: [] as { key: string; count: number }[],
      by_source: [] as { key: string; count: number }[],
      recent: [] as Array<{
        id: number; tag_id: string; created_at: string;
        country: string | null; city: string | null;
        device: string | null; browser: string | null; os: string | null;
      }>,
    };
    if (scoped.length === 0) return empty;

    const start = new Date(Date.now() - (data.days - 1) * 86400_000);
    start.setHours(0, 0, 0, 0);

    const [{ data: reads }, { data: recent }] = await Promise.all([
      supabase
        .from("reads")
        .select("created_at, country, city, device, browser, os, referrer, variant, source")
        .in("tag_id", scoped)
        .gte("created_at", start.toISOString()),
      supabase
        .from("reads")
        .select("id, tag_id, created_at, country, city, device, browser, os")
        .in("tag_id", scoped)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const list = reads ?? [];
    const bucket = new Map<string, number>();
    for (let i = 0; i < data.days; i++) {
      const d = new Date(start.getTime() + i * 86400_000);
      bucket.set(d.toISOString().slice(0, 10), 0);
    }
    const tally = (key: keyof (typeof list)[number], fallback = "—") => {
      const m = new Map<string, number>();
      for (const r of list) {
        const raw = (r as Record<string, unknown>)[key as string];
        const v = (typeof raw === "string" && raw.trim()) ? raw : fallback;
        m.set(v, (m.get(v) ?? 0) + 1);
      }
      return Array.from(m.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    };
    for (const r of list) {
      const k = new Date(r.created_at).toISOString().slice(0, 10);
      if (bucket.has(k)) bucket.set(k, (bucket.get(k) ?? 0) + 1);
    }

    return {
      tags: tags.data ?? [],
      totals: {
        reads: list.length,
        unique_days: Array.from(bucket.values()).filter((n) => n > 0).length,
      },
      daily: Array.from(bucket.entries()).map(([date, count]) => ({ date, count })),
      by_country: tally("country"),
      by_city: tally("city"),
      by_device: tally("device"),
      by_browser: tally("browser"),
      by_os: tally("os"),
      by_referrer: tally("referrer", "direto"),
      // Only rows from A/B tags carry a variant; ignore the rest.
      by_variant: (() => {
        const m = new Map<string, number>();
        for (const r of list) {
          const v = (r as { variant?: string | null }).variant;
          if (v) m.set(v, (m.get(v) ?? 0) + 1);
        }
        return Array.from(m.entries())
          .map(([key, count]) => ({ key, count }))
          .sort((a, b) => a.key.localeCompare(b.key));
      })(),
      // Reads written by the NFC tag carry ?s=nfc. Everything else is a QR scan
      // or a direct visit, which we can't tell apart — labelled honestly.
      by_source: (() => {
        const labels: Record<string, string> = { nfc: "NFC", qr: "QR Code" };
        const m = new Map<string, number>();
        for (const r of list) {
          const raw = (r as { source?: string | null }).source;
          const key = raw ? labels[raw] ?? raw : "QR / link direto";
          m.set(key, (m.get(key) ?? 0) + 1);
        }
        return Array.from(m.entries())
          .map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count);
      })(),
      recent: recent ?? [],
    };
  });
