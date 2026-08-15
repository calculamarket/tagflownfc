import { newTagId } from "./tag-id";
import { createZip, type ZipEntry } from "./zip";

export type BatchMode = "unique" | "same";

export type BatchItem = { index: number; id: string; text: string };

/** Build the list of QR contents for a batch run. */
export function buildBatchItems(params: {
  quantity: number;
  mode: BatchMode;
  baseUrl: string;
  sameText: string;
}): BatchItem[] {
  const { quantity, mode, baseUrl, sameText } = params;
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error("Informe uma quantidade válida (mínimo 1).");
  }
  if (quantity > 500) throw new Error("Máximo de 500 etiquetas por lote.");

  if (mode === "same") {
    if (!sameText.trim()) throw new Error("Informe o conteúdo do QR Code.");
    return Array.from({ length: quantity }, (_, i) => ({
      index: i + 1,
      id: "",
      text: sameText,
    }));
  }

  const prefix = baseUrl.trim();
  if (!prefix) throw new Error("Informe a URL base dos QR Codes únicos.");
  const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const seen = new Set<string>();
  const items: BatchItem[] = [];
  while (items.length < quantity) {
    const id = newTagId();
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ index: items.length + 1, id, text: `${normalized}${id}` });
  }
  return items;
}

export function batchCsv(items: BatchItem[]): string {
  const rows = [
    "arquivo,codigo,conteudo",
    ...items.map((i) => `${i.index},${i.id},"${i.text.replace(/"/g, '""')}"`),
  ];
  return rows.join("\n");
}

const pad = (n: number, total: number) => String(n).padStart(String(total).length, "0");

/**
 * Runs the model builder once per item and packs everything into a single ZIP,
 * plus a CSV index listing which code went into which file.
 */
export async function buildBatchZip(params: {
  items: BatchItem[];
  filename: string;
  format: "3mf" | "stl";
  build: (text: string) => Promise<Blob> | Blob;
  onProgress?: (done: number, total: number) => void;
}): Promise<Blob> {
  const { items, filename, format, build, onProgress } = params;
  const entries: ZipEntry[] = [];
  for (const item of items) {
    const blob = await build(item.text);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const suffix = item.id ? `${pad(item.index, items.length)}-${item.id}` : pad(item.index, items.length);
    entries.push({ name: `${filename}-${suffix}.${format}`, data: bytes });
    onProgress?.(entries.length, items.length);
    // Yield so the UI can repaint between heavy meshes.
    await new Promise((r) => setTimeout(r, 0));
  }
  entries.push({
    name: `${filename}-lista.csv`,
    data: new TextEncoder().encode(batchCsv(items)),
  });
  return createZip(entries);
}
