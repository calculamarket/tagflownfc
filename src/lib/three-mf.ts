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

  // Child meshes + one assembly object that references them as components.
  // Shipping the meshes as separate build items makes slicers treat each as an
  // independent object and drop it onto the bed, which flipped the QR plate
  // under the body. As components of a single object the relative Z is kept,
  // so the code always stays on top of the piece.
  const assemblyId = objects.length + 2;

  const resources = objects
    .map(
      (o, i) =>
        `<object id="${i + 2}" type="model" pid="1" pindex="${i}" name="${o.name}">${o.mesh}</object>`,
    )
    .join("");

  const components = objects
    .map((_, i) => `<component objectid="${i + 2}"/>`)
    .join("");

  const assembly =
    `<object id="${assemblyId}" type="model" name="${objects[0]?.name ?? "Peca"}">` +
    `<components>${components}</components></object>`;

  const items = `<item objectid="${assemblyId}"/>`;

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<resources><basematerials id="1">${materials}</basematerials>${resources}${assembly}</resources>` +
    `<build>${items}</build>` +
    `</model>`;


  // PrusaSlicer / SuperSlicer dialect: one object with a volume per component.
  let firstTriangle = 0;
  const prusaVolumes = objects
    .map((o) => {
      const first = firstTriangle;
      const last = Math.max(first, first + o.triangleCount - 1);
      firstTriangle = last + 1;
      return (
        `<volume firstid="${first}" lastid="${last}">` +
        `<metadata type="volume" key="name" value="${o.name}"/>` +
        `<metadata type="volume" key="extruder" value="${o.slot.extruder}"/>` +
        `</volume>`
      );
    })
    .join("");

  const prusaConfig =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<config>` +
    `<object id="${assemblyId}">` +
    `<metadata type="object" key="name" value="${objects[0]?.name ?? "Peca"}"/>` +
    `<metadata type="object" key="extruder" value="${objects[0]?.slot.extruder ?? 1}"/>` +
    prusaVolumes +
    `</object>` +
    `</config>`;

  // Bambu Studio / OrcaSlicer dialect: parts reference the component objects.
  const orcaConfig =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<config>` +
    `<object id="${assemblyId}">` +
    `<metadata key="name" value="${objects[0]?.name ?? "Peca"}"/>` +
    `<metadata key="extruder" value="${objects[0]?.slot.extruder ?? 1}"/>` +
    objects
      .map(
        (o, i) =>
          `<part id="${i + 2}" subtype="normal_part">` +
          `<metadata key="name" value="${o.name}"/>` +
          `<metadata key="extruder" value="${o.slot.extruder}"/>` +
          `</part>`,
      )
      .join("") +
    `</object>` +
    `</config>`;


  // Filament arrays are indexed by EXTRUDER SLOT (position 0 = slot 1), not by
  // object. Emitting them per object shifted every colour when two parts share
  // a slot, which is why prints came out with the wrong colours.
  const maxSlot = objects.reduce((m, o) => Math.max(m, o.slot.extruder), 1);
  const bySlot: (MaterialSlot | undefined)[] = Array.from({ length: maxSlot });
  for (const o of objects) if (!bySlot[o.slot.extruder - 1]) bySlot[o.slot.extruder - 1] = o.slot;
  const slotList = Array.from({ length: maxSlot }, (_, i) =>
    bySlot[i] ?? { extruder: i + 1, material: "PLA" as FilamentType, color: "#FFFFFF" },
  );

  const projectSettings = JSON.stringify({
    filament_type: slotList.map((s) => s.material),
    filament_colour: slotList.map((s) => s.color.toUpperCase()),
    filament_settings_id: slotList.map((s) => `${s.material}`),
    // Fast-but-safe speed profile so plates don't take hours to print.
    outer_wall_speed: "200",
    inner_wall_speed: "300",
    sparse_infill_speed: "350",
    internal_solid_infill_speed: "300",
    top_surface_speed: "200",
    gap_infill_speed: "250",
    travel_speed: "500",
    initial_layer_speed: "50",
    initial_layer_infill_speed: "105",
    bridge_speed: "50",
    default_acceleration: "10000",
    outer_wall_acceleration: "5000",
    inner_wall_acceleration: "10000",
    travel_acceleration: "10000",
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
