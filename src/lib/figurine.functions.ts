import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Turns two or more reference photos into a stylised collectible figurine
 * render (front / side / back views), using the Lovable AI gateway.
 */
const STYLES = ["funko", "chibi", "realista", "cartoon", "lego"] as const;

const stylePrompt: Record<(typeof STYLES)[number], string> = {
  funko:
    "vinyl collectible figurine in the classic big-head bobble style: oversized rounded head, small stylised body, simple black oval eyes, no nose, matte vinyl finish",
  chibi:
    "cute chibi anime figurine: large expressive eyes, soft rounded proportions, glossy painted resin finish",
  realista:
    "realistic proportional collectible statuette, finely painted resin, museum-quality detailing",
  cartoon:
    "playful cartoon figurine with exaggerated friendly features and bold flat colours",
  lego:
    "blocky minifigure-style toy with cylindrical head, clip hands and glossy ABS plastic finish",
};

const viewPrompt: Record<string, string> = {
  frente: "front view, facing the camera straight on",
  lado: "side view, exact left profile",
  costas: "back view, seen from directly behind",
  turnaround:
    "character turnaround sheet showing the same figurine three times side by side: front view, side profile and back view, evenly spaced",
};

const schema = z.object({
  photos: z.array(z.string().min(32)).min(2).max(5),
  style: z.enum(STYLES),
  view: z.enum(["frente", "lado", "costas", "turnaround"]).default("turnaround"),
  notes: z.string().max(500).optional(),
});

export const generateFigurine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("IA indisponível no momento.");

    const prompt =
      `Create a single product-photography style image of a ${stylePrompt[data.style]}, ` +
      `designed after the real person/object shown in the reference photos. ` +
      `Keep the recognisable traits: face shape, hair, skin tone, clothing colours and any accessories. ` +
      `${viewPrompt[data.view]}. Centered, full body, standing on a small round display base, ` +
      `soft studio lighting, plain light-grey seamless background, no text, no watermark, sharp focus.` +
      (data.notes ? ` Additional direction: ${data.notes}` : "");

    const content = [
      { type: "text", text: prompt },
      ...data.photos.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Limite de uso atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha ao gerar a imagem (${res.status}). ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("A IA não retornou imagem. Tente outras fotos ou outro estilo.");
    return { image: `data:image/png;base64,${b64}` };
  });
