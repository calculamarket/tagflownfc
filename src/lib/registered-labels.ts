import type { BatchItem, BatchMode } from "./batch-qr";

export const LABEL_ORIGIN = "https://www.3dqr.com.br";
export const registeredTagUrl = (id: string) => `${LABEL_ORIGIN}/t/${encodeURIComponent(id)}`;

/** Only server-confirmed IDs can be rendered into activation labels. */
export async function registeredLabelItems(
  quantity: number,
  mode: BatchMode,
  mint: (quantity: number) => Promise<{ id: string }[]>,
): Promise<BatchItem[]> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
    throw new Error("Informe uma quantidade entre 1 e 500 etiquetas.");
  }
  const needed = mode === "same" ? 1 : quantity;
  const tags = await mint(needed);
  if (tags.length !== needed || tags.some((tag) => !tag.id) || new Set(tags.map((tag) => tag.id)).size !== needed) {
    throw new Error("Não foi possível cadastrar todas as etiquetas. Tente novamente.");
  }
  return Array.from({ length: quantity }, (_, i) => {
    const tag = tags[mode === "same" ? 0 : i];
    if (!tag) throw new Error("Etiqueta não cadastrada.");
    return { index: i + 1, id: tag.id, text: registeredTagUrl(tag.id) };
  });
}