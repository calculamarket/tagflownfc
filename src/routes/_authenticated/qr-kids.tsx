import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Backpack, Download, Printer, FileCode } from "lucide-react";
import {
  roundQrPng, roundQrSvg, openRoundLabelSheet, type QrLevel,
} from "@/lib/round-label";
import { pageTitle } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/qr-kids")({
  head: () => ({
    meta: [
      { title: pageTitle("QR Kids") },
      {
        name: "description",
        content:
          "Gere etiquetas redondas de QR (26 mm) para inserir no frame da Tag NFC de mochila infantil.",
      },
    ],
  }),
  component: QrKidsPage,
});

const num = (v: string) => parseFloat(v.replace(",", "."));

function QrKidsPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.3dqr.com.br";
  const [url, setUrl] = useState(`${origin}/t/kids`);
  const [level, setLevel] = useState<QrLevel>("Q");
  const [diam, setDiam] = useState("26");
  const [qty, setQty] = useState("12");
  const [preview, setPreview] = useState("");

  // Prévia redonda, reativa ao que o usuário digita.
  useEffect(() => {
    let alive = true;
    roundQrPng(url, level, 600).then((d) => { if (alive) setPreview(d); }).catch(() => {});
    return () => { alive = false; };
  }, [url, level]);

  const diamMm = Math.min(60, Math.max(10, num(diam) || 26));

  const downloadPng = async () => {
    // 1000 px por etiqueta ~ 100 dpi/mm suficiente para 26 mm nítido.
    const data = await roundQrPng(url, level, 1200);
    const a = document.createElement("a");
    a.href = data;
    a.download = `qr-kids-${diamMm}mm.png`;
    a.click();
    toast.success("PNG gerado.");
  };

  const downloadSvg = () => {
    const svg = roundQrSvg(url, level, diamMm);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `qr-kids-${diamMm}mm.svg`;
    a.click();
    URL.revokeObjectURL(href);
    toast.success("SVG vetorial gerado.");
  };

  const printSheet = async () => {
    const data = await roundQrPng(url, level, 1000);
    openRoundLabelSheet(data, diamMm, Math.max(1, Math.floor(num(qty)) || 1));
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
          <Backpack className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">QR Kids</h1>
          <p className="text-sm text-muted-foreground">
            Etiquetas redondas de QR para o frame da Tag NFC de mochila infantil.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        A <strong>Tag NFC de mochila</strong> tem um encaixe <strong>circular de 26 mm</strong> para a
        etiqueta. Gere aqui a etiqueta redonda do QR, imprima em <strong>tamanho real (100%)</strong>,
        recorte e insira no frame. Cada QR aponta para o endereço que você definir — o destino
        continua reconfigurável na aba <strong>Minhas Tags</strong>.
      </div>

      <div className="grid gap-6 sm:grid-cols-[1fr_260px] items-start">
        {/* Configuração */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Endereço do QR (destino)</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`${origin}/t/...`} />
            <p className="text-xs text-muted-foreground">
              Cole o link de uma tag sua (ex.: <code>{origin}/t/abc123</code>) para que fique
              reconfigurável e com analytics.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Diâmetro (mm)</Label>
              <Input inputMode="numeric" value={diam} onChange={(e) => setDiam(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Correção de erro</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as QrLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Baixa (L)</SelectItem>
                  <SelectItem value="M">Média (M)</SelectItem>
                  <SelectItem value="Q">Alta (Q)</SelectItem>
                  <SelectItem value="H">Máxima (H)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Qtd. na folha</Label>
              <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={downloadPng}><Download className="size-4" /> Baixar PNG</Button>
            <Button variant="outline" onClick={downloadSvg}>
              <FileCode className="size-4" /> Baixar SVG
            </Button>
            <Button variant="outline" onClick={printSheet}>
              <Printer className="size-4" /> Folha A4 ({diamMm} mm)
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Para muitas crianças (cada uma com QR diferente), gere um <strong>lote</strong> em
            <strong> Admin → Lotes de produção</strong> e use a “Folha Chaveiro” com diâmetro 26 mm.
          </p>
        </div>

        {/* Prévia redonda */}
        <div className="space-y-2">
          <Label className="text-xs">Prévia ({diamMm} mm)</Label>
          <div className="grid place-items-center rounded-lg border border-border bg-white p-4">
            {preview ? (
              <img src={preview} alt="Prévia da etiqueta" className="w-40 h-40 rounded-full" />
            ) : (
              <div className="w-40 h-40 rounded-full bg-muted animate-pulse" />
            )}
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            O QR ocupa o centro; o anel branco é a zona de silêncio (necessária para escanear).
          </p>
        </div>
      </div>
    </div>
  );
}
