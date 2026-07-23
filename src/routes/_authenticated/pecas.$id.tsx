import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getKit, renameFace } from "@/lib/kits.functions";
import { DESTINATION_LABELS } from "@/lib/destination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Boxes, Pencil, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pecas/$id")({
  head: () => ({ meta: [{ title: "Peça · 3D QR" }] }),
  component: KitDetail,
});

function KitDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const { data: kit, isLoading } = useQuery({
    queryKey: ["kit", id],
    queryFn: () => getKit({ data: { id } }),
  });

  const rename = useMutation({
    mutationFn: (v: { tagId: string; label: string }) => renameFace({ data: v }),
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["kit", id] });
      qc.invalidateQueries({ queryKey: ["kits"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!kit) return <div className="p-6">Peça não encontrada.</div>;

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <div>
        <Link to="/pecas" className="text-xs text-muted-foreground hover:underline">
          ← Minhas Peças
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Boxes className="size-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">{kit.model}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {kit.slots} QR Codes nesta peça. Configure o destino de cada face — pode trocar
          quando quiser, sem reimprimir.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {kit.faces.map((face) => (
          <div key={face.id} className="p-4 flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-sm font-medium">
              {face.slot}
            </div>

            <div className="flex-1 min-w-0">
              {editing === face.id ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    className="h-8"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={`Face ${face.slot}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") rename.mutate({ tagId: face.id, label });
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={rename.isPending}
                    onClick={() => rename.mutate({ tagId: face.id, label })}
                  >
                    <Check className="size-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="group inline-flex items-center gap-1.5 font-medium"
                    onClick={() => {
                      setLabel(face.slot_label ?? "");
                      setEditing(face.id);
                    }}
                  >
                    {face.slot_label || `Face ${face.slot}`}
                    <Pencil className="size-3 opacity-0 group-hover:opacity-60" />
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {DESTINATION_LABELS[face.destination_type]} · {face.read_count} leituras
                  </div>
                </>
              )}
            </div>

            <a href={`/t/${face.id}`} target="_blank" rel="noreferrer" className="shrink-0">
              <Button variant="ghost" size="icon" title="Abrir">
                <ExternalLink className="size-4" />
              </Button>
            </a>
            <Link to="/tags/$id" params={{ id: face.id }} className="shrink-0">
              <Button variant="outline" size="sm">Configurar</Button>
            </Link>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Dica: renomeie as faces conforme o uso (“Cardápio”, “Instagram”, “PIX”) clicando no nome.
      </p>
    </div>
  );
}
