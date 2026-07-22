import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const buttonSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
  style: z.enum(["primary", "secondary"]).default("primary"),
});

const landingSchema = z.object({
  tag_id: z.string().min(1),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  buttons: z.array(buttonSchema).default([]),
});

export type LandingButton = z.infer<typeof buttonSchema>;

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
    return {
      ok: true as const,
      tag: {
        id: tag.id,
        name: tag.name,
        destination_type: tag.destination_type,
        destination: (tag.destination ?? {}) as Record<string, string>,
      },
      landing: lp,
    };
  });
