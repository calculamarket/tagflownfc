import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createStockTags } from "@/lib/stock.functions";
import { registeredLabelItems } from "@/lib/registered-labels";

/** Reuse the same reserved code across PNG, STL and 3MF for one piece. */
export function useRegisteredLabel(model: string, category?: string) {
  const mint = useServerFn(createStockTags);
  const pending = useRef<{ key: string; result: Promise<string> } | null>(null);
  const [url, setUrl] = useState("");
  const getText = async () => {
    const key = `${model}:${category ?? ""}`;
    if (pending.current?.key === key) return pending.current.result;
    const result = registeredLabelItems(1, "same", async (quantity) => {
      const res = await mint({ data: { name: model, model, category, quantity } });
      return res.tags;
    }).then((items) => {
      const first = items[0];
      if (!first) throw new Error("Etiqueta não cadastrada.");
      setUrl(first.text);
      return first.text;
    }).catch((error: unknown) => {
      if (pending.current?.key === key) pending.current = null;
      throw error;
    });
    pending.current = { key, result };
    return result;
  };
  return { url, getText };
}