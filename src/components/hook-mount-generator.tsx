import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import {
  buildHookMount3mf,
  buildHookMountGeometry,
  buildHookMountStl,
  type HookMountOptions,
  type HookMountPart,
} from "@/lib/hook-mount-3d";
import { MaterialSlotFields, SlotCountField } from "@/components/material-slots";
import type { MaterialSlot } from "@/lib/three-mf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const num = (v: string) => parseFloat(v.replace(",", "."));

type Preset = {
  id: string;
  label: string;
  w: string; mh: string; hh: string; rise: string; reach: string; lip: string; at: string;
};

const PRESETS: Preset[] = [
  { id: "padrao", label: "Padrão (22 × 46 mm)", w: "22", mh: "46", hh: "34", rise: "20", reach: "20", lip: "8", at: "6" },
  { id: "casaco", label: "Casaco reforçado (28 × 60 mm)", w: "28", mh: "60", hh: "44", rise: "26", reach: "26", lip: "12", at: "8" },
  { id: "chaves", label: "Chaves / leve (18 × 36 mm)", w: "18", mh: "36", hh: "26", rise: "14", reach: "12", lip: "5", at: "4" },
];

export function HookMountGenerator() {
  const [widthMm, setWidthMm] = useState("22");
  const [mountHeightMm, setMountHeightMm] = useState("46");
  const [plateThickMm, setPlateThickMm] = useState("3");

  const [railDepthMm, setRailDepthMm] = useState("4");
  const [railBaseWidthMm, setRailBaseWidthMm] = useState("10");
  const [railTopWidthMm, setRailTopWidthMm] = useState("14");
  const [clearanceMm, setClearanceMm] = useState("0.25");

  const [screwHoles, setScrewHoles] = useState("2");
  const [screwDiameterMm, setScrewDiameterMm] = useState("4");
  const [countersink, setCountersink] = useState(true);
  const [countersinkDiameterMm, setCountersinkDiameterMm] = useState("8");
  const [countersinkDepthMm, setCountersinkDepthMm] = useState("1.8");

  const [hookHeightMm, setHookHeightMm] = useState("34");
  const [backThickMm, setBackThickMm] = useState("5");
  const [topStopMm, setTopStopMm] = useState("4");
  const [armWidthMm, setArmWidthMm] = useState("12");
  const [armThickMm, setArmThickMm] = useState("6");
  const [armRiseMm, setArmRiseMm] = useState("20");
  const [armReachMm, setArmReachMm] = useState("20");
  const [armLipMm, setArmLipMm] = useState("8");

  const [part, setPart] = useState<HookMountPart>("conjunto");
  const [printerSlots, setPrinterSlots] = useState(4);
  const [hookSlot, setHookSlot] = useState<MaterialSlot>({ extruder: 1, material: "PLA", color: "#f5f5f5" });
  const [mountSlot, setMountSlot] = useState<MaterialSlot>({ extruder: 2, material: "PLA", color: "#2f6fed" });

  const [filename, setFilename] = useState("gancho-encaixe");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const options = (): HookMountOptions => {
    const values = {
      widthMm: num(widthMm),
      mountHeightMm: num(mountHeightMm),
      plateThickMm: num(plateThickMm),
      railDepthMm: num(railDepthMm),
      railBaseWidthMm: num(railBaseWidthMm),
      railTopWidthMm: num(railTopWidthMm),
      clearanceMm: num(clearanceMm),
      screwDiameterMm: num(screwDiameterMm),
      countersinkDiameterMm: num(countersinkDiameterMm),
      countersinkDepthMm: num(countersinkDepthMm),
      hookHeightMm: num(hookHeightMm),
      backThickMm: num(backThickMm),
      topStopMm: num(topStopMm),
      armWidthMm: num(armWidthMm),
      armThickMm: num(armThickMm),
      armRiseMm: num(armRiseMm),
      armReachMm: num(armReachMm),
      armLipMm: num(armLipMm),
    };
    for (const [key, v] of Object.entries(values)) {
      if (!Number.isFinite(v)) throw new Error(`Medida inválida: ${key}.`);
    }
    if (values.railTopWidthMm <= values.railBaseWidthMm) {
      throw new Error("A largura do topo do trilho precisa ser maior que a da base (rabo de andorinha).");
    }
    if (values.railTopWidthMm + 2 > values.widthMm) {
      throw new Error("O trilho é largo demais para a largura da peça.");
    }
    if (values.armWidthMm + 3 > values.widthMm) {
      throw new Error("O braço é mais largo que o corpo do gancho.");
    }
    if (countersink && values.countersinkDepthMm + 1 > values.plateThickMm) {
      throw new Error("O escareado é fundo demais para a espessura da base.");
    }
    return { screwHoles: Number(screwHoles), countersink, ...values };
  };

  const summary = useMemo(() => {
    try {
      const geo = buildHookMountGeometry(options());
      return {
        base: `${geo.widthMm.toFixed(0)} × ${geo.mountHeightMm.toFixed(0)} mm`,
        hook: `${geo.widthMm.toFixed(0)} × ${geo.hookHeightMm.toFixed(0)} mm`,
        depth: geo.totalDepthMm,
        reach: geo.totalReachMm,
        holes: geo.screwCenters.length,
      };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    widthMm, mountHeightMm, plateThickMm, railDepthMm, railBaseWidthMm, railTopWidthMm,
    clearanceMm, screwHoles, screwDiameterMm, countersink, countersinkDiameterMm,
    countersinkDepthMm, hookHeightMm, backThickMm, topStopMm, armWidthMm, armThickMm,
    armRiseMm, armReachMm, armLipMm,
  ]);

  // Side view: wall, mount plate + rail, hook body and arm.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!summary) return;

    const pt = num(plateThickMm);
    const rd = num(railDepthMm);
    const Hm = num(mountHeightMm);
    const Hh = num(hookHeightMm);
    const Tb = rd + num(clearanceMm) + num(backThickMm);
    const at = num(armThickMm);
    const rise = num(armRiseMm);
    const reach = num(armReachMm);
    const lip = num(armLipMm);

    const totalW = pt + Tb + reach + lip + 6;
    const totalH = Math.max(Hm, Hh + rise + lip) + 6;
    const scale = Math.min((canvas.width - 24) / totalW, (canvas.height - 24) / totalH);
    const ox = 20;
    const oy = canvas.height - 16;
    const px = (y: number) => ox + y * scale;
    const py = (z: number) => oy - z * scale;

    // wall
    ctx.fillStyle = "rgba(0,0,0,.08)";
    ctx.fillRect(0, 0, ox, canvas.height);

    // mount plate + rail (side view)
    ctx.fillStyle = mountSlot.color;
    ctx.strokeStyle = "rgba(0,0,0,.3)";
    ctx.fillRect(px(0), py(Hm), pt * scale, Hm * scale);
    ctx.strokeRect(px(0), py(Hm), pt * scale, Hm * scale);
    const railH = Math.max(10, Hm - 14);
    ctx.fillRect(px(pt), py((Hm + railH) / 2), rd * scale, railH * scale);
    ctx.strokeRect(px(pt), py((Hm + railH) / 2), rd * scale, railH * scale);

    // hook body
    const hz = (Hm + railH) / 2 - 2; // top of the hook when seated
    ctx.fillStyle = hookSlot.color;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(px(pt), py(hz), Tb * scale, Hh * scale);
    ctx.strokeRect(px(pt), py(hz), Tb * scale, Hh * scale);
    ctx.globalAlpha = 1;

    // arm
    const baseZ = hz - Hh + Math.max(2, Hh * 0.22);
    ctx.beginPath();
    ctx.moveTo(px(pt + Tb - at), py(baseZ));
    for (let i = 0; i <= 16; i++) {
      const a = (Math.PI / 2) * (i / 16);
      ctx.lineTo(px(pt + Tb + reach * Math.sin(a)), py(baseZ + rise * (1 - Math.cos(a))));
    }
    if (lip > 0) {
      ctx.lineTo(px(pt + Tb + reach + lip * 0.25), py(baseZ + rise + lip));
    }
    ctx.strokeStyle = hookSlot.color;
    ctx.lineWidth = Math.max(2, at * scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.lineWidth = 1;

    // screws
    ctx.fillStyle = "rgba(0,0,0,.5)";
    const holes = Number(screwHoles);
    const edge = Math.max(num(countersinkDiameterMm) / 2, num(screwDiameterMm) / 2) + 2.5;
    const ys = holes === 1 ? [Hm / 2] : holes >= 2 ? [edge, Hm - edge] : [];
    for (const y of ys) {
      ctx.fillRect(px(-1), py(y) - 1.5, (pt + 1) * scale, 3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, hookSlot.color, mountSlot.color]);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setWidthMm(p.w); setMountHeightMm(p.mh); setHookHeightMm(p.hh);
    setArmRiseMm(p.rise); setArmReachMm(p.reach); setArmLipMm(p.lip); setArmThickMm(p.at);
  };

  const download = async (format: "3mf" | "stl") => {
    setBusy(true);
    try {
      const opts = options();
      const blob =
        format === "3mf"
          ? await buildHookMount3mf({ ...opts, part, hookSlot, mountSlot })
          : buildHookMountStl(opts, part);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${filename || "gancho-encaixe"}-${part}.${format}`;
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
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5 rounded-lg border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="space-y-1.5">
            <Label>O que gerar</Label>
            <Select value={part} onValueChange={(v) => setPart(v as HookMountPart)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="conjunto">Conjunto (base + gancho)</SelectItem>
                <SelectItem value="base">Somente a base de parede</SelectItem>
                <SelectItem value="gancho">Somente o gancho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4 rounded-md border border-border p-4">
          <Label>Base parafusada</Label>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="mw">Largura (mm)</Label>
              <Input id="mw" inputMode="decimal" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mh">Altura da base (mm)</Label>
              <Input id="mh" inputMode="decimal" value={mountHeightMm} onChange={(e) => setMountHeightMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt">Espessura da base (mm)</Label>
              <Input id="mt" inputMode="decimal" value={plateThickMm} onChange={(e) => setPlateThickMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Furos para parafuso</Label>
              <Select value={screwHoles} onValueChange={setScrewHoles}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem furos (colar)</SelectItem>
                  <SelectItem value="1">1 furo central</SelectItem>
                  <SelectItem value="2">2 furos (topo e base)</SelectItem>
                  <SelectItem value="4">4 furos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msd">Diâmetro do furo (mm)</Label>
              <Input id="msd" inputMode="decimal" disabled={screwHoles === "0"} value={screwDiameterMm} onChange={(e) => setScrewDiameterMm(e.target.value)} />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <Label htmlFor="mcs">Escareado</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch id="mcs" checked={countersink} disabled={screwHoles === "0"} onCheckedChange={setCountersink} />
                <span className="text-xs text-muted-foreground">
                  {countersink ? "Cabeça embutida" : "Furo reto"}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mcd">Diâmetro do escareado (mm)</Label>
              <Input id="mcd" inputMode="decimal" disabled={!countersink || screwHoles === "0"} value={countersinkDiameterMm} onChange={(e) => setCountersinkDiameterMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mcdp">Profundidade do escareado (mm)</Label>
              <Input id="mcdp" inputMode="decimal" disabled={!countersink || screwHoles === "0"} value={countersinkDepthMm} onChange={(e) => setCountersinkDepthMm(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-md border border-border p-4">
          <Label>Encaixe (rabo de andorinha)</Label>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="rd">Altura do trilho (mm)</Label>
              <Input id="rd" inputMode="decimal" value={railDepthMm} onChange={(e) => setRailDepthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rb">Largura na base (mm)</Label>
              <Input id="rb" inputMode="decimal" value={railBaseWidthMm} onChange={(e) => setRailBaseWidthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt">Largura no topo (mm)</Label>
              <Input id="rt" inputMode="decimal" value={railTopWidthMm} onChange={(e) => setRailTopWidthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl">Folga do encaixe (mm)</Label>
              <Input id="cl" inputMode="decimal" value={clearanceMm} onChange={(e) => setClearanceMm(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O gancho desliza de cima para baixo sobre o trilho e trava pelo alargamento. Folga
            de 0,2–0,3 mm costuma dar um encaixe firme sem lixar.
          </p>
        </div>

        <div className="space-y-4 rounded-md border border-border p-4">
          <Label>Gancho</Label>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="hh">Altura do corpo (mm)</Label>
              <Input id="hh" inputMode="decimal" value={hookHeightMm} onChange={(e) => setHookHeightMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bt">Parede atrás do encaixe (mm)</Label>
              <Input id="bt" inputMode="decimal" value={backThickMm} onChange={(e) => setBackThickMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts">Batente superior (mm)</Label>
              <Input id="ts" inputMode="decimal" value={topStopMm} onChange={(e) => setTopStopMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="haw">Largura do braço (mm)</Label>
              <Input id="haw" inputMode="decimal" value={armWidthMm} onChange={(e) => setArmWidthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hat">Espessura do braço (mm)</Label>
              <Input id="hat" inputMode="decimal" value={armThickMm} onChange={(e) => setArmThickMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="har">Altura da curva (mm)</Label>
              <Input id="har" inputMode="decimal" value={armRiseMm} onChange={(e) => setArmRiseMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="harc">Avanço da curva (mm)</Label>
              <Input id="harc" inputMode="decimal" value={armReachMm} onChange={(e) => setArmReachMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hal">Ponta de retenção (mm)</Label>
              <Input id="hal" inputMode="decimal" value={armLipMm} onChange={(e) => setArmLipMm(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SlotCountField value={printerSlots} onChange={setPrinterSlots} />
          <MaterialSlotFields idPrefix="hm-hook" label="Cor do gancho" value={hookSlot} onChange={setHookSlot} slots={printerSlots} />
          <MaterialSlotFields idPrefix="hm-mount" label="Cor da base" value={mountSlot} onChange={setMountSlot} slots={printerSlots} />
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Label>Prévia (vista lateral)</Label>
          <canvas
            ref={canvasRef}
            width={280}
            height={280}
            className="w-full rounded-md border border-border bg-muted/30"
          />
          {summary ? (
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>Base: {summary.base} · {summary.holes} furo(s)</li>
              <li>Gancho: {summary.hook}</li>
              <li>Saliência total da parede: {summary.depth.toFixed(1)} mm</li>
              <li>Avanço do braço: {summary.reach.toFixed(1)} mm</li>
            </ul>
          ) : (
            <p className="text-xs text-destructive">Revise as medidas.</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="hmfn">Nome do arquivo</Label>
            <Input id="hmfn" value={filename} onChange={(e) => setFilename(e.target.value)} />
          </div>
          <Button className="w-full" disabled={busy} onClick={() => download("3mf")}>
            <Download className="size-4" /> Baixar 3MF
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => download("stl")}>
            <Download className="size-4" /> Baixar STL
          </Button>
          <p className="text-xs text-muted-foreground">
            A base imprime deitada (trilho para cima) e o gancho imprime deitado de lado —
            nenhuma das peças precisa de suporte.
          </p>
        </div>
      </aside>
    </div>
  );
}
