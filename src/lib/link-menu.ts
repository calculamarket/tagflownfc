import { normalizeDestinationUrl } from "./destination";

/** One option of a "Menu de links" page. Stored (JSON-encoded) in the tag's
 *  destination so no extra table is needed. */
export type LinkItem = {
  type: LinkItemType;
  label: string;
  value?: string; // url / @user / phone / e-mail / chave PIX
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
  | "email";

export const LINK_ITEM_TYPES: { type: LinkItemType; label: string; placeholder: string }[] = [
  { type: "instagram", label: "Instagram", placeholder: "@seu_usuario" },
  { type: "whatsapp", label: "WhatsApp", placeholder: "5511999999999" },
  { type: "pix", label: "PIX", placeholder: "chave PIX" },
  { type: "url", label: "Site / Link", placeholder: "https://…" },
  { type: "phone", label: "Telefone", placeholder: "5511999999999" },
  { type: "email", label: "E-mail", placeholder: "contato@exemplo.com" },
];

/** Default visible label when the owner leaves it blank. */
export function defaultLabel(type: LinkItemType): string {
  return LINK_ITEM_TYPES.find((t) => t.type === type)?.label ?? "Link";
}

/** Read the items array back from the tag's destination JSON. Tolerant of the
 *  string-encoded form used by the editor and of a raw array. */
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
    case "url":
      return normalizeDestinationUrl(v);
    case "pix":
      return "";
  }
}
