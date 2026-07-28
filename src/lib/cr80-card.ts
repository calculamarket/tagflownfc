import QRCode from "qrcode";
import { toast } from "sonner";

// Template de cartão CR80 (padrão de cartão de crédito) com QR + símbolo NFC +
// frase. Impresso em folha A4, empacotando o máximo de cartões por página.
//
// Orientação retrato (54 × 85,6 mm), como o exemplo: NFC no topo, QR no meio,
// frase embaixo. A borda arredondada serve de guia de corte.

const CARD_W_MM = 54;
const CARD_H_MM = 85.6;
const CORNER_MM = 3.18; // raio de canto do CR80

export const DEFAULT_CR80_PHRASE = "Escaneie ou aproxime o seu celular.";

// Símbolo de aproximação (NFC/contactless): arcos concêntricos apontando para
// cima, desenhados em vetor para sair nítido em qualquer tamanho.
const NFC_SVG =
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
  `<g fill="none" stroke="#111111" stroke-width="9" stroke-linecap="round" transform="rotate(-90 50 50)">` +
  `<path d="M33 28 A 34 34 0 0 1 33 72"/>` +
  `<path d="M48 20 A 46 46 0 0 1 48 80"/>` +
  `<path d="M63 13 A 58 58 0 0 1 63 87"/>` +
  `</g></svg>`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Abre uma aba pronta para impressão com uma folha A4 de cartões CR80, um QR por
 * cartão. Cada QR codifica a mesma URL da peça física (`/t/{id}`).
 */
export async function openCr80Sheet(
  rows: { id: string }[],
  origin: string,
  opts?: { phrase?: string },
): Promise<void> {
  const phrase = (opts?.phrase ?? DEFAULT_CR80_PHRASE).trim();

  const qrDataUrls = await Promise.all(
    rows.map((r) =>
      QRCode.toDataURL(`${origin}/t/${r.id}`, { width: 600, margin: 0, errorCorrectionLevel: "M" }),
    ),
  );

  const cards = qrDataUrls
    .map(
      (qr) =>
        `<div class="card">` +
        `<div class="nfc">${NFC_SVG}</div>` +
        `<img class="qr" src="${qr}" alt=""/>` +
        (phrase ? `<div class="txt">${esc(phrase)}</div>` : "") +
        `</div>`,
    )
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Cartões CR80 para impressão</title><style>
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; }
.head { font-family: system-ui, sans-serif; font-size: 12px; color: #555; padding: 0 0 4mm; }
.sheet { font-size: 0; }
.card {
  display: inline-block; vertical-align: top;
  width: ${CARD_W_MM}mm; height: ${CARD_H_MM}mm; margin: 2mm; padding: 5mm;
  border: 0.2mm solid #c8c8c8; border-radius: ${CORNER_MM}mm;
  page-break-inside: avoid; text-align: center;
}
.card .nfc { height: 14mm; }
.card .nfc svg { height: 100%; width: auto; display: inline-block; }
.card .qr { width: 40mm; height: 40mm; display: block; margin: 4mm auto 0; }
.card .txt {
  margin-top: 4mm; color: #111;
  font-family: system-ui, sans-serif; font-weight: 600; font-size: 3.3mm; line-height: 1.25;
}
@media print { .head { display: none; } }
</style></head><body>
<div class="head">${rows.length} cartões CR80 (85,6 × 54 mm) — Ctrl/Cmd+P para imprimir ou salvar em PDF. A linha fina é só guia de corte.</div>
<div class="sheet">${cards}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Permita pop-ups para abrir a folha de impressão.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
