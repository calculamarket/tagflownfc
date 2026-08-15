import { createZip } from "./zip";

/**
 * Shared 3MF packer with multi-material (AMS / multi-extruder) support.
 *
 * Each object is bound to its own base material AND carries slicer metadata
 * declaring which extruder slot prints it, in both the PrusaSlicer and the
 * Bambu/Orca dialects, so the piece opens with the filaments already assigned.
 */
export type FilamentType = "PLA" | "PETG" | "ABS" | "ASA" | "TPU" | "PC" | "PA";

export const FILAMENT_TYPES: FilamentType[] = [
  "PLA", "PETG", "ABS", "ASA", "TPU", "PC", "PA",
];

export type MaterialSlot = {
  /** Extruder / AMS slot, 1-based. */
  extruder: number;
  /** Filament material, e.g. PLA or PETG. */
  material: FilamentType;
  /** Colour as #RRGGBB. */
  color: string;
};

export type Mf3Object = {
  /** Human readable object name shown in the slicer. */
  name: string;
  /** Ready-made <mesh>…</mesh> XML. */
  mesh: string;
  /** Number of triangles in the mesh (used for volume ranges). */
  triangleCount: number;
  slot: MaterialSlot;
};

export function normalizeSlot(
  slot: Partial<MaterialSlot> | undefined,
  fallback: MaterialSlot,
): MaterialSlot {
  const extruder = Math.min(16, Math.max(1, Math.round(slot?.extruder ?? fallback.extruder)));
  const color =
    slot?.color && /^#[0-9a-f]{6}$/i.test(slot.color) ? slot.color : fallback.color;
  return { extruder, material: slot?.material ?? fallback.material, color };
}

const displayColor = (color: string) => `${color.toUpperCase()}FF`;

export function pack3mf(objects: Mf3Object[]): Promise<Blob> {
  const materials = objects
    .map(
      (o) =>
        `<base name="${o.name} ${o.slot.material} (T${o.slot.extruder})" ` +
        `displaycolor="${displayColor(o.slot.color)}"/>`,
    )
    .join("");

  const resources = objects
    .map(
      (o, i) =>
        `<object id="${i + 2}" type="model" pid="1" pindex="${i}" name="${o.name}">${o.mesh}</object>`,
    )
    .join("");

  const items = objects.map((_, i) => `<item objectid="${i + 2}"/>`).join("");

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<resources><basematerials id="1">${materials}</basematerials>${resources}</resources>` +
    `<build>${items}</build>` +
    `</model>`;

  // PrusaSlicer / SuperSlicer dialect.
  const prusaConfig =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<config>` +
    objects
      .map(
        (o, i) =>
          `<object id="${i + 2}">` +
          `<metadata type="object" key="name" value="${o.name}"/>` +
          `<metadata type="object" key="extruder" value="${o.slot.extruder}"/>` +
          `<volume firstid="0" lastid="${Math.max(0, o.triangleCount - 1)}">` +
          `<metadata type="volume" key="name" value="${o.name}"/>` +
          `<metadata type="volume" key="extruder" value="${o.slot.extruder}"/>` +
          `</volume>` +
          `</object>`,
      )
      .join("") +
    `</config>`;

  // Bambu Studio / OrcaSlicer dialect.
  const orcaConfig =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<config>` +
    objects
      .map(
        (o, i) =>
          `<object id="${i + 2}">` +
          `<metadata key="name" value="${o.name}"/>` +
          `<metadata key="extruder" value="${o.slot.extruder}"/>` +
          `<part id="${i + 1}" subtype="normal_part">` +
          `<metadata key="name" value="${o.name}"/>` +
          `<metadata key="extruder" value="${o.slot.extruder}"/>` +
          `</part>` +
          `</object>`,
      )
      .join("") +
    `</config>`;

  const projectSettings = JSON.stringify({
    filament_type: objects.map((o) => o.slot.material),
    filament_colour: objects.map((o) => o.slot.color.toUpperCase()),
    filament_settings_id: objects.map((o) => `${o.slot.material}`),
  });

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
    `<Default Extension="config" ContentType="application/xml"/>` +
    `<Default Extension="json" ContentType="application/json"/>` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Target="/3D/3dmodel.model" Id="rel0" ` +
    `Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>` +
    `</Relationships>`;

  const encoder = new TextEncoder();
  return createZip([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rels) },
    { name: "3D/3dmodel.model", data: encoder.encode(model) },
    { name: "Metadata/Slic3r_PE_model.config", data: encoder.encode(prusaConfig) },
    { name: "Metadata/model_settings.config", data: encoder.encode(orcaConfig) },
    { name: "Metadata/project_settings.config", data: encoder.encode(projectSettings) },
  ]);
}
