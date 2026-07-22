// Server-only webhook dispatcher.
// SECURITY: imports the service-role admin client, so this module must never be
// imported from route files or *.functions.ts at top level (those ship to the
// client bundle). Load it lazily inside a server handler:
//   const { deliverWebhooks } = await import("./webhook-delivery.server");
import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";

type WebhookEvent = Database["public"]["Enums"]["webhook_event"];
type WebhookTarget = { id: string; url: string; secret: string };

// How many times to attempt a single delivery (1 initial + retries) and the
// backoff between attempts. Kept short so awaited callers (tag create/update)
// are never blocked for long; endpoints down for longer are handled by the
// manual "resend" action in the UI.
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1500];
const TIMEOUT_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Only transient failures are worth retrying: network errors, 429 and 5xx. */
function isRetryable(statusCode: number | null): boolean {
  if (statusCode === null) return true; // network / timeout error
  return statusCode === 429 || statusCode >= 500;
}

/**
 * Deliver a single payload to one webhook, with signed body + bounded retry,
 * then log the final attempt to `webhook_deliveries`.
 */
async function dispatchOne(
  hook: WebhookTarget,
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const deliveredAt = new Date().toISOString();
  const body = JSON.stringify({ event, delivered_at: deliveredAt, data });
  const signature = createHmac("sha256", hook.secret).update(body).digest("hex");

  let statusCode: number | null = null;
  let ok = false;
  let errorMessage: string | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    attempts = attempt + 1;
    statusCode = null;
    errorMessage = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tagflow-event": event,
          "x-tagflow-signature": `sha256=${signature}`,
          "x-tagflow-attempt": String(attempts),
        },
        body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      statusCode = res.status;
      ok = res.ok;
      if (!ok) errorMessage = res.statusText || `HTTP ${res.status}`;
    } catch (e) {
      errorMessage = (e as Error).message;
    }

    if (ok || !isRetryable(statusCode)) break;
    if (attempt < MAX_ATTEMPTS - 1) await sleep(BACKOFF_MS[attempt] ?? 1500);
  }

  await supabaseAdmin.from("webhook_deliveries").insert({
    webhook_id: hook.id,
    user_id: userId,
    event,
    url: hook.url,
    payload: { event, delivered_at: deliveredAt, data, attempts } as unknown as Json,
    status_code: statusCode,
    ok,
    error: errorMessage,
  });
}

/**
 * Fire all active webhooks a user has registered for `event`. Never throws —
 * failures are captured per webhook so the caller is never blocked by a bad
 * endpoint.
 */
export async function deliverWebhooks(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: hooks, error } = await supabaseAdmin
      .from("webhooks")
      .select("id, url, secret")
      .eq("user_id", userId)
      .eq("event", event)
      .eq("active", true);

    if (error || !hooks?.length) return;

    await Promise.all(hooks.map((hook) => dispatchOne(hook, userId, event, data)));
  } catch {
    // Swallow: webhook delivery must never break the primary operation.
  }
}

/**
 * Fire webhooks for a tag event when only the tag id is known (e.g. the public
 * redirector, where anon has no column-level access to tags.user_id). Resolves
 * the owner via the service role, then fans out. Never throws.
 */
export async function deliverWebhooksForTag(
  tagId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: tag } = await supabaseAdmin
      .from("tags")
      .select("user_id")
      .eq("id", tagId)
      .maybeSingle();
    if (!tag) return;
    await deliverWebhooks(tag.user_id, event, data);
  } catch {
    // Swallow: webhook delivery must never break the redirect.
  }
}

/**
 * Re-send a past delivery (manual "resend" from the UI). Re-uses the original
 * payload data and the webhook's current secret; logs a fresh delivery row.
 * Throws with a user-facing message on validation errors.
 */
export async function redeliverDelivery(userId: string, deliveryId: string): Promise<void> {
  const { data: delivery, error } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id, user_id, webhook_id, event, payload")
    .eq("id", deliveryId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!delivery || delivery.user_id !== userId) throw new Error("Entrega não encontrada.");

  const { data: hook } = await supabaseAdmin
    .from("webhooks")
    .select("id, url, secret")
    .eq("id", delivery.webhook_id)
    .maybeSingle();

  if (!hook) throw new Error("O webhook desta entrega não existe mais.");

  const stored = (delivery.payload ?? {}) as { data?: Record<string, unknown> };
  const data = stored.data ?? {};
  await dispatchOne(hook, userId, delivery.event, data);
}
