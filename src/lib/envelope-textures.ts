import type { ReliefMask } from "./pix-plate-3d";

/**
 * Procedural textures used inside the envelope frame. Every generator returns a
 * boolean raster (true = material) that the extruder turns into relief.
 */
export type EnvelopeTextureKind =
  | "renda"
  | "malha"
  | "favo"
  | "diagonal"
  | "pontos"
  | "flores"
  | "ondas"
  | "solido";

export const ENVELOPE_TEXTURES: { value: EnvelopeTextureKind; label: string }[] = [
  { value: "renda", label: "Renda floral" },
  { value: "malha", label: "Malha (tule)" },
  { value: "favo", label: "Favo de mel" },
  { value: "diagonal", label: "Treliça diagonal" },
  { value: "pontos", label: "Pontos" },
  { value: "flores", label: "Flores" },
  { value: "ondas", label: "Ondas" },
  { value: "solido", label: "Sólido (sem vazado)" },
];

/**
 * @param cols/rows raster size in cells
 * @param scale     cells per pattern repeat
 */
export function patternToMask(
  kind: EnvelopeTextureKind,
  cols: number,
  rows: number,
  scale: number,
): ReliefMask {
  const data: boolean[] = new Array(cols * rows).fill(false);
  const s = Math.max(3, scale);
  const on = (x: number, y: number) => {
    const u = (x % s) / s;
    const v = (y % s) / s;
    const cx = u - 0.5;
    const cy = v - 0.5;
    const r = Math.hypot(cx, cy);
    switch (kind) {
      case "solido":
        return true;
      case "malha":
        return u < 0.22 || v < 0.22;
      case "favo": {
        const hy = y / (s * 0.87);
        const row = Math.floor(hy);
        const hx = (x + (row % 2 ? s / 2 : 0)) / s;
        const du = (hx % 1) - 0.5;
        const dv = (hy % 1) - 0.5;
        return Math.hypot(du, dv * 1.15) > 0.34;
      }
      case "diagonal":
        return ((x + y) % s) / s < 0.28 || ((x - y + cols * s) % s) / s < 0.28;
      case "pontos":
        return r < 0.3;
      case "flores": {
        const a = Math.atan2(cy, cx);
        return r < 0.14 + 0.24 * Math.abs(Math.cos(3 * a));
      }
      case "ondas":
        return (y + Math.sin((x / s) * Math.PI * 2) * s * 0.35) % s < s * 0.4;
      case "renda":
      default: {
        const a = Math.atan2(cy, cx);
        const flower = r < 0.1 + 0.22 * Math.abs(Math.cos(4 * a));
        const mesh = (x % Math.round(s / 3)) < 1 || (y % Math.round(s / 3)) < 1;
        const ring = Math.abs(r - 0.42) < 0.05;
        return flower || ring || mesh;
      }
    }
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) data[r * cols + c] = on(c, r);
  }
  return { cols, rows, data };
}
