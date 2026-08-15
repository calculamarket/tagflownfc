import earcut from "earcut";
import { normalizeSlot, pack3mf, type MaterialSlot } from "./three-mf";
import type { Tri } from "./pet-tag-3d";

/**
 * Two-part wall hook: a screw-on mount plate with a dovetail rail and a hook
 * that slides down onto it. Based on the "Wall Hook Screw" reference set.
 *
 * Both parts are generated already in printing orientation:
 *  - mount: plate flat on the bed, rail growing in +Z (no supports)
 *  - hook: lying on its side, so the socket and the arm print in plain layers
 */

export type HookMountOptions = {
  /** Shared rail geometry. */
  widthMm?: number;
  railDepthMm?: number;
  railBaseWidthMm?: number;
  railTopWidthMm?: number;
  clearanceMm?: number;
  /** Mount plate. */
  mountHeightMm?: number;
  plateThickMm?: number;
  screwHoles?: number;
  screwDiameterMm?: number;
  countersink?: boolean;
  countersinkDiameterMm?: number;
  countersinkDepthMm?: number;
  /** Hook body. */
  hookHeightMm?: number;
  backThickMm?: number;
  topStopMm?: number;
  armWidthMm?: number;
  armThickMm?: number;
  armRiseMm?: number;
  armReachMm?: number;
  armLipMm?: number;
};

export type HookMountGeometry = {
  hook: Tri[];
  mount: Tri[];
  widthMm: number;
  mountHeightMm: number;
  hookHeightMm: number;
  totalDepthMm: number;
  totalReachMm: number;
  screwCenters: [number, number][];
};

type Pt = [number, number];
const OVERLAP = 0.2;

/* ------------------------------------------------------------- primitives */

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

/** Loft between two rings with the same point count (tapered rail). */
function loft(bottom: Pt[], z0: number, top: Pt[], z1: number): Tri[] {
  const tris: Tri[] = [];
  const n = bottom.length;
  for (let i = 0; i < n; i++) {
    const a = bottom[i];
    const b = bottom[(i + 1) % n];
    const c = top[(i + 1) % n];
    const d = top[i];
    tris.push([
      [a[0], a[1], z0],
      [b[0], b[1], z0],
      [c[0], c[1], z1],
    ]);
    tris.push([
      [a[0], a[1], z0],
      [c[0], c[1], z1],
      [d[0], d[1], z1],
    ]);
  }
  // caps
  const cap = (ring: Pt[], z: number, up: boolean) => {
    const coords: number[] = [];
    for (const p of ring) coords.push(p[0], p[1]);
    const idx = earcut(coords, undefined, 2);
    for (let i = 0; i < idx.length; i += 3) {
      const p = (k: number): [number, number, number] => [
        coords[idx[i + k] * 2],
        coords[idx[i + k] * 2 + 1],
        z,
      ];
      tris.push(up ? [p(0), p(1), p(2)] : [p(0), p(2), p(1)]);
    }
  };
  cap(bottom, z0, false);
  cap(top, z1, true);
  return tris;
}

function rect(w: number, h: number, cx = 0, cy = 0): Pt[] {
  return [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ];
}

