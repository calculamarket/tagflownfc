import { useState } from "react";
import { Download, FileImage, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { a4Layout, buildA4Sheets, deliverA4File, packageA4Sheets } from "@/lib/a4-label-sheet";
import type { LabelShape, QrLevel } from "@/lib/round-label";

export function A4LabelExport({ getTexts, count, initialSize = 35, initialShape = "square", level = "Q", disabled = false }: {
  getTexts: () => Promise<string[]> | string[];
  count: number;
  initialSize?: number;
  initialShape?: LabelShape;
  level?: QrLevel;
  disabled?: boolean;
}) {
  const [size, setSize] = useState(String(initialSize));
  const [shape, setShape] = useState<LabelShape>(initialShape);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<{ blob: Blob; filename: string } | null>(null);
  const [preview, setPreview] = useState("");
  const [open, setOpen] = useState(false);
  let layout;
  try { layout = a4Layout(Number(size), count); } catch { /* validation shown on generate */ }

  const clear = () => { setReady(null); setPreview(""); };
  const generate = async () => {
    setBusy(true);
    clear();
    try {
      a4Layout(Number(size), count);
      const texts = await getTexts();
      const sheets = await buildA4Sheets(texts, Number(size), shape, level);
      const first = sheets[0];
      if (first) {
        const reader = new FileReader();
        reader.onload = () => setPreview(typeof reader.result === "string" ? reader.result : "");
        reader.readAsDataURL(first);
      }
      setReady(await packageA4Sheets(sheets));
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) { setSize(String(initialSize)); setShape(initialShape); clear(); } }}>
      <DialogTrigger asChild><Button variant="outline" disabled={disabled || count < 1}><FileImage className="size-4" /> Folha A4 · PNG 300 dpi</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Etiquetas em folha A4</DialogTitle>
          <DialogDescription>210 × 297 mm · 2480 × 3508 pixels · 300 dpi</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="a4-size">Tamanho (mm)</Label><Input id="a4-size" type="number" min={10} max={100} value={size} disabled={busy} onChange={(e) => { setSize(e.target.value); clear(); }} /></div>
          <div className="space-y-2"><Label>Formato</Label><Select value={shape} disabled={busy} onValueChange={(v) => { setShape(v as LabelShape); clear(); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="square">Quadrada</SelectItem><SelectItem value="round">Redonda</SelectItem></SelectContent></Select></div>
        </div>
        <p className="text-sm text-muted-foreground">{count} etiqueta(s){layout ? ` · ${layout.capacity} por folha · ${layout.pages} folha(s)` : ""}</p>
        {preview && <img src={preview} alt="Prévia da primeira folha A4 de etiquetas" className="mx-auto max-h-80 border border-border object-contain" />}
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={busy || !layout} variant={ready ? "outline" : "default"} onClick={generate}>{busy ? <Loader2 className="size-4 animate-spin" /> : <FileImage className="size-4" />}{busy ? "Gerando…" : "Gerar folha A4"}</Button>
          {ready && <Button onClick={() => deliverA4File(ready.blob, ready.filename).catch((e) => toast.error((e as Error).message))}><Download className="size-4" />{ready.filename.endsWith(".zip") ? "Baixar PNGs (ZIP)" : "Baixar PNG"}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}