/**
 * Read the bounding box (in mm) of a .stl or .3mf file in the browser.
 * Used by the silicone mold page so the user can upload the piece file
 * instead of typing measurements by hand.
 */

export type MeshBounds = {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  triangles: number;
};

function bounds(points: number[][]): MeshBounds {
  if (!points.length) throw new Error("Nenhuma geometria encontrada no arquivo.");
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const [x, y, z] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return {
    widthMm: maxX - minX,
    depthMm: maxY - minY,
    heightMm: maxZ - minZ,
    triangles: Math.round(points.length / 3),
  };
}

function parseStl(buf: ArrayBuffer): MeshBounds {
  const bytes = new Uint8Array(buf);
  const header = new TextDecoder().decode(bytes.slice(0, 512));
  const isAscii = /^\s*solid/i.test(header) && header.includes("facet");

  if (isAscii) {
    const text = new TextDecoder().decode(bytes);
    const pts: number[][] = [];
    const re = /vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) pts.push([+m[1], +m[2], +m[3]]);
    return bounds(pts);
  }

  const view = new DataView(buf);
  const count = view.getUint32(80, true);
  const pts: number[][] = [];
  for (let i = 0; i < count; i++) {
    const o = 84 + i * 50 + 12;
    for (let v = 0; v < 3; v++) {
      const b = o + v * 12;
      pts.push([view.getFloat32(b, true), view.getFloat32(b + 4, true), view.getFloat32(b + 8, true)]);
    }
  }
  return bounds(pts);
}

/** Minimal zip reader: enough to pull 3D/3dmodel.model out of a .3mf. */
async function readZipEntry(buf: ArrayBuffer, match: (name: string) => boolean): Promise<string> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // locate End Of Central Directory
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66000; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Arquivo .3mf inválido.");
  const entries = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);

  for (let i = 0; i < entries; i++) {
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + nameLen));
    if (match(name)) {
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = bytes.slice(start, start + compSize);
      if (method === 0) return new TextDecoder().decode(data);
      const stream = new Blob([data as unknown as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      return await new Response(stream).text();
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("Modelo 3D não encontrado dentro do .3mf.");
}

async function parse3mf(buf: ArrayBuffer): Promise<MeshBounds> {
  const xml = await readZipEntry(buf, (n) => n.toLowerCase().endsWith(".model"));
  const pts: number[][] = [];
  const re = /<vertex[^>]*x="(-?[\d.eE+]+)"[^>]*y="(-?[\d.eE+]+)"[^>]*z="(-?[\d.eE+]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) pts.push([+m[1], +m[2], +m[3]]);
  const b = bounds(pts);
  return { ...b, triangles: (xml.match(/<triangle /g) ?? []).length };
}

export async function measureMeshFile(file: File): Promise<MeshBounds> {
  const buf = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  if (name.endsWith(".3mf")) return parse3mf(buf);
  if (name.endsWith(".stl")) return parseStl(buf);
  throw new Error("Envie um arquivo .stl ou .3mf.");
}
