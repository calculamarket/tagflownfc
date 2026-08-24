import { BRAND, type Brand } from "./brand";

/** Subconjunto de colunas de um tenant que definem a marca. */
export type TenantBrandRow = {
  name: string;
  monogram: string;
  tagline: string;
  powered_by: boolean;
  support_email: string | null;
  primary_color?: string | null;
  logo_url?: string | null;
};

/** Colunas de marca a selecionar no banco (usado por getMyBrand/getPublicView). */
export const BRAND_COLS = "name, monogram, tagline, powered_by, support_email, primary_color, logo_url";

/** Converte a linha de um tenant na marca usada pela UI, caindo nos padrões
 *  (BRAND) quando o tenant não existe ou tem campos vazios. */
export function brandFromTenant(t: TenantBrandRow | null | undefined): Brand {
  if (!t) return BRAND;
  return {
    name: t.name || BRAND.name,
    monogram: t.monogram || BRAND.monogram,
    tagline: t.tagline || BRAND.tagline,
    poweredBy: t.powered_by,
    supportEmail: t.support_email || BRAND.supportEmail,
    primaryColor: t.primary_color || null,
    logoUrl: t.logo_url || null,
  };
}

/**
 * Aplica (ou limpa) a cor primária do tenant sobrescrevendo os tokens CSS.
 * Só roda no cliente. `--primary` é uma cor CSS completa, então o hex do
 * revendedor entra direto.
 */
export function applyBrandTheme(brand: Brand): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const c = brand.primaryColor?.trim();
  if (c) {
    root.style.setProperty("--primary", c);
    root.style.setProperty("--sidebar-primary", c);
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--sidebar-primary");
  }
}

/**
 * Extrai o subdomínio de um host: "marca.dominio.com.br" -> "marca".
 * Retorna null para apex, www, app, localhost e IPs. Preparado para a fase de
 * infra (subdomínios por tenant); hoje o host é único e isto devolve null.
 */
export function subdomainOf(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.split(":")[0].toLowerCase();
  if (h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
  const parts = h.split(".");
  if (parts.length < 3) return null; // precisa de sub.dominio.tld
  const sub = parts[0];
  if (sub === "www" || sub === "app") return null;
  return sub;
}
