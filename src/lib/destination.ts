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
};

export function buildDestinationUrl(
  type: DestinationType,
  payload: Record<string, unknown>,
  fallbackTagId: string,
): string {
  const v = (k: string) => String(payload[k] ?? "").trim();

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
      return v("url");
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
    case "pix":
    case "wifi":
    case "landing_page":
      return `/t/${fallbackTagId}/view`;
  }
}
