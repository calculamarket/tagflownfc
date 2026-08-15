import QRCode from "qrcode";
import { createZip } from "./zip";
import type { Tri } from "./pet-tag-3d";

/**
 * Parametric "Etiqueta Plana" — a flat rounded plate with a QR code on top and
 * an optional hanging hole. Matches the reference model (49 x 33 x 2.5 mm plate
 * with a 25 mm / 1 mm-tall QR on top) but every measure is adjustable, so the
 * same generator serves pet tags, luggage tags, keychains, asset labels, etc.
 */
export type FlatTagOptions = {
  text: string;
  widthMm?: number;
  depthMm?: number;
  plateMm?: number;
  radiusMm?: number;
  /** Add a hanging hole. */
  hole?: boolean;
  holeDiameterMm?: number;
  /** Distance from the left edge to the hole centre. */
  holeMarginMm?: number;
  qrSizeMm?: number;
  quietZoneMm?: number;
  codeMm?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  recessed?: boolean;
};

export type FlatTagGeometry = {
  body: Tri[];
  code: Tri[];
  totalWidthMm: number;
  totalDepthMm: number;
  totalHeightMm: number;
  codeStartZ: number;
  maxQrSizeMm: number;
  /** Centre of the QR area (used by the UI summary). */
  qrCenterXMm: number;
};

const OVERLAP = 0.2;
type Pt = [number, number];

function roundedRect(x0: number, y0: number, w: number, d: number, r: number, segments = 10): Pt[] {
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

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Tri[] {
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

/** Cast a ray from `c` at angle `a` and return where it leaves the polygon. */
function rayHit(poly: Pt[], c: Pt, a: number): Pt {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let best: Pt | null = null;
  let bestT = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const ex = q[0] - p[0];
    const ey = q[1] - p[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((p[0] - c[0]) * ey - (p[1] - c[1]) * ex) / den;
    const u = ((p[0] - c[0]) * dy - (p[1] - c[1]) * dx) / den;
    if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && t < bestT) {
      bestT = t;
      best = [c[0] + dx * t, c[1] + dy * t];
    }
  }
  return best ?? [c[0], c[1]];
}

/** Plate with a circular hole: ring faces + outer walls + hole walls. */
function plateWithHole(
  outer: Pt[],
  center: Pt,
  radius: number,
  z0: number,
  z1: number,
  rays = 72,
): Tri[] {
  const tris: Tri[] = [];
  const inner: Pt[] = [];
  const rim: Pt[] = [];
  for (let i = 0; i < rays; i++) {
    const a = (2 * Math.PI * i) / rays;
    inner.push([center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)]);
    rim.push(rayHit(outer, center, a));
  }
  for (let i = 0; i < rays; i++) {
    const j = (i + 1) % rays;
    const ai = inner[i];
    const aj = inner[j];
    const bi = rim[i];
    const bj = rim[j];
    // bottom (normals down), top (normals up)
    tris.push([
      [ai[0], ai[1], z0],
      [bi[0], bi[1], z0],
      [bj[0], bj[1], z0],
    ]);
    tris.push([
      [ai[0], ai[1], z0],
      [bj[0], bj[1], z0],
      [aj[0], aj[1], z0],
    ]);
    tris.push([
      [ai[0], ai[1], z1],
      [bj[0], bj[1], z1],
      [bi[0], bi[1], z1],
    ]);
    tris.push([
      [ai[0], ai[1], z1],
      [aj[0], aj[1], z1],
      [bj[0], bj[1], z1],
    ]);
    // outer wall
    tris.push([
      [bi[0], bi[1], z0],
      [bi[0], bi[1], z1],
      [bj[0], bj[1], z1],
    ]);
    tris.push([
      [bi[0], bi[1], z0],
      [bj[0], bj[1], z1],
      [bj[0], bj[1], z0],
    ]);
    // hole wall (normals point inward)
    tris.push([
      [ai[0], ai[1], z0],
      [aj[0], aj[1], z1],
      [ai[0], ai[1], z1],
    ]);
    tris.push([
      [ai[0], ai[1], z0],
      [aj[0], aj[1], z0],
      [aj[0], aj[1], z1],
    ]);
  }
  return tris;
}

