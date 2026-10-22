import { useState } from "react";
import { Download, FileImage, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { a4Layout, buildA4Sheets, deliverA4File, packageA4Sheets, packageA4Pdf, LABEL_ICONS, type A4LabelShape, type LabelIcon, type QrScheme } from "@/lib/a4-label-sheet";
import type { QrLevel } from "@/lib/round-label";

export function A4LabelExport({ getTexts, count, initialSize = 35, initialShape = "square", initialIcons = ["instagram", "whatsapp", "google", "nfc"], level = "Q", disabled = false }: {
  getTexts: () => Promise<string[]> | string[];
  count: number;
  initialSize?: number;
  initialShape?: A4LabelShape;
  initialIcons?: LabelIcon[];
  level?: QrLevel;
  disabled?: boolean;
}) {
  const [size, setSize] = useState(String(initialSize));
  const [shape, setShape] = useState<A4LabelShape>(initialShape);
  const [icons, setIcons] = useState<LabelIcon[]>(initialIcons);
  const [scheme, setScheme] = useState<QrScheme>("light");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<{ blob: Blob; filename: string } | null>(null);
  const [sheets, setSheets] = useState<Blob[]>([]);
  const [preview, setPreview] = useState("");
  const [open, setOpen] = useState(false);
  let layout;
  try { layout = a4Layout(Number(size), count, shape); } catch { /* validation shown on generate */ }

  const clear = () => { setReady(null); setSheets([]); setPreview(""); };
  const downloadPdf = async () => {
    setBusy(true);
    try {
      const file = await packageA4Pdf(sheets);
      await deliverA4File(file.blob, file.filename);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const generate = async () => {
    setBusy(true);
    clear();
    try {
      a4Layout(Number(size), count, shape);
      const texts = await getTexts();
      const sheets = await buildA4Sheets(texts, Number(size), shape, level, scheme, icons);
      setSheets(sheets);
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
      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) { setSize(String(initialSize)); setShape(initialShape); setScheme("light"); setIcons([...initialIcons]); clear(); } }}>
      <DialogTrigger asChild><Button variant="outline" disabled={disabled || count < 1}><FileImage className="size-4" /> Folha A4 · PNG / PDF</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Etiquetas em folha A4</DialogTitle>
          <DialogDescription>210 × 297 mm · 4961 × 7016 pixels · 600 dpi</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="a4-size">{shape === "rectangle" ? "QR quadrado (mm)" : "Tamanho (mm)"}</Label><Input id="a4-size" type="number" min={10} max={100} value={size} disabled={busy} onChange={(e) => { setSize(e.target.value); clear(); }} /></div>
          <div className="space-y-2"><Label>Formato</Label><Select value={shape} disabled={busy} onValueChange={(v) => { setShape(v as A4LabelShape); clear(); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="square">Quadrada</SelectItem><SelectItem value="round">Redonda</SelectItem><SelectItem value="rectangle">Retangular + ícones</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Cores</Label><Select value={scheme} disabled={busy} onValueChange={(v) => { setScheme(v as QrScheme); clear(); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="light">Fundo branco · QR preto</SelectItem><SelectItem value="dark">Fundo preto · QR branco</SelectItem></SelectContent></Select></div>
        </div>
        {shape === "rectangle" && <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Ícones à esquerda</legend><div className="grid grid-cols-2 gap-3">{LABEL_ICONS.map((item) => <Label key={item.id} className="flex items-center gap-2"><Checkbox disabled={busy} checked={icons.includes(item.id)} onCheckedChange={(checked) => { setIcons((current) => checked === true ? [...current, item.id] : current.filter((id) => id !== item.id)); clear(); }} />{item.label}</Label>)}</div>{layout && <p className="text-sm text-muted-foreground">Etiqueta: {layout.widthMm} × {layout.heightMm} mm · QR: {size} × {size} mm</p>}</fieldset>}
        <p className="text-sm text-muted-foreground">{count} etiqueta(s){layout ? ` · ${layout.capacity} por folha · ${layout.pages} folha(s)` : ""}</p>
        {preview && <img src={preview} alt="Prévia da primeira folha A4 de etiquetas" className="mx-auto max-h-80 border border-border object-contain" />}
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={busy || !layout} variant={ready ? "outline" : "default"} onClick={generate}>{busy ? <Loader2 className="size-4 animate-spin" /> : <FileImage className="size-4" />}{busy ? "Gerando…" : "Gerar folha A4"}</Button>
          {ready && <Button disabled={busy} onClick={() => deliverA4File(ready.blob, ready.filename).catch((e) => toast.error((e as Error).message))}><Download className="size-4" />{ready.filename.endsWith(".zip") ? "Baixar PNGs (ZIP)" : "Baixar PNG"}</Button>}
          {ready && <Button disabled={busy} variant="outline" onClick={downloadPdf}><FileText className="size-4" />Baixar PDF</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}