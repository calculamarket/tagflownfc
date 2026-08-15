// Geometria do QR em 3D — porta em JS puro de src/lib/qr-stl.ts + qr-3mf.ts,
// para que o servidor MCP rode fora do bundle do app (Node puro, sem Vite).
import QRCode from "qrcode";
import { deflateRawSync, crc32 } from "node:zlib";

const OVERLAP_MM = 0.2;

export function buildQrGeometry(text, options = {}) {
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

  const base = [[0, 0, 0, sizeMm, sizeMm, baseHeightMm]];
  const modules = [];

  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const qrRow = row - marginModules;
      const qrCol = col - marginModules;
      const inside = qrRow >= 0 && qrRow < qrSize && qrCol >= 0 && qrCol < qrSize;
      const isDark = inside ? data[qrRow * qrSize + qrCol] === 1 : false;
      if (recessed ? isDark : !isDark) continue;

      const x0 = col * moduleMm;
      const y0 = sizeMm - (row + 1) * moduleMm;
      modules.push([x0, y0, baseHeightMm - OVERLAP_MM, x0 + moduleMm, y0 + moduleMm, topZ]);
    }
  }

  return { base, modules, baseHeightMm };
}

function boxVertices([x0, y0, z0, x1, y1, z1]) {
  return [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
}

const TRIANGLES = [
  [0, 2, 1], [0, 3, 2],
  [4, 5, 6], [4, 6, 7],
  [0, 1, 5], [0, 5, 4],
  [3, 7, 6], [3, 6, 2],
  [0, 4, 7], [0, 7, 3],
  [1, 2, 6], [1, 6, 5],
];

const FACE_NORMALS = [
  [0, 0, -1], [0, 0, -1],
  [0, 0, 1], [0, 0, 1],
  [0, -1, 0], [0, -1, 0],
  [0, 1, 0], [0, 1, 0],
  [-1, 0, 0], [-1, 0, 0],
  [1, 0, 0], [1, 0, 0],
];

/** STL binário (peça única). */
export function buildQrStl(text, options = {}) {
  const { base, modules } = buildQrGeometry(text, options);
  const boxes = [...base, ...modules];
  const triangles = boxes.length * 12;
  const buffer = Buffer.alloc(84 + triangles * 50);
  buffer.write(`3D QR - ${options.sizeMm ?? 60}mm`, 0, 79, "ascii");
  buffer.writeUInt32LE(triangles, 80);

  let off = 84;
  for (const box of boxes) {
    const v = boxVertices(box);
    for (let t = 0; t < TRIANGLES.length; t++) {
      const n = FACE_NORMALS[t];
      buffer.writeFloatLE(n[0], off);
      buffer.writeFloatLE(n[1], off + 4);
      buffer.writeFloatLE(n[2], off + 8);
      off += 12;
      for (const vi of TRIANGLES[t]) {
        const p = v[vi];
        buffer.writeFloatLE(p[0], off);
        buffer.writeFloatLE(p[1], off + 4);
        buffer.writeFloatLE(p[2], off + 8);
        off += 12;
      }
      buffer.writeUInt16LE(0, off);
      off += 2;
    }
  }
  return buffer;
}

const fmt = (n) => (Math.round(n * 1000) / 1000).toString();

function boxesToMesh(boxes) {
  const vertices = [];
  const triangles = [];
  let offset = 0;
  for (const box of boxes) {
    for (const [x, y, z] of boxVertices(box)) {
      vertices.push(`<vertex x="${fmt(x)}" y="${fmt(y)}" z="${fmt(z)}"/>`);
    }
    for (const [a, b, c] of TRIANGLES) {
      triangles.push(`<triangle v1="${a + offset}" v2="${b + offset}" v3="${c + offset}"/>`);
    }
    offset += 8;
  }
  return `<mesh><vertices>${vertices.join("")}</vertices><triangles>${triangles.join("")}</triangles></mesh>`;
}

function toDisplayColor(color, fallback) {
  const c = /^#[0-9a-f]{6}$/i.test(color || "") ? color : fallback;
  return `${c.toUpperCase()}FF`;
}

/** ZIP store/deflate mínimo (3MF é um pacote OPC/ZIP). */
function createZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.data);
    const compressed = deflateRawSync(data);
    const crc = crc32(data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBuf, compressed);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(compressed.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, centralBuf, end]);
}

/** 3MF com base e código como objetos separados (duas cores no fatiador). */
export function buildQr3mf(text, options = {}) {
  const { base, modules } = buildQrGeometry(text, options);
  const baseColor = toDisplayColor(options.baseColor ?? "#FFFFFF", "#FFFFFF");
  const codeColor = toDisplayColor(options.codeColor ?? "#111111", "#111111");

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<resources>` +
    `<basematerials id="1">` +
    `<base name="Base" displaycolor="${baseColor}"/>` +
    `<base name="Codigo" displaycolor="${codeColor}"/>` +
    `</basematerials>` +
    `<object id="2" type="model" pid="1" pindex="0">${boxesToMesh(base)}</object>` +
    `<object id="3" type="model" pid="1" pindex="1">${boxesToMesh(modules)}</object>` +
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

  return createZip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rels, "utf8") },
    { name: "3D/3dmodel.model", data: Buffer.from(model, "utf8") },
  ]);
}
