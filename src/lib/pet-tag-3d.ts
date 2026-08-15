import QRCode from "qrcode";
import { normalizeSlot, pack3mf, type MaterialSlot } from "./three-mf";

/**
 * Parametric "Pet Tag" — a collar slider plate with a QR code on top.
 *
 * Shape mirrors the reference model: a rounded plate (default 50 x 32 x 3 mm)
 * sitting on two legs at each end, leaving a slot the collar strap runs through.
 * The QR code is generated on the fly and lives on the plate's top face, so the
 * whole piece comes out of the generator ready to slice.
 *
 * Everything is emitted as closed, overlapping solids: slicers union those
 * reliably, whereas hand-culled shared faces are where meshes go non-manifold.
 */
export type PetTagOptions = {
  /** QR content. */
  text: string;
  /** Plate width (along the strap) in mm. */
  widthMm?: number;
  /** Plate depth in mm. */
  depthMm?: number;
  /** Plate thickness in mm. */
  plateMm?: number;
  /** Corner radius of the plate in mm. */
  radiusMm?: number;
  /** Width of each collar leg in mm. */
  legWidthMm?: number;
  /** Height of the strap slot (leg height) in mm. */
  legHeightMm?: number;
  /** Thickness of the floor below the strap slot in mm. */
  floorMm?: number;
  /** Side of the QR code itself in mm (quiet zone is added around it). */
  qrSizeMm?: number;
  /** Quiet zone around the code in mm. */
  quietZoneMm?: number;
  /** How far the code rises above the plate in mm. */
  codeMm?: number;
  /** Error correction: L ~7%, M ~15%, Q ~25%, H ~30%. */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  /** Raise the light modules instead of the dark ones. */
  recessed?: boolean;
  /** Horizontal placement of the QR on the plate. */
  qrAlign?: "left" | "center" | "right";
  /** Margin from the plate edge when the QR is aligned to a side, in mm. */
  qrMarginMm?: number;
};

export type Tri = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export type PetTagGeometry = {
  body: Tri[];
  code: Tri[];
  /** Overall bounding size, for the UI summary. */
  totalWidthMm: number;
  totalDepthMm: number;
  totalHeightMm: number;
  /** Z of the plate top face — the filament-change height for a single STL. */
  codeStartZ: number;
  /** Largest QR side that still fits with the current quiet zone. */
  maxQrSizeMm: number;
};

const OVERLAP = 0.2;

type Pt = [number, number];

