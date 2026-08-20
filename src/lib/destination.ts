import type { Database } from "@/integrations/supabase/types";

export type DestinationType = Database["public"]["Enums"]["destination_type"];

export const DESTINATION_LABELS: Record<DestinationType, string> = {
  url: "URL",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  pdf: "PDF",
  pix: "PIX",
  wifi: "Wi-Fi",
  phone: "Telefone",
  email: "E-mail",
  landing_page: "Landing Page",
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  vcard: "Cartão de contato (vCard)",
  review_gate: "Avaliação inteligente",
  ab_test: "Teste A/B",
  links: "Menu de links (link na bio)",
  promo: "Promoção (vitrine de ofertas)",
  emergency: "Emergência / Se encontrado",
};

/** Drop control characters: browsers strip them, so "java\nscript:" would
 *  otherwise sneak past the scheme check below. */
function stripControlChars(value: string): string {
  return Array.from(value)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("");
}

/**
 * Normalize a destination typed by the user before it reaches
 * `window.location` or an `href`.
 *
 * - `http://` and `https://` are both accepted as-is.
 * - A bare domain (`site.com`, `www.site.com:8080/x`) gets `https://` prepended;
 *   without it the browser treats the value as a relative path and lands on
 *   `/t/site.com` instead of leaving the site.
 * - Anything declaring another scheme (`javascript:`, `data:`, `file:` …) is
 *   rejected. Destinations are user-controlled, so navigating to them blindly
 *   would be an XSS vector.
 *
 * Returns "" when the value is unusable, which callers treat as "not found".
 */
export function normalizeDestinationUrl(raw: string): string {
  const s = stripControlChars(String(raw ?? "")).trim();
  if (!s) return "";

  const lower = s.toLowerCase();
  if (/^(https?:\/\/|mailto:|tel:)/.test(lower)) return s;
  if (s.startsWith("//")) return `https:${s}`; // protocol-relative
  if (s.startsWith("/")) return s; // internal path, e.g. /t/abc/view

  // A colon *not* followed by a digit declares a scheme (javascript:, data:…).
  // A colon followed by digits is just a port (site.com:8080), which is fine.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(lower)) return "";

  return `https://${s}`;
}

export function buildDestinationUrl(
  type: DestinationType,
  payload: Record<string, unknown>,
  fallbackTagId: string,
): string {
  const v = (k: string) => String(payload[k] ?? "").trim();
  const url = (k: string) => normalizeDestinationUrl(v(k));

  switch (type) {
    case "url":
    case "instagram":
    case "facebook":
    case "tiktok":
    case "youtube":
    case "pdf":
    case "mercadolivre":
    case "shopee":
    case "amazon":
      return url("url");
    case "whatsapp": {
      const phone = v("phone").replace(/\D/g, "");
      const msg = encodeURIComponent(v("message"));
      return `https://wa.me/${phone}${msg ? `?text=${msg}` : ""}`;
    }
    case "phone":
      return `tel:${v("phone").replace(/\s/g, "")}`;
    case "email": {
      const subj = encodeURIComponent(v("subject"));
      return `mailto:${v("email")}${subj ? `?subject=${subj}` : ""}`;
    }
    case "ab_test":
      // The chosen variant URL is injected server-side into payload.url.
      return url("url");
    case "pix":
    case "wifi":
    case "landing_page":
    case "vcard":
    case "review_gate":
    case "links":
    case "promo":
    case "emergency":
      return `/t/${fallbackTagId}/view`;
  }
}
