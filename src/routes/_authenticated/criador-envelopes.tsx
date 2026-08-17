import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Mail, Upload, X } from "lucide-react";
import {
  buildEnvelope3mf,
  buildEnvelopeGeometry,
  buildEnvelopeStl,
  type EnvelopeOptions,
} from "@/lib/envelope-3d";
import {
  ENVELOPE_TEXTURES,
  patternToMask,
  type EnvelopeTextureKind,
} from "@/lib/envelope-textures";
import { imageToMask, maskToDataUrl } from "@/lib/relief-raster";
import type { ReliefMask } from "@/lib/pix-plate-3d";
import { MaterialSlotFields, SlotCountField } from "@/components/material-slots";
import type { MaterialSlot } from "@/lib/three-mf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/criador-envelopes")({
  head: () => ({
    meta: [
      { title: "Criador de Envelopes · 3D QR" },
      {
        name: "description",
        content:
          "Gere envelopes impressos em 3D com moldura e texturas rendadas: escolha medidas, abas, padrão interno e baixe em 3MF multicor ou STL.",
      },
      { property: "og:title", content: "Criador de Envelopes · 3D QR" },
      {
        property: "og:description",
        content: "Envelopes paramétricos com frame e texturas para impressão 3D.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EnvelopesPage,
});

const num = (v: string) => parseFloat(v.replace(",", "."));

function EnvelopesPage() {
  const [size, setSize] = useState("110");
  const [topFlap, setTopFlap] = useState("62");
  const [bottomFlap, setBottomFlap] = useState("50");
  const [sideFlap, setSideFlap] = useState("48");
  const [taper, setTaper] = useState("14");
  const [thickness, setThickness] = useState("0.8");
  const [frame, setFrame] = useState("4");
  const [frameRelief, setFrameRelief] = useState("0.4");
  const [textureThick, setTextureThick] = useState("0.6");
  const [foldGap, setFoldGap] = useState("1.2");
  const [hinge, setHinge] = useState("0.35");
  const [textureCell, setTextureCell] = useState("0.8");
  const [solidBack, setSolidBack] = useState(false);

  const [kind, setKind] = useState<EnvelopeTextureKind>("renda");
  const [patternScale, setPatternScale] = useState("18");
  const [customMask, setCustomMask] = useState<ReliefMask | null>(null);
  const [customName, setCustomName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [slots, setSlots] = useState(2);
  const [frameSlot, setFrameSlot] = useState<MaterialSlot>({ extruder: 1, material: "PLA", color: "#111111" });
  const [textureSlot, setTextureSlot] = useState<MaterialSlot>({ extruder: 2, material: "PLA", color: "#d4af37" });
  const [filename, setFilename] = useState("envelope");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const mask = useMemo<ReliefMask>(() => {
    if (customMask) return customMask;
    const s = Math.max(4, Math.round(num(patternScale) || 18));
    return patternToMask(kind, s * 2, s * 2, s);
  }, [customMask, kind, patternScale]);

  const options = useMemo<EnvelopeOptions>(
    () => ({
      sizeMm: num(size),
      topFlapMm: num(topFlap),
      bottomFlapMm: num(bottomFlap),
      sideFlapMm: num(sideFlap),
      taperMm: num(taper),
      thicknessMm: num(thickness),
      frameMm: num(frame),
      frameReliefMm: num(frameRelief),
      textureThickMm: num(textureThick),
      foldGapMm: num(foldGap),
      hingeMm: num(hinge),
      textureCellMm: num(textureCell),
      solidBack,
      texture: mask,
    }),
    [size, topFlap, bottomFlap, sideFlap, taper, thickness, frame, frameRelief, textureThick, foldGap, hinge, textureCell, solidBack, mask],
  );

  const geo = useMemo(() => buildEnvelopeGeometry({ ...options, texture: null }), [options]);
  const tileUrl = useMemo(
    () => maskToDataUrl(mask, frameSlot.color, textureSlot.color),
    [mask, frameSlot.color, textureSlot.color],
  );

  // 2D top view of the net: frames filled with the chosen texture.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pad = 16;
    const scale = Math.min(
      (canvas.width - pad * 2) / geo.widthMm,
      (canvas.height - pad * 2) / geo.heightMm,
    );
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const toX = (x: number) => canvas.width / 2 + x * scale;
    const toY = (y: number) => canvas.height / 2 - y * scale;
    const path = (ring: [number, number][]) => {
      ctx.beginPath();
      ring.forEach(([x, y], i) => (i ? ctx.lineTo(toX(x), toY(y)) : ctx.moveTo(toX(x), toY(y))));
      ctx.closePath();
    };

    const img = new Image();
    img.onload = () => {
      const pattern = ctx.createPattern(img, "repeat");
      for (const p of geo.panels) {
        path(p.outer);
        ctx.fillStyle = frameSlot.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
        path(p.inner);
        ctx.save();
        ctx.clip();
        ctx.fillStyle = pattern ?? textureSlot.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    };
    img.src = tileUrl || "";
  }, [geo, tileUrl, frameSlot.color, textureSlot.color]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const m = await imageToMask(file, { maxPixels: 160 });
      if (!m.cols) throw new Error("Imagem vazia.");
      setCustomMask(m);
      setCustomName(file.name);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const download = async (format: "3mf" | "stl") => {
    setBusy(true);
    try {
      const blob =
        format === "3mf"
          ? await buildEnvelope3mf({ ...options, frameSlot, textureSlot })
          : buildEnvelopeStl(options);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename || "envelope"}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Arquivo ${format.toUpperCase()} gerado.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Mail className="size-6 text-primary" /> Criador de Envelopes
        </h1>
        <p className="text-sm text-muted-foreground">
          Envelope impresso deitado, com moldura sólida e textura vazada por dentro do frame.
          Depois de imprimir, basta dobrar nas linhas de vinco.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-5">
          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-medium">Medidas (mm)</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Painel central" value={size} onChange={setSize} />
              <Field label="Aba superior" value={topFlap} onChange={setTopFlap} />
              <Field label="Aba inferior" value={bottomFlap} onChange={setBottomFlap} />
              <Field label="Abas laterais" value={sideFlap} onChange={setSideFlap} />
              <Field label="Chanfro das abas" value={taper} onChange={setTaper} />
              <Field label="Espessura" value={thickness} onChange={setThickness} />
              <Field label="Largura do frame" value={frame} onChange={setFrame} />
              <Field label="Relevo do frame" value={frameRelief} onChange={setFrameRelief} />
              <Field label="Folga do vinco" value={foldGap} onChange={setFoldGap} />
              <Field label="Dobradiça" value={hinge} onChange={setHinge} />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-medium">Textura do frame</h2>
            <div className="space-y-1.5">
              <Label>Padrão</Label>
              <Select
                value={kind}
                onValueChange={(v) => { setKind(v as EnvelopeTextureKind); setCustomMask(null); setCustomName(null); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENVELOPE_TEXTURES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Escala do padrão" value={patternScale} onChange={setPatternScale} />
              <Field label="Célula (mm)" value={textureCell} onChange={setTextureCell} />
              <Field label="Altura textura" value={textureThick} onChange={setTextureThick} />
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> Textura própria
              </Button>
              {customName && (
                <button
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                  onClick={() => { setCustomMask(null); setCustomName(null); }}
                >
                  <X className="size-3.5" /> {customName}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="solid-back">Fundo fechado (sem vazado)</Label>
              <Switch id="solid-back" checked={solidBack} onCheckedChange={setSolidBack} />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-medium">Cores de impressão</h2>
            <SlotCountField value={slots} onChange={setSlots} />
            <div className="grid grid-cols-2 gap-3">
              <MaterialSlotFields label="Envelope" idPrefix="env-frame" value={frameSlot} onChange={setFrameSlot} slots={slots} />
              <MaterialSlotFields label="Textura" idPrefix="env-tex" value={textureSlot} onChange={setTextureSlot} slots={slots} />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <canvas ref={canvasRef} width={640} height={640} className="w-full h-auto rounded-md bg-background" />
            <p className="mt-3 text-xs text-muted-foreground">
              Planificação {geo.widthMm.toFixed(0)} × {geo.heightMm.toFixed(0)} mm — verifique se cabe na sua mesa.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="env-filename">Nome do arquivo</Label>
            <Input id="env-filename" value={filename} onChange={(e) => setFilename(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => download("3mf")} disabled={busy}>
              <Download className="size-4" /> Baixar 3MF multicor
            </Button>
            <Button variant="outline" onClick={() => download("stl")} disabled={busy}>
              <Download className="size-4" /> Baixar STL
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" />
    </div>
  );
}
