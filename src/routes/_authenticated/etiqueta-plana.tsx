import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Box, Download, Tag as TagIcon } from "lucide-react";
import {
  buildFlatTag3mf,
  buildFlatTagStl,
  buildFlatTagGeometry,
  type FlatTagOptions,
} from "@/lib/flat-tag-3d";
import { BatchGenerator } from "@/components/batch-generator";
import { MaterialSlotFields, SlotCountField } from "@/components/material-slots";
import type { MaterialSlot } from "@/lib/three-mf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/etiqueta-plana")({
  head: () => ({
    meta: [
      { title: "Etiqueta Plana 3D · 3D QR" },
      {
        name: "description",
        content:
          "Gere etiquetas planas com QR Code em 3D — pet, bagagem, chaveiro ou patrimônio — e baixe em 3MF de duas cores ou STL.",
      },
      { property: "og:title", content: "Etiqueta Plana 3D · 3D QR" },
      {
        property: "og:description",
        content:
          "Modelo de placa plana parametrizável com QR Code integrado, furo opcional e download pronto para o fatiador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FlatTagPage,
});

type Level = "L" | "M" | "Q" | "H";
const num = (v: string) => parseFloat(v.replace(",", "."));

type Preset = {
  id: string;
  label: string;
  w: string; d: string; p: string; r: string;
  hole: boolean; hd: string; hm: string; qr: string;
  slots: boolean; sw: string; sh: string; sm: string;
};

const PRESETS: Preset[] = [
  { id: "padrao", label: "Padrão com passadores (49 × 33 mm)", w: "49", d: "33", p: "2.5", r: "5", hole: false, hd: "4", hm: "5", qr: "25", slots: true, sw: "4", sh: "25", sm: "7" },
  { id: "lisa", label: "Placa lisa (49 × 33 mm)", w: "49", d: "33", p: "2.5", r: "5", hole: false, hd: "4", hm: "5", qr: "25", slots: false, sw: "4", sh: "25", sm: "7" },
  { id: "chaveiro", label: "Chaveiro com furo (45 × 30 mm)", w: "45", d: "30", p: "3", r: "6", hole: true, hd: "4", hm: "5", qr: "22", slots: false, sw: "4", sh: "22", sm: "7" },
  { id: "bagagem", label: "Bagagem (70 × 40 mm)", w: "70", d: "40", p: "3", r: "6", hole: true, hd: "6", hm: "7", qr: "30", slots: false, sw: "5", sh: "30", sm: "8" },
  { id: "patrimonio", label: "Patrimônio (40 × 40 mm)", w: "40", d: "40", p: "2", r: "3", hole: false, hd: "4", hm: "5", qr: "32", slots: false, sw: "4", sh: "30", sm: "6" },
];


function FlatTagPage() {
  const [text, setText] = useState("https://www.3dqr.com.br/t/tag");
  const [level, setLevel] = useState<Level>("Q");
  const [widthMm, setWidthMm] = useState("49");
  const [depthMm, setDepthMm] = useState("33");
  const [plateMm, setPlateMm] = useState("2.5");
  const [radiusMm, setRadiusMm] = useState("5");
  const [hole, setHole] = useState(false);
  const [holeDiameterMm, setHoleDiameterMm] = useState("4");
  const [holeMarginMm, setHoleMarginMm] = useState("5");
  const [slots, setSlots] = useState(true);
  const [slotWidthMm, setSlotWidthMm] = useState("4");
  const [slotHeightMm, setSlotHeightMm] = useState("25");
  const [slotMarginMm, setSlotMarginMm] = useState("7");
  const [qrSizeMm, setQrSizeMm] = useState("25");
  const [quietMm, setQuietMm] = useState("2");
  const [codeMm, setCodeMm] = useState("1");
  const [mode, setMode] = useState<"emboss" | "recess">("emboss");

  const [bodyColor, setBodyColor] = useState("#ffffff");
  const [codeColor, setCodeColor] = useState("#000000");
  const [printerSlots, setPrinterSlots] = useState(4);
  const [bodySlot, setBodySlot] = useState<MaterialSlot>({ extruder: 1, material: "PLA", color: "#ffffff" });
  const [codeSlot, setCodeSlot] = useState<MaterialSlot>({ extruder: 2, material: "PLA", color: "#000000" });
  const [filename, setFilename] = useState("etiqueta-qr");
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

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setWidthMm(p.w); setDepthMm(p.d); setPlateMm(p.p); setRadiusMm(p.r);
    setHole(p.hole); setHoleDiameterMm(p.hd); setHoleMarginMm(p.hm); setQrSizeMm(p.qr);
    setSlots(p.slots); setSlotWidthMm(p.sw); setSlotHeightMm(p.sh); setSlotMarginMm(p.sm);
  };

  const options = (): FlatTagOptions => {
    const values = {
      widthMm: num(widthMm),
      depthMm: num(depthMm),
      plateMm: num(plateMm),
      radiusMm: num(radiusMm),
      holeDiameterMm: num(holeDiameterMm),
      holeMarginMm: num(holeMarginMm),
      slotWidthMm: num(slotWidthMm),
      slotHeightMm: num(slotHeightMm),
      slotMarginMm: num(slotMarginMm),
      qrSizeMm: num(qrSizeMm),
      quietZoneMm: num(quietMm),
      codeMm: num(codeMm),
    };
    if (!text.trim()) throw new Error("Informe o conteúdo do QR Code.");
    for (const [key, v] of Object.entries(values)) {
      if (!Number.isFinite(v) || v < 0) throw new Error(`Medida inválida: ${key}.`);
    }
    if (values.plateMm < 0.6) throw new Error("A placa precisa ter pelo menos 0,6 mm.");
    if (hole && values.holeDiameterMm + 3 > values.depthMm) {
      throw new Error("O furo é grande demais para a profundidade da peça.");
    }
    if (slots && values.slotHeightMm + 4 > values.depthMm) {
      throw new Error("Os passadores são altos demais para a profundidade da peça.");
    }
    if (slots && 2 * (values.slotMarginMm + values.slotWidthMm / 2) + 10 > values.widthMm) {
      throw new Error("Não há largura suficiente entre os passadores.");
    }
    return { text, ...values, hole, slots, errorCorrectionLevel: level, recessed: mode === "recess" };
  };

  const summary = useMemo(() => {
    try {
      const geo = buildFlatTagGeometry(options());
      return {
        size: `${geo.totalWidthMm.toFixed(0)} × ${geo.totalDepthMm.toFixed(0)} × ${geo.totalHeightMm.toFixed(2)} mm`,
        maxQr: geo.maxQrSizeMm,
        changeZ: geo.codeStartZ,
      };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, level, widthMm, depthMm, plateMm, radiusMm, hole, holeDiameterMm, holeMarginMm, slots, slotWidthMm, slotHeightMm, slotMarginMm, qrSizeMm, quietMm, codeMm, mode]);


  const download = async (format: "3mf" | "stl") => {
    setBusy(true);
    try {
      const opts = options();
      const blob =
        format === "3mf"
          ? await buildFlatTag3mf({ ...opts, bodyColor, codeColor, bodySlot, codeSlot })
          : buildFlatTagStl(opts);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${filename || "etiqueta-qr"}.${format}`;
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
          <TagIcon className="size-5 text-primary" /> Etiqueta Plana
        </h1>
        <p className="text-sm text-muted-foreground">
          Placa plana com QR Code integrado e furo opcional para argola. Serve para pet,
          bagagem, chaveiro, patrimônio — todas as medidas são ajustáveis.
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

          <div className="space-y-1.5">
            <Label>Modelo pronto</Label>
            <Select onValueChange={applyPreset}>
              <SelectTrigger><SelectValue placeholder="Escolher um preset" /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Label htmlFor="w">Largura (mm)</Label>
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
              <Label htmlFor="r">Raio dos cantos (mm)</Label>
              <Input id="r" inputMode="decimal" value={radiusMm} onChange={(e) => setRadiusMm(e.target.value)} />
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
            <div className="space-y-1.5 flex flex-col justify-end">
              <Label htmlFor="furo">Furo para argola</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch id="furo" checked={hole} onCheckedChange={setHole} />
                <span className="text-xs text-muted-foreground">{hole ? "Com furo" : "Sem furo"}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hd">Diâmetro do furo (mm)</Label>
              <Input id="hd" inputMode="decimal" disabled={!hole} value={holeDiameterMm} onChange={(e) => setHoleDiameterMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hm">Distância da borda (mm)</Label>
              <Input id="hm" inputMode="decimal" disabled={!hole} value={holeMarginMm} onChange={(e) => setHoleMarginMm(e.target.value)} />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <Label htmlFor="passadores">Passadores da fita</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch id="passadores" checked={slots} onCheckedChange={setSlots} />
                <span className="text-xs text-muted-foreground">
                  {slots ? "Com recortes" : "Sem recortes"}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sw">Largura do passador (mm)</Label>
              <Input id="sw" inputMode="decimal" disabled={!slots} value={slotWidthMm} onChange={(e) => setSlotWidthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sh">Altura do passador (mm)</Label>
              <Input id="sh" inputMode="decimal" disabled={!slots} value={slotHeightMm} onChange={(e) => setSlotHeightMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm">Passador: distância da borda (mm)</Label>
              <Input id="sm" inputMode="decimal" disabled={!slots} value={slotMarginMm} onChange={(e) => setSlotMarginMm(e.target.value)} />
            </div>

            <SlotCountField value={printerSlots} onChange={setPrinterSlots} />
            <MaterialSlotFields
              label="Corpo"
              idPrefix="corpo"
              slots={printerSlots}
              value={bodySlot}
              onChange={(v) => { setBodySlot(v); setBodyColor(v.color); }}
            />
            <MaterialSlotFields
              label="Código"
              idPrefix="codigo"
              slots={printerSlots}
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
          <canvas ref={canvasRef} className="w-full max-w-[220px] mx-auto rounded-md" />
          <dl className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between"><dt>Peça final</dt><dd>{summary?.size ?? "—"}</dd></div>
            <div className="flex justify-between"><dt>QR máximo</dt><dd>{summary ? `${summary.maxQr.toFixed(1)} mm` : "—"}</dd></div>
            <div className="flex justify-between"><dt>Troca de cor em</dt><dd>{summary ? `${summary.changeZ.toFixed(2)} mm` : "—"}</dd></div>
            <div className="flex justify-between"><dt>Furo</dt><dd>{hole ? `${holeDiameterMm} mm` : "sem furo"}</dd></div>
            <div className="flex justify-between"><dt>Passadores</dt><dd>{slots ? `2 × ${slotWidthMm} × ${slotHeightMm} mm` : "sem recortes"}</dd></div>

          </dl>
          <p className="text-xs text-muted-foreground">
            No 3MF, corpo e código saem como dois objetos — atribua o filamento de cada um no
            fatiador. No STL, use troca de filamento na altura indicada.
          </p>
        </aside>
      </div>

      <BatchGenerator
        sameText={text}
        filename={filename || "etiqueta-qr"}
        build={(content, format) => {
          const opts = { ...options(), text: content };
          return format === "3mf"
            ? buildFlatTag3mf({ ...opts, bodyColor, codeColor, bodySlot, codeSlot })
            : buildFlatTagStl(opts);
        }}
      />
    </div>
  );
}
