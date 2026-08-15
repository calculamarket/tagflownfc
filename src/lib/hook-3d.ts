import earcut from "earcut";
import { normalizeSlot, pack3mf, type MaterialSlot } from "./three-mf";
import type { Tri } from "./pet-tag-3d";

/**
 * Parametric wall hook generator.
 *
 * The back plate lies flat on the bed (Z = 0 … plateMm) and the arm rises in
 * +Z, so the piece prints without supports. Plate shape, surface texture,
 * screw holes and arm geometry are all adjustable.
 */

export type PlateShape = "nuvem" | "arredondado" | "circulo" | "coracao" | "hexagono";
export type PlateTexture =
  | "liso"
  | "listras"
  | "xadrez"
  | "ondas"
  | "pontos"
  | "favo"
  | "diagonal";

export const PLATE_SHAPES: { id: PlateShape; label: string }[] = [
  { id: "nuvem", label: "Nuvem" },
  { id: "arredondado", label: "Retângulo arredondado" },
  { id: "circulo", label: "Círculo" },
  { id: "coracao", label: "Coração" },
  { id: "hexagono", label: "Hexágono" },
];

export const PLATE_TEXTURES: { id: PlateTexture; label: string }[] = [
  { id: "liso", label: "Liso" },
  { id: "listras", label: "Listras" },
  { id: "xadrez", label: "Xadrez" },
  { id: "ondas", label: "Ondas" },
  { id: "pontos", label: "Pontos" },
  { id: "favo", label: "Favo de mel" },
  { id: "diagonal", label: "Diagonais" },
];

export type HookOptions = {
  shape?: PlateShape;
  plateWidthMm?: number;
  plateHeightMm?: number;
  plateThickMm?: number;
  cornerRadiusMm?: number;
  texture?: PlateTexture;
  textureDepthMm?: number;
  texturePitchMm?: number;
  /** 0, 1, 2 or 4 screw holes. */
  screwHoles?: number;
  screwDiameterMm?: number;
  screwSpacingMm?: number;
  countersink?: boolean;
  countersinkDiameterMm?: number;
  countersinkDepthMm?: number;
  /** Arm. */
  armWidthMm?: number;
  armThickMm?: number;
  armRiseMm?: number;
  armReachMm?: number;
  armLipMm?: number;
  /** Where the arm meets the plate, measured from the plate bottom edge. */
  armOffsetMm?: number;
};

export type HookGeometry = {
  body: Tri[];
  texture: Tri[];
  widthMm: number;
  heightMm: number;
  plateThickMm: number;
  totalReachMm: number;
  totalRiseMm: number;
  screwCenters: [number, number][];
};

type Pt = [number, number];
const OVERLAP = 0.2;

/* ------------------------------------------------------------------ shapes */

function roundedRect(w: number, h: number, r: number, segments = 10): Pt[] {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  const x0 = -w / 2;
  const y0 = -h / 2;
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

function ellipse(w: number, h: number, segments = 72): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    pts.push([(w / 2) * Math.cos(a), (h / 2) * Math.sin(a)]);
  }
  return pts;
}

function hexagon(w: number, h: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (2 * Math.PI * i) / 6;
    pts.push([(w / 2) * Math.cos(a), (h / 2) * Math.sin(a)]);
  }
  return pts;
}

function heart(w: number, h: number, segments = 120): Pt[] {
  const raw: Pt[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    const x = 16 * Math.sin(t) ** 3;
    const y =
      13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    raw.push([x, y]);
  }
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const sx = w / (Math.max(...xs) - Math.min(...xs));
  const sy = h / (Math.max(...ys) - Math.min(...ys));
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return raw.map(([x, y]) => [x * sx, (y - cy) * sy] as Pt);
}

