import QRCode from "qrcode";
import earcut from "earcut";
import { normalizeSlot, pack3mf, type MaterialSlot } from "./three-mf";
import type { Tri } from "./pet-tag-3d";

/**
 * Parametric "Placa Pix": a display plate carrying a QR Code plus a free area
 * for logo / image / text, and a matching base (stand) with an angled slot the
 * plate slides into. Both parts are laid flat on the bed, QR facing +Z, so the
 * piece prints without supports.
 */

export type ReliefMask = {
  cols: number;
  rows: number;
  /** Row-major, top row first. */
  data: boolean[];
};

export type PixPlateOptions = {
  text: string;
  plateWidthMm?: number;
  plateHeightMm?: number;
  plateThickMm?: number;
  radiusMm?: number;
  qrSizeMm?: number;
  marginMm?: number;
  codeMm?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  recessed?: boolean;
  /** "bottom" keeps the free area at the top of the plate, "top" inverts it. */
  qrPosition?: "bottom" | "top";
  /** Optional second QR (menu, social, WhatsApp...) printed next to the Pix one. */
  secondText?: string | null;
  secondQrSizeMm?: number;
  /** Raster of the logo / image / text to emboss on the free area. */
  artMask?: ReliefMask | null;
  artHeightMm?: number;
  /** Recess the free area so a printed sticker / plate can be glued in. */
  artPocket?: boolean;
  artPocketDepthMm?: number;
  includeBase?: boolean;
  baseDepthMm?: number;
  baseHeightMm?: number;
  baseWidthMm?: number;
  slotAngleDeg?: number;
  slotDepthMm?: number;
  slotClearanceMm?: number;
};

export type PixPlateGeometry = {
  base: Tri[];
  plate: Tri[];
  code: Tri[];
  code2: Tri[];
  art: Tri[];
  plateWidthMm: number;
  plateHeightMm: number;
  plateTopZ: number;
  qrSideMm: number;
  qr2SideMm: number;
  maxQrSizeMm: number;
  artAreaWMm: number;
  artAreaHMm: number;
};


const OVERLAP = 0.2;
type Pt = [number, number];

function roundedRect(x0: number, y0: number, w: number, h: number, r: number, segments = 10): Pt[] {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  if (radius === 0) {
    return [
      [x0, y0],
      [x0 + w, y0],
      [x0 + w, y0 + h],
      [x0, y0 + h],
    ];
  }
  const corners: [number, number, number][] = [
    [x0 + w - radius, y0 + radius, -Math.PI / 2],
    [x0 + w - radius, y0 + h - radius, 0],
    [x0 + radius, y0 + h - radius, Math.PI / 2],
    [x0 + radius, y0 + radius, Math.PI],
  ];
  const pts: Pt[] = [];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= segments; i++) {
      const a = start + (Math.PI / 2) * (i / segments);
      pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }
  }
  return pts;
}

function wall(ring: Pt[], z0: number, z1: number): Tri[] {
  const tris: Tri[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    tris.push([
      [a[0], a[1], z0],
      [b[0], b[1], z0],
      [b[0], b[1], z1],
    ]);
    tris.push([
      [a[0], a[1], z0],
      [b[0], b[1], z1],
      [a[0], a[1], z1],
    ]);
  }
  return tris;
}

/** Prism between z0 and z1 built from an outer ring and optional holes. */
function plateWithHoles(outer: Pt[], holes: Pt[][], z0: number, z1: number): Tri[] {
  const coords: number[] = [];
  const holeIndices: number[] = [];
  for (const p of outer) coords.push(p[0], p[1]);
  for (const ring of holes) {
    holeIndices.push(coords.length / 2);
    for (const p of ring) coords.push(p[0], p[1]);
  }
  const indices = earcut(coords, holeIndices.length ? holeIndices : undefined, 2);
  const at = (i: number): Pt => [coords[i * 2], coords[i * 2 + 1]];
  const tris: Tri[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = at(indices[i]);
    const b = at(indices[i + 1]);
    const c = at(indices[i + 2]);
    tris.push([
      [a[0], a[1], z0],
      [c[0], c[1], z0],
      [b[0], b[1], z0],
    ]);
    tris.push([
      [a[0], a[1], z1],
      [b[0], b[1], z1],
      [c[0], c[1], z1],
    ]);
  }
  tris.push(...wall(outer, z0, z1));
  for (const ring of holes) tris.push(...wall([...ring].reverse(), z0, z1));
  return tris;
}

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Tri[] {
  return plateWithHoles(
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    [],
    z0,
    z1,
  );
}

