import QRCode from "qrcode";
import type { Box } from "./qr-stl";
import { normalizeSlot, pack3mf, type MaterialSlot } from "./three-mf";
import { textToMask } from "./relief-raster";
import type { ReliefMask } from "./pix-plate-3d";

/**
 * "QR + NFC": rectangular plate with the QR code on top and, below it, the
 * NFC waves icon plus the "NFC" label — signalling that the tag also carries
 * an NFC chip, without interfering with QR readability (quiet zone kept).
 */
export type NfcTagOptions = {
  /** Plate width in mm (X). */
  widthMm?: number;
  /** Plate height in mm (Y). */
  heightMm?: number;
  /** Plate thickness in mm (Z). */
  thicknessMm?: number;
  /** How far the relief (QR, icon, text) rises above the plate. */
  reliefHeightMm?: number;
  /** Margin around the content, in mm. */
  marginMm?: number;
  /** Height of the NFC icon/label strip below the QR code, in mm. */
  nfcZoneMm?: number;
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

/**
 * NFC waves icon: three concentric arcs radiating from an emitter dot,
 * sampled into thin boxes. Angles sweep symmetrically around vertical.
 */
function nfcIconBoxes(
  cx: number,
  cy: number,
  size: number,
  z0: number,
  z1: number,
): Box[] {
  const boxes: Box[] = [];
  const rMax = size / 2;
  const thick = Math.max(0.5, size * 0.075);
  // Emitter dot.
  const dot = size * 0.14;
  boxes.push([cx - dot / 2, cy - rMax + size * 0.06, z0, cx + dot / 2, cy - rMax + size * 0.06 + dot, z1]);

  const radii = [rMax * 0.45, rMax * 0.7, rMax * 0.95];
  const span = Math.PI / 2.6; // arc sweep, centred on straight-up
  const originY = cy - rMax + size * 0.06 + dot / 2;
  for (const r of radii) {
    const steps = Math.max(10, Math.round(r * 6));
    for (let i = 0; i < steps; i++) {
      const a0 = Math.PI / 2 - span / 2 + (i / steps) * span;
      const a1 = Math.PI / 2 - span / 2 + ((i + 1) / steps) * span;
      const x0 = cx + (r - thick / 2) * Math.cos(a0);
      const y0 = originY + (r - thick / 2) * Math.sin(a0);
      const x1 = cx + (r + thick / 2) * Math.cos(a1);
      const y1 = originY + (r + thick / 2) * Math.sin(a1);
      boxes.push([
        Math.min(x0, x1) - thick / 2,
        Math.min(y0, y1),
        z0,
        Math.max(x0, x1) + thick / 2,
        Math.max(y0, y1),
        z1,
      ]);
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

function geometry(text: string, o: NfcTagOptions) {
  const width = o.widthMm ?? 45;
  const height = o.heightMm ?? 60;
  const thickness = o.thicknessMm ?? 1.5;
  const relief = o.reliefHeightMm ?? 0.6;
  const margin = o.marginMm ?? 3;
  const nfcZone = o.nfcZoneMm ?? 12;
  const hole = o.holeDiameterMm ?? 0;

  const z0 = thickness - OVERLAP_MM;
  const z1 = thickness + relief;

  const holeSpec = hole > 0 ? { cx: width / 2, cy: height - margin - hole / 2, d: hole } : null;
  const topLimit = holeSpec ? holeSpec.cy - hole / 2 - 1.5 : height - margin;

  const detail: Box[] = [];

  // Keep the NFC mark compact and centred inside its strip. The strip itself
  // remains unchanged so it continues to separate the mark from the QR quiet
  // zone, but the artwork no longer dominates the plate.
  const nfcY = margin;
  const iconSize = Math.min(6, nfcZone * 0.5);
  const labelHeight = Math.min(3.6, nfcZone * 0.3);
  const labelWidth = Math.min(9, width * 0.2);
  const markGap = 1.5;
  const markWidth = iconSize + markGap + labelWidth;
  const markX = (width - markWidth) / 2;
  const iconCx = markX + iconSize / 2;
  const iconCy = nfcY + nfcZone / 2;
  detail.push(...nfcIconBoxes(iconCx, iconCy, iconSize, z0, z1));

  const labelMask = textToMask("NFC", { resolution: 80 });
  detail.push(
    ...maskToBoxes(
      labelMask,
      {
        x: markX + iconSize + markGap,
        y: iconCy - labelHeight / 2,
        w: labelWidth,
        h: labelHeight,
      },
      z0,
      z1,
    ),
  );

  // QR code above the NFC strip, centred, with quiet margin preserved.
  const qr = QRCode.create(text, { errorCorrectionLevel: o.errorCorrectionLevel ?? "M" });
  const n = qr.modules.size;
  const data = qr.modules.data;
  const areaW = width - margin * 2;
  const areaH = topLimit - (nfcY + nfcZone + 2); // 2 mm gap above the NFC strip
  const side = Math.min(areaW, areaH);
  const moduleMm = side / n;
  const ox = (width - side) / 2;
  const oy = nfcY + nfcZone + 2 + (areaH - side) / 2;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (data[row * n + col] !== 1) continue;
      const x0 = ox + col * moduleMm;
      const y0 = oy + (n - 1 - row) * moduleMm;
      detail.push([x0, y0, z0, x0 + moduleMm, y0 + moduleMm, z1]);
    }
  }

  return { base: plateBoxes(width, height, thickness, holeSpec), detail };
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

/** Two-colour 3MF: plate + relief (QR, icon, text). */
export function buildNfcTag3mf(
  text: string,
  options: NfcTagOptions = {},
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
    { name: "QR e NFC", mesh: boxesToMesh(detail), triangleCount: detail.length * 12, slot: codeSlot },
  ]);
}

/** Single-solid binary STL. */
export function buildNfcTagStl(text: string, options: NfcTagOptions = {}): Blob {
  const { base, detail } = geometry(text, options);
  const boxes = [...base, ...detail];
  const triangles = boxes.length * 12;
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const head = "QR + NFC - 3D QR";
  for (let i = 0; i < head.length; i++) bytes[i] = head.charCodeAt(i) & 0x7f;
  view.setUint32(80, triangles, true);

  let off = 84;
  for (const box of boxes) {
    const v = boxVertices(box);
    FACES.forEach((face, fi) => {
      for (const tri of face) {
        const nrm = NORMALS[fi];
        view.setFloat32(off, nrm[0], true);
        view.setFloat32(off + 4, nrm[1], true);
        view.setFloat32(off + 8, nrm[2], true);
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
