import { useState } from "react";
import { toast } from "sonner";
import { Layers, Download } from "lucide-react";
import {
  buildBatchItems,
  buildBatchZip,
  type BatchMode,
} from "@/lib/batch-qr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Props = {
  /** QR content used when every etiqueta shares the same code. */
  sameText: string;
  /** Base name for the downloaded files. */
  filename: string;
  /** Builds one model for the given QR content. */
  build: (text: string, format: "3mf" | "stl") => Promise<Blob> | Blob;
};

const DEFAULT_BASE = "https://www.3dqr.com.br/t";

export function BatchGenerator({ sameText, filename, build }: Props) {
  const [quantity, setQuantity] = useState("10");
  const [mode, setMode] = useState<BatchMode>("unique");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const run = async (format: "3mf" | "stl") => {
    try {
      const items = buildBatchItems({
        quantity: Math.round(Number(quantity.replace(",", "."))),
        mode,
        baseUrl,
        sameText,
      });
      setProgress({ done: 0, total: items.length });
      const zip = await buildBatchZip({
        items,
        filename: filename || "etiqueta",
        format,
        build: (text) => build(text, format),
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const href = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${filename || "etiqueta"}-lote-${items.length}.zip`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success(`${items.length} peças geradas no arquivo .zip.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Layers className="size-4 text-primary" /> Geração em lote
        </h2>
        <p className="text-xs text-muted-foreground">
          Gere várias etiquetas de uma vez usando exatamente as mesmas medidas acima. O
          download sai em .zip com um CSV listando o código de cada arquivo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="qtd">Quantidade</Label>
          <Input
            id="qtd"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo de QR Code</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as BatchMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unique">QR Codes diferentes (um por etiqueta)</SelectItem>
              <SelectItem value="same">Mesmo QR Code em todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="base">URL base dos códigos únicos</Label>
          <Input
            id="base"
            disabled={mode !== "unique"}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {mode === "unique"
          ? `Cada peça recebe um código curto próprio, no formato ${baseUrl.replace(/\/$/, "")}/a1b2c3d4.`
          : "Todas as peças usarão o conteúdo do QR Code definido acima."}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy} onClick={() => run("3mf")}>
          <Layers className="size-4" /> Gerar lote .3mf (.zip)
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => run("stl")}>
          <Download className="size-4" /> Gerar lote .stl (.zip)
        </Button>
        {progress ? (
          <span className="text-xs text-muted-foreground">
            Gerando {progress.done}/{progress.total}…
          </span>
        ) : null}
      </div>
    </section>
  );
}