/**
 * Prism built from a profile in the (Y, Z) plane and extruded along X.
 * Used for the base, whose defining feature is the angled slot on the top face.
 */
function prismX(profile: Pt[], x0: number, x1: number): Tri[] {
  const coords: number[] = [];
  for (const p of profile) coords.push(p[0], p[1]);
  const indices = earcut(coords, undefined, 2);
  const at = (i: number): Pt => [coords[i * 2], coords[i * 2 + 1]];
  const tris: Tri[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = at(indices[i]);
    const b = at(indices[i + 1]);
    const c = at(indices[i + 2]);
    // x0 cap (normals -X) and x1 cap (normals +X)
    tris.push([
      [x0, a[0], a[1]],
      [x0, b[0], b[1]],
      [x0, c[0], c[1]],
    ]);
    tris.push([
      [x1, a[0], a[1]],
      [x1, c[0], c[1]],
      [x1, b[0], b[1]],
    ]);
  }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i];
    const b = profile[(i + 1) % profile.length];
    tris.push([
      [x0, a[0], a[1]],
      [x1, a[0], a[1]],
      [x1, b[0], b[1]],
    ]);
    tris.push([
      [x0, a[0], a[1]],
      [x1, b[0], b[1]],
      [x0, b[0], b[1]],
    ]);
  }
  return tris;
}

/** Merge horizontal runs of a boolean mask into as few boxes as possible. */
function maskToBoxes(
  mask: ReliefMask,
  x0: number,
  y0: number,
  cellW: number,
  cellH: number,
  z0: number,
  z1: number,
): Tri[] {
  const tris: Tri[] = [];
  for (let row = 0; row < mask.rows; row++) {
    let run = 0;
    for (let col = 0; col <= mask.cols; col++) {
      const on = col < mask.cols && mask.data[row * mask.cols + col];
      if (on) {
        run++;
        continue;
      }
      if (run > 0) {
        const cx = x0 + (col - run) * cellW;
        // Row 0 is the top of the image.
        const cy = y0 + (mask.rows - 1 - row) * cellH;
        tris.push(...box(cx, cy, z0, cx + run * cellW, cy + cellH, z1));
        run = 0;
      }
    }
  }
  return tris;
}

