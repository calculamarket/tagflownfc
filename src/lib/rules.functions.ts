import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ConditionType = z.enum(["device", "country", "time", "scan_count"]);

const ruleSchema = z.object({
  id: z.string().uuid().optional(),
  tag_id: z.string().min(1),
  priority: z.number().int().default(0),
  condition_type: ConditionType,
  condition_value: z.record(z.string(), z.any()).default({}),
  destination_url: z.string().url().max(2000),
});

export const listRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tagId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tag_rules")
      .select("*")
      .eq("tag_id", data.tagId)
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ruleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tag_rules")
      .upsert({ ...data, user_id: context.userId }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tag_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