/** Cloud outline: union of overlapping circles with a flat bottom edge. */
function cloud(w: number, h: number, segments = 160): Pt[] {
  const circles: [number, number, number][] = [
    [0, 0.04 * h, 0.3 * w],
    [-0.28 * w, -0.04 * h, 0.23 * w],
    [0.29 * w, -0.02 * h, 0.24 * w],
    [-0.1 * w, 0.16 * h, 0.24 * w],
    [0.14 * w, 0.14 * h, 0.22 * w],
  ];
  const yBottom = -h / 2;
  const pts: Pt[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = 0;
    for (const [cx, cy, r] of circles) {
      // farthest intersection of the ray with this circle
      const b = dx * cx + dy * cy;
      const c = cx * cx + cy * cy - r * r;
      const disc = b * b - c;
      if (disc < 0) continue;
      const t = b + Math.sqrt(disc);
      if (t > best) best = t;
    }
    if (best <= 0) continue;
    const x = dx * best;
    const y = Math.max(yBottom, dy * best);
    pts.push([x, y]);
  }
  return pts;
}

export function plateOutline(
  shape: PlateShape,
  w: number,
  h: number,
  radius: number,
): Pt[] {
  switch (shape) {
    case "circulo":
      return ellipse(w, h);
    case "hexagono":
      return hexagon(w, h);
    case "coracao":
      return heart(w, h);
    case "nuvem":
      return cloud(w, h);
    default:
      return roundedRect(w, h, radius);
  }
}

/* -------------------------------------------------------------- primitives */

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

function prism(outer: Pt[], holes: Pt[][], z0: number, z1: number): Tri[] {
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
  return prism(
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

function circleRing(cx: number, cy: number, r: number, segments = 40): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Cone wall (countersink) between two radii at two heights. */
function cone(cx: number, cy: number, r0: number, z0: number, r1: number, z1: number, segments = 40): Tri[] {
  const tris: Tri[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (2 * Math.PI * i) / segments;
    const a1 = (2 * Math.PI * (i + 1)) / segments;
    const p0: [number, number, number] = [cx + r0 * Math.cos(a0), cy + r0 * Math.sin(a0), z0];
    const p1: [number, number, number] = [cx + r0 * Math.cos(a1), cy + r0 * Math.sin(a1), z0];
    const q0: [number, number, number] = [cx + r1 * Math.cos(a0), cy + r1 * Math.sin(a0), z1];
    const q1: [number, number, number] = [cx + r1 * Math.cos(a1), cy + r1 * Math.sin(a1), z1];
    tris.push([p0, q1, p1], [p0, q0, q1]);
  }
  return tris;
}

/** Profile polygon extruded along X (used for the arm, defined in Y/Z). */
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

function pointInPolygon(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Approximate inset by scaling the outline toward its centroid. */
function shrink(poly: Pt[], mm: number): Pt[] {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const avg =
    poly.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / poly.length || 1;
  const k = Math.max(0.1, 1 - mm / avg);
  return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k] as Pt);
}

function texturePattern(kind: PlateTexture, x: number, y: number, pitch: number): boolean {
  const p = Math.max(1, pitch);
  switch (kind) {
    case "listras":
      return ((y % p) + p) % p < p / 2;
    case "diagonal":
      return ((((x + y) % p) + p) % p) < p / 2;
    case "xadrez":
      return (Math.floor(x / p) + Math.floor(y / p)) % 2 === 0;
    case "ondas":
      return y - Math.sin(x / (p / 2)) * (p / 2) > 0
        ? (((y - Math.sin(x / (p / 2)) * (p / 2)) % p) + p) % p < p / 2
        : (((y - Math.sin(x / (p / 2)) * (p / 2)) % p) + p) % p < p / 2;
    case "pontos": {
      const dx = (((x % p) + p) % p) - p / 2;
      const dy = (((y % p) + p) % p) - p / 2;
      return Math.hypot(dx, dy) < p * 0.28;
    }
    case "favo": {
      const row = Math.round(y / (p * 0.866));
      const ox = row % 2 === 0 ? 0 : p / 2;
      const dx = ((((x - ox) % p) + p) % p) - p / 2;
      const dy = y - row * p * 0.866;
      return Math.hypot(dx, dy) < p * 0.3;
    }
    default:
      return false;
  }
}

/* -------------------------------------------------------------- generation */

export function buildHookGeometry(options: HookOptions = {}): HookGeometry {
  const {
    shape = "nuvem",
    plateWidthMm = 46,
    plateHeightMm = 34,
    plateThickMm = 4,
    cornerRadiusMm = 6,
    texture = "liso",
    textureDepthMm = 0.6,
    texturePitchMm = 4,
    screwHoles = 2,
    screwDiameterMm = 4,
    screwSpacingMm = 24,
    countersink = true,
    countersinkDiameterMm = 8,
    countersinkDepthMm = 2,
    armWidthMm = 12,
    armThickMm = 6,
    armRiseMm = 22,
    armReachMm = 20,
    armLipMm = 8,
    armOffsetMm = 0,
  } = options;

  const outer = plateOutline(shape, plateWidthMm, plateHeightMm, cornerRadiusMm);
  const t = plateThickMm;

  // Screw holes.
  const r = Math.max(0.6, screwDiameterMm / 2);
  const centers: [number, number][] = [];
  if (screwHoles === 1) centers.push([0, plateHeightMm * 0.22]);
  if (screwHoles === 2) {
    const dx = Math.min(screwSpacingMm, plateWidthMm - 2 * (r + 2)) / 2;
    centers.push([-dx, plateHeightMm * 0.18], [dx, plateHeightMm * 0.18]);
  }
  if (screwHoles === 4) {
    const dx = Math.min(screwSpacingMm, plateWidthMm - 2 * (r + 2)) / 2;
    const dy = Math.min(screwSpacingMm, plateHeightMm - 2 * (r + 2)) / 2;
    centers.push([-dx, dy], [dx, dy], [-dx, -dy], [dx, -dy]);
  }
  const rings = centers.map(([cx, cy]) => circleRing(cx, cy, r));

  const csR = Math.max(r + 0.6, countersinkDiameterMm / 2);
  const csDepth = Math.min(Math.max(0.4, countersinkDepthMm), t - 1);
  const useCs = countersink && centers.length > 0 && t - csDepth >= 1;

  const body: Tri[] = [];
  if (useCs) {
    body.push(...prism(outer, rings, 0, t - csDepth));
    body.push(
      ...prism(
        outer,
        centers.map(([cx, cy]) => circleRing(cx, cy, csR)),
        t - csDepth - OVERLAP / 2,
        t,
      ),
    );
    for (const [cx, cy] of centers) {
      body.push(...cone(cx, cy, r, t - csDepth, csR, t));
    }
  } else {
    body.push(...prism(outer, rings, 0, t));
  }

  // Arm: profile swept in the Y/Z plane, extruded across X.
  const aw = Math.max(3, Math.min(armWidthMm, plateWidthMm - 4));
  const at = Math.max(2, armThickMm);
  const rise = Math.max(4, armRiseMm);
  const reach = Math.max(4, armReachMm);
  const lip = Math.max(0, armLipMm);
  const yBase = armOffsetMm;

  // Centre line: up from the plate, quarter-turn toward +Z' (out of the wall),
  // then the lip. In this coordinate system the plate lies on the bed, so the
  // "out of the wall" direction is +Y once mounted.
  const path: Pt[] = [[yBase, -0.5]];
  const segs = 14;
  const cy0 = yBase;
  path.push([cy0, rise - reach / 2]);
  for (let i = 1; i <= segs; i++) {
    const a = (Math.PI / 2) * (i / segs);
    path.push([
      cy0 + (reach / 2) * Math.sin(a),
      rise - reach / 2 + (reach / 2) * (1 - Math.cos(a)),
    ]);
  }
  if (lip > 0) path.push([cy0 + reach / 2 + lip * 0.35, rise + lip * 0.9]);

  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(path.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    left.push([path[i][0] + (nx * at) / 2, path[i][1] + (ny * at) / 2]);
    right.push([path[i][0] - (nx * at) / 2, path[i][1] - (ny * at) / 2]);
  }
  const armProfile: Pt[] = [...left, ...right.reverse()];
  body.push(...prismX(armProfile, -aw / 2, aw / 2));

  // Surface texture on the visible face, clipped to the plate interior.
  const textureTris: Tri[] = [];
  if (texture !== "liso" && textureDepthMm > 0) {
    const inner = shrink(outer, 2);
    const cell = 0.6;
    const pitch = Math.max(1.2, texturePitchMm);
    const nx = Math.ceil(plateWidthMm / cell);
    const ny = Math.ceil(plateHeightMm / cell);
    const z0 = t - OVERLAP;
    const z1 = t + textureDepthMm;
    for (let iy = 0; iy < ny; iy++) {
      const y = -plateHeightMm / 2 + iy * cell;
      let run = 0;
      for (let ix = 0; ix <= nx; ix++) {
        const x = -plateWidthMm / 2 + ix * cell;
        const cxp = x + cell / 2;
        const cyp = y + cell / 2;
        const nearHole = centers.some(
          ([hx, hy]) => Math.hypot(cxp - hx, cyp - hy) < (useCs ? csR : r) + 1.5,
        );
        const underArm =
          Math.abs(cxp) < aw / 2 + 1 && Math.abs(cyp - yBase) < at / 2 + 1;
        const on =
          ix < nx &&
          !nearHole &&
          !underArm &&
          pointInPolygon(cxp, cyp, inner) &&
          texturePattern(texture, cxp, cyp, pitch);
        if (on) {
          run++;
          continue;
        }
        if (run > 0) {
          const sx = -plateWidthMm / 2 + (ix - run) * cell;
          textureTris.push(...box(sx, y, z0, sx + run * cell, y + cell, z1));
          run = 0;
        }
      }
    }
  }

  const tipY = path[path.length - 1][1];
  return {
    body,
    texture: textureTris,
    widthMm: plateWidthMm,
    heightMm: plateHeightMm,
    plateThickMm: t,
    totalReachMm: path[path.length - 1][0] - yBase + at / 2,
    totalRiseMm: tipY,
    screwCenters: centers,
  };
}

/* ------------------------------------------------------------------ export */

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
  for (const tri of tris) {
    const n = normal(tri);
    view.setFloat32(off, n[0], true);
    view.setFloat32(off + 4, n[1], true);
    view.setFloat32(off + 8, n[2], true);
    off += 12;
    for (const p of tri) {
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

export function buildHookStl(options: HookOptions): Blob {
  const { body, texture } = buildHookGeometry(options);
  return new Blob([trisToStl([...body, ...texture], "Gancho parametrico - 3D QR")], {
    type: "model/stl",
  });
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

export function buildHook3mf(
  options: HookOptions & {
    bodySlot?: Partial<MaterialSlot>;
    textureSlot?: Partial<MaterialSlot>;
  },
): Promise<Blob> {
  const { body, texture } = buildHookGeometry(options);
  const bodySlot = normalizeSlot(options.bodySlot, {
    extruder: 1,
    material: "PLA",
    color: "#FFFFFF",
  });
  const textureSlot = normalizeSlot(options.textureSlot, {
    extruder: 2,
    material: "PLA",
    color: "#111111",
  });

  const objects = [
    { name: "Gancho", mesh: trisToMesh(body), triangleCount: body.length, slot: bodySlot },
  ];
  if (texture.length) {
    objects.push({
      name: "Textura",
      mesh: trisToMesh(texture),
      triangleCount: texture.length,
      slot: textureSlot,
    });
  }
  return pack3mf(objects);
}
