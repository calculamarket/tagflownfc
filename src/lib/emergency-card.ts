import QRCode from "qrcode";
import { toast } from "sonner";

// Folha A4 de "Cartão de Emergência" (categoria Idoso / Emergência) com o QR
// real de cada peça do lote já composto — tema médico. Três formatos:
//  - cr80     : cartão paisagem 85,6 × 54 mm (tamanho de crédito)
//  - vertical : 54 × 85,6 mm (crachá / cordão)
//  - pendant  : pingente/chaveiro redondo Ø 40 mm
// Cada QR aponta para /t/{id} (reconfigurável).

export type EmCardVariant = "cr80" | "vertical" | "pendant";

const crossSvg = (fill: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${fill}" d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/></svg>`;

function cardMarkup(variant: EmCardVariant, qr: string): string {
  if (variant === "vertical") {
    return (
      `<div class="card vert">` +
      `<div class="vhead"><span class="cross">${crossSvg("#fff")}</span><div class="vh2">Emergência médica</div></div>` +
      `<div class="vbody">` +
      `<div class="instr">Escaneie para meus <b>contatos</b> e <b>dados de saúde</b>.</div>` +
      `<div class="qrbox big"><img src="${qr}" alt=""/></div>` +
      `<div class="vname">Nome<span class="rule"></span></div>` +
      `</div></div>`
    );
  }
  if (variant === "pendant") {
    return (
      `<div class="card pend">` +
      `<span class="cross">${crossSvg("#C81E28")}</span>` +
      `<span class="tiny">Emergência</span>` +
      `<div class="qrbox"><img src="${qr}" alt=""/></div>` +
      `<span class="sub">escaneie-me</span>` +
      `</div>`
    );
  }
  // cr80 (paisagem)
  return (
    `<div class="card cr80">` +
    `<div class="band"><span class="cross">${crossSvg("#fff")}</span> EMERGÊNCIA MÉDICA</div>` +
    `<div class="qrbox"><img src="${qr}" alt=""/></div>` +
    `<div class="right">` +
    `<div class="callout">Escaneie</div>` +
    `<div class="instr">para meus <b>contatos de família</b> e <b>informações de saúde</b> (alergias, medicações, condições).</div>` +
    `<div class="name">Nome<span class="rule"></span></div>` +
    `<div class="foot">Aponte a câmera do celular ao código</div>` +
    `</div></div>`
  );
}

const VARIANT_CSS: Record<EmCardVariant, string> = {
  cr80: `
.card.cr80 { width: 85.6mm; height: 54mm; }
.band { position: absolute; inset: 0 0 auto 0; height: 9mm; background: #C81E28; color: #fff;
  display: flex; align-items: center; gap: 2mm; padding: 0 3.2mm; font-weight: 800; font-size: 3.4mm;
  letter-spacing: .02em; text-transform: uppercase; }
.band .cross { width: 4.6mm; height: 4.6mm; }
.cr80 .qrbox { position: absolute; left: 3.2mm; top: 11mm; width: 31.4mm; height: 31.4mm; }
.right { position: absolute; left: 38mm; right: 3.4mm; top: 11mm; bottom: 3mm; display: flex; flex-direction: column; }
.callout { font-weight: 800; font-size: 4.6mm; line-height: 1.02; color: #8E1119; margin: 0 0 1.6mm; }
.instr { font-size: 3mm; line-height: 1.28; margin: 0; }
.name { margin-top: auto; font-size: 2.6mm; color: #5C544E; }
.name .rule { display: block; height: 0.35mm; background: #E4DAD2; margin-top: 3.4mm; }
.foot { font-size: 2.1mm; color: #5C544E; margin-top: 1.6mm; }`,
  vertical: `
.card.vert { width: 54mm; height: 85.6mm; display: flex; flex-direction: column; text-align: center; }
.vhead { background: #C81E28; color: #fff; padding: 5mm 3mm 4.4mm; display: flex; flex-direction: column;
  align-items: center; gap: 1.8mm; }
.vhead .cross { width: 9mm; height: 9mm; }
.vh2 { font-weight: 800; font-size: 4.6mm; text-transform: uppercase; letter-spacing: .02em; line-height: 1; }
.vbody { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 4mm 4mm 3mm; }
.vbody .instr { font-size: 3mm; line-height: 1.28; margin: 0 0 3.4mm; }
.vert .qrbox.big { width: 36mm; height: 36mm; }
.vname { margin-top: auto; width: 100%; font-size: 2.6mm; color: #5C544E; text-align: left; }
.vname .rule { display: block; height: 0.35mm; background: #E4DAD2; margin-top: 3mm; }`,
  pendant: `
.card.pend { width: 40mm; height: 40mm; border-radius: 50%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; border: 1.4mm solid #C81E28;
  padding: 3mm; outline: none; }
.pend .cross { width: 6mm; height: 6mm; margin-bottom: 1mm; }
.pend .tiny { font-weight: 800; font-size: 2.5mm; color: #8E1119; text-transform: uppercase; letter-spacing: .04em; line-height: 1; }
.pend .qrbox { width: 20mm; height: 20mm; border: none; padding: 0; margin: 1.4mm 0; }
.pend .sub { font-size: 1.9mm; color: #5C544E; }`,
};

export async function openEmergencyCardSheet(
  rows: { id: string }[],
  origin: string,
  opts?: { variant?: EmCardVariant },
): Promise<void> {
  if (rows.length === 0) {
    toast.error("Lote sem QR Codes.");
    return;
  }
  const variant = opts?.variant ?? "cr80";

  const qrs = await Promise.all(
    rows.map((r) =>
      QRCode.toDataURL(`${origin}/t/${r.id}`, { width: 600, margin: 0, errorCorrectionLevel: "M" }),
    ),
  );
  const cards = qrs.map((qr) => cardMarkup(variant, qr)).join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Cartões de Emergência para impressão</title><style>
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, Arial, sans-serif; color: #171310; }
.head { font-size: 12px; color: #555; padding: 0 0 4mm; }
.sheet { font-size: 0; }
.card { display: inline-block; vertical-align: top; position: relative; margin: 2mm; background: #fff;
  overflow: hidden; page-break-inside: avoid; border-radius: 3.2mm; outline: 0.2mm solid #d8cfc7; }
.card .cross { display: inline-flex; }
.card .cross svg { width: 100%; height: 100%; }
.qrbox { border: 0.4mm solid #C81E28; border-radius: 1.6mm; padding: 1.4mm; background: #fff; }
.qrbox img { width: 100%; height: 100%; display: block; }
${VARIANT_CSS[variant]}
@media print { .head { display: none; } }
</style></head><body>
<div class="head">${rows.length} cartões de emergência — Ctrl/Cmd+P para imprimir ou salvar em PDF. Imprima em tamanho real (100%).</div>
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