function circleRing(cx: number, cy: number, r: number, segments = 40): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function cone(
  cx: number, cy: number, r0: number, z0: number, r1: number, z1: number, segments = 40,
): Tri[] {
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

/** Polygon in the (Y,Z) plane extruded across X. */
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

/** Rotate mounted coords (x width, y out of wall, z up) into print coords. */
function layOnSide(tris: Tri[], halfWidth: number): Tri[] {
  return tris.map(
    (t) => t.map(([x, y, z]) => [y, z, x + halfWidth]) as unknown as Tri,
  );
}

/* ------------------------------------------------------------- generation */

export function buildHookMountGeometry(options: HookMountOptions = {}): HookMountGeometry {
  const {
    widthMm = 22,
    railDepthMm = 4,
    railBaseWidthMm = 10,
    railTopWidthMm = 14,
    clearanceMm = 0.25,
    mountHeightMm = 46,
    plateThickMm = 3,
    screwHoles = 2,
    screwDiameterMm = 4,
    countersink = true,
    countersinkDiameterMm = 8,
    countersinkDepthMm = 1.8,
    hookHeightMm = 34,
    backThickMm = 5,
    topStopMm = 4,
    armWidthMm = 12,
    armThickMm = 6,
    armRiseMm = 20,
    armReachMm = 20,
    armLipMm = 8,
  } = options;

  const W = Math.max(12, widthMm);
  const rd = Math.max(2, railDepthMm);
  const rb = Math.max(4, Math.min(railBaseWidthMm, W - 4));
  const rt = Math.max(rb + 1, Math.min(railTopWidthMm, W - 2));
  const cl = Math.max(0, clearanceMm);
  const Hm = Math.max(20, mountHeightMm);
  const pt = Math.max(2, plateThickMm);

  /* ------------------------------------------------------------- mount */
  const mount: Tri[] = [];
  const r = Math.max(0.6, screwDiameterMm / 2);
  const csR = Math.max(r + 0.6, countersinkDiameterMm / 2);
  const edge = Math.max(csR, r) + 2.5;
  const centers: [number, number][] = [];
  if (screwHoles === 1) centers.push([0, 0]);
  if (screwHoles >= 2) centers.push([0, -Hm / 2 + edge], [0, Hm / 2 - edge]);
  if (screwHoles === 4) {
    const dx = W / 2 - edge;
    centers.push([-dx, 0], [dx, 0]);
  }

  const plateOuter = rect(W, Hm);
  const csDepth = Math.min(Math.max(0.4, countersinkDepthMm), pt - 1);
  const useCs = countersink && centers.length > 0 && pt - csDepth >= 1;
  const holeRings = centers.map(([cx, cy]) => circleRing(cx, cy, r));

  if (useCs) {
    mount.push(...prism(plateOuter, holeRings, 0, pt - csDepth));
    mount.push(
      ...prism(
        plateOuter,
        centers.map(([cx, cy]) => circleRing(cx, cy, csR)),
        pt - csDepth - OVERLAP / 2,
        pt,
      ),
    );
    for (const [cx, cy] of centers) mount.push(...cone(cx, cy, r, pt - csDepth, csR, pt));
  } else {
    mount.push(...prism(plateOuter, holeRings, 0, pt));
  }

  // Dovetail rail: sits between the screw heads, tapering wider toward the top.
  const railClear = screwHoles > 0 ? edge * 2 + 1 : 4;
  const railH = Math.max(10, Hm - railClear);
  mount.push(
    ...loft(rect(rb, railH), pt - OVERLAP, rect(rt, railH), pt + rd),
  );

  /* -------------------------------------------------------------- hook */
  const Hh = Math.max(railH * 0.6, hookHeightMm);
  const back = Math.max(3, backThickMm);
  const stop = Math.max(2, Math.min(topStopMm, Hh / 3));
  const cavDepth = rd + cl;
  const cavBase = rb + 2 * cl;
  const cavTop = rt + 2 * cl;
  const Tb = cavDepth + back;

  // Cross-section with the dovetail notch open on the wall side (y = 0).
  const notched: Pt[] = [
    [-W / 2, 0],
    [-cavBase / 2, 0],
    [-cavTop / 2, cavDepth],
    [cavTop / 2, cavDepth],
    [cavBase / 2, 0],
    [W / 2, 0],
    [W / 2, Tb],
    [-W / 2, Tb],
  ];
  const hookM: Tri[] = [];
  hookM.push(...prism(notched, [], 0, Hh - stop));
  hookM.push(...prism(rect(W, Tb, 0, Tb / 2), [], Hh - stop - OVERLAP, Hh));

  // Arm swept in the Y/Z plane from the front face.
  const aw = Math.max(3, Math.min(armWidthMm, W - 4));
  const at = Math.max(2, armThickMm);
  const rise = Math.max(4, armRiseMm);
  const reach = Math.max(4, armReachMm);
  const lip = Math.max(0, armLipMm);
  const y0 = Tb - 0.5;

  const baseZ = Math.max(2, Hh * 0.22);
  const path: Pt[] = [[y0 - at, baseZ]];
  const segs = 16;
  for (let i = 0; i <= segs; i++) {
    const a = (Math.PI / 2) * (i / segs);
    path.push([y0 + reach * Math.sin(a), baseZ + rise * (1 - Math.cos(a))]);
  }
  if (lip > 0) {
    const tip = path[path.length - 1];
    path.push([tip[0] + lip * 0.25, tip[1] + lip]);
  }

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
  hookM.push(...prismX([...left, ...right.reverse()], -aw / 2, aw / 2));

  const tip = path[path.length - 1];
  const hook = layOnSide(hookM, W / 2);

  return {
    hook,
    mount,
    widthMm: W,
    mountHeightMm: Hm,
    hookHeightMm: Hh,
    totalDepthMm: pt + Tb,
    totalReachMm: tip[0] + at / 2,
    screwCenters: centers,
  };
}

/* ----------------------------------------------------------------- export */

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

function shiftX(tris: Tri[], dx: number): Tri[] {
  return tris.map((t) => t.map(([x, y, z]) => [x + dx, y, z]) as unknown as Tri);
}

export type HookMountPart = "conjunto" | "gancho" | "base";

export function buildHookMountStl(options: HookMountOptions, part: HookMountPart = "conjunto"): Blob {
  const geo = buildHookMountGeometry(options);
  const gap = geo.widthMm + 8;
  const tris =
    part === "gancho"
      ? geo.hook
      : part === "base"
        ? geo.mount
        : [...shiftX(geo.mount, -gap / 2), ...shiftX(geo.hook, gap / 2)];
  return new Blob([trisToStl(tris, "Gancho de encaixe - 3D QR")], { type: "model/stl" });
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

export function buildHookMount3mf(
  options: HookMountOptions & {
    part?: HookMountPart;
    hookSlot?: Partial<MaterialSlot>;
    mountSlot?: Partial<MaterialSlot>;
  },
): Promise<Blob> {
  const geo = buildHookMountGeometry(options);
  const part = options.part ?? "conjunto";
  const gap = geo.widthMm + 8;
  const hookSlot = normalizeSlot(options.hookSlot, {
    extruder: 1,
    material: "PLA",
    color: "#FFFFFF",
  });
  const mountSlot = normalizeSlot(options.mountSlot, {
    extruder: 2,
    material: "PLA",
    color: "#111111",
  });

  const objects: {
    name: string;
    mesh: string;
    triangleCount: number;
    slot: MaterialSlot;
  }[] = [];
  const both = part === "conjunto";
  if (part !== "base") {
    objects.push({
      name: "Gancho",
      mesh: trisToMesh(both ? shiftX(geo.hook, gap / 2) : geo.hook),
      triangleCount: geo.hook.length,
      slot: hookSlot,
    });
  }
  if (part !== "gancho") {
    objects.push({
      name: "Base de parede",
      mesh: trisToMesh(both ? shiftX(geo.mount, -gap / 2) : geo.mount),
      triangleCount: geo.mount.length,
      slot: mountSlot,
    });
  }
  return pack3mf(objects);
}
