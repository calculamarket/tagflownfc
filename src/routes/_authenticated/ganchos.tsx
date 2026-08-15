import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Anchor } from "lucide-react";
import {
  PLATE_SHAPES,
  PLATE_TEXTURES,
  buildHook3mf,
  buildHookGeometry,
  buildHookStl,
  plateOutline,
  type HookOptions,
  type PlateShape,
  type PlateTexture,
} from "@/lib/hook-3d";
import { MaterialSlotFields, SlotCountField } from "@/components/material-slots";
import type { MaterialSlot } from "@/lib/three-mf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/ganchos")({
  head: () => ({
    meta: [
      { title: "Gerador de Ganchos 3D · 3D QR" },
      {
        name: "description",
        content:
          "Crie ganchos de parede paramétricos: formato da placa, texturas, furação para parafuso e braço ajustável, em 3MF multicor ou STL.",
      },
      { property: "og:title", content: "Gerador de Ganchos 3D · 3D QR" },
      {
        property: "og:description",
        content:
          "Ganchos paramétricos com placa em nuvem, coração, círculo ou hexágono, texturas em relevo e furos escareados para parafusos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HookPage,
});

const num = (v: string) => parseFloat(v.replace(",", "."));

type Preset = {
  id: string;
  label: string;
  shape: PlateShape;
  w: string; h: string; t: string;
  aw: string; at: string; rise: string; reach: string; lip: string;
};

const PRESETS: Preset[] = [
  { id: "nuvem", label: "Nuvem infantil (46 × 34 mm)", shape: "nuvem", w: "46", h: "34", t: "4", aw: "12", at: "6", rise: "22", reach: "20", lip: "8" },
  { id: "casaco", label: "Cabide de casaco (60 × 40 mm)", shape: "arredondado", w: "60", h: "40", t: "5", aw: "16", at: "8", rise: "30", reach: "28", lip: "12" },
  { id: "chaves", label: "Porta-chaves (32 × 32 mm)", shape: "circulo", w: "32", h: "32", t: "3.5", aw: "8", at: "4", rise: "14", reach: "12", lip: "5" },
  { id: "coracao", label: "Coração decorativo (44 × 40 mm)", shape: "coracao", w: "44", h: "40", t: "4", aw: "10", at: "5", rise: "18", reach: "16", lip: "7" },
  { id: "oficina", label: "Oficina reforçado (55 × 45 mm)", shape: "hexagono", w: "55", h: "45", t: "6", aw: "20", at: "10", rise: "34", reach: "30", lip: "14" },
];

function HookPage() {
  const [shape, setShape] = useState<PlateShape>("nuvem");
  const [plateWidthMm, setPlateWidthMm] = useState("46");
  const [plateHeightMm, setPlateHeightMm] = useState("34");
  const [plateThickMm, setPlateThickMm] = useState("4");
  const [cornerRadiusMm, setCornerRadiusMm] = useState("6");

  const [texture, setTexture] = useState<PlateTexture>("liso");
  const [textureDepthMm, setTextureDepthMm] = useState("0.6");
  const [texturePitchMm, setTexturePitchMm] = useState("4");

  const [screwHoles, setScrewHoles] = useState("2");
  const [screwDiameterMm, setScrewDiameterMm] = useState("4");
  const [screwSpacingMm, setScrewSpacingMm] = useState("24");
  const [countersink, setCountersink] = useState(true);
  const [countersinkDiameterMm, setCountersinkDiameterMm] = useState("8");
  const [countersinkDepthMm, setCountersinkDepthMm] = useState("2");

  const [armWidthMm, setArmWidthMm] = useState("12");
  const [armThickMm, setArmThickMm] = useState("6");
  const [armRiseMm, setArmRiseMm] = useState("22");
  const [armReachMm, setArmReachMm] = useState("20");
  const [armLipMm, setArmLipMm] = useState("8");
  const [armOffsetMm, setArmOffsetMm] = useState("0");

  const [printerSlots, setPrinterSlots] = useState(4);
  const [bodySlot, setBodySlot] = useState<MaterialSlot>({ extruder: 1, material: "PLA", color: "#f5f5f5" });
  const [textureSlot, setTextureSlot] = useState<MaterialSlot>({ extruder: 2, material: "PLA", color: "#2f6fed" });

  const [filename, setFilename] = useState("gancho");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const options = (): HookOptions => {
    const values = {
      plateWidthMm: num(plateWidthMm),
      plateHeightMm: num(plateHeightMm),
      plateThickMm: num(plateThickMm),
      cornerRadiusMm: num(cornerRadiusMm),
      textureDepthMm: num(textureDepthMm),
      texturePitchMm: num(texturePitchMm),
      screwDiameterMm: num(screwDiameterMm),
      screwSpacingMm: num(screwSpacingMm),
      countersinkDiameterMm: num(countersinkDiameterMm),
      countersinkDepthMm: num(countersinkDepthMm),
      armWidthMm: num(armWidthMm),
      armThickMm: num(armThickMm),
      armRiseMm: num(armRiseMm),
      armReachMm: num(armReachMm),
      armLipMm: num(armLipMm),
      armOffsetMm: num(armOffsetMm),
    };
    for (const [key, v] of Object.entries(values)) {
      if (!Number.isFinite(v)) throw new Error(`Medida inválida: ${key}.`);
    }
    if (values.plateThickMm < 2) throw new Error("A placa precisa ter pelo menos 2 mm.");
    if (values.armWidthMm + 4 > values.plateWidthMm) {
      throw new Error("O braço é mais largo que a placa.");
    }
    const holes = Number(screwHoles);
    if (holes > 0 && values.screwDiameterMm + 4 > values.plateWidthMm) {
      throw new Error("O furo é grande demais para a placa.");
    }
    if (countersink && values.countersinkDepthMm + 1 > values.plateThickMm) {
      throw new Error("O escareado é fundo demais para a espessura da placa.");
    }
    return { shape, texture, screwHoles: holes, countersink, ...values };
  };

  const summary = useMemo(() => {
    try {
      const geo = buildHookGeometry(options());
      return {
        plate: `${geo.widthMm.toFixed(0)} × ${geo.heightMm.toFixed(0)} × ${geo.plateThickMm.toFixed(1)} mm`,
        rise: geo.totalRiseMm,
        reach: geo.totalReachMm,
        holes: geo.screwCenters.length,
      };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shape, plateWidthMm, plateHeightMm, plateThickMm, cornerRadiusMm, texture, textureDepthMm,
    texturePitchMm, screwHoles, screwDiameterMm, screwSpacingMm, countersink,
    countersinkDiameterMm, countersinkDepthMm, armWidthMm, armThickMm, armRiseMm, armReachMm,
    armLipMm, armOffsetMm,
  ]);

  // Flat preview of the plate: outline, texture cells and screw holes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let geo: ReturnType<typeof buildHookGeometry> | null = null;
    try {
      geo = buildHookGeometry(options());
    } catch {
      geo = null;
    }
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!geo) return;

    const outline = plateOutline(shape, geo.widthMm, geo.heightMm, num(cornerRadiusMm) || 0);
    const scale = Math.min((w - 20) / geo.widthMm, (h - 20) / geo.heightMm);
    const px = (x: number) => w / 2 + x * scale;
    const py = (y: number) => h / 2 - y * scale;

    ctx.beginPath();
    outline.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))));
    ctx.closePath();
    ctx.fillStyle = bodySlot.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.stroke();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = textureSlot.color;
    for (const tri of geo.texture) {
      if (tri[0][2] < geo.plateThickMm) continue;
      ctx.beginPath();
      ctx.moveTo(px(tri[0][0]), py(tri[0][1]));
      ctx.lineTo(px(tri[1][0]), py(tri[1][1]));
      ctx.lineTo(px(tri[2][0]), py(tri[2][1]));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // arm footprint
    const aw = num(armWidthMm) || 0;
    const at = num(armThickMm) || 0;
    const off = num(armOffsetMm) || 0;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(px(-aw / 2), py(off + at / 2), aw * scale, at * scale);

    ctx.fillStyle = "rgba(0,0,0,.55)";
    const r = (num(screwDiameterMm) || 0) / 2;
    for (const [cx, cy] of geo.screwCenters) {
      ctx.beginPath();
      ctx.arc(px(cx), py(cy), r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, bodySlot.color, textureSlot.color]);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setShape(p.shape);
    setPlateWidthMm(p.w); setPlateHeightMm(p.h); setPlateThickMm(p.t);
    setArmWidthMm(p.aw); setArmThickMm(p.at);
    setArmRiseMm(p.rise); setArmReachMm(p.reach); setArmLipMm(p.lip);
  };

  const download = async (format: "3mf" | "stl") => {
    setBusy(true);
    try {
      const opts = options();
      const blob =
        format === "3mf"
          ? await buildHook3mf({ ...opts, bodySlot, textureSlot })
          : buildHookStl(opts);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${filename || "gancho"}.${format}`;
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
          <Anchor className="size-5 text-primary" /> Gerador de Ganchos
        </h1>
        <p className="text-sm text-muted-foreground">
          Ganchos de parede paramétricos: escolha o formato da placa, a textura em relevo, a
          furação para parafusos e as medidas do braço. Tudo imprime deitado, sem suportes.
        </p>
      </header>

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
              <Label>Formato da placa</Label>
              <Select value={shape} onValueChange={(v) => setShape(v as PlateShape)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATE_SHAPES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Largura da placa (mm)</Label>
              <Input id="pw" inputMode="decimal" value={plateWidthMm} onChange={(e) => setPlateWidthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Altura da placa (mm)</Label>
              <Input id="ph" inputMode="decimal" value={plateHeightMm} onChange={(e) => setPlateHeightMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt">Espessura da placa (mm)</Label>
              <Input id="pt" inputMode="decimal" value={plateThickMm} onChange={(e) => setPlateThickMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr">Raio dos cantos (mm)</Label>
              <Input id="cr" inputMode="decimal" disabled={shape !== "arredondado"} value={cornerRadiusMm} onChange={(e) => setCornerRadiusMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Textura da placa</Label>
              <Select value={texture} onValueChange={(v) => setTexture(v as PlateTexture)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATE_TEXTURES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="td">Altura da textura (mm)</Label>
              <Input id="td" inputMode="decimal" disabled={texture === "liso"} value={textureDepthMm} onChange={(e) => setTextureDepthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp">Passo da textura (mm)</Label>
              <Input id="tp" inputMode="decimal" disabled={texture === "liso"} value={texturePitchMm} onChange={(e) => setTexturePitchMm(e.target.value)} />
            </div>
          </div>

          <div className="space-y-4 rounded-md border border-border p-4">
            <Label>Furação para parafuso</Label>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Quantidade de furos</Label>
                <Select value={screwHoles} onValueChange={setScrewHoles}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sem furos (colar / fita dupla-face)</SelectItem>
                    <SelectItem value="1">1 furo central</SelectItem>
                    <SelectItem value="2">2 furos</SelectItem>
                    <SelectItem value="4">4 furos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sd">Diâmetro do furo (mm)</Label>
                <Input id="sd" inputMode="decimal" disabled={screwHoles === "0"} value={screwDiameterMm} onChange={(e) => setScrewDiameterMm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ss">Distância entre furos (mm)</Label>
                <Input id="ss" inputMode="decimal" disabled={screwHoles === "0" || screwHoles === "1"} value={screwSpacingMm} onChange={(e) => setScrewSpacingMm(e.target.value)} />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <Label htmlFor="cs">Escareado (cabeça embutida)</Label>
                <div className="flex h-9 items-center gap-2">
                  <Switch id="cs" checked={countersink} disabled={screwHoles === "0"} onCheckedChange={setCountersink} />
                  <span className="text-xs text-muted-foreground">
                    {countersink ? "Cabeça escondida" : "Furo reto"}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cd">Diâmetro do escareado (mm)</Label>
                <Input id="cd" inputMode="decimal" disabled={!countersink || screwHoles === "0"} value={countersinkDiameterMm} onChange={(e) => setCountersinkDiameterMm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cdp">Profundidade do escareado (mm)</Label>
                <Input id="cdp" inputMode="decimal" disabled={!countersink || screwHoles === "0"} value={countersinkDepthMm} onChange={(e) => setCountersinkDepthMm(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-md border border-border p-4">
            <Label>Braço do gancho</Label>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="aw">Largura do braço (mm)</Label>
                <Input id="aw" inputMode="decimal" value={armWidthMm} onChange={(e) => setArmWidthMm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="at">Espessura do braço (mm)</Label>
                <Input id="at" inputMode="decimal" value={armThickMm} onChange={(e) => setArmThickMm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ar">Altura do braço (mm)</Label>
                <Input id="ar" inputMode="decimal" value={armRiseMm} onChange={(e) => setArmRiseMm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="arc">Avanço da curva (mm)</Label>
                <Input id="arc" inputMode="decimal" value={armReachMm} onChange={(e) => setArmReachMm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="al">Ponta de retenção (mm)</Label>
                <Input id="al" inputMode="decimal" value={armLipMm} onChange={(e) => setArmLipMm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ao">Posição do braço na placa (mm)</Label>
                <Input id="ao" inputMode="decimal" value={armOffsetMm} onChange={(e) => setArmOffsetMm(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <SlotCountField value={printerSlots} onChange={setPrinterSlots} />
            <MaterialSlotFields label="Corpo" idPrefix="corpo" slots={printerSlots} value={bodySlot} onChange={setBodySlot} />
            <MaterialSlotFields label="Textura" idPrefix="textura" slots={printerSlots} value={textureSlot} onChange={setTextureSlot} />
            <div className="space-y-1.5">
              <Label htmlFor="arquivo">Nome do arquivo</Label>
              <Input id="arquivo" value={filename} onChange={(e) => setFilename(e.target.value)} />
            </div>
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

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-medium">Prévia da placa</h2>
            <canvas
              ref={canvasRef}
              width={280}
              height={240}
              className="w-full rounded-md border border-border bg-muted/30"
            />
            {summary ? (
              <dl className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><dt>Placa</dt><dd>{summary.plate}</dd></div>
                <div className="flex justify-between"><dt>Altura total</dt><dd>{summary.rise.toFixed(1)} mm</dd></div>
                <div className="flex justify-between"><dt>Avanço do gancho</dt><dd>{summary.reach.toFixed(1)} mm</dd></div>
                <div className="flex justify-between"><dt>Furos</dt><dd>{summary.holes}</dd></div>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">Ajuste as medidas para ver o resumo.</p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-5 text-xs text-muted-foreground space-y-2">
            <p>
              A placa sai deitada na mesa com o braço subindo em Z: sem suportes e com o furo
              já escareado para a cabeça do parafuso ficar rente.
            </p>
            <p>
              Para carga maior, aumente a espessura do braço e use 4 perímetros com 40% de
              preenchimento.
            </p>
          </div>
        </aside>
      </div>
      </TabsContent>

      <TabsContent value="encaixe">
        <HookMountGenerator />
      </TabsContent>
      </Tabs>
    </div>
  );
}
