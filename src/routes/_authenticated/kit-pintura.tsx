import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Download, Layers3, Palette, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { buildPaintKit3mf, getPaintKitLayout, PAINT_FIGURES, type PaintKitTheme } from "@/lib/paint-kit-3d";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kit-pintura")({
  head: () => ({ meta: [
    { title: "Gerador de Kit de Pintura 3D · 3D QR" },
    { name: "description", content: "Monte kits de figuras com base e contornos em relevo, prontos para impressão 3D e pintura." },
  ] }),
  component: PaintKitPage,
});

const themes: (PaintKitTheme | "Todos")[] = ["Todos", "Animais", "Fundo do Mar", "Fantasia/Espaço"];
const asNumber = (value: string) => Number(value.replace(",", "."));

function FigurePreview({ paths }: { paths: [number, number][][] }) {
  return (
    <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
      <rect x="3" y="3" width="94" height="94" rx="12" fill="currentColor" opacity=".07" />
      {paths.map((path, index) => <polyline key={index} points={path.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}

function PaintKitPage() {
  const [theme, setTheme] = useState<PaintKitTheme | "Todos">("Todos");
  const [selected, setSelected] = useState<string[]>([]);
  const [size, setSize] = useState("60");
  const [base, setBase] = useState("2");
  const [relief, setRelief] = useState("1,2");
  const [line, setLine] = useState("1,2");
  const [busy, setBusy] = useState(false);
  const filtered = theme === "Todos" ? PAINT_FIGURES : PAINT_FIGURES.filter((item) => item.theme === theme);
  const chosen = PAINT_FIGURES.filter((item) => selected.includes(item.id));
  const layout = useMemo(() => getPaintKitLayout(selected.length, asNumber(size) || 60), [selected.length, size]);

  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 8) { toast.error("Você pode selecionar até 8 figuras por kit."); return current; }
      return [...current, id];
    });
  };

  const download = async () => {
    if (!selected.length) { toast.error("Selecione pelo menos uma figura."); return; }
    const values = { size: asNumber(size), base: asNumber(base), relief: asNumber(relief), line: asNumber(line) };
    if (!Object.values(values).every(Number.isFinite) || values.size < 30 || values.base <= 0 || values.relief <= 0 || values.line < 1.2) {
      toast.error("Use tamanho mínimo de 30 mm e medidas positivas. A linha mínima é 1,2 mm."); return;
    }
    setBusy(true);
    try {
      const blob = await buildPaintKit3mf({ figureIds: selected, sizeMm: values.size, baseMm: values.base, reliefMm: values.relief, lineMm: values.line });
      if (!blob.size) throw new Error("O arquivo gerado está vazio.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `kit-pintura-${selected.length}-figuras.3mf`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Kit 3MF gerado com geometria real.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 lg:p-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="gap-1.5"><Palette className="size-3.5" /> Produção 3D</Badge>
          <div><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Gerador de Kit de Pintura 3D</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Escolha as figuras, ajuste as medidas e baixe uma bandeja organizada, pronta para abrir no seu fatiador.</p></div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
          <span className="font-semibold text-primary">{selected.length}/8</span> figuras selecionadas
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <Tabs value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
            <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
              {themes.map((item) => <TabsTrigger key={item} value={item} className="whitespace-nowrap">{item}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3">
            {filtered.map((figure) => {
              const active = selected.includes(figure.id);
              return <button key={figure.id} type="button" onClick={() => toggle(figure.id)} aria-pressed={active}
                className={cn("group relative rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "border-primary bg-primary/5 ring-1 ring-primary") }>
                <span className={cn("absolute right-2 top-2 grid size-6 place-items-center rounded-full border bg-background text-transparent", active && "border-primary bg-primary text-primary-foreground")}><Check className="size-4" /></span>
                <div className="mx-auto aspect-square max-w-32 text-primary"><FigurePreview paths={figure.paths} /></div>
                <div className="mt-2 flex items-center justify-between gap-2"><span className="text-sm font-medium">{figure.name}</span><span className="text-lg" aria-hidden="true">{figure.emoji}</span></div>
                <span className="text-[11px] text-muted-foreground">{figure.theme}</span>
              </button>;
            })}
          </div>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><Layers3 className="size-5 text-primary" /><h2 className="font-semibold">Configuração de impressão</h2></div>
            <div className="grid grid-cols-2 gap-4">
              <Measure label="Tamanho da figura" value={size} onChange={setSize} suffix="mm" />
              <Measure label="Espessura da base" value={base} onChange={setBase} suffix="mm" />
              <Measure label="Altura do relevo" value={relief} onChange={setRelief} suffix="mm" />
              <Measure label="Largura das linhas" value={line} onChange={setLine} suffix="mm" min="1.2" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3 text-xs">
              <div><span className="text-muted-foreground">Bico recomendado</span><strong className="mt-0.5 block text-foreground">0,4 mm</strong></div>
              <div><span className="text-muted-foreground">Organização</span><strong className="mt-0.5 block text-foreground">Automática</strong></div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Prévia da bandeja</h2><Sparkles className="size-4 text-primary" /></div>
            {chosen.length ? <>
              <div className="my-4 grid gap-2 rounded-lg bg-muted/50 p-3" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}>
                {chosen.map((figure) => <div key={figure.id} className="aspect-square rounded-md border bg-background p-1 text-primary" title={figure.name}><FigurePreview paths={figure.paths} /></div>)}
              </div>
              <div className="mb-4 flex justify-between text-xs text-muted-foreground"><span>{layout.columns} colunas × {layout.rows} linhas</span><span>{layout.widthMm.toFixed(0)} × {layout.depthMm.toFixed(0)} mm</span></div>
            </> : <div className="my-4 grid min-h-36 place-items-center rounded-lg border border-dashed text-center text-sm text-muted-foreground"><div><Printer className="mx-auto mb-2 size-7 opacity-50" />Selecione figuras para montar a prévia.</div></div>}
            <Button className="w-full gap-2" size="lg" onClick={download} disabled={busy || !selected.length}><Download className="size-4" />{busy ? "Gerando geometria…" : "Baixar kit em 3MF"}</Button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">O arquivo contém volumes reais de base e relevo, compatíveis com Bambu Studio, OrcaSlicer e PrusaSlicer.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Measure({ label, value, onChange, suffix, min = "0.1" }: { label: string; value: string; onChange: (value: string) => void; suffix: string; min?: string }) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return <div className="space-y-1.5"><Label htmlFor={id} className="text-xs">{label}</Label><div className="relative"><Input id={id} inputMode="decimal" min={min} value={value} onChange={(event) => onChange(event.target.value)} className="pr-10" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span></div></div>;
}
