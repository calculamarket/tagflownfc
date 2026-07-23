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
  /** Engrave the dark modules instead of embossing them. */
  recessed?: boolean;
};

type Box = [number, number, number, number, number, number]; // x0,y0,z0,x1,y1,z1

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

/** Build the STL for `text` as a downloadable Blob. */
export function buildQrStl(text: string, options: QrStlOptions = {}): Blob {
  const {
    sizeMm = 60,
    baseHeightMm = 2,
    moduleHeightMm = 1.6,
    marginModules = 4,
    recessed = false,
  } = options;

  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const qrSize = qr.modules.size;
  const data = qr.modules.data;

  const grid = qrSize + marginModules * 2;
  const moduleMm = sizeMm / grid;
  const topZ = baseHeightMm + moduleHeightMm;

  const boxes: Box[] = [];
  // Base plate.
  boxes.push([0, 0, 0, sizeMm, sizeMm, baseHeightMm]);

  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const qrRow = row - marginModules;
      const qrCol = col - marginModules;
      const inside = qrRow >= 0 && qrRow < qrSize && qrCol >= 0 && qrCol < qrSize;
      const isDark = inside ? data[qrRow * qrSize + qrCol] === 1 : false;

      // Emboss raises the dark modules; recess raises everything else so the
      // dark modules become channels.
      if (recessed ? isDark : !isDark) continue;

      const x0 = col * moduleMm;
      // Flip Y so the code reads correctly when viewed from +Z.
      const y0 = sizeMm - (row + 1) * moduleMm;
      boxes.push([x0, y0, baseHeightMm, x0 + moduleMm, y0 + moduleMm, topZ]);
    }
  }

  const stl = boxesToStl(boxes, `3D QR - ${sizeMm}mm - ${recessed ? "recess" : "emboss"}`);
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
