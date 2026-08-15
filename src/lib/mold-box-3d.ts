import { normalizeSlot, pack3mf, type MaterialSlot } from "./three-mf";

/**
 * Parametric silicone-mould box.
 *
 * Prints an open-top container the customer fills with silicone around the
 * master piece: a floor, four walls, an optional pedestal that lifts the piece
 * off the floor, and optional registration keys (half-spheres approximated as
 * pyramids) for two-part moulds.
 *
 * Everything is emitted as overlapping closed boxes — slicers union those
 * reliably, which is what keeps the mesh manifold.
 */
export type MoldBoxOptions = {
  /** Master piece bounding box in mm. */
  pieceWidthMm: number;
  pieceDepthMm: number;
  pieceHeightMm: number;
  /** Silicone margin around the piece on every side, in mm. */
  marginMm?: number;
  /** Extra silicone above the piece, in mm. */
  topMarginMm?: number;
  /** Wall thickness in mm. */
  wallMm?: number;
  /** Floor thickness in mm. */
  floorMm?: number;
  /** Pedestal that holds the master piece up, in mm (0 disables it). */
  pedestalMm?: number;
  /** Registration keys in the floor corners, for two-part moulds. */
  keys?: boolean;
  /** Pouring spout notch on one wall. */
  spout?: boolean;
};

export type Tri = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export type MoldBoxGeometry = {
  shell: Tri[];
  pedestal: Tri[];
  /** Inner cavity, i.e. the silicone volume. */
  innerWidthMm: number;
  innerDepthMm: number;
  innerHeightMm: number;
  outerWidthMm: number;
  outerDepthMm: number;
  outerHeightMm: number;
  /** Approximate silicone needed, in millilitres. */
  siliconeMl: number;
};

const OVERLAP = 0.2;

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Tri[] {
  const v: [number, number, number][] = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const faces: [number, number, number][] = [
    [0, 2, 1], [0, 3, 2], // bottom
    [4, 5, 6], [4, 6, 7], // top
    [0, 1, 5], [0, 5, 4], // front
    [1, 2, 6], [1, 6, 5], // right
    [2, 3, 7], [2, 7, 6], // back
    [3, 0, 4], [3, 4, 7], // left
  ];
  return faces.map(([a, b, c]) => [v[a], v[b], v[c]] as Tri);
}

/** Four-sided pyramid used as an alignment key. */
function pyramid(cx: number, cy: number, z0: number, half: number, h: number): Tri[] {
  const a: [number, number, number] = [cx - half, cy - half, z0];
  const b: [number, number, number] = [cx + half, cy - half, z0];
  const c: [number, number, number] = [cx + half, cy + half, z0];
  const d: [number, number, number] = [cx - half, cy + half, z0];
  const t: [number, number, number] = [cx, cy, z0 + h];
  return [
    [a, c, b], [a, d, c],
    [a, b, t], [b, c, t], [c, d, t], [d, a, t],
  ];
}

export function buildMoldBoxGeometry(options: MoldBoxOptions): MoldBoxGeometry {
  const margin = Math.max(1, options.marginMm ?? 10);
  const topMargin = Math.max(1, options.topMarginMm ?? margin);
  const wall = Math.max(1, options.wallMm ?? 2.4);
  const floor = Math.max(0.8, options.floorMm ?? 2);
  const pedestalH = Math.max(0, options.pedestalMm ?? 0);

  const innerW = Math.max(5, options.pieceWidthMm + 2 * margin);
  const innerD = Math.max(5, options.pieceDepthMm + 2 * margin);
  const innerH = Math.max(5, options.pieceHeightMm + topMargin + pedestalH);

  const outerW = innerW + 2 * wall;
  const outerD = innerD + 2 * wall;
  const outerH = innerH + floor;

  const shell: Tri[] = [];
  // Floor.
  shell.push(...box(0, 0, 0, outerW, outerD, floor));
  // Walls (overlap the floor so the union is watertight).
  const z0 = floor - OVERLAP;
  shell.push(...box(0, 0, z0, outerW, wall, outerH));                       // front
  shell.push(...box(0, outerD - wall, z0, outerW, outerD, outerH));          // back
  shell.push(...box(0, 0, z0, wall, outerD, outerH));                        // left
  shell.push(...box(outerW - wall, 0, z0, outerW, outerD, outerH));          // right

  // Pouring spout: a small V-shaped lip added to one corner of the back wall.
  if (options.spout) {
    const w = Math.min(14, innerW / 2);
    const cx = outerW - wall - w;
    shell.push(...box(cx, outerD - wall, outerH - OVERLAP, cx + w, outerD + wall * 2, outerH + 6));
    shell.push(...box(cx, outerD - wall * 2, outerH - OVERLAP, cx + w, outerD, outerH + 3));
  }

  // Registration keys on the floor, so a two-part mould realigns after cutting.
  if (options.keys) {
    const half = Math.min(4, Math.min(innerW, innerD) / 8);
    const h = half;
    const inset = wall + half + 2;
    for (const [kx, ky] of [
      [inset, inset],
      [outerW - inset, inset],
      [inset, outerD - inset],
      [outerW - inset, outerD - inset],
    ]) {
      shell.push(...pyramid(kx, ky, floor - OVERLAP, half, h));
    }
  }

  const pedestal: Tri[] = [];
  if (pedestalH > 0) {
    const pw = Math.max(4, options.pieceWidthMm * 0.5);
    const pd = Math.max(4, options.pieceDepthMm * 0.5);
    const px = (outerW - pw) / 2;
    const py = (outerD - pd) / 2;
    pedestal.push(...box(px, py, floor - OVERLAP, px + pw, py + pd, floor + pedestalH));
  }

  const pieceVol = options.pieceWidthMm * options.pieceDepthMm * options.pieceHeightMm;
  const siliconeMl = Math.max(0, (innerW * innerD * innerH - pieceVol) / 1000);

  return {
    shell,
    pedestal,
    innerWidthMm: innerW,
    innerDepthMm: innerD,
    innerHeightMm: innerH,
    outerWidthMm: outerW,
    outerDepthMm: outerD,
    outerHeightMm: outerH,
    siliconeMl,
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

export function buildMoldBoxStl(options: MoldBoxOptions): Blob {
  const { shell, pedestal } = buildMoldBoxGeometry(options);
  return new Blob([trisToStl([...shell, ...pedestal], "Caixa de molde - 3D QR")], {
    type: "model/stl",
  });
}

export function buildMoldBox3mf(
  options: MoldBoxOptions & {
    shellSlot?: Partial<MaterialSlot>;
    pedestalSlot?: Partial<MaterialSlot>;
  },
): Promise<Blob> {
  const { shell, pedestal } = buildMoldBoxGeometry(options);
  const shellSlot = normalizeSlot(options.shellSlot, {
    extruder: 1,
    material: "PLA",
    color: "#2B6CB0",
  });
  const pedestalSlot = normalizeSlot(options.pedestalSlot, {
    extruder: 2,
    material: "PLA",
    color: "#F6AD55",
  });

  const objects = [
    { name: "Caixa", mesh: trisToMesh(shell), triangleCount: shell.length, slot: shellSlot },
  ];
  if (pedestal.length) {
    objects.push({
      name: "Pedestal",
      mesh: trisToMesh(pedestal),
      triangleCount: pedestal.length,
      slot: pedestalSlot,
    });
  }
  return pack3mf(objects);
}
