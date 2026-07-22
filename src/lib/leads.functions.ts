import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const submitSchema = z.object({
  tag_id: z.string().min(1).max(32),
  name: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable(),
  message: z.string().trim().max(1000).optional().nullable(),
});

/**
 * Public lead submission from a landing page. Runs with the service role so the
 * owner (user_id) is resolved server-side from the tag — the client can never
 * forge it. Only accepts submissions for active tags.
 */
export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tag } = await supabaseAdmin
      .from("tags")
      .select("id, user_id, status")
      .eq("id", data.tag_id)
      .maybeSingle();

    if (!tag || tag.status !== "active") return { ok: false as const };

    if (!data.name && !data.email && !data.phone && !data.message)
      return { ok: false as const };

    const { error } = await supabaseAdmin.from("leads").insert({
      tag_id: tag.id,
      user_id: tag.user_id,
      name: data.name || null,
      email: data.email || null,
      phone: data.phone || null,
      message: data.message || null,
    });
    if (error) return { ok: false as const };

    return { ok: true as const };
  });

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tagId?: string | null }) => d ?? {})
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("leads")
      .select("id, tag_id, name, email, phone, message, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data?.tagId) query = query.eq("tag_id", data.tagId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
