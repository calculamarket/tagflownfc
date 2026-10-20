import QRCode from "qrcode";
import type { LabelShape, QrLevel } from "./round-label";
import { createZip } from "./zip";

export const A4 = { widthMm: 210, heightMm: 297, dpi: 300, widthPx: 2480, heightPx: 3508 };
const px = (mm: number) => Math.round(mm * A4.dpi / 25.4);

export function a4Layout(sizeMm: number, quantity: number) {
  if (!Number.isFinite(sizeMm) || sizeMm < 10 || sizeMm > 100) throw new Error("Tamanho entre 10 e 100 mm.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Informe uma quantidade inteira maior que zero.");
  const marginMm = 8;
  const gapMm = 3;
  const columns = Math.floor((A4.widthMm - marginMm * 2 + gapMm) / (sizeMm + gapMm));
  const rows = Math.floor((A4.heightMm - marginMm * 2 + gapMm) / (sizeMm + gapMm));
  const capacity = columns * rows;
  return { columns, rows, capacity, pages: Math.ceil(quantity / capacity), marginMm, gapMm };
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Canvas defaults to 96 dpi. Replace pHYs with true 300 dpi density. */
export function pngAt300Dpi(bytes: Uint8Array): Uint8Array {
  const density = new Uint8Array(21);
  const view = new DataView(density.buffer);
  view.setUint32(0, 9);
  density.set(new TextEncoder().encode("pHYs"), 4);
  view.setUint32(8, Math.round(A4.dpi / 0.0254));
  view.setUint32(12, Math.round(A4.dpi / 0.0254));
  density[16] = 1;
  view.setUint32(17, crc32(density.subarray(4, 17)));
  const parts = [bytes.slice(0, 8)];
  let offset = 8;
  const source = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset < bytes.length) {
    const length = source.getUint32(offset) + 12;
    const type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
    if (type !== "pHYs") parts.push(bytes.slice(offset, offset + length));
    if (type === "IHDR") parts.push(density);
    offset += length;
  }
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) { out.set(part, cursor); cursor += part.length; }
  return out;
}

export async function buildA4Sheets(texts: string[], sizeMm: number, shape: LabelShape = "square", level: QrLevel = "Q") {
  const layout = a4Layout(sizeMm, texts.length);
  const sheets: Blob[] = [];
  for (let page = 0; page < layout.pages; page++) {
    const canvas = document.createElement("canvas");
    canvas.width = A4.widthPx;
    canvas.height = A4.heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível criar a folha.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const items = texts.slice(page * layout.capacity, (page + 1) * layout.capacity);
    for (let i = 0; i < items.length; i++) {
      const x = px(layout.marginMm + (i % layout.columns) * (sizeMm + layout.gapMm));
      const y = px(layout.marginMm + Math.floor(i / layout.columns) * (sizeMm + layout.gapMm));
      const side = px(sizeMm);
      ctx.strokeStyle = "#b8b8b8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (shape === "round") ctx.arc(x + side / 2, y + side / 2, side / 2, 0, 2 * Math.PI);
      else ctx.rect(x, y, side, side);
      ctx.stroke();
      const qr = QRCode.create(items[i], { errorCorrectionLevel: level });
      // Integer-sized modules and four-module quiet zone keep codes sharp and scannable.
      const available = shape === "round" ? side / Math.SQRT2 : side;
      const cell = Math.floor((available - 2) / (qr.modules.size + 8));
      if (cell < 1) throw new Error("Conteúdo muito longo para este tamanho de etiqueta.");
      const qrSide = cell * qr.modules.size;
      const ox = x + Math.round((side - qrSide) / 2);
      const oy = y + Math.round((side - qrSide) / 2);
      ctx.fillStyle = "#000000";
      for (let r = 0; r < qr.modules.size; r++) {
        for (let c = 0; c < qr.modules.size; c++) {
          if (qr.modules.data[r * qr.modules.size + c]) ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
        }
      }
    }
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Falha ao gerar PNG.")), "image/png"));
    sheets.push(new Blob([new Uint8Array(pngAt300Dpi(new Uint8Array(await blob.arrayBuffer())))], { type: "image/png" }));
  }
  return sheets;
}

export async function packageA4Sheets(sheets: Blob[]) {
  const first = sheets[0];
  if (!first) throw new Error("Selecione pelo menos uma etiqueta.");
  if (sheets.length === 1) return { blob: first, filename: "etiquetas-a4-300dpi.png" };
  const entries = await Promise.all(sheets.map(async (blob, i) => ({ name: `etiquetas-a4-${String(i + 1).padStart(3, "0")}-300dpi.png`, data: new Uint8Array(await blob.arrayBuffer()) })));
  return { blob: await createZip(entries), filename: "etiquetas-a4-300dpi.zip" };
}

export async function deliverA4File(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if ((e as DOMException).name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}