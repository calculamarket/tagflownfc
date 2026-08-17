import earcut from "earcut";
import { normalizeSlot, pack3mf, type MaterialSlot } from "./three-mf";
import type { Tri } from "./pet-tag-3d";
import type { ReliefMask } from "./pix-plate-3d";

/**
 * Parametric flat-printed envelope, modelled after the reference 3MF: a square
 * centre panel with four folding flaps, each panel carrying a solid border
 * ("frame") and a decorative texture inside it. Everything lies flat on the bed
 * (Z+ up) so it prints without supports; the fold lines are thin living hinges.
 */

export type EnvelopePanelKey = "center" | "top" | "bottom" | "left" | "right";

export type EnvelopeOptions = {
  /** Side of the square centre panel, in mm. */
  sizeMm?: number;
  /** Flap heights, in mm. */
  topFlapMm?: number;
  bottomFlapMm?: number;
  sideFlapMm?: number;
  /** How much each flap narrows towards its tip, in mm. */
  taperMm?: number;
  /** Panel thickness (the solid frame and the base of the texture). */
  thicknessMm?: number;
  /** Border width around each panel. */
  frameMm?: number;
  /** Extra height of the frame above the texture. */
  frameReliefMm?: number;
  /** Texture layer thickness. */
  textureThickMm?: number;
  /** Gap between panels (folding line). */
  foldGapMm?: number;
  /** Thickness of the living hinge that bridges the fold gap. */
  hingeMm?: number;
  /** Texture raster tiled inside the frames. */
  texture?: ReliefMask | null;
  /** Size of one texture cell in mm. */
  textureCellMm?: number;
  /** Solid backing under the texture (closed envelope) instead of open lace. */
  solidBack?: boolean;
};

export type EnvelopeGeometry = {
  frame: Tri[];
  texture: Tri[];
  widthMm: number;
  heightMm: number;
  panels: { key: EnvelopePanelKey; outer: Pt[]; inner: Pt[] }[];
};

type Pt = [number, number];

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

/** Shrink a convex polygon towards its centroid by `d` mm (good enough for the flaps). */
function insetPolygon(ring: Pt[], d: number): Pt[] {
  const n = ring.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n];
    const cur = ring[i];
    const next = ring[(i + 1) % n];
    const n1 = normalOf(prev, cur);
    const n2 = normalOf(cur, next);
    let nx = n1[0] + n2[0];
    let ny = n1[1] + n2[1];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const cos = Math.max(0.35, nx * n1[0] + ny * n1[1]);
    out.push([cur[0] + (nx * d) / cos, cur[1] + (ny * d) / cos]);
  }
  return out;
}

