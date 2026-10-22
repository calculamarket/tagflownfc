import { siInstagram, siWhatsapp, siGoogle } from "simple-icons";
import type { LabelIcon } from "./a4-label-sheet";

export type SocialIconMask = { id: LabelIcon; cols: number; rows: number; data: boolean[] };
const masks = new Map<LabelIcon, SocialIconMask>();

/** Rasterize official artwork once per session; runs only during browser export. */
export async function socialIconMasks(ids: LabelIcon[]): Promise<SocialIconMask[]> {
  return Promise.all([...new Set(ids)].map(async (id) => {
    const cached = masks.get(id);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Não foi possível gerar os ícones.");
    ctx.scale(4, 4);
    if (id === "nfc") {
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.stroke(new Path2D("M5 8v8 M9 5c4 4 4 10 0 14 M13 2c6 6 6 14 0 20 M17 1c7 7 7 15 0 22"));
    } else {
      const brand = { instagram: siInstagram, whatsapp: siWhatsapp, google: siGoogle }[id];
      ctx.fill(new Path2D(brand.path));
    }
    const pixels = ctx.getImageData(0, 0, 96, 96).data;
    const mask = { id, cols: 96, rows: 96, data: Array.from({ length: 96 * 96 }, (_, i) => pixels[i * 4 + 3] >= 128) };
    masks.set(id, mask);
    return mask;
  }));
}