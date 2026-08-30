import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Baby, Check, Download, Puzzle, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { PAINT_FIGURES, type PaintKitTheme } from "@/lib/paint-kit-3d";
import { buildMontessoriPuzzle3mf, interpretPuzzleRequest, type PuzzleStyle } from "@/lib/montessori-puzzle-3d";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quebra-cabeca-montessori")({
  head: () => ({ meta: [{ title: "Gerador de Quebra-cabeça Montessori · 3D QR" }, { name: "description", content: "Crie tabuleiros Montessori com encaixes e peças removíveis, prontos para impressão 3D." }] }),
  component: MontessoriPuzzlePage,
});

const themes: (PaintKitTheme | "Todos")[] = ["Todos", "Animais", "Fundo do Mar", "Fantasia/Espaço"];
const number = (v:string) => Number(v.replace(",","."));

function MontessoriPuzzlePage(){
  const [request,setRequest]=useState("Quero um quebra-cabeça suave do fundo do mar com 4 peças");
  const [theme,setTheme]=useState<PaintKitTheme|"Todos">("Fundo do Mar");
  const [style,setStyle]=useState<PuzzleStyle>("suave");
  const [selected,setSelected]=useState(["peixe","polvo","tartaruga","baleia"]);
  const [width,setWidth]=useState("160"),[depth,setDepth]=useState("120"),[base,setBase]=useState("2"),[recess,setRecess]=useState("4"),[clearance,setClearance]=useState("0,5"),[busy,setBusy]=useState(false);
  const visible=theme==="Todos"?PAINT_FIGURES:PAINT_FIGURES.filter(f=>f.theme===theme);
  const chosen=useMemo(()=>PAINT_FIGURES.filter(f=>selected.includes(f.id)),[selected]);
  const applyRequest=()=>{const parsed=interpretPuzzleRequest(request);setTheme(parsed.theme);setStyle(parsed.style);const pool=parsed.theme==="Todos"?PAINT_FIGURES:PAINT_FIGURES.filter(f=>f.theme===parsed.theme);setSelected(pool.slice(0,parsed.count).map(f=>f.id));toast.success("Estilo e figuras aplicados ao projeto.");};
  const toggle=(id:string)=>setSelected(current=>current.includes(id)?current.filter(x=>x!==id):current.length>=4?(toast.error("Este tabuleiro aceita até 4 peças."),current):[...current,id]);
  const download=async()=>{if(!selected.length){toast.error("Escolha ao menos uma figura.");return;}setBusy(true);try{const blob=await buildMontessoriPuzzle3mf({figureIds:selected,boardWidthMm:number(width),boardDepthMm:number(depth),baseMm:number(base),recessMm:number(recess),clearanceMm:number(clearance),style});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`quebra-cabeca-montessori-${selected.length}-pecas.3mf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast.success("Quebra-cabeça 3MF criado com encaixes reais.");}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}};
  return <div className="mx-auto max-w-7xl space-y-6 p-5 lg:p-10">
    <header className="space-y-2"><Badge variant="secondary" className="gap-1.5"><Baby className="size-3.5"/> Montessori 3D</Badge><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Gerador de Quebra-cabeça Montessori</h1><p className="max-w-3xl text-sm text-muted-foreground">Descreva o estilo desejado ou monte manualmente. O gerador cria o tabuleiro, as cavidades e as peças removíveis já separadas para impressão.</p></header>
    <section className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm"><div className="mb-2 flex items-center gap-2"><WandSparkles className="size-5 text-primary"/><Label htmlFor="pedido" className="text-base font-semibold">Como você quer o quebra-cabeça?</Label></div><div className="flex flex-col gap-3 md:flex-row"><Textarea id="pedido" value={request} onChange={e=>setRequest(e.target.value)} rows={2} className="bg-background" placeholder="Ex.: animais da fazenda, estilo suave, com 3 peças"/><Button onClick={applyRequest} className="gap-2 md:self-stretch"><Sparkles className="size-4"/>Criar este estilo</Button></div><p className="mt-2 text-xs text-muted-foreground">Entende temas, quantidade de 1 a 4 peças e estilos suave, clássico ou geométrico.</p></section>
    <div className="grid gap-6 xl:grid-cols-[1fr_370px]"><section className="space-y-4"><Tabs value={theme} onValueChange={v=>setTheme(v as typeof theme)}><TabsList className="h-auto w-full justify-start overflow-x-auto">{themes.map(t=><TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}</TabsList></Tabs><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visible.map(fig=>{const active=selected.includes(fig.id);return <button type="button" key={fig.id} onClick={()=>toggle(fig.id)} aria-pressed={active} className={cn("relative rounded-xl border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-md",active&&"border-primary bg-primary/5 ring-1 ring-primary")}><span className="block text-4xl" aria-hidden="true">{fig.emoji}</span><span className="mt-3 block text-sm font-medium">{fig.name}</span><span className="text-[11px] text-muted-foreground">{fig.theme}</span>{active&&<span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-4"/></span>}</button>})}</div></section>
      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start"><div className="rounded-xl border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Puzzle className="size-5 text-primary"/><h2 className="font-semibold">Projeto do tabuleiro</h2></div><div className="space-y-4"><div className="space-y-1.5"><Label>Estilo das peças</Label><Select value={style} onValueChange={v=>setStyle(v as PuzzleStyle)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="suave">Suave · formas orgânicas</SelectItem><SelectItem value="classico">Clássico · contornos definidos</SelectItem><SelectItem value="geometrico">Geométrico · linhas modernas</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><Measure label="Largura" value={width} set={setWidth}/><Measure label="Profundidade" value={depth} set={setDepth}/><Measure label="Base" value={base} set={setBase}/><Measure label="Prof. encaixe" value={recess} set={setRecess}/><Measure label="Folga" value={clearance} set={setClearance}/></div></div><div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground"><strong className="block text-foreground">Configuração inspirada no STL anexado</strong>Base + moldura com cavidades, peças impressas separadamente e detalhes superiores em relevo de 0,6 mm.</div></div>
        <div className="rounded-xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">{selected.length}/4 peças</h2><span className="text-xs text-muted-foreground">{width} × {depth} mm</span></div><div className="my-4 grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3">{chosen.length?chosen.map(f=><div key={f.id} className={cn("grid aspect-square place-items-center border bg-background text-4xl",style==="geometrico"?"rounded-lg":style==="classico"?"rounded-2xl":"rounded-[35%]")}>{f.emoji}</div>):<p className="col-span-2 py-8 text-center text-sm text-muted-foreground">Escolha as peças do tabuleiro.</p>}</div><Button size="lg" className="w-full gap-2" disabled={busy||!selected.length} onClick={download}><Download className="size-4"/>{busy?"Gerando encaixes…":"Baixar quebra-cabeça 3MF"}</Button><p className="mt-3 text-center text-[11px] text-muted-foreground">Volumes separados para tabuleiro, peças e detalhes. Compatível com fatiadores populares.</p></div>
      </aside></div>
  </div>;
}

function Measure({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <div className="space-y-1.5"><Label className="text-xs">{label} (mm)</Label><Input inputMode="decimal" value={value} onChange={e=>set(e.target.value)}/></div>}
