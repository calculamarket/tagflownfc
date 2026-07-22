import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { parseUA } from "./user-agent";

/**
 * Resolve a tag by public id, enforce access guards, log the read, and return
 * the redirect target. Runs server-side with the service role so it can read
 * owner-only guard columns (scan limit, schedule, password) that anon cannot —
 * only sanitized data (the final destination) is ever returned to the client.
 */
export const resolveTag = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; referrer?: string | null; password?: string | null }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tag, error } = await supabaseAdmin
      .from("tags")
      .select(
        "id, user_id, status, destination_type, destination, activate_at, expire_at, max_scans, access_password",
      )
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!tag) return { ok: false as const, reason: "not_found" as const };
    if (tag.status !== "active") return { ok: false as const, reason: "inactive" as const };

    const now = Date.now();
    if (tag.activate_at && now < new Date(tag.activate_at).getTime())
      return { ok: false as const, reason: "scheduled" as const };
    if (tag.expire_at && now > new Date(tag.expire_at).getTime())
      return { ok: false as const, reason: "expired" as const };

    // Scan limit: count prior reads before logging this one.
    if (tag.max_scans && tag.max_scans > 0) {
      const { count } = await supabaseAdmin
        .from("reads")
        .select("id", { count: "exact", head: true })
        .eq("tag_id", tag.id);
      if ((count ?? 0) >= tag.max_scans)
        return { ok: false as const, reason: "limit_reached" as const };
    }

    // Password gate (soft): require the correct password before revealing the destination.
    if (tag.access_password) {
      if (!data.password) return { ok: false as const, reason: "password_required" as const };
      if (data.password !== tag.access_password)
        return { ok: false as const, reason: "password_incorrect" as const };
    }

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
    await supabaseAdmin.from("reads").insert({
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

    // Fire tag.read webhooks without blocking the redirect.
    void import("./webhook-delivery.server").then(({ deliverWebhooks }) =>
      deliverWebhooks(tag.user_id, "tag.read", {
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