/** Inward normal of edge a→b for a counter-clockwise ring. */
function normalOf(a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

function pointInPolygon(x: number, y: number, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function buildEnvelopeGeometry(options: EnvelopeOptions = {}): EnvelopeGeometry {
  const size = Math.max(40, options.sizeMm ?? 110);
  const top = Math.max(10, options.topFlapMm ?? size * 0.55);
  const bottom = Math.max(10, options.bottomFlapMm ?? size * 0.45);
  const side = Math.max(10, options.sideFlapMm ?? size * 0.45);
  const taper = Math.max(0, options.taperMm ?? size * 0.12);
  const t = Math.max(0.4, options.thicknessMm ?? 0.8);
  const frameW = Math.max(1, options.frameMm ?? 4);
  const frameRelief = Math.max(0, options.frameReliefMm ?? 0.4);
  const textureThick = Math.max(0.2, options.textureThickMm ?? 0.6);
  const gap = Math.max(0.4, options.foldGapMm ?? 1.2);
  const hinge = Math.min(t, Math.max(0.2, options.hingeMm ?? 0.35));
  const solidBack = options.solidBack ?? false;
  const cell = Math.max(0.4, options.textureCellMm ?? 0.8);

  const h = size / 2;
  const g = gap / 2;

  // Counter-clockwise rings for every panel.
  const center: Pt[] = [
    [-h + g, -h + g],
    [h - g, -h + g],
    [h - g, h - g],
    [-h + g, h - g],
  ];
  const topFlap: Pt[] = [
    [-h, h + g],
    [h, h + g],
    [h - taper, h + top],
    [-h + taper, h + top],
  ];
  const bottomFlap: Pt[] = [
    [-h + taper, -h - bottom],
    [h - taper, -h - bottom],
    [h, -h - g],
    [-h, -h - g],
  ];
  const leftFlap: Pt[] = [
    [-h - side, -h + taper],
    [-h - g, -h],
    [-h - g, h],
    [-h - side, h - taper],
  ];
  const rightFlap: Pt[] = [
    [h + g, -h],
    [h + side, -h + taper],
    [h + side, h - taper],
    [h + g, h],
  ];

  const panels: { key: EnvelopePanelKey; outer: Pt[]; inner: Pt[] }[] = [
    { key: "center", outer: center, inner: insetPolygon(center, frameW) },
    { key: "top", outer: topFlap, inner: insetPolygon(topFlap, frameW) },
    { key: "bottom", outer: bottomFlap, inner: insetPolygon(bottomFlap, frameW) },
    { key: "left", outer: leftFlap, inner: insetPolygon(leftFlap, frameW) },
    { key: "right", outer: rightFlap, inner: insetPolygon(rightFlap, frameW) },
  ];

  const frame: Tri[] = [];
  for (const p of panels) {
    if (solidBack) {
      frame.push(...prism(p.outer, [], 0, t));
      frame.push(...prism(p.outer, [p.inner], t, t + frameRelief));
    } else {
      frame.push(...prism(p.outer, [p.inner], 0, t + frameRelief));
    }
  }

  // Living hinges bridging the fold gaps.
  const hy = gap / 2 + 0.05;
  frame.push(...box(-h + frameW * 0.2, h - hy, 0, h - frameW * 0.2, h + hy, hinge));
  frame.push(...box(-h + frameW * 0.2, -h - hy, 0, h - frameW * 0.2, -h + hy, hinge));
  frame.push(...box(-h - hy, -h + frameW * 0.2, 0, -h + hy, h - frameW * 0.2, hinge));
  frame.push(...box(h - hy, -h + frameW * 0.2, 0, h + hy, h - frameW * 0.2, hinge));

  // Texture tiled over the whole net, clipped to the inner area of each panel.
  const texture: Tri[] = [];
  const mask = options.texture;
  if (mask && mask.cols > 0 && mask.rows > 0) {
    const minX = -h - side;
    const maxX = h + side;
    const minY = -h - bottom;
    const maxY = h + top;
    const cols = Math.ceil((maxX - minX) / cell);
    const rows = Math.ceil((maxY - minY) / cell);
    const z0 = solidBack ? t : 0;
    const z1 = solidBack ? t + textureThick : Math.min(t + frameRelief, textureThick);
    for (let r = 0; r < rows; r++) {
      const y = minY + r * cell;
      const cy = y + cell / 2;
      let run = 0;
      for (let c = 0; c <= cols; c++) {
        const x = minX + c * cell;
        const cx = x + cell / 2;
        const mc = ((c % mask.cols) + mask.cols) % mask.cols;
        const mr = ((mask.rows - 1 - (r % mask.rows)) % mask.rows + mask.rows) % mask.rows;
        const filled =
          c < cols &&
          mask.data[mr * mask.cols + mc] &&
          panels.some((p) => pointInPolygon(cx, cy, p.inner));
        if (filled) {
          run++;
          continue;
        }
        if (run > 0) {
          const x0 = minX + (c - run) * cell;
          texture.push(...box(x0, y, z0, x0 + run * cell, y + cell, z1));
          run = 0;
        }
      }
    }
  }

  return {
    frame,
    texture,
    widthMm: size + side * 2,
    heightMm: size + top + bottom,
    panels,
  };
}

function trisToStl(tris: Tri[], name: string): string {
  const lines = [`solid ${name}`];
  for (const [a, b, c] of tris) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    lines.push(`facet normal ${nx} ${ny} ${nz}`, "outer loop");
    for (const p of [a, b, c]) lines.push(`vertex ${p[0]} ${p[1]} ${p[2]}`);
    lines.push("endloop", "endfacet");
  }
  lines.push(`endsolid ${name}`);
  return lines.join("\n");
}

function trisToMesh(tris: Tri[]): string {
  const vertices: string[] = [];
  const triangles: string[] = [];
  let i = 0;
  for (const tri of tris) {
    for (const p of tri) vertices.push(`<vertex x="${p[0]}" y="${p[1]}" z="${p[2]}"/>`);
    triangles.push(`<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}"/>`);
    i += 3;
  }
  return `<mesh><vertices>${vertices.join("")}</vertices><triangles>${triangles.join("")}</triangles></mesh>`;
}

export function buildEnvelopeStl(options: EnvelopeOptions = {}): Blob {
  const { frame, texture } = buildEnvelopeGeometry(options);
  return new Blob([trisToStl([...frame, ...texture], "Envelope - 3D QR")], { type: "model/stl" });
}

export function buildEnvelope3mf(
  options: EnvelopeOptions & {
    frameSlot?: Partial<MaterialSlot>;
    textureSlot?: Partial<MaterialSlot>;
  } = {},
): Promise<Blob> {
  const { frame, texture } = buildEnvelopeGeometry(options);
  const frameSlot = normalizeSlot(options.frameSlot, {
    extruder: 1,
    material: "PLA",
    color: "#111111",
  });
  const textureSlot = normalizeSlot(options.textureSlot, {
    extruder: 2,
    material: "PLA",
    color: "#d4af37",
  });
  const objects = [
    { name: "Envelope", mesh: trisToMesh(frame), triangleCount: frame.length, slot: frameSlot },
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
