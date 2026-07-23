import { buildQrGeometry, type Box, type QrStlOptions } from "./qr-stl";
import { createZip } from "./zip";

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

/** #RRGGBB -> #RRGGBBAA, which is what 3MF's displaycolor expects. */
function toDisplayColor(color: string, fallback: string): string {
  const c = /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  return `${c.toUpperCase()}FF`;
}

export function buildQr3mf(text: string, options: Qr3mfOptions = {}): Blob {
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

  const encoder = new TextEncoder();
  const zip = createZip([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rels) },
    { name: "3D/3dmodel.model", data: encoder.encode(model) },
  ]);

  return new Blob([zip], { type: "model/3mf" });
}
