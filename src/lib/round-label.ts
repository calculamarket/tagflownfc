import QRCode from "qrcode";

// Etiquetas REDONDAS de QR (ex.: encaixe circular de 26 mm da Tag de mochila
// "QR Kids"). O QR é sempre quadrado; a etiqueta é um disco branco com o QR
// centrado ocupando ~72% do diâmetro — o anel branco funciona como zona de
// silêncio, então escaneia bem.

export type QrLevel = "L" | "M" | "Q" | "H";
export type LabelShape = "round" | "square";

const QR_RATIO = 0.72; // fração do diâmetro ocupada pelo QR (etiqueta redonda)
const SQ_RATIO = 0.82; // fração do lado ocupada pelo QR (etiqueta quadrada)
const round = (n: number) => Math.round(n * 1000) / 1000;

const ratioFor = (shape: LabelShape) => (shape === "round" ? QR_RATIO : SQ_RATIO);

/** PNG (data URL) de uma etiqueta redonda: disco branco + QR centrado. */
export async function roundQrPng(text: string, level: QrLevel, px = 1000): Promise<string> {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, text || " ", {
    errorCorrectionLevel: level,
    margin: 0,
    width: Math.round(px * QR_RATIO),
  });

  const out = document.createElement("canvas");
  out.width = px;
  out.height = px;
  const ctx = out.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
  ctx.fill();
  const qs = qrCanvas.width;
  ctx.drawImage(qrCanvas, (px - qs) / 2, (px - qs) / 2);
  return out.toDataURL("image/png");
}

/** SVG vetorial de uma etiqueta redonda, em mm (1 unidade = 1 mm). */
export function roundQrSvg(text: string, level: QrLevel, diamMm: number): string {
  const qr = QRCode.create(text || " ", { errorCorrectionLevel: level });
  const size = qr.modules.size;
  const data = qr.modules.data;

  const qrMm = diamMm * QR_RATIO;
  const moduleMm = qrMm / size;
  const off = (diamMm - qrMm) / 2;

  const rects: string[] = [];
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (data[r * size + c] === 1) {
        const start = c;
        while (c < size && data[r * size + c] === 1) c++;
        rects.push(
          `<rect x="${round(off + start * moduleMm)}" y="${round(off + r * moduleMm)}" ` +
            `width="${round((c - start) * moduleMm)}" height="${round(moduleMm)}"/>`,
        );
      } else {
        c++;
      }
    }
  }

  const d = round(diamMm);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${d}mm" height="${d}mm" viewBox="0 0 ${d} ${d}">` +
    `<circle cx="${round(diamMm / 2)}" cy="${round(diamMm / 2)}" r="${round(diamMm / 2)}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects.join("")}</g>` +
    `</svg>`
  );
}

/** PNG (data URL) de uma etiqueta QUADRADA: fundo branco + QR centrado. */
export async function squareQrPng(text: string, level: QrLevel, px = 1000): Promise<string> {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, text || " ", {
    errorCorrectionLevel: level,
    margin: 0,
    width: Math.round(px * SQ_RATIO),
  });
  const out = document.createElement("canvas");
  out.width = px;
  out.height = px;
  const ctx = out.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, px, px);
  const qs = qrCanvas.width;
  ctx.drawImage(qrCanvas, (px - qs) / 2, (px - qs) / 2);
  return out.toDataURL("image/png");
}

/** SVG vetorial de uma etiqueta quadrada, em mm. */
export function squareQrSvg(text: string, level: QrLevel, sideMm: number): string {
  const qr = QRCode.create(text || " ", { errorCorrectionLevel: level });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const qrMm = sideMm * SQ_RATIO;
  const moduleMm = qrMm / size;
  const off = (sideMm - qrMm) / 2;

  const rects: string[] = [];
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (data[r * size + c] === 1) {
        const start = c;
        while (c < size && data[r * size + c] === 1) c++;
        rects.push(
          `<rect x="${round(off + start * moduleMm)}" y="${round(off + r * moduleMm)}" ` +
            `width="${round((c - start) * moduleMm)}" height="${round(moduleMm)}"/>`,
        );
      } else {
        c++;
      }
    }
  }
  const s = round(sideMm);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}mm" height="${s}mm" viewBox="0 0 ${s} ${s}">` +
    `<rect width="${s}" height="${s}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects.join("")}</g>` +
    `</svg>`
  );
}

/** PNG/SVG por forma (helper único usado pela página). */
export function qrLabelPng(text: string, level: QrLevel, shape: LabelShape, px = 1000) {
  return shape === "round" ? roundQrPng(text, level, px) : squareQrPng(text, level, px);
}
export function qrLabelSvg(text: string, level: QrLevel, shape: LabelShape, sizeMm: number) {
  return shape === "round" ? roundQrSvg(text, level, sizeMm) : squareQrSvg(text, level, sizeMm);
}

const sheetHtml = (cells: string, sizeMm: number, shape: LabelShape, note: string) => {
  const radius = shape === "round" ? "border-radius:50%;" : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Etiquetas ${sizeMm} mm</title><style>
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; }
.head { font-family: system-ui, sans-serif; font-size: 12px; color: #555; padding: 0 0 4mm; }
.wrap { font-size: 0; }
.cell { display: inline-block; width: ${sizeMm}mm; height: ${sizeMm}mm; margin: 1.5mm; page-break-inside: avoid; }
.cell img { width: 100%; height: 100%; display: block; ${radius} }
@media print { .head { display: none; } }
</style></head><body>
<div class="head">${note} — Ctrl/Cmd+P para imprimir ou salvar em PDF. Imprima em tamanho real (100%).</div>
<div class="wrap">${cells}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;
};

const openSheet = (html: string) => {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
};

/** Folha A4 com várias etiquetas IGUAIS (mesmo QR). */
export function openRoundLabelSheet(pngDataUrl: string, sizeMm: number, quantity: number, shape: LabelShape = "round"): void {
  const cells = Array.from(
    { length: Math.max(1, Math.min(400, quantity)) },
    () => `<span class="cell"><img src="${pngDataUrl}" alt=""/></span>`,
  ).join("");
  openSheet(sheetHtml(cells, sizeMm, shape, `Etiquetas ${sizeMm} mm`));
}

/** Folha A4 com etiquetas DISTINTAS (uma por QR), p/ lotes ativáveis. */
export function openLabelSheetMulti(pngDataUrls: string[], sizeMm: number, shape: LabelShape): void {
  const cells = pngDataUrls.map((u) => `<span class="cell"><img src="${u}" alt=""/></span>`).join("");
  openSheet(sheetHtml(cells, sizeMm, shape, `${pngDataUrls.length} etiquetas ${sizeMm} mm`));
}
