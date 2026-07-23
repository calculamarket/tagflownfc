import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { parseUA } from "./user-agent";
import { ruleMatches, platformFromOs, nowMinutesInTz } from "./rules-eval";

/**
 * Resolve a tag by public id, enforce access guards, log the read, and return
 * the redirect target. Runs server-side with the service role so it can read
 * owner-only guard columns (scan limit, schedule, password) that anon cannot —
 * only sanitized data (the final destination) is ever returned to the client.
 */
/** Only these media are recorded; anything else becomes null so a crafted URL
 *  can't inject arbitrary values into the analytics breakdown. */
function normalizeSource(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().toLowerCase();
  return v === "nfc" || v === "qr" ? v : null;
}

export const resolveTag = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      referrer?: string | null;
      password?: string | null;
      source?: string | null;
    }) => d,
  )
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
    // A pre-generated stock piece has no owner yet: send the scanner to the
    // activation flow. Having an owner is the only signal that matters — tags
    // created in the panel have one immediately (and no claimed_at), so we must
    // NOT treat a missing claimed_at as unclaimed.
    if (!tag.user_id) return { ok: false as const, reason: "unclaimed" as const };
    const ownerId = tag.user_id; // narrowed; the closure below would widen it again
    if (tag.status !== "active") return { ok: false as const, reason: "inactive" as const };

    const now = Date.now();
    if (tag.activate_at && now < new Date(tag.activate_at).getTime())
      return { ok: false as const, reason: "scheduled" as const };
    if (tag.expire_at && now > new Date(tag.expire_at).getTime())
      return { ok: false as const, reason: "expired" as const };

    // Dynamic redirect rules for this tag (evaluated below, after we know the UA).
    const { data: rules } = await supabaseAdmin
      .from("tag_rules")
      .select("condition_type, condition_value, destination_url")
      .eq("tag_id", tag.id)
      .order("priority", { ascending: true });

    // Compute the read count once if any guard/rule needs it.
    const needsCount =
      (tag.max_scans != null && tag.max_scans > 0) ||
      (rules ?? []).some((r) => r.condition_type === "scan_count");
    let scanCount: number | null = null;
    if (needsCount) {
      const { count } = await supabaseAdmin
        .from("reads")
        .select("id", { count: "exact", head: true })
        .eq("tag_id", tag.id);
      scanCount = count ?? 0;
    }

    // Scan limit guard.
    if (tag.max_scans && tag.max_scans > 0 && (scanCount ?? 0) >= tag.max_scans)
      return { ok: false as const, reason: "limit_reached" as const };

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

    const dest = (tag.destination ?? {}) as Record<string, string>;
    let variant: string | null = null;
    let effectiveDestination = dest;
    let outType = tag.destination_type;

    // 1) Dynamic rules take precedence: first matching rule (by priority) wins.
    const ctx = {
      platform: platformFromOs(os),
      country,
      scanCount,
      nowMinutes: nowMinutesInTz("America/Sao_Paulo"),
    };
    const matched = (rules ?? []).find((r) =>
      ruleMatches(r.condition_type, (r.condition_value ?? {}) as Record<string, unknown>, ctx),
    );

    if (matched) {
      outType = "url";
      effectiveDestination = { url: matched.destination_url };
    } else if (tag.destination_type === "ab_test") {
      // 2) A/B test: choose a variant server-side and route to its URL.
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
      source: normalizeSource(data.source),
    });

    // Fire tag.read webhooks without blocking the redirect.
    void import("./webhook-delivery.server").then(({ deliverWebhooks }) =>
      deliverWebhooks(ownerId, "tag.read", {
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
      destination_type: outType,
      destination: effectiveDestination,
    };
  });
