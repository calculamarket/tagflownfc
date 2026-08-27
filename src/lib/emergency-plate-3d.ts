import QRCode from "qrcode";
import type { Box } from "./qr-stl";
import { normalizeSlot, pack3mf, type MaterialSlot } from "./three-mf";
import { textToMask } from "./relief-raster";
import type { ReliefMask } from "./pix-plate-3d";

/**
 * "Etiqueta de Emergência": rectangular plate (default 45 mm wide × 60 mm tall
 * × 1.5 mm thick) with a phrase in relief above the QR code.
 *
 * Both the lettering and the QR modules are emitted as a second solid so a
 * two-colour print (AMS / filament change) reads with high contrast.
 */
export type EmergencyPlateOptions = {
  /** Plate width in mm (X). */
  widthMm?: number;
  /** Plate height in mm (Y). */
  heightMm?: number;
  /** Plate thickness in mm (Z). */
  thicknessMm?: number;
  /** How far the QR modules and the text rise above the plate. */
  reliefHeightMm?: number;
  /** Phrase printed above the QR code. Use \n for more lines. */
  caption?: string;
  /** Height reserved for the caption block, in mm. */
  captionHeightMm?: number;
  /** Margin around the content, in mm. */
  marginMm?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  /** Corner hole for a cord / hook (0 disables it). */
  holeDiameterMm?: number;
  baseColor?: string;
  codeColor?: string;
  baseSlot?: Partial<MaterialSlot>;
  codeSlot?: Partial<MaterialSlot>;
};

const OVERLAP_MM = 0.2;

/** Extrude a boolean raster into boxes, merging horizontal runs. */
function maskToBoxes(
  mask: ReliefMask,
  area: { x: number; y: number; w: number; h: number },
  z0: number,
  z1: number,
): Box[] {
  if (!mask.cols || !mask.rows) return [];
  // Fit the mask inside the area keeping its aspect ratio, centred.
  const scale = Math.min(area.w / mask.cols, area.h / mask.rows);
  const w = mask.cols * scale;
  const h = mask.rows * scale;
  const ox = area.x + (area.w - w) / 2;
  const oy = area.y + (area.h - h) / 2;

  const boxes: Box[] = [];
  for (let r = 0; r < mask.rows; r++) {
    let c = 0;
    while (c < mask.cols) {
      if (!mask.data[r * mask.cols + c]) {
        c++;
        continue;
      }
      let end = c;
      while (end + 1 < mask.cols && mask.data[r * mask.cols + end + 1]) end++;
      const x0 = ox + c * scale;
      const x1 = ox + (end + 1) * scale;
      // Raster rows run top-down; the plate's Y axis runs bottom-up.
      const y1 = oy + h - r * scale;
      const y0 = oy + h - (r + 1) * scale;
      boxes.push([x0, y0, z0, x1, y1, z1]);
      c = end + 1;
    }
  }
  return boxes;
}

/** Plate outline with an optional round hole, approximated as a ring of boxes. */
function plateBoxes(
  w: number,
  h: number,
  t: number,
  hole: { cx: number; cy: number; d: number } | null,
): Box[] {
  if (!hole || hole.d <= 0) return [[0, 0, 0, w, h, t]];
  // Slice the plate in horizontal strips, skipping the hole span on each strip.
  const steps = 48;
  const r = hole.d / 2;
  const boxes: Box[] = [];
  const yTop = hole.cy + r;
  const yBottom = hole.cy - r;
  if (yBottom > 0) boxes.push([0, 0, 0, w, yBottom, t]);
  if (yTop < h) boxes.push([0, yTop, 0, w, h, t]);
  const step = (yTop - yBottom) / steps;
  for (let i = 0; i < steps; i++) {
    const y0 = yBottom + i * step;
    const y1 = y0 + step;
    const dy = Math.max(Math.abs(y0 - hole.cy), Math.abs(y1 - hole.cy));
    const half = Math.sqrt(Math.max(0, r * r - dy * dy));
    boxes.push([0, y0, 0, hole.cx - half, y1, t]);
    boxes.push([hole.cx + half, y0, 0, w, y1, t]);
  }
  return boxes;
}

