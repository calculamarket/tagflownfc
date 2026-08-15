import QRCode from "qrcode";

/**
 * Generates a binary STL of a QR code for 3D printing.
 *
 * Geometry: a solid base plate plus one block per module. In "emboss" mode the
 * dark modules are raised; in "recess" mode the light modules (and the quiet
 * zone) are raised instead, so the dark modules read as engraved channels —
 * handy for filling with a second filament colour.
 *
 * Blocks are emitted as closed, overlapping boxes. That is intentional: every
 * slicer unions overlapping solids reliably, whereas hand-culling shared faces
 * is where hand-rolled meshes usually end up non-manifold.
 */
export type QrStlOptions = {
  /** Total width/depth of the plate in millimetres. */
  sizeMm?: number;
  /** Thickness of the solid base plate. */
  baseHeightMm?: number;
  /** How far the modules rise above the base. */
  moduleHeightMm?: number;
  /** Quiet zone in modules. The QR spec asks for 4; below 2 scanning suffers. */
  marginModules?: number;
  /**
   * Quiet zone in millimetres. When set, it wins over `marginModules`: the code
   * itself measures `sizeMm` and the plate grows to `sizeMm + 2 * quietZoneMm`,
   * which is how the OpenSCAD generator states its dimensions.
   */
  quietZoneMm?: number;
  /** Error correction level: L ~7%, M ~15%, Q ~25%, H ~30%. */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  /** Engrave the dark modules instead of embossing them. */
  recessed?: boolean;
};


export type Box = [number, number, number, number, number, number]; // x0,y0,z0,x1,y1,z1

/**
 * Base plate and module blocks kept apart, so a two-colour export can hand the
 * slicer two separate solids. The modules sink slightly into the plate instead
 * of resting exactly on it: a shared coincident plane is what makes slicers
 * produce gaps or z-fighting between materials.
 */
export type QrGeometry = { base: Box[]; modules: Box[]; baseHeightMm: number };

const OVERLAP_MM = 0.2;

/** Shared geometry for every 3D export format. */
export function buildQrGeometry(text: string, options: QrStlOptions = {}): QrGeometry {
  const {
    sizeMm = 60,
    baseHeightMm = 2,
    moduleHeightMm = 1.6,
    marginModules = 4,
    quietZoneMm,
    errorCorrectionLevel = "M",
    recessed = false,
  } = options;

  const qr = QRCode.create(text, { errorCorrectionLevel });
  const qrSize = qr.modules.size;
  const data = qr.modules.data;

  // Two ways to state the quiet zone: in modules (legacy) or in millimetres
  // (matches the OpenSCAD generator, where SIZE is the code and the plate grows).
  const useMmQuiet = typeof quietZoneMm === "number";
  const moduleMm = useMmQuiet ? sizeMm / qrSize : sizeMm / (qrSize + marginModules * 2);
  const quietMm = useMmQuiet ? quietZoneMm! : marginModules * moduleMm;
  const plateMm = qrSize * moduleMm + quietMm * 2;
  const topZ = baseHeightMm + moduleHeightMm;

  const base: Box[] = [[0, 0, 0, plateMm, plateMm, baseHeightMm]];
  const modules: Box[] = [];

  for (let row = 0; row < qrSize; row++) {
    for (let col = 0; col < qrSize; col++) {
      const isDark = data[row * qrSize + col] === 1;

      // Emboss raises the dark modules; recess raises everything else so the
      // dark modules become channels.
      if (recessed ? isDark : !isDark) continue;

      const x0 = quietMm + col * moduleMm;
      // Flip Y so the code reads correctly when viewed from +Z.
      const y0 = quietMm + (qrSize - 1 - row) * moduleMm;
      modules.push([
        x0,
        y0,
        baseHeightMm - OVERLAP_MM,
        x0 + moduleMm,
        y0 + moduleMm,
        topZ,
      ]);
    }
  }

  // In recess mode the quiet zone must be raised too, otherwise the plate edge
  // sits lower than the light modules and the contrast inverts.
  if (recessed && quietMm > 0) {
    const z0 = baseHeightMm - OVERLAP_MM;
    const inner0 = quietMm;
    const inner1 = quietMm + qrSize * moduleMm;
    modules.push(
      [0, 0, z0, plateMm, inner0, topZ],
      [0, inner1, z0, plateMm, plateMm, topZ],
      [0, inner0, z0, inner0, inner1, topZ],
      [inner1, inner0, z0, plateMm, inner1, topZ],
    );
  }

  return { base, modules, baseHeightMm };
}


const FACES: { n: [number, number, number]; idx: [number, number, number][] }[] = [
  // Vertex order: 0=a 1=b 2=c 3=d (bottom), 4=e 5=f 6=g 7=h (top)
  { n: [0, 0, -1], idx: [[0, 2, 1], [0, 3, 2]] }, // bottom
  { n: [0, 0, 1], idx: [[4, 5, 6], [4, 6, 7]] }, // top
  { n: [0, -1, 0], idx: [[0, 1, 5], [0, 5, 4]] }, // front (y0)
  { n: [0, 1, 0], idx: [[3, 7, 6], [3, 6, 2]] }, // back (y1)
  { n: [-1, 0, 0], idx: [[0, 4, 7], [0, 7, 3]] }, // left (x0)
  { n: [1, 0, 0], idx: [[1, 2, 6], [1, 6, 5]] }, // right (x1)
];

function boxVertices([x0, y0, z0, x1, y1, z1]: Box): [number, number, number][] {
  return [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
}

/** Serialize boxes into a binary STL buffer (80-byte header + count + 50B/tri). */
function boxesToStl(boxes: Box[], header: string): ArrayBuffer {
  const triangles = boxes.length * 12;
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // 80-byte ASCII header (must not start with "solid" in a binary STL).
  const head = header.slice(0, 79);
  for (let i = 0; i < head.length; i++) bytes[i] = head.charCodeAt(i) & 0x7f;

  view.setUint32(80, triangles, true);

  let off = 84;
  for (const box of boxes) {
    const v = boxVertices(box);
    for (const face of FACES) {
      for (const tri of face.idx) {
        view.setFloat32(off, face.n[0], true);
        view.setFloat32(off + 4, face.n[1], true);
        view.setFloat32(off + 8, face.n[2], true);
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
    }
  }

  return buffer;
}

/**
 * Single-solid STL: base plate and modules merged into one object. Right for a
 * single-colour print, or for the filament-change trick (all modules start at
 * the same Z, so one swap at that layer colours the whole code).
 */
export function buildQrStl(text: string, options: QrStlOptions = {}): Blob {
  const { base, modules } = buildQrGeometry(text, options);
  const label = `3D QR - ${options.sizeMm ?? 60}mm - ${options.recessed ? "recess" : "emboss"}`;
  const stl = boxesToStl([...base, ...modules], label);
  return new Blob([stl], { type: "model/stl" });
}

/** Trigger a browser download of the generated STL. */
export function downloadQrStl(text: string, filename: string, options?: QrStlOptions) {
  const blob = buildQrStl(text, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".stl") ? filename : `${filename}.stl`;
  a.click();
  URL.revokeObjectURL(url);
}
