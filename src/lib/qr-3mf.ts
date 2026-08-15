import { buildQrGeometry, type Box, type QrStlOptions } from "./qr-stl";
import { normalizeSlot, pack3mf, type MaterialSlot } from "./three-mf";

/**
 * 3MF export for two-colour printing.
 *
 * The plate and the code go out as two separate objects, each bound to its own
 * base material. That is what lets a slicer (Bambu Studio, PrusaSlicer, Cura)
 * assign a different filament to each — impossible with a single merged STL,
 * where there is no boundary between plate and code to assign colours to.
 *
 * 3MF is an OPC/ZIP package with the model as XML, and it carries units, so the
 * part lands in the slicer already at the right millimetre scale.
 */
export type Qr3mfOptions = QrStlOptions & {
  /** Plate colour, as #RRGGBB. */
  baseColor?: string;
  /** Code colour, as #RRGGBB. */
  codeColor?: string;
  /** Extruder slot + filament for the plate. */
  baseSlot?: Partial<MaterialSlot>;
  /** Extruder slot + filament for the code. */
  codeSlot?: Partial<MaterialSlot>;
};

/** 8 corner vertices of a box, in the winding used by `TRIANGLES`. */
function boxVertices([x0, y0, z0, x1, y1, z1]: Box): [number, number, number][] {
  return [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
}

// Same face winding as the STL writer: outward-facing normals.
const TRIANGLES: [number, number, number][] = [
  [0, 2, 1], [0, 3, 2], // bottom
  [4, 5, 6], [4, 6, 7], // top
  [0, 1, 5], [0, 5, 4], // front
  [3, 7, 6], [3, 6, 2], // back
  [0, 4, 7], [0, 7, 3], // left
  [1, 2, 6], [1, 6, 5], // right
];

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

/** Serialize a set of boxes as a single <mesh>. */
function boxesToMesh(boxes: Box[]): string {
  const vertices: string[] = [];
  const triangles: string[] = [];
  let offset = 0;

  for (const box of boxes) {
    for (const [x, y, z] of boxVertices(box)) {
      vertices.push(`<vertex x="${fmt(x)}" y="${fmt(y)}" z="${fmt(z)}"/>`);
    }
    for (const [a, b, c] of TRIANGLES) {
      triangles.push(
        `<triangle v1="${a + offset}" v2="${b + offset}" v3="${c + offset}"/>`,
      );
    }
    offset += 8;
  }

  return `<mesh><vertices>${vertices.join("")}</vertices><triangles>${triangles.join("")}</triangles></mesh>`;
}

export function buildQr3mf(text: string, options: Qr3mfOptions = {}): Promise<Blob> {
  const { base, modules } = buildQrGeometry(text, options);
  const baseSlot = normalizeSlot(
    { color: options.baseColor, ...options.baseSlot },
    { extruder: 1, material: "PLA", color: "#FFFFFF" },
  );
  const codeSlot = normalizeSlot(
    { color: options.codeColor, ...options.codeSlot },
    { extruder: 2, material: "PLA", color: "#111111" },
  );

  return pack3mf([
    { name: "Base", mesh: boxesToMesh(base), triangleCount: base.length * 12, slot: baseSlot },
    { name: "Codigo", mesh: boxesToMesh(modules), triangleCount: modules.length * 12, slot: codeSlot },
  ]);
}

/** Raw 3MF bytes, for packing many pieces of a batch into one archive. */
export async function buildQr3mfBytes(
  text: string,
  options: Qr3mfOptions = {},
): Promise<Uint8Array> {
  const blob = await buildQr3mf(text, options);
  return new Uint8Array(await blob.arrayBuffer());
}
