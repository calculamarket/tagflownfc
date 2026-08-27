import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Box, Download } from "lucide-react";
import { buildQr3mf } from "@/lib/qr-3mf";
import { buildQrStl } from "@/lib/qr-stl";
import { buildEmergencyPlate3mf, buildEmergencyPlateStl } from "@/lib/emergency-plate-3d";
import { BatchGenerator } from "@/components/batch-generator";
import { MaterialSlotFields, SlotCountField } from "@/components/material-slots";
import type { MaterialSlot } from "@/lib/three-mf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/gerador-3d")({
  head: () => ({
    meta: [
      { title: "Gerador de QR 3D · 3D QR" },
      {
        name: "description",
        content:
          "Gere o arquivo 3MF (duas cores) ou STL de qualquer QR Code, com tamanho, quiet zone, alturas e cores definidos em milímetros.",
      },
      { property: "og:title", content: "Gerador de QR 3D · 3D QR" },
      {
        property: "og:description",
        content: "Crie o modelo 3D imprimível de qualquer QR Code em segundos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Gerador3dPage,
});

type Level = "L" | "M" | "Q" | "H";
type Model = "placa" | "emergencia";

const num = (v: string) => parseFloat(v.replace(",", "."));

function Gerador3dPage() {
  const [model, setModel] = useState<Model>("placa");
  const [caption, setCaption] = useState("Emergência - Leia o QR Code");
  const [emWidth, setEmWidth] = useState("45");
  const [emHeight, setEmHeight] = useState("60");
  const [emThickness, setEmThickness] = useState("1.5");
  const [emHole, setEmHole] = useState("0");
  const [text, setText] = useState("https://www.3dqr.com.br");
  const [level, setLevel] = useState<Level>("M");
  const [sizeMm, setSizeMm] = useState("50");
  const [quietMm, setQuietMm] = useState("2");
  const [fillMm, setFillMm] = useState("1");
  const [codeMm, setCodeMm] = useState("0.6");
  const [mode, setMode] = useState<"emboss" | "recess">("emboss");
  const [fillColor, setFillColor] = useState("#ffffff");
  const [codeColor, setCodeColor] = useState("#000000");
  const [slots, setSlots] = useState(4);
  const [bodySlot, setBodySlot] = useState<MaterialSlot>({ extruder: 1, material: "PLA", color: "#ffffff" });
  const [codeSlot, setCodeSlot] = useState<MaterialSlot>({ extruder: 2, material: "PLA", color: "#000000" });
  const [filename, setFilename] = useState("qrcode-3d");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, text || " ", {
      width: 260,
      margin: 2,
      errorCorrectionLevel: level,
      color: { dark: codeColor, light: fillColor },
    }).catch(() => undefined);
  }, [text, level, codeColor, fillColor]);

  const options = () => {
    const size = num(sizeMm);
    const quiet = num(quietMm);
    const base = num(fillMm);
    const mod = num(codeMm);
    if (!text.trim()) throw new Error("Informe o conteúdo do QR Code.");
    if (!(size > 0) || !(base > 0) || !(mod > 0) || !(quiet >= 0)) {
      throw new Error("Informe medidas válidas em milímetros.");
    }
    return {
      sizeMm: size,
      quietZoneMm: quiet,
      baseHeightMm: base,
      moduleHeightMm: mod,
      errorCorrectionLevel: level,
      recessed: mode === "recess",
    };
  };

  const emergencyOptions = () => {
    const w = num(emWidth);
    const h = num(emHeight);
    const t = num(emThickness);
    if (!text.trim()) throw new Error("Informe o conteúdo do QR Code.");
    if (!(w > 0) || !(h > 0) || !(t > 0)) {
      throw new Error("Informe medidas válidas em milímetros.");
    }
    return {
      widthMm: w,
      heightMm: h,
      thicknessMm: t,
      reliefHeightMm: num(codeMm) || 0.6,
      caption,
      holeDiameterMm: num(emHole) || 0,
      errorCorrectionLevel: level,
      baseColor: fillColor,
      codeColor,
      baseSlot: bodySlot,
      codeSlot,
    };
  };

  const buildModel = (content: string, format: "3mf" | "stl") => {
    if (model === "emergencia") {
      const opts = emergencyOptions();
      return format === "3mf"
        ? buildEmergencyPlate3mf(content, opts)
        : buildEmergencyPlateStl(content, opts);
    }
    const opts = options();
    return format === "3mf"
      ? buildQr3mf(content, { ...opts, baseColor: fillColor, codeColor, baseSlot: bodySlot, codeSlot })
      : buildQrStl(content, opts);
  };

  const download = async (format: "3mf" | "stl") => {
    setBusy(true);
    try {
      const blob = await buildModel(text, format);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${filename || "qrcode-3d"}.${format}`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success(`Arquivo .${format} gerado.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const total = (num(sizeMm) || 0) + 2 * (num(quietMm) || 0);

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Gerador de QR 3D</h1>
        <p className="text-sm text-muted-foreground">
          Digite qualquer conteúdo e baixe o modelo pronto para o fatiador — 3MF com duas
          cores separadas ou STL de peça única.
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
              placeholder="https://… , texto, WIFI:T:WPA;S:rede;P:senha;;"
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
              <Label htmlFor="size">Tamanho do código (mm)</Label>
              <Input id="size" inputMode="decimal" value={sizeMm} onChange={(e) => setSizeMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiet">Quiet zone (mm)</Label>
              <Input id="quiet" inputMode="decimal" value={quietMm} onChange={(e) => setQuietMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fill">Espessura da base (mm)</Label>
              <Input id="fill" inputMode="decimal" value={fillMm} onChange={(e) => setFillMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Espessura do código (mm)</Label>
              <Input id="code" inputMode="decimal" value={codeMm} onChange={(e) => setCodeMm(e.target.value)} />
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
            <SlotCountField value={slots} onChange={setSlots} />
            <MaterialSlotFields
              label="Base"
              idPrefix="corbase"
              slots={slots}
              value={bodySlot}
              onChange={(v) => { setBodySlot(v); setFillColor(v.color); }}
            />
            <MaterialSlotFields
              label="Código"
              idPrefix="codigo"
              slots={slots}
              value={codeSlot}
              onChange={(v) => { setCodeSlot(v); setCodeColor(v.color); }}
            />
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
          <canvas ref={canvasRef} className="w-full max-w-[260px] mx-auto rounded-md" />
          <dl className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between"><dt>Placa final</dt><dd>{total.toFixed(1)} × {total.toFixed(1)} mm</dd></div>
            <div className="flex justify-between"><dt>Altura total</dt><dd>{((num(fillMm) || 0) + (num(codeMm) || 0)).toFixed(2)} mm</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">
            No 3MF, base e código saem como dois objetos — basta atribuir o filamento de
            cada um no fatiador. No STL, use troca de filamento na altura {fillMm} mm.
          </p>
        </aside>
      </div>

      <BatchGenerator
        sameText={text}
        filename={filename || "qrcode-3d"}
        build={(content, format) => buildModel(content, format)}
      />
    </div>
  );
}
