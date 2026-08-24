import QRCode from "qrcode";
import { toast } from "sonner";

// Folha A4 de "Cartão de Emergência" (tamanho CR80, 85,6 × 54 mm) com o QR real
// de cada peça do lote já composto — tema médico, para a categoria Idoso /
// Emergência. Cada QR aponta para /t/{id} (reconfigurável).

const CARD_W_MM = 85.6;
const CARD_H_MM = 54;
const CORNER_MM = 3.2;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const CROSS =
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/></svg>`;

export async function openEmergencyCardSheet(
  rows: { id: string }[],
  origin: string,
): Promise<void> {
  if (rows.length === 0) {
    toast.error("Lote sem QR Codes.");
    return;
  }

  const qrs = await Promise.all(
    rows.map((r) =>
      QRCode.toDataURL(`${origin}/t/${r.id}`, { width: 600, margin: 0, errorCorrectionLevel: "M" }),
    ),
  );

  const cards = qrs
    .map(
      (qr) =>
        `<div class="card">` +
        `<div class="band"><span class="cross">${CROSS}</span> EMERGÊNCIA MÉDICA</div>` +
        `<div class="qrbox"><img src="${qr}" alt=""/></div>` +
        `<div class="right">` +
        `<div class="callout">Escaneie</div>` +
        `<div class="instr">para meus <b>contatos de família</b> e <b>informações de saúde</b> (alergias, medicações, condições).</div>` +
        `<div class="name">Nome<span class="rule"></span></div>` +
        `<div class="foot">Aponte a câmera do celular ao código</div>` +
        `</div>` +
        `</div>`,
    )
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Cartões de Emergência para impressão</title><style>
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, Arial, sans-serif; color: #171310; }
.head { font-size: 12px; color: #555; padding: 0 0 4mm; }
.sheet { font-size: 0; }
.card {
  display: inline-block; vertical-align: top; position: relative;
  width: ${CARD_W_MM}mm; height: ${CARD_H_MM}mm; margin: 2mm;
  border-radius: ${CORNER_MM}mm; overflow: hidden; background: #fff;
  outline: 0.2mm solid #d8cfc7; page-break-inside: avoid;
}
.band {
  position: absolute; inset: 0 0 auto 0; height: 9mm;
  background: #C81E28; color: #fff; display: flex; align-items: center; gap: 2mm;
  padding: 0 3.2mm; font-weight: 800; font-size: 3.4mm; letter-spacing: .02em; text-transform: uppercase;
}
.band .cross { width: 4.6mm; height: 4.6mm; display: inline-flex; }
.band .cross svg { width: 100%; height: 100%; }
.qrbox {
  position: absolute; left: 3.2mm; top: 11mm; width: 31.4mm; height: 31.4mm;
  border: 0.4mm solid #C81E28; border-radius: 1.6mm; padding: 1.4mm; background: #fff;
}
.qrbox img { width: 100%; height: 100%; display: block; }
.right {
  position: absolute; left: 38mm; right: 3.4mm; top: 11mm; bottom: 3mm;
  display: flex; flex-direction: column;
}
.callout { font-weight: 800; font-size: 4.6mm; line-height: 1.02; color: #8E1119; margin: 0 0 1.6mm; }
.instr { font-size: 3mm; line-height: 1.28; margin: 0; }
.name { margin-top: auto; font-size: 2.6mm; color: #5C544E; }
.name .rule { display: block; height: 0.35mm; background: #E4DAD2; margin-top: 3.4mm; }
.foot { font-size: 2.1mm; color: #5C544E; margin-top: 1.6mm; }
@media print { .head { display: none; } }
</style></head><body>
<div class="head">${rows.length} cartões de emergência (85,6 × 54 mm) — Ctrl/Cmd+P para imprimir ou salvar em PDF. Imprima em tamanho real (100%).</div>
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
