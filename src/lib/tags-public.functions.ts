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

    // NB: anon has column-level SELECT on tags (no user_id). The tag owner for
    // webhook firing is resolved server-side via the service role below.
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

    // A/B test: choose a variant server-side and route to its URL, so the
    // variant can be recorded on the read for later analysis.
    const dest = (tag.destination ?? {}) as Record<string, string>;
    let variant: string | null = null;
    let effectiveDestination = dest;
    if (tag.destination_type === "ab_test") {
      const weightA = Math.min(100, Math.max(0, parseFloat(dest.weight_a ?? "50") || 50));
      const pickA = Math.random() * 100 < weightA;
      variant = pickA ? "A" : "B";
      effectiveDestination = { url: (pickA ? dest.url_a : dest.url_b) ?? "" };
    }

    // Record the read (awaited so analytics stay accurate).
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
      variant,
    });

    // Fire tag.read webhooks without blocking the redirect. The admin client
    // lives in a server-only module, loaded lazily so it never reaches the
    // client bundle; it also resolves the tag owner via the service role.
    void import("./webhook-delivery.server").then(({ deliverWebhooksForTag }) =>
      deliverWebhooksForTag(tag.id, "tag.read", {
        id: tag.id,
        country,
        city,
        os,
        browser,
        device,
        referrer: data.referrer ?? null,
      }),
    );

    return {
      ok: true as const,
      destination_type: tag.destination_type,
      destination: effectiveDestination,
    };
  });
