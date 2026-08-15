import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Upload, X, Download, Box } from "lucide-react";
import { generateFigurine } from "@/lib/figurine.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/estudio-bonecos")({
  head: () => ({
    meta: [
      { title: "Estúdio de Bonecos · 3D QR" },
      {
        name: "description",
        content:
          "Envie duas ou mais fotos e gere a arte de um boneco colecionável estilizado, com vistas de frente, lado e costas prontas para modelagem.",
      },
      { property: "og:title", content: "Estúdio de Bonecos · 3D QR" },
      {
        property: "og:description",
        content: "Fotos viram a arte do seu boneco colecionável em segundos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EstudioBonecosPage,
});

const STYLES = [
  { value: "funko", label: "Funko-like (cabeça grande)" },
  { value: "chibi", label: "Chibi / anime" },
  { value: "realista", label: "Estatueta realista" },
  { value: "cartoon", label: "Cartoon" },
  { value: "lego", label: "Minifigura de blocos" },
] as const;

const VIEWS = [
  { value: "turnaround", label: "Turnaround (frente + lado + costas)" },
  { value: "frente", label: "Somente frente" },
  { value: "lado", label: "Somente perfil" },
  { value: "costas", label: "Somente costas" },
] as const;

const MAX_SIDE = 1024;

/** Downscale to a data URL so the request payload stays small. */
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponível."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function EstudioBonecosPage() {
  const generate = useServerFn(generateFigurine);
  const [photos, setPhotos] = useState<string[]>([]);
  const [style, setStyle] = useState<(typeof STYLES)[number]["value"]>("funko");
  const [view, setView] = useState<(typeof VIEWS)[number]["value"]>("turnaround");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (!files.length) return;
    try {
      const urls = await Promise.all(files.map(toDataUrl));
      setPhotos((prev) => [...prev, ...urls].slice(0, 5));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const run = async () => {
    if (photos.length < 2) {
      toast.error("Envie pelo menos duas fotos (rosto de frente e perfil ou corpo inteiro).");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await generate({ data: { photos, style, view, notes: notes || undefined } });
      setResult(res.image);
      toast.success("Boneco gerado.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `boneco-${style}-${view}.png`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Estúdio de Bonecos</h1>
        <p className="text-sm text-muted-foreground">
          Envie de 2 a 5 fotos da pessoa ou do produto e gere a arte do boneco colecionável.
          Use o turnaround como referência para modelar e imprimir a peça.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div className="space-y-2">
            <Label>Fotos de referência</Label>
            <div className="flex flex-wrap gap-3">
              {photos.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    alt={`Referência ${i + 1}`}
                    className="h-24 w-24 rounded-md border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    className="absolute -right-2 -top-2 rounded-full border border-border bg-background p-1"
                    aria-label="Remover foto"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:bg-accent"
                >
                  <Upload className="size-4" /> Adicionar
                </button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={addFiles}
            />
            <p className="text-xs text-muted-foreground">
              Melhor resultado: rosto de frente, perfil e corpo inteiro, com boa iluminação.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Estilo</Label>
              <Select value={style} onValueChange={(v) => setStyle(v as typeof style)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vistas</Label>
              <Select value={view} onValueChange={(v) => setView(v as typeof view)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VIEWS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notas">Detalhes extras (opcional)</Label>
            <Textarea
              id="notas"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: camisa do time, óculos escuros, segurando uma prancha…"
            />
          </div>

          <Button disabled={busy} onClick={run}>
            <Sparkles className="size-4" /> {busy ? "Gerando…" : "Gerar boneco"}
          </Button>
        </div>

        <aside className="space-y-3 rounded-lg border border-border bg-card p-5 h-fit">
          <div className="text-sm font-medium">Resultado</div>
          {result ? (
            <>
              <img src={result} alt="Boneco gerado" className="w-full rounded-md border border-border" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={download}>
                  <Download className="size-4" /> Baixar PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    sessionStorage.setItem("tagflow:mold-reference", result);
                    navigate({ to: "/molde-silicone" });
                  }}
                >
                  <Box className="size-4" /> Usar no molde
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {busy
                ? "A IA está desenhando o boneco. Isso pode levar até um minuto."
                : "A arte aparece aqui depois de gerar."}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            A geração cria a arte 2D. Para imprimir, use o turnaround como referência de
            modelagem — ou gere a caixa de molde em silicone na página “Molde de Silicone”.
          </p>
        </aside>
      </div>
    </div>
  );
}
