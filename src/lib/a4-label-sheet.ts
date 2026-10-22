import QRCode from "qrcode";
import type { LabelShape, QrLevel } from "./round-label";
import { createZip } from "./zip";
import { siInstagram, siWhatsapp, siGoogle } from "simple-icons";

export const A4 = { widthMm: 210, heightMm: 297, dpi: 600, widthPx: 4961, heightPx: 7016 };
const px = (mm: number) => Math.round(mm * A4.dpi / 25.4);

export type A4LabelShape = LabelShape | "rectangle";
export type LabelIcon = "instagram" | "whatsapp" | "google" | "nfc";
export type LabelDecoration = { shape?: A4LabelShape; icons?: LabelIcon[] };
export const LABEL_ICONS: { id: LabelIcon; label: string }[] = [
  { id: "instagram", label: "Instagram" }, { id: "whatsapp", label: "WhatsApp" },
  { id: "google", label: "Google · Avaliações" }, { id: "nfc", label: "NFC" },
];

export function labelDimensions(sizeMm: number, shape: A4LabelShape = "square") {
  return shape === "rectangle"
    ? { widthMm: sizeMm + 19, heightMm: sizeMm, qrSizeMm: sizeMm, qrLeftMm: 19, qrTopMm: 0 }
    : { widthMm: sizeMm, heightMm: sizeMm, qrSizeMm: sizeMm, qrLeftMm: 0, qrTopMm: 0 };
}

export function a4Layout(sizeMm: number, quantity: number, shape: A4LabelShape = "square") {
  if (!Number.isFinite(sizeMm) || sizeMm < 10 || sizeMm > 100) throw new Error("Tamanho entre 10 e 100 mm.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Informe uma quantidade inteira maior que zero.");
  const marginMm = 8;
  const gapMm = 3;
  const dimensions = labelDimensions(sizeMm, shape);
  const columns = Math.floor((A4.widthMm - marginMm * 2 + gapMm) / (dimensions.widthMm + gapMm));
  const rows = Math.floor((A4.heightMm - marginMm * 2 + gapMm) / (dimensions.heightMm + gapMm));
  const capacity = columns * rows;
  return { columns, rows, capacity, pages: Math.ceil(quantity / capacity), marginMm, gapMm, ...dimensions };
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Canvas defaults to 96 dpi. Replace pHYs with true print density (A4.dpi). */
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

export type QrScheme = "light" | "dark";

/** Page background, label outline and module colors for each scheme. */
export const QR_SCHEME_COLORS: Record<QrScheme, { page: string; outline: string; modules: string }> = {
  light: { page: "#ffffff", outline: "#b8b8b8", modules: "#000000" },
  dark: { page: "#000000", outline: "#ffffff", modules: "#ffffff" },
};

async function iconImage(icon: LabelIcon, color: string) {
  const brands = { instagram: siInstagram, whatsapp: siWhatsapp, google: siGoogle };
  const drawing = icon === "nfc"
    ? '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 8v8m4-11c4 4 4 10 0 14m4-17c6 6 6 14 0 20m4-22c7 7 7 15 0 22"/></g>'
    : `<path fill="currentColor" d="${brands[icon].path}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" style="color:${color}">${drawing}</svg>`;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}

export async function buildA4Sheets(
  texts: string[],
  sizeMm: number,
  shape: A4LabelShape = "square",
  level: QrLevel = "Q",
  scheme: QrScheme = "light",
  icons: LabelIcon[] = ["instagram", "whatsapp", "google", "nfc"],
) {
  const colors = QR_SCHEME_COLORS[scheme] ?? QR_SCHEME_COLORS.light;
  const layout = a4Layout(sizeMm, texts.length, shape);
  const selectedIcons = LABEL_ICONS.filter((item) => icons.includes(item.id));
  const images = shape === "rectangle" ? await Promise.all(selectedIcons.map((item) => iconImage(item.id, colors.modules))) : [];
  const sheets: Blob[] = [];
  for (let page = 0; page < layout.pages; page++) {
    const canvas = document.createElement("canvas");
    canvas.width = A4.widthPx;
    canvas.height = A4.heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível criar a folha.");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = colors.page;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const items = texts.slice(page * layout.capacity, (page + 1) * layout.capacity);
    for (let i = 0; i < items.length; i++) {
      const x = px(layout.marginMm + (i % layout.columns) * (layout.widthMm + layout.gapMm));
      const y = px(layout.marginMm + Math.floor(i / layout.columns) * (layout.heightMm + layout.gapMm));
      const side = px(sizeMm);
      ctx.strokeStyle = colors.outline;
      ctx.lineWidth = Math.max(1, Math.round(A4.dpi / 300));
      ctx.beginPath();
      if (shape === "round") ctx.arc(x + side / 2, y + side / 2, side / 2, 0, 2 * Math.PI);
      else ctx.rect(x, y, px(layout.widthMm), px(layout.heightMm));
      ctx.stroke();
      if (shape === "rectangle") {
        const slot = (layout.heightMm - 4) / Math.max(1, images.length);
        const iconSize = Math.min(8, slot * 0.65);
        for (let n = 0; n < images.length; n++) {
          const image = images[n];
          ctx.drawImage(image, x + px((17 - iconSize) / 2), y + px(2 + n * slot + (slot - iconSize) / 2), px(iconSize), px(iconSize));
        }
      }
      const qr = QRCode.create(items[i], { errorCorrectionLevel: level });
      // Integer-sized modules and four-module quiet zone keep codes sharp and scannable.
      const available = shape === "round" ? side / Math.SQRT2 : side;
      const cell = Math.floor((available - 2) / (qr.modules.size + 8));
      if (cell < 1) throw new Error("Conteúdo muito longo para este tamanho de etiqueta.");
      const qrSide = cell * qr.modules.size;
      const ox = x + px(layout.qrLeftMm) + Math.round((side - qrSide) / 2);
      const oy = y + px(layout.qrTopMm) + Math.round((side - qrSide) / 2);
      ctx.fillStyle = colors.modules;
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
  if (sheets.length === 1) return { blob: first, filename: `etiquetas-a4-${A4.dpi}dpi.png` };
  const entries = await Promise.all(sheets.map(async (blob, i) => ({ name: `etiquetas-a4-${String(i + 1).padStart(3, "0")}-${A4.dpi}dpi.png`, data: new Uint8Array(await blob.arrayBuffer()) })));
  return { blob: await createZip(entries), filename: `etiquetas-a4-${A4.dpi}dpi.zip` };
}

/** Reuse the exact rendered sheets so PDF and PNG keep identical codes and artwork. */
export async function packageA4Pdf(sheets: Blob[]) {
  if (!sheets.length) throw new Error("Selecione pelo menos uma etiqueta.");
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle("Etiquetas A4 · 3D QR");
  const width = A4.widthMm * 72 / 25.4;
  const height = A4.heightMm * 72 / 25.4;
  for (const sheet of sheets) {
    const image = await pdf.embedPng(await sheet.arrayBuffer());
    const page = pdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  return { blob: new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" }), filename: `etiquetas-a4-${A4.dpi}dpi.pdf` };
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