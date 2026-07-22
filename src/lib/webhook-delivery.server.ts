// Server-only webhook dispatcher.
// SECURITY: imports the service-role admin client, so this module must never be
// imported from route files or *.functions.ts at top level (those ship to the
// client bundle). Load it lazily inside a server handler:
//   const { deliverWebhooks } = await import("./webhook-delivery.server");
import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";

type WebhookEvent = Database["public"]["Enums"]["webhook_event"];

/**
 * Fire all active webhooks a user has registered for `event`.
 * Each delivery is signed (HMAC-SHA256 over the raw JSON body) and logged to
 * `webhook_deliveries`. Never throws — failures are captured per webhook so the
 * caller (tag creation, redirect, ...) is never blocked by a bad endpoint.
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

    const deliveredAt = new Date().toISOString();

    await Promise.all(
      hooks.map(async (hook) => {
        const body = JSON.stringify({ event, delivered_at: deliveredAt, data });
        const signature = createHmac("sha256", hook.secret).update(body).digest("hex");

        let statusCode: number | null = null;
        let ok = false;
        let errorMessage: string | null = null;

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(hook.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-tagflow-event": event,
              "x-tagflow-signature": `sha256=${signature}`,
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

        await supabaseAdmin.from("webhook_deliveries").insert({
          webhook_id: hook.id,
          user_id: userId,
          event,
          url: hook.url,
          payload: { event, delivered_at: deliveredAt, data } as unknown as Json,
          status_code: statusCode,
          ok,
          error: errorMessage,
        });
      }),
    );
  } catch {
    // Swallow: webhook delivery must never break the primary operation.
  }
}
