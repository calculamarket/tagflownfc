import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createStockTags } from "@/lib/stock.functions";
import { registeredLabelItems } from "@/lib/registered-labels";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { LABEL_ICONS, type LabelIcon } from "@/lib/a4-label-sheet";
import { A4LabelExport } from "@/components/a4-label-export";
import type { QrLevel } from "@/lib/round-label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Props = {
  /** QR content used when every etiqueta shares the same code. */
  sameText: string;
  /** Base name for the downloaded files. */
  filename: string;
  /** Builds one model for the given QR content. */
  build: (text: string, format: "3mf" | "stl", icons?: LabelIcon[]) => Promise<Blob> | Blob;
  social?: { qrSizeMm: number; plateSizeMm: number };
  a4?: { sizeMm: number; level: QrLevel };
  activation?: { model: string; category?: string };
  getSameText?: () => Promise<string>;
};

const DEFAULT_BASE = "https://www.3dqr.com.br/t";

export function BatchGenerator({ sameText, filename, build, a4, activation, getSameText, social }: Props) {
  const mint = useServerFn(createStockTags);
  const [quantity, setQuantity] = useState("10");
  const [mode, setMode] = useState<BatchMode>("unique");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [withSocial, setWithSocial] = useState(false);
  const [icons, setIcons] = useState<LabelIcon[]>(["instagram", "whatsapp", "google", "nfc"]);
  const count = Math.round(Number(quantity.replace(",", ".")));
  const getItems = async () => {
    if (!activation && mode === "same") return buildBatchItems({ quantity: count, mode, baseUrl, sameText });
    return registeredLabelItems(count, mode, async (quantity) => {
      if (mode === "same" && getSameText) {
        const url = await getSameText();
        const id = new URL(url).pathname.split("/").pop();
        if (!id) throw new Error("Etiqueta não cadastrada.");
        return [{ id }];
      }
      const model = activation?.model ?? "Etiqueta QR";
      return (await mint({ data: { ...activation, model, name: model, quantity } })).tags;
    });
  };

  const run = async (format: "3mf" | "stl") => {
    try {
      setProgress({ done: 0, total: count });
      const items = await getItems();
      setProgress({ done: 0, total: items.length });
      const zip = await buildBatchZip({
        items,
        filename: filename || "etiqueta",
        format,
        build: (text) => build(text, format, social && withSocial ? icons : []),
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
        {!activation && <div className="space-y-1.5">
          <Label htmlFor="base">URL base dos códigos únicos</Label>
          <Input
            id="base"
            disabled
            value={DEFAULT_BASE}
          />
        </div>}
      </div>

      {social && <div className="space-y-3 border-t border-border pt-4">
        <Label className="flex items-center gap-3"><Switch checked={withSocial} disabled={busy} onCheckedChange={setWithSocial} />Redes sociais / NFC à esquerda</Label>
        {withSocial && <div className="grid gap-3 sm:grid-cols-4">{LABEL_ICONS.map((item) => <Label key={item.id} className="flex items-center gap-2"><Checkbox checked={icons.includes(item.id)} disabled={busy} onCheckedChange={(checked) => setIcons((current) => checked === true ? [...current, item.id] : current.filter((id) => id !== item.id))} />{item.label}</Label>)}</div>}
        <p className="text-xs text-muted-foreground">Peça: {(social.plateSizeMm + (withSocial && icons.length ? 19 : 0)).toFixed(1)} × {social.plateSizeMm.toFixed(1)} mm · QR quadrado: {social.qrSizeMm.toFixed(1)} × {social.qrSizeMm.toFixed(1)} mm</p>
      </div>}

      <p className="text-xs text-muted-foreground">
        {mode === "unique"
          ? "QR Codes cadastrados no sistema, prontos para ativação."
          : activation ? "Todas as peças compartilham a mesma etiqueta cadastrada." : "Todas as peças usarão o conteúdo do QR Code definido acima."}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy} onClick={() => run("3mf")}>
          <Layers className="size-4" /> Gerar lote .3mf (.zip)
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => run("stl")}>
          <Download className="size-4" /> Gerar lote .stl (.zip)
        </Button>
        {a4 && <A4LabelExport
          count={count}
          getTexts={async () => (await getItems()).map((item) => item.text)}
          initialSize={a4.sizeMm}
          initialShape={social && withSocial && icons.length ? "rectangle" : "square"}
          initialIcons={social ? (withSocial ? icons : []) : undefined}
          level={a4.level}
          disabled={busy || !Number.isFinite(count) || count < 1 || count > 500}
        />}
        {progress ? (
          <span className="text-xs text-muted-foreground">
            Gerando {progress.done}/{progress.total}…
          </span>
        ) : null}
      </div>
    </section>
  );
}