function geometry(text: string, o: EmergencyPlateOptions) {
  const width = o.widthMm ?? 45;
  const height = o.heightMm ?? 60;
  const thickness = o.thicknessMm ?? 1.5;
  const relief = o.reliefHeightMm ?? 0.6;
  const margin = o.marginMm ?? 3;
  const captionH = o.captionHeightMm ?? 10;
  const caption = (o.caption ?? "Emergência - Leia o QR Code").trim();
  const hole = o.holeDiameterMm ?? 0;

  const z0 = thickness - OVERLAP_MM;
  const z1 = thickness + relief;

  const holeSpec = hole > 0 ? { cx: width / 2, cy: height - margin - hole / 2, d: hole } : null;
  const topLimit = holeSpec ? holeSpec.cy - hole / 2 - 1.5 : height - margin;

  const detail: Box[] = [];

  // Caption block, right above the QR code.
  if (caption) {
    const mask = textToMask(caption.includes("\n") ? caption : caption.replace(/\s+-\s+/, "\n"), {
      resolution: 120,
    });
    detail.push(
      ...maskToBoxes(
        mask,
        { x: margin, y: topLimit - captionH, w: width - margin * 2, h: captionH },
        z0,
        z1,
      ),
    );
  }

  // QR code, centred in the remaining space below the caption.
  const qr = QRCode.create(text, { errorCorrectionLevel: o.errorCorrectionLevel ?? "M" });
  const n = qr.modules.size;
  const data = qr.modules.data;
  const areaW = width - margin * 2;
  const areaH = topLimit - (caption ? captionH : 0) - margin;
  const side = Math.min(areaW, areaH);
  const moduleMm = side / n;
  const ox = (width - side) / 2;
  const oy = margin + (areaH - side) / 2;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (data[row * n + col] !== 1) continue;
      const x0 = ox + col * moduleMm;
      const y0 = oy + (n - 1 - row) * moduleMm;
      detail.push([x0, y0, z0, x0 + moduleMm, y0 + moduleMm, z1]);
    }
  }

  return {
    base: plateBoxes(width, height, thickness, holeSpec),
    detail,
    width,
    height,
    thickness,
  };
}

const FACES: [number, number, number][][] = [
  [[0, 2, 1], [0, 3, 2]],
  [[4, 5, 6], [4, 6, 7]],
  [[0, 1, 5], [0, 5, 4]],
  [[3, 7, 6], [3, 6, 2]],
  [[0, 4, 7], [0, 7, 3]],
  [[1, 2, 6], [1, 6, 5]],
];
const NORMALS: [number, number, number][] = [
  [0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0],
];

function boxVertices([x0, y0, z0, x1, y1, z1]: Box): [number, number, number][] {
  return [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
}

const fmt = (v: number) => (Math.round(v * 1000) / 1000).toString();

function boxesToMesh(boxes: Box[]): string {
  const vertices: string[] = [];
  const triangles: string[] = [];
  let offset = 0;
  for (const box of boxes) {
    for (const [x, y, z] of boxVertices(box)) {
      vertices.push(`<vertex x="${fmt(x)}" y="${fmt(y)}" z="${fmt(z)}"/>`);
    }
    for (const face of FACES) {
      for (const [a, b, c] of face) {
        triangles.push(
          `<triangle v1="${a + offset}" v2="${b + offset}" v3="${c + offset}"/>`,
        );
      }
    }
    offset += 8;
  }
  return `<mesh><vertices>${vertices.join("")}</vertices><triangles>${triangles.join("")}</triangles></mesh>`;
}

/** Two-colour 3MF: plate + (text & QR) relief. */
export function buildEmergencyPlate3mf(
  text: string,
  options: EmergencyPlateOptions = {},
): Promise<Blob> {
  const { base, detail } = geometry(text, options);
  const baseSlot = normalizeSlot(
    { color: options.baseColor, ...options.baseSlot },
    { extruder: 1, material: "PLA", color: "#FFFFFF" },
  );
  const codeSlot = normalizeSlot(
    { color: options.codeColor, ...options.codeSlot },
    { extruder: 2, material: "PLA", color: "#111111" },
  );
  return pack3mf([
    { name: "Placa", mesh: boxesToMesh(base), triangleCount: base.length * 12, slot: baseSlot },
    { name: "QR e texto", mesh: boxesToMesh(detail), triangleCount: detail.length * 12, slot: codeSlot },
  ]);
}

/** Single-solid binary STL. */
export function buildEmergencyPlateStl(
  text: string,
  options: EmergencyPlateOptions = {},
): Blob {
  const { base, detail } = geometry(text, options);
  const boxes = [...base, ...detail];
  const triangles = boxes.length * 12;
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const head = "Etiqueta Emergencia - 3D QR";
  for (let i = 0; i < head.length; i++) bytes[i] = head.charCodeAt(i) & 0x7f;
  view.setUint32(80, triangles, true);

  let off = 84;
  for (const box of boxes) {
    const v = boxVertices(box);
    FACES.forEach((face, fi) => {
      for (const tri of face) {
        const n = NORMALS[fi];
        view.setFloat32(off, n[0], true);
        view.setFloat32(off + 4, n[1], true);
        view.setFloat32(off + 8, n[2], true);
        off += 12;
        for (const vi of tri) {
          const p = v[vi];
          view.setFloat32(off, p[0], true);
          view.setFloat32(off + 4, p[1], true);
          view.setFloat32(off + 8, p[2], true);
          off += 12;
        }
        view.setUint16(off, 0, true);
        off += 2;
      }
    });
  }
  return new Blob([buffer], { type: "model/stl" });
}