export function buildPixPlateGeometry(options: PixPlateOptions): PixPlateGeometry {
  const {
    text,
    plateWidthMm = 80,
    plateHeightMm = 117,
    plateThickMm = 3,
    radiusMm = 4,
    qrSizeMm = 60,
    marginMm = 6,
    codeMm = 1,
    errorCorrectionLevel = "Q",
    recessed = false,
    qrPosition = "bottom",
    secondText = null,
    secondQrSizeMm = 34,
    artMask = null,
    artHeightMm = 1,
    artPocket = false,
    artPocketDepthMm = 0.8,
    includeBase = true,
    baseWidthMm = plateWidthMm,
    baseDepthMm = 76,
    baseHeightMm = 24,
    slotAngleDeg = 15,
    slotDepthMm = 14,
    slotClearanceMm = 0.4,
  } = options;

  const outer = roundedRect(0, 0, plateWidthMm, plateHeightMm, radiusMm);
  const topZ = plateThickMm;

  const usableW = Math.max(0, plateWidthMm - 2 * marginMm);
  const usableH = Math.max(0, plateHeightMm - 2 * marginMm);
  const maxQrSizeMm = Math.max(0, Math.min(usableW, usableH));
  const side = Math.min(qrSizeMm, maxQrSizeMm > 0 ? maxQrSizeMm : qrSizeMm);

  const gap = Math.min(marginMm, 6);
  const second = (secondText || "").trim();
  const side2 = second
    ? Math.max(0, Math.min(secondQrSizeMm, usableW, Math.max(0, usableH - side - gap)))
    : 0;
  const secondBand = side2 > 0 ? side2 + gap : 0;

  const artAreaHMm = Math.max(0, usableH - side - gap - secondBand);
  const artAreaWMm = usableW;

  // Vertical stack, from the bottom of the plate upwards.
  // qrPosition "bottom": [Pix QR] [2nd QR] [art]; "top": [art] [2nd QR] [Pix QR].
  const qrY0 =
    qrPosition === "bottom" ? marginMm : marginMm + artAreaHMm + gap + secondBand;
  const qr2Y0 =
    qrPosition === "bottom" ? marginMm + side + gap : marginMm + artAreaHMm + gap;
  const artY0 =
    qrPosition === "bottom" ? marginMm + side + gap + secondBand : marginMm;
  const qrX0 = marginMm + (usableW - side) / 2;
  const qr2X0 = marginMm + (usableW - side2) / 2;

  // Plate body — optionally with a recessed pocket over the free area.
  const pocketDepth = Math.min(Math.max(0.2, artPocketDepthMm), plateThickMm - 1);
  const usePocket = artPocket && artAreaHMm > 4 && plateThickMm - pocketDepth >= 1;
  const pocketRing: Pt[] | null = usePocket
    ? roundedRect(marginMm, artY0, artAreaWMm, artAreaHMm, Math.min(2, radiusMm))
    : null;

  const plate: Tri[] = usePocket
    ? [
        ...plateWithHoles(outer, [], 0, topZ - pocketDepth),
        ...plateWithHoles(outer, [pocketRing!], topZ - pocketDepth - OVERLAP / 2, topZ),
      ]
    : plateWithHoles(outer, [], 0, topZ);

  const codeZ0 = topZ - OVERLAP;
  const codeZ1 = topZ + codeMm;

  const buildCode = (content: string, x0: number, y0: number, sideMm: number): Tri[] => {
    const tris: Tri[] = [];
    if (sideMm <= 0) return tris;
    const qr = QRCode.create(content || " ", { errorCorrectionLevel });
    const count = qr.modules.size;
    const data = qr.modules.data;
    const moduleMm = sideMm / count;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        const dark = data[row * count + col] === 1;
        if (recessed ? dark : !dark) continue;
        const x = x0 + col * moduleMm;
        const y = y0 + (count - 1 - row) * moduleMm;
        tris.push(...box(x, y, codeZ0, x + moduleMm, y + moduleMm, codeZ1));
      }
    }
    return tris;
  };

  const code = buildCode(text, qrX0, qrY0, side);
  const code2 = second ? buildCode(second, qr2X0, qr2Y0, side2) : [];


  // Logo / image / text relief inside the free area.
  const art: Tri[] = [];
  if (artMask && artMask.cols > 0 && artMask.rows > 0 && artAreaHMm > 2) {
    const scale = Math.min(artAreaWMm / artMask.cols, artAreaHMm / artMask.rows);
    const w = artMask.cols * scale;
    const h = artMask.rows * scale;
    const ax = marginMm + (artAreaWMm - w) / 2;
    const ay = artY0 + (artAreaHMm - h) / 2;
    const artZBase = usePocket ? topZ - pocketDepth : topZ;
    art.push(
      ...maskToBoxes(artMask, ax, ay, scale, scale, artZBase - OVERLAP, artZBase + artHeightMm),
    );
  }

  // Base: rectangular block with an angled slot for the plate, printed beside
  // the plate so both parts come out flat on the bed.
  const baseTris: Tri[] = [];
  if (includeBase) {
    const angle = (Math.min(35, Math.max(0, slotAngleDeg)) * Math.PI) / 180;
    const thick = plateThickMm + Math.max(0.1, slotClearanceMm);
    const wSlot = thick / Math.cos(angle);
    const depth = Math.min(slotDepthMm, baseHeightMm - 3);
    const yc = baseDepthMm / 2;
    const yA = yc - wSlot / 2;
    const yB = yc + wSlot / 2;
    const dy = depth * Math.sin(angle);
    const zBottom = baseHeightMm - depth * Math.cos(angle);

    const profile: Pt[] = [
      [0, 0],
      [baseDepthMm, 0],
      [baseDepthMm, baseHeightMm],
      [yB, baseHeightMm],
      [yB + dy, zBottom],
      [yA + dy, zBottom],
      [yA, baseHeightMm],
      [0, baseHeightMm],
    ];
    const bx0 = plateWidthMm + 10;
    baseTris.push(...prismX(profile, bx0, bx0 + baseWidthMm));
  }

  return {
    base: baseTris,
    plate,
    code,
    code2,
    art,
    plateWidthMm,
    plateHeightMm,
    plateTopZ: topZ,
    qrSideMm: side,
    qr2SideMm: side2,

    maxQrSizeMm,
    artAreaWMm,
    artAreaHMm,
  };
}

