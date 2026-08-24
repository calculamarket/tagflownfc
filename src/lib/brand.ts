// Configuração central da marca — fonte única de verdade para nome/marcas do
// white-label.
//
// Fase 0: uma marca estática. Fase 1 (multi-tenant) vai resolver isto por
// requisição, a partir do subdomínio, e injetar via contexto. Por isso TODO
// texto de marca deve vir daqui — assim a troca por tenant é uma mudança de um
// arquivo só, não uma caça a strings espalhadas pelo código.

export type Brand = {
  name: string; // "3D QR"
  monogram: string; // selo quadrado do menu, ex.: "3D"
  tagline: string;
  poweredBy: boolean; // mostrar "Powered by <name>" nas páginas públicas
  supportEmail: string;
  primaryColor?: string | null; // cor primária do tenant (sobrescreve o tema)
  logoUrl?: string | null; // logo do tenant (substitui o selo no menu)
};

export const BRAND: Brand = {
  name: "3D QR",
  monogram: "3D",
  tagline: "QR Codes em impressão 3D, reconfiguráveis",
  poweredBy: true,
  supportEmail: "contato@3dqr.com.br",
  primaryColor: null,
  logoUrl: null,
};

/** Título de aba padronizado: "Seção · Marca" (ou só a marca). */
export function pageTitle(section?: string): string {
  return section ? `${section} · ${BRAND.name}` : BRAND.name;
}
