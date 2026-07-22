import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseUA } from "./user-agent";

function isNewSupabaseApiKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}

function serverPublicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (isNewSupabaseApiKey(key) && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Resolve a tag by public id, log the read, and return the redirect target. */
export const resolveTag = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; referrer?: string | null }) => d)
  .handler(async ({ data }) => {
    const supabase = serverPublicClient();

    const { data: tag, error } = await supabase
      .from("tags")
      .select("id, status, destination_type, destination")
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!tag) return { ok: false as const, reason: "not_found" as const };
    if (tag.status !== "active")
      return { ok: false as const, reason: "inactive" as const };

    const req = getRequest();
    const headers = req?.headers;
    const ua = headers?.get("user-agent") ?? "";
    const country = headers?.get("cf-ipcountry") ?? headers?.get("x-vercel-ip-country") ?? null;
    const city = headers?.get("cf-ipcity") ?? null;
    const ip =
      headers?.get("cf-connecting-ip") ??
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const { os, browser, device } = parseUA(ua);

    // fire-and-forget insert; do not block redirect on failure
    await supabase.from("reads").insert({
      tag_id: tag.id,
      ip,
      country,
      city,
      os,
      browser,
      device,
      referrer: data.referrer ?? null,
      user_agent: ua,
    });

    // Update denormalized counter (best-effort; RLS blocks anon UPDATE — ok)
    return {
      ok: true as const,
      destination_type: tag.destination_type,
      destination: (tag.destination ?? {}) as Record<string, string>,
    };
  });
