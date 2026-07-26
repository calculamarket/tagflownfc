import { normalizeDestinationUrl } from "./destination";

/** One option of a "Menu de links" page. Stored (JSON-encoded) in the tag's
 *  destination so no extra table is needed. */
export type LinkItem = {
  type: LinkItemType;
  label: string;
  value?: string; // url / @user / phone / e-mail / chave PIX / endereço
  message?: string; // WhatsApp
  // PIX extras
  name?: string;
  city?: string;
  amount?: string;
};

export type LinkItemType =
  | "instagram"
  | "whatsapp"
  | "pix"
  | "url"
  | "phone"
  | "email"
  | "menu"
  | "maps"
  | "ifood"
  | "catalog"
  | "schedule"
  | "reviews"
  | "facebook"
  | "youtube"
  | "tiktok";

type TypeMeta = { type: LinkItemType; label: string; placeholder: string; icon: string };

export const LINK_ITEM_TYPES: TypeMeta[] = [
  { type: "instagram", label: "Instagram", placeholder: "@seu_usuario", icon: "📸" },
  { type: "whatsapp", label: "WhatsApp", placeholder: "5511999999999", icon: "💬" },
  { type: "pix", label: "PIX", placeholder: "chave PIX", icon: "💠" },
  { type: "menu", label: "Cardápio", placeholder: "link ou PDF do cardápio", icon: "🍽️" },
  { type: "ifood", label: "iFood", placeholder: "https://ifood.com.br/…", icon: "🍔" },
  { type: "maps", label: "Localização", placeholder: "endereço ou link do mapa", icon: "📍" },
  { type: "catalog", label: "Catálogo", placeholder: "link ou PDF do catálogo", icon: "📖" },
  { type: "schedule", label: "Agendamento", placeholder: "link para agendar", icon: "📅" },
  { type: "reviews", label: "Avaliação (Google)", placeholder: "link de avaliação", icon: "⭐" },
  { type: "url", label: "Site / Link", placeholder: "https://…", icon: "🔗" },
  { type: "facebook", label: "Facebook", placeholder: "link do Facebook", icon: "👍" },
  { type: "youtube", label: "YouTube", placeholder: "link do canal/vídeo", icon: "▶️" },
  { type: "tiktok", label: "TikTok", placeholder: "@usuario ou link", icon: "🎵" },
  { type: "phone", label: "Telefone", placeholder: "5511999999999", icon: "📞" },
  { type: "email", label: "E-mail", placeholder: "contato@exemplo.com", icon: "✉️" },
];

const META = new Map(LINK_ITEM_TYPES.map((t) => [t.type, t]));

/** Default visible label when the owner leaves it blank. */
export function defaultLabel(type: LinkItemType): string {
  return META.get(type)?.label ?? "Link";
}

export function itemIcon(type: LinkItemType): string {
  return META.get(type)?.icon ?? "🔗";
}

/** These accept a file (PDF/image) as their value, so the editor offers upload. */
export function usesFileUpload(type: LinkItemType): boolean {
  return type === "menu" || type === "catalog";
}

/**
 * These hand control to an app (WhatsApp, dialer, mail client). They must open
 * in the SAME tab: a target="_blank" tab is left blank when the app takes over
 * and gets auto-closed by the browser before the user can tap "Abrir".
 */
export function opensInApp(type: LinkItemType): boolean {
  return type === "whatsapp" || type === "phone" || type === "email";
}

/** Ready-made option sets per business segment. */
export const LINK_PRESETS: { label: string; items: LinkItem[] }[] = [
  {
    label: "Loja",
    items: [
      { type: "instagram", label: "" },
      { type: "whatsapp", label: "" },
      { type: "pix", label: "" },
      { type: "url", label: "Site" },
    ],
  },
  {
    label: "Restaurante",
    items: [
      { type: "menu", label: "" },
      { type: "ifood", label: "" },
      { type: "whatsapp", label: "Pedidos" },
      { type: "maps", label: "Como chegar" },
      { type: "instagram", label: "" },
    ],
  },
  {
    label: "Imobiliária",
    items: [
      { type: "catalog", label: "Imóveis" },
      { type: "whatsapp", label: "Falar com corretor" },
      { type: "schedule", label: "Agendar visita" },
      { type: "instagram", label: "" },
      { type: "url", label: "Site" },
    ],
  },
  {
    label: "Serviços",
    items: [
      { type: "whatsapp", label: "" },
      { type: "schedule", label: "Agendar" },
      { type: "maps", label: "Localização" },
      { type: "instagram", label: "" },
    ],
  },
];

/** Read the items array back from the tag's destination JSON. */
export function parseLinkItems(destination: Record<string, unknown>): LinkItem[] {
  const raw = destination?.items;
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.filter((i) => i && typeof i === "object") as LinkItem[];
  } catch {
    return [];
  }
}

/**
 * Where a tapped item should go. PIX returns "" — it is handled inline on the
 * page (expands to show the QR + copy) rather than navigating away.
 */
export function linkItemHref(item: LinkItem): string {
  const v = (item.value ?? "").trim();
  switch (item.type) {
    case "instagram": {
      if (!v) return "";
      if (/^https?:\/\//i.test(v)) return v;
      return `https://instagram.com/${v.replace(/^@/, "")}`;
    }
    case "tiktok": {
      if (!v) return "";
      if (/^https?:\/\//i.test(v)) return v;
      return `https://tiktok.com/@${v.replace(/^@/, "")}`;
    }
    case "whatsapp": {
      const phone = v.replace(/\D/g, "");
      if (!phone) return "";
      const msg = (item.message ?? "").trim();
      return `https://wa.me/${phone}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
    }
    case "phone":
      return v ? `tel:${v.replace(/\s/g, "")}` : "";
    case "email":
      return v ? `mailto:${v}` : "";
    case "maps": {
      if (!v) return "";
      if (/^https?:\/\//i.test(v)) return v;
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
    }
    case "pix":
      return "";
    // Plain links (owner pastes a URL, or uploads a file for menu/catalog).
    case "url":
    case "menu":
    case "ifood":
    case "catalog":
    case "schedule":
    case "reviews":
    case "facebook":
    case "youtube":
      return normalizeDestinationUrl(v);
  }
}