function normal(t: Tri): [number, number, number] {
  const [a, b, c] = t;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: [number, number, number] = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

function trisToStl(tris: Tri[], header: string): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const head = header.slice(0, 79);
  for (let i = 0; i < head.length; i++) bytes[i] = head.charCodeAt(i) & 0x7f;
  view.setUint32(80, tris.length, true);
  let off = 84;
  for (const t of tris) {
    const n = normal(t);
    view.setFloat32(off, n[0], true);
    view.setFloat32(off + 4, n[1], true);
    view.setFloat32(off + 8, n[2], true);
    off += 12;
    for (const p of t) {
      view.setFloat32(off, p[0], true);
      view.setFloat32(off + 4, p[1], true);
      view.setFloat32(off + 8, p[2], true);
      off += 12;
    }
    view.setUint16(off, 0, true);
    off += 2;
  }
  return buffer;
}

/** Which piece(s) to export: whole set, only the plate, or only the base. */
export type PixPlatePart = "both" | "plate" | "base";

/** Move tris so the piece starts at X=0 (the base is modelled beside the plate). */
function shiftToOriginX(tris: Tri[]): Tri[] {
  let minX = Infinity;
  for (const t of tris) for (const p of t) if (p[0] < minX) minX = p[0];
  if (!Number.isFinite(minX) || Math.abs(minX) < 1e-9) return tris;
  return tris.map((t) => t.map((p) => [p[0] - minX, p[1], p[2]]) as Tri);
}

export function buildPixPlateStl(options: PixPlateOptions & { part?: PixPlatePart }): Blob {
  const part = options.part ?? "both";
  const { base, plate, code, code2, art } = buildPixPlateGeometry({
    ...options,
    includeBase: part === "plate" ? false : options.includeBase,
  });
  const tris =
    part === "base"
      ? shiftToOriginX(base)
      : part === "plate"
        ? [...plate, ...code, ...code2, ...art]
        : [...plate, ...code, ...code2, ...art, ...base];
  return new Blob([trisToStl(tris, "Placa Pix QR - 3D QR")], { type: "model/stl" });
}



const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

function trisToMesh(tris: Tri[]): string {
  const vertices: string[] = [];
  const triangles: string[] = [];
  let i = 0;
  for (const t of tris) {
    for (const p of t) {
      vertices.push(`<vertex x="${fmt(p[0])}" y="${fmt(p[1])}" z="${fmt(p[2])}"/>`);
    }
    triangles.push(`<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}"/>`);
    i += 3;
  }
  return `<mesh><vertices>${vertices.join("")}</vertices><triangles>${triangles.join("")}</triangles></mesh>`;
}

export function buildPixPlate3mf(
  options: PixPlateOptions & {
    plateSlot?: Partial<MaterialSlot>;
    codeSlot?: Partial<MaterialSlot>;
    code2Slot?: Partial<MaterialSlot>;
    artSlot?: Partial<MaterialSlot>;
    baseSlot?: Partial<MaterialSlot>;
  },
): Promise<Blob> {
  const { base, plate, code, code2, art } = buildPixPlateGeometry(options);
  const plateSlot = normalizeSlot(options.plateSlot, {
    extruder: 1,
    material: "PLA",
    color: "#FFFFFF",
  });
  const codeSlot = normalizeSlot(options.codeSlot, {
    extruder: 2,
    material: "PLA",
    color: "#111111",
  });
  const code2Slot = normalizeSlot(options.code2Slot, codeSlot);
  const artSlot = normalizeSlot(options.artSlot, codeSlot);
  const baseSlot = normalizeSlot(options.baseSlot, plateSlot);

  const objects = [
    { name: "Placa", mesh: trisToMesh(plate), triangleCount: plate.length, slot: plateSlot },
    { name: "Codigo", mesh: trisToMesh(code), triangleCount: code.length, slot: codeSlot },
  ];
  if (code2.length) {
    objects.push({
      name: "Codigo 2",
      mesh: trisToMesh(code2),
      triangleCount: code2.length,
      slot: code2Slot,
    });
  }
  if (art.length) {
    objects.push({ name: "Arte", mesh: trisToMesh(art), triangleCount: art.length, slot: artSlot });
  }

  if (base.length) {
    objects.push({ name: "Base", mesh: trisToMesh(base), triangleCount: base.length, slot: baseSlot });
  }

  return pack3mf(objects);
}
