import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Box, Download, PawPrint } from "lucide-react";
import {
  buildPetTag3mf,
  buildPetTagStl,
  buildPetTagGeometry,
  type PetTagOptions,
} from "@/lib/pet-tag-3d";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pet-tag")({
  head: () => ({
    meta: [
      { title: "Gerador Pet Tag 3D · 3D QR" },
      {
        name: "description",
        content:
          "Gere a plaquinha de coleira Pet Tag com QR Code já embutido e baixe em 3MF (duas cores) ou STL pronto para imprimir.",
      },
      { property: "og:title", content: "Gerador Pet Tag 3D · 3D QR" },
      {
        property: "og:description",
        content:
          "Crie a peça completa da coleira do seu pet com QR Code personalizado, pronta para o fatiador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PetTagPage,
});

type Level = "L" | "M" | "Q" | "H";

const num = (v: string) => parseFloat(v.replace(",", "."));

function PetTagPage() {
  const [text, setText] = useState("https://www.3dqr.com.br/t/pet");
  const [level, setLevel] = useState<Level>("Q");
  const [widthMm, setWidthMm] = useState("50");
  const [depthMm, setDepthMm] = useState("32");
  const [plateMm, setPlateMm] = useState("3");
  const [legWidthMm, setLegWidthMm] = useState("10");
  const [legHeightMm, setLegHeightMm] = useState("7");
  const [qrSizeMm, setQrSizeMm] = useState("24");
  const [quietMm, setQuietMm] = useState("2");
  const [codeMm, setCodeMm] = useState("0.8");
  const [mode, setMode] = useState<"emboss" | "recess">("emboss");
  const [bodyColor, setBodyColor] = useState("#ffffff");
  const [codeColor, setCodeColor] = useState("#000000");
  const [filename, setFilename] = useState("pet-tag-qr");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, text || " ", {
      width: 220,
      margin: 2,
      errorCorrectionLevel: level,
      color: { dark: codeColor, light: bodyColor },
    }).catch(() => undefined);
  }, [text, level, codeColor, bodyColor]);

  const options = (): PetTagOptions => {
    const values = {
      widthMm: num(widthMm),
      depthMm: num(depthMm),
      plateMm: num(plateMm),
      legWidthMm: num(legWidthMm),
      legHeightMm: num(legHeightMm),
      qrSizeMm: num(qrSizeMm),
      quietZoneMm: num(quietMm),
      codeMm: num(codeMm),
    };
    if (!text.trim()) throw new Error("Informe o conteúdo do QR Code.");
    for (const [key, v] of Object.entries(values)) {
      if (!Number.isFinite(v) || v < 0) throw new Error(`Medida inválida: ${key}.`);
    }
    if (values.widthMm - 2 * values.legWidthMm < 10) {
      throw new Error("O vão da coleira ficou pequeno: reduza a largura das pernas.");
    }
    return {
      text,
      ...values,
      radiusMm: 4,
      errorCorrectionLevel: level,
      recessed: mode === "recess",
    };
  };

  const summary = useMemo(() => {
    try {
      const geo = buildPetTagGeometry(options());
      return {
        size: `${geo.totalWidthMm.toFixed(0)} × ${geo.totalDepthMm.toFixed(0)} × ${geo.totalHeightMm.toFixed(2)} mm`,
        slot: `${(num(widthMm) - 2 * num(legWidthMm)).toFixed(0)} × ${num(legHeightMm).toFixed(0)} mm`,
        maxQr: geo.maxQrSizeMm,
        changeZ: geo.codeStartZ,
      };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, level, widthMm, depthMm, plateMm, legWidthMm, legHeightMm, qrSizeMm, quietMm, codeMm, mode]);

  const download = async (format: "3mf" | "stl") => {
    setBusy(true);
    try {
      const opts = options();
      const blob =
        format === "3mf"
          ? await buildPetTag3mf({ ...opts, bodyColor, codeColor })
          : buildPetTagStl(opts);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${filename || "pet-tag-qr"}.${format}`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success(`Peça .${format} gerada.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <PawPrint className="size-5 text-primary" /> Pet Tag
        </h1>
        <p className="text-sm text-muted-foreground">
          Gere a plaquinha de coleira completa — corpo com passador para a fita e QR Code
          já integrado na face superior. Baixe o 3MF com as duas cores separadas ou o STL
          de peça única.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="conteudo">Conteúdo do QR Code</Label>
            <Textarea
              id="conteudo"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://… , telefone, texto do contato"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Correção de erro</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">L · ~7%</SelectItem>
                  <SelectItem value="M">M · ~15%</SelectItem>
                  <SelectItem value="Q">Q · ~25%</SelectItem>
                  <SelectItem value="H">H · ~30%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w">Largura da peça (mm)</Label>
              <Input id="w" inputMode="decimal" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d">Profundidade (mm)</Label>
              <Input id="d" inputMode="decimal" value={depthMm} onChange={(e) => setDepthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Espessura da placa (mm)</Label>
              <Input id="p" inputMode="decimal" value={plateMm} onChange={(e) => setPlateMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lw">Largura das pernas (mm)</Label>
              <Input id="lw" inputMode="decimal" value={legWidthMm} onChange={(e) => setLegWidthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lh">Altura do vão da fita (mm)</Label>
              <Input id="lh" inputMode="decimal" value={legHeightMm} onChange={(e) => setLegHeightMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q">Tamanho do QR (mm)</Label>
              <Input id="q" inputMode="decimal" value={qrSizeMm} onChange={(e) => setQrSizeMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiet">Quiet zone (mm)</Label>
              <Input id="quiet" inputMode="decimal" value={quietMm} onChange={(e) => setQuietMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c">Altura do código (mm)</Label>
              <Input id="c" inputMode="decimal" value={codeMm} onChange={(e) => setCodeMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Modo</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "emboss" | "recess")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emboss">Relevo</SelectItem>
                  <SelectItem value="recess">Baixo-relevo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="corpo">Cor do corpo</Label>
              <input
                id="corpo"
                type="color"
                value={bodyColor}
                onChange={(e) => setBodyColor(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="corcode">Cor do código</Label>
              <input
                id="corcode"
                type="color"
                value={codeColor}
                onChange={(e) => setCodeColor(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="arquivo">Nome do arquivo</Label>
              <Input id="arquivo" value={filename} onChange={(e) => setFilename(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => download("3mf")}>
              <Box className="size-4" /> Baixar .3mf (duas cores)
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => download("stl")}>
              <Download className="size-4" /> Baixar .stl
            </Button>
          </div>
        </div>

        <aside className="space-y-3 rounded-lg border border-border bg-card p-5 h-fit">
          <div className="text-sm font-medium">Pré-visualização</div>
          <canvas ref={canvasRef} className="w-full max-w-[220px] mx-auto rounded-md" />
          <dl className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <dt>Peça final</dt><dd>{summary?.size ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Vão da fita</dt><dd>{summary?.slot ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>QR máximo</dt><dd>{summary ? `${summary.maxQr.toFixed(1)} mm` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Troca de cor em</dt><dd>{summary ? `${summary.changeZ.toFixed(2)} mm` : "—"}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            No 3MF, corpo e código saem como dois objetos — basta atribuir o filamento de
            cada um no fatiador. No STL, use troca de filamento na altura indicada.
          </p>
        </aside>
      </div>
    </div>
  );
}