export function buildFlatTagGeometry(options: FlatTagOptions): FlatTagGeometry {
  const {
    text,
    widthMm = 49,
    depthMm = 33,
    plateMm = 2.5,
    radiusMm = 5,
    hole = false,
    holeDiameterMm = 4,
    holeMarginMm = 5,
    qrSizeMm = 25,
    quietZoneMm = 2,
    codeMm = 1,
    errorCorrectionLevel = "Q",
    recessed = false,
  } = options;

  const outer = roundedRect(0, 0, widthMm, depthMm, radiusMm);
  const plateZ1 = plateMm;
  const topZ = plateZ1 + codeMm;

  const holeR = Math.max(0.5, holeDiameterMm / 2);
  const holeCx = Math.max(holeMarginMm, holeR + 0.8);
  const body: Tri[] = hole
    ? plateWithHole(outer, [holeCx, depthMm / 2], holeR, 0, plateZ1)
    : extrude(outer, 0, plateZ1);

  // Usable area for the code: full plate, minus the hole column when present.
  const areaX0 = hole ? holeCx + holeR + 1.5 : 0;
  const areaW = widthMm - areaX0;
  const maxQrSizeMm = Math.max(0, Math.min(areaW, depthMm) - 2 * quietZoneMm);
  const side = Math.min(qrSizeMm, maxQrSizeMm > 0 ? maxQrSizeMm : qrSizeMm);

  const qr = QRCode.create(text || " ", { errorCorrectionLevel });
  const count = qr.modules.size;
  const data = qr.modules.data;
  const moduleMm = side / count;
  const originX = areaX0 + (areaW - side) / 2;
  const originY = (depthMm - side) / 2;
  const z0 = plateZ1 - OVERLAP;

  const code: Tri[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      const dark = data[row * count + col] === 1;
      if (recessed ? dark : !dark) continue;
      const x = originX + col * moduleMm;
      const y = originY + (count - 1 - row) * moduleMm;
      code.push(...box(x, y, z0, x + moduleMm, y + moduleMm, topZ));
    }
  }

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
    qrCenterXMm: originX + side / 2,
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

export function buildFlatTagStl(options: FlatTagOptions): Blob {
  const { body, code } = buildFlatTagGeometry(options);
  return new Blob([trisToStl([...body, ...code], "Flat Tag QR - 3D QR")], { type: "model/stl" });
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

function displayColor(color: string | undefined, fallback: string): string {
  const c = color && /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  return `${c.toUpperCase()}FF`;
}

export function buildFlatTag3mf(
  options: FlatTagOptions & { bodyColor?: string; codeColor?: string },
): Promise<Blob> {
  const { body, code } = buildFlatTagGeometry(options);
  const bodyColor = displayColor(options.bodyColor, "#FFFFFF");
  const codeColor = displayColor(options.codeColor, "#111111");

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<resources>` +
    `<basematerials id="1">` +
    `<base name="Corpo" displaycolor="${bodyColor}"/>` +
    `<base name="Codigo" displaycolor="${codeColor}"/>` +
    `</basematerials>` +
    `<object id="2" type="model" pid="1" pindex="0">${trisToMesh(body)}</object>` +
    `<object id="3" type="model" pid="1" pindex="1">${trisToMesh(code)}</object>` +
    `</resources>` +
    `<build><item objectid="2"/><item objectid="3"/></build>` +
    `</model>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Target="/3D/3dmodel.model" Id="rel0" ` +
    `Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>` +
    `</Relationships>`;

  const encoder = new TextEncoder();
  return createZip([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rels) },
    { name: "3D/3dmodel.model", data: encoder.encode(model) },
  ]);
}
