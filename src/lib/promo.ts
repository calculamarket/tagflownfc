/** One product in a "Promoção" showcase. Stored (JSON-encoded) in the tag's
 *  destination, so no extra table is needed. */
export type PromoProduct = {
  name: string;
  description?: string;
  images?: string[]; // up to 3 URLs
  price_from?: string; // "de" (old price)
  price_to?: string; // "por" (promo price)
  coupon?: string;
  ends_at?: string; // ISO date the offer is valid until
};

export const MAX_PROMO_PRODUCTS = 3;
export const MAX_PROMO_IMAGES = 3;

/** Read the products array back from the tag's destination JSON. */
export function parsePromoProducts(destination: Record<string, unknown>): PromoProduct[] {
  const raw = destination?.products;
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return (arr.filter((p) => p && typeof p === "object") as PromoProduct[]).slice(
      0,
      MAX_PROMO_PRODUCTS,
    );
  } catch {
    return [];
  }
}

/** Format a user-typed amount ("99,90" / "99.90") as BRL; empty stays empty. */
export function formatBRL(value: string | undefined): string {
  const s = (value ?? "").trim();
  if (!s) return "";
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(n)) return s;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Offer status from its end date. */
export function promoStatus(endsAt: string | undefined): {
  state: "none" | "active" | "ended";
  text: string;
} {
  if (!endsAt) return { state: "none", text: "" };
  const end = new Date(`${endsAt}T23:59:59`);
  if (Number.isNaN(end.getTime())) return { state: "none", text: "" };
  const now = Date.now();
  if (now > end.getTime()) return { state: "ended", text: "Oferta encerrada" };

  const days = Math.ceil((end.getTime() - now) / 86400000);
  const dateStr = end.toLocaleDateString("pt-BR");
  const suffix =
    days <= 1 ? " · termina hoje" : days <= 7 ? ` · faltam ${days} dias` : "";
  return { state: "active", text: `Válido até ${dateStr}${suffix}` };
}