function roundedRect(
  x0: number,
  y0: number,
  w: number,
  d: number,
  r: number,
  segments = 8,
): Pt[] {
  const radius = Math.max(0, Math.min(r, Math.min(w, d) / 2));
  if (radius === 0) {
    return [
      [x0, y0],
      [x0 + w, y0],
      [x0 + w, y0 + d],
      [x0, y0 + d],
    ];
  }
  const corners: [number, number, number][] = [
    [x0 + w - radius, y0 + radius, -Math.PI / 2],
    [x0 + w - radius, y0 + d - radius, 0],
    [x0 + radius, y0 + d - radius, Math.PI / 2],
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

/** Extrude a convex CCW polygon between two Z planes into closed triangles. */
function extrude(poly: Pt[], z0: number, z1: number): Tri[] {
  const tris: Tri[] = [];
  const n = poly.length;
  for (let i = 1; i < n - 1; i++) {
    tris.push([
      [poly[0][0], poly[0][1], z0],
      [poly[i + 1][0], poly[i + 1][1], z0],
      [poly[i][0], poly[i][1], z0],
    ]);
    tris.push([
      [poly[0][0], poly[0][1], z1],
      [poly[i][0], poly[i][1], z1],
      [poly[i + 1][0], poly[i + 1][1], z1],
    ]);
  }
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
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

function box(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): Tri[] {
  return extrude(
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    z0,
    z1,
  );
}

export function buildPetTagGeometry(options: PetTagOptions): PetTagGeometry {
  const {
    text,
    widthMm = 50,
    depthMm = 32,
    plateMm = 3,
    radiusMm = 4,
    legWidthMm = 10,
    legHeightMm = 7,
    floorMm = 1.2,
    qrSizeMm = 24,
    quietZoneMm = 2,
    codeMm = 0.8,
    errorCorrectionLevel = "Q",
    recessed = false,
  } = options;

  // Solid block sitting flat on the bed: a floor, two side walls and the QR
  // plate on top. The strap channel is a real rectangular slot that goes right
  // through the piece (front to back), exactly like the reference part, and the
  // QR faces +Z — no supports needed, the plate just bridges the slot.
  const floorZ0 = 0;
  const floorZ1 = floorMm;
  const legZ1 = floorZ1 + legHeightMm;
  const plateZ0 = legZ1;
  const plateZ1 = plateZ0 + plateMm;
  const topZ = plateZ1 + codeMm;

  const outer = roundedRect(0, 0, widthMm, depthMm, radiusMm);
  const wallR = Math.min(radiusMm, legWidthMm / 2);
  const body: Tri[] = [
    ...extrude(outer, floorZ0, floorZ1 + OVERLAP),
    ...extrude(
      roundedRect(0, 0, legWidthMm, depthMm, wallR),
      floorZ1,
      legZ1 + OVERLAP,
    ),
    ...extrude(
      roundedRect(widthMm - legWidthMm, 0, legWidthMm, depthMm, wallR),
      floorZ1,
      legZ1 + OVERLAP,
    ),
    ...extrude(outer, plateZ0, plateZ1),
  ];

  // QR code, centred on the plate top face.
  const qr = QRCode.create(text || " ", { errorCorrectionLevel });
  const count = qr.modules.size;
  const data = qr.modules.data;

  const maxQrSizeMm = Math.max(
    0,
    Math.min(widthMm, depthMm) - 2 * quietZoneMm - 2,
  );
  const side = Math.min(qrSizeMm, maxQrSizeMm > 0 ? maxQrSizeMm : qrSizeMm);
  const moduleMm = side / count;
  const originX = (widthMm - side) / 2;
  const originY = (depthMm - side) / 2;
  const z0 = plateZ1 - OVERLAP;


  const code: Tri[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      const dark = data[row * count + col] === 1;
      if (recessed ? dark : !dark) continue;
      const x = originX + col * moduleMm;
      // Flip Y so the code reads correctly seen from +Z.
      const y = originY + (count - 1 - row) * moduleMm;
      code.push(...box(x, y, z0, x + moduleMm, y + moduleMm, topZ));
    }
  }

  // In recess mode the quiet frame rises with the light modules, otherwise the
  // contrast around the code inverts.
  if (recessed && quietZoneMm > 0) {
    const a0 = originX - quietZoneMm;
    const a1 = originX + side + quietZoneMm;
    const b0 = originY - quietZoneMm;
    const b1 = originY + side + quietZoneMm;
    code.push(
      ...box(a0, b0, z0, a1, originY, topZ),
      ...box(a0, originY + side, z0, a1, b1, topZ),
      ...box(a0, originY, z0, originX, originY + side, topZ),
      ...box(originX + side, originY, z0, a1, originY + side, topZ),
    );
  }

  return {
    body,
    code,
    totalWidthMm: widthMm,
    totalDepthMm: depthMm,
    totalHeightMm: topZ,
    codeStartZ: plateZ1,
    maxQrSizeMm,
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

/** Single-solid STL: body and code merged, for one-colour printing. */
export function buildPetTagStl(options: PetTagOptions): Blob {
  const { body, code } = buildPetTagGeometry(options);
  const stl = trisToStl([...body, ...code], "Pet Tag QR - 3D QR");
  return new Blob([stl], { type: "model/stl" });
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

export function buildPetTag3mf(
  options: PetTagOptions & {
    bodyColor?: string;
    codeColor?: string;
    bodySlot?: Partial<MaterialSlot>;
    codeSlot?: Partial<MaterialSlot>;
  },
): Promise<Blob> {
  const { body, code } = buildPetTagGeometry(options);
  const bodySlot = normalizeSlot(
    { color: options.bodyColor, ...options.bodySlot },
    { extruder: 1, material: "PLA", color: "#FFFFFF" },
  );
  const codeSlot = normalizeSlot(
    { color: options.codeColor, ...options.codeSlot },
    { extruder: 2, material: "PLA", color: "#111111" },
  );

  return pack3mf([
    { name: "Corpo", mesh: trisToMesh(body), triangleCount: body.length, slot: bodySlot },
    { name: "Codigo", mesh: trisToMesh(code), triangleCount: code.length, slot: codeSlot },
  ]);
}
