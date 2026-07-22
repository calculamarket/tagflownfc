import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const EventEnum = z.enum(["tag.read", "tag.created", "tag.updated"]);

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().url().max(500),
  event: EventEnum,
  active: z.boolean().default(true),
});

export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("webhooks").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    const { error } = await context.supabase
      .from("webhooks")
      .upsert(row, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("webhooks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: wh, error } = await context.supabase
      .from("webhooks").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!wh) throw new Error("Webhook não encontrado");

    try {
      const res = await fetch(wh.url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tagflow-event": wh.event },
        body: JSON.stringify({
          event: wh.event,
          test: true,
          delivered_at: new Date().toISOString(),
          data: { message: "Teste de webhook TagFlow" },
        }),
      });
      return { ok: true, status: res.status };
    } catch (e) {
      return { ok: false, status: 0, error: (e as Error).message };
    }
  });
