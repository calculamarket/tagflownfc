import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getLandingForEditor, upsertLanding, type LandingButton } from "@/lib/landing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/landing/$tagId")({
  head: () => ({ meta: [{ title: "Landing Page · TagFlow" }] }),
  component: LandingEditor,
});

function LandingEditor() {
  const { tagId } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["landing", tagId],
    queryFn: () => getLandingForEditor({ data: { tag_id: tagId } }),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [buttons, setButtons] = useState<LandingButton[]>([]);

  useEffect(() => {
    if (!data) return;
    setTitle((data.landing?.title as string) ?? data.tag.name);
    setDescription((data.landing?.description as string) ?? "");
    setLogoUrl((data.landing?.logo_url as string) ?? "");
    setImageUrl((data.landing?.image_url as string) ?? "");
    const raw = data.landing?.buttons;
    setButtons(Array.isArray(raw) ? (raw as LandingButton[]) : []);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      upsertLanding({
        data: {
          tag_id: tagId,
          title, description,
          logo_url: logoUrl || null,
          image_url: imageUrl || null,
          buttons,
        },
      }),
    onSuccess: () => {
      toast.success("Landing page salva");
      qc.invalidateQueries({ queryKey: ["landing", tagId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addBtn = () => setButtons([...buttons, { label: "Novo botão", url: "https://", style: "primary" }]);
  const updBtn = (i: number, patch: Partial<LandingButton>) =>
    setButtons(buttons.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const rmBtn = (i: number) => setButtons(buttons.filter((_, idx) => idx !== i));

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/t/${tagId}/view` : "";

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Landing Page</h1>
          <p className="text-sm text-muted-foreground">Tag: {data?.tag.name ?? tagId}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4 mr-2" />Ver</a>
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Conteúdo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Logo (URL)</Label>
                  <Input placeholder="https://…/logo.png" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Imagem de capa (URL)</Label>
                  <Input placeholder="https://…/cover.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Botões</CardTitle>
              <Button size="sm" variant="outline" onClick={addBtn}><Plus className="size-4 mr-1" />Adicionar</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {buttons.length === 0 && <p className="text-sm text-muted-foreground">Nenhum botão ainda.</p>}
              {buttons.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_120px_auto] gap-2 items-end">
                  <div className="space-y-1"><Label className="text-xs">Label</Label>
                    <Input value={b.label} onChange={(e) => updBtn(i, { label: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">URL</Label>
                    <Input value={b.url} onChange={(e) => updBtn(i, { url: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Estilo</Label>
                    <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={b.style} onChange={(e) => updBtn(i, { style: e.target.value as LandingButton["style"] })}>
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                    </select></div>
                  <Button variant="ghost" size="icon" onClick={() => rmBtn(i)}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit sticky top-6">
          <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              {imageUrl && <img src={imageUrl} alt="" className="w-full h-32 object-cover" />}
              <div className="p-5 text-center space-y-3">
                {logoUrl && <img src={logoUrl} alt="" className="mx-auto size-16 rounded-full object-cover" />}
                <h3 className="font-semibold">{title || "Título"}</h3>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
                <div className="flex flex-col gap-2 pt-2">
                  {buttons.map((b, i) => (
                    <div key={i} className={
                      b.style === "primary"
                        ? "rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium"
                        : "rounded-md border border-border py-2 text-sm"
                    }>{b.label}</div>
                  ))}
                </div>
              </div>
            </div>
            <Link to="/tags" className="mt-4 block text-xs text-muted-foreground hover:underline">← Voltar às tags</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
