import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Box, Download, Upload, X } from "lucide-react";
import { measureMeshFile } from "@/lib/mesh-measure";
import { buildMoldBox3mf, buildMoldBoxGeometry, buildMoldBoxStl } from "@/lib/mold-box-3d";
import { MaterialSlotFields, SlotCountField } from "@/components/material-slots";
import type { MaterialSlot } from "@/lib/three-mf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/molde-silicone")({
  head: () => ({
    meta: [
      { title: "Molde de Silicone · 3D QR" },
      {
        name: "description",
        content:
          "Gere a caixa de molde imprimível para verter silicone ao redor da sua peça: base, paredes, pedestal, bico de vazamento e chaves de registro.",
      },
      { property: "og:title", content: "Molde de Silicone · 3D QR" },
      {
        property: "og:description",
        content: "Caixa paramétrica para criar moldes de silicone a partir da sua peça.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MoldeSiliconePage,
});

const num = (v: string) => parseFloat(v.replace(",", "."));

function MoldeSiliconePage() {
  const [w, setW] = useState("40");
  const [d, setD] = useState("40");
  const [h, setH] = useState("60");
  const [margin, setMargin] = useState("10");
  const [topMargin, setTopMargin] = useState("10");
  const [wall, setWall] = useState("2.4");
  const [floor, setFloor] = useState("2");
  const [pedestal, setPedestal] = useState("3");
  const [keys, setKeys] = useState(true);
  const [spout, setSpout] = useState(true);
  const [slots, setSlots] = useState(2);
  const [shellSlot, setShellSlot] = useState<MaterialSlot>({ extruder: 1, material: "PLA", color: "#2b6cb0" });
  const [pedestalSlot, setPedestalSlot] = useState<MaterialSlot>({ extruder: 2, material: "PLA", color: "#f6ad55" });
  const [filename, setFilename] = useState("molde-silicone");
  const [busy, setBusy] = useState(false);
  const [meshInfo, setMeshInfo] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const meshRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  // Arte enviada a partir do Estúdio de Bonecos ("Usar no molde").
  useEffect(() => {
    const saved = sessionStorage.getItem("tagflow:mold-reference");
    if (saved) setReference(saved);
  }, []);

  const setReferenceImage = (url: string | null) => {
    setReference(url);
    if (url) sessionStorage.setItem("tagflow:mold-reference", url);
    else sessionStorage.removeItem("tagflow:mold-reference");
  };

  const loadMesh = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (meshRef.current) meshRef.current.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const b = await measureMeshFile(file);
      const round = (n: number) => String(Math.round(n * 10) / 10);
      setW(round(b.widthMm));
      setD(round(b.depthMm));
      setH(round(b.heightMm));
      if (!filename || filename === "molde-silicone") {
        setFilename(`molde-${file.name.replace(/\.(stl|3mf)$/i, "")}`);
      }
      setMeshInfo(`${file.name} · ${b.triangles.toLocaleString("pt-BR")} triângulos`);
      toast.success("Medidas preenchidas a partir do arquivo.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const loadReference = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (imgRef.current) imgRef.current.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReferenceImage(reader.result as string);
    reader.readAsDataURL(file);
  };


  const options = () => {
    const o = {
      pieceWidthMm: num(w),
      pieceDepthMm: num(d),
      pieceHeightMm: num(h),
      marginMm: num(margin),
      topMarginMm: num(topMargin),
      wallMm: num(wall),
      floorMm: num(floor),
      pedestalMm: num(pedestal) || 0,
      keys,
      spout,
    };
    if (![o.pieceWidthMm, o.pieceDepthMm, o.pieceHeightMm].every((n) => n > 0)) {
      throw new Error("Informe as medidas da peça em milímetros.");
    }
    return o;
  };

  const preview = (() => {
    try {
      return buildMoldBoxGeometry(options());
    } catch {
      return null;
    }
  })();

  const download = async (format: "3mf" | "stl") => {
    setBusy(true);
    try {
      const opts = options();
      const blob =
        format === "3mf"
          ? await buildMoldBox3mf({ ...opts, shellSlot, pedestalSlot })
          : buildMoldBoxStl(opts);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${filename || "molde-silicone"}.${format}`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success(`Arquivo .${format} gerado.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Molde de Silicone</h1>
        <p className="text-sm text-muted-foreground">
          Informe as medidas da peça original e baixe a caixa imprimível: base, paredes e
          pedestal. Quem comprar cola a peça no pedestal, verte o silicone e obtém o molde.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Largura da peça (mm)</Label>
              <Input id="pw" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pd">Profundidade da peça (mm)</Label>
              <Input id="pd" inputMode="decimal" value={d} onChange={(e) => setD(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Altura da peça (mm)</Label>
              <Input id="ph" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mg">Folga lateral (mm)</Label>
              <Input id="mg" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm">Silicone acima da peça (mm)</Label>
              <Input id="tm" inputMode="decimal" value={topMargin} onChange={(e) => setTopMargin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl">Espessura da parede (mm)</Label>
              <Input id="wl" inputMode="decimal" value={wall} onChange={(e) => setWall(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fl">Espessura da base (mm)</Label>
              <Input id="fl" inputMode="decimal" value={floor} onChange={(e) => setFloor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pe">Pedestal da peça (mm)</Label>
              <Input id="pe" inputMode="decimal" value={pedestal} onChange={(e) => setPedestal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="arquivo">Nome do arquivo</Label>
              <Input id="arquivo" value={filename} onChange={(e) => setFilename(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={keys} onCheckedChange={setKeys} /> Chaves de registro (molde em 2 partes)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={spout} onCheckedChange={setSpout} /> Bico de vazamento
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <SlotCountField value={slots} onChange={setSlots} />
            <MaterialSlotFields
              label="Caixa"
              idPrefix="caixa"
              slots={slots}
              value={shellSlot}
              onChange={setShellSlot}
            />
            <MaterialSlotFields
              label="Pedestal"
              idPrefix="pedestal"
              slots={slots}
              value={pedestalSlot}
              onChange={setPedestalSlot}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => download("3mf")}>
              <Box className="size-4" /> Baixar .3mf
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => download("stl")}>
              <Download className="size-4" /> Baixar .stl
            </Button>
          </div>
        </div>

        <aside className="space-y-3 rounded-lg border border-border bg-card p-5 h-fit">
          <div className="text-sm font-medium">Resumo</div>
          <dl className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <dt>Caixa externa</dt>
              <dd>
                {preview
                  ? `${preview.outerWidthMm.toFixed(1)} × ${preview.outerDepthMm.toFixed(1)} × ${preview.outerHeightMm.toFixed(1)} mm`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Cavidade</dt>
              <dd>
                {preview
                  ? `${preview.innerWidthMm.toFixed(1)} × ${preview.innerDepthMm.toFixed(1)} × ${preview.innerHeightMm.toFixed(1)} mm`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Silicone estimado</dt>
              <dd>{preview ? `${preview.siliconeMl.toFixed(0)} ml` : "—"}</dd>
            </div>
          </dl>
          <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-1">
            <li>Imprima a caixa com paredes sólidas (3+ perímetros) para não vazar.</li>
            <li>Cole a peça no pedestal com cola quente.</li>
            <li>Verta o silicone pelo bico, devagar, e aguarde a cura.</li>
            <li>Corte o silicone entre as chaves de registro e retire a peça.</li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
