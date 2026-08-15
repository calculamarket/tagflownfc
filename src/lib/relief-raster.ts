import type { ReliefMask } from "./pix-plate-3d";

/**
 * Browser helpers that turn text or an uploaded image into a boolean raster
 * that the 3D generators extrude as relief.
 */

function canvasToMask(canvas: HTMLCanvasElement, threshold: number, invert: boolean): ReliefMask {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { cols: 0, rows: 0, data: [] };
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height).data;
  const data: boolean[] = new Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = img[i * 4];
    const g = img[i * 4 + 1];
    const b = img[i * 4 + 2];
    const a = img[i * 4 + 3];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const dark = a > 40 && lum < threshold;
    data[i] = invert ? !dark && a > 40 : dark;
  }
  return { cols: width, rows: height, data };
}

/** Trim fully empty rows / columns so the art fills the available area. */
function trim(mask: ReliefMask): ReliefMask {
  let top = mask.rows;
  let bottom = -1;
  let left = mask.cols;
  let right = -1;
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      if (!mask.data[r * mask.cols + c]) continue;
      if (r < top) top = r;
      if (r > bottom) bottom = r;
      if (c < left) left = c;
      if (c > right) right = c;
    }
  }
  if (bottom < 0) return { cols: 0, rows: 0, data: [] };
  const cols = right - left + 1;
  const rows = bottom - top + 1;
  const data: boolean[] = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      data[r * cols + c] = mask.data[(r + top) * mask.cols + (c + left)];
    }
  }
  return { cols, rows, data };
}

/** Render one or more lines of text into a relief mask. */
export function textToMask(
  text: string,
  opts: { fontFamily?: string; bold?: boolean; resolution?: number } = {},
): ReliefMask {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (!lines.length) return { cols: 0, rows: 0, data: [] };
  const size = opts.resolution ?? 96;
  const font = `${opts.bold === false ? "500" : "700"} ${size}px ${opts.fontFamily ?? "Inter, system-ui, sans-serif"}`;

  const probe = document.createElement("canvas");
  const pctx = probe.getContext("2d")!;
  pctx.font = font;
  const widest = Math.max(...lines.map((l) => pctx.measureText(l).width));
  const lineH = size * 1.25;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, Math.ceil(widest) + size * 0.4);
  canvas.height = Math.ceil(lineH * lines.length) + size * 0.3;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, size * 0.15 + lineH * (i + 0.5));
  });
  return trim(canvasToMask(canvas, 0.5, false));
}

/** Rasterize an uploaded image (PNG / JPG / SVG) into a relief mask. */
export async function imageToMask(
  file: File,
  opts: { maxPixels?: number; threshold?: number; invert?: boolean } = {},
): Promise<ReliefMask> {
  const max = opts.maxPixels ?? 180;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return trim(canvasToMask(canvas, opts.threshold ?? 0.55, opts.invert ?? false));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Small preview of a mask, for the UI. */
export function maskToDataUrl(mask: ReliefMask, fg = "#111", bg = "#fff"): string {
  if (!mask.cols || !mask.rows) return "";
  const canvas = document.createElement("canvas");
  canvas.width = mask.cols;
  canvas.height = mask.rows;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, mask.cols, mask.rows);
  ctx.fillStyle = fg;
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      if (mask.data[r * mask.cols + c]) ctx.fillRect(c, r, 1, 1);
    }
  }
  return canvas.toDataURL();
}
