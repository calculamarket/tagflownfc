import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTags, deleteTag } from "@/lib/tags.functions";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, ExternalLink, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DESTINATION_LABELS } from "@/lib/destination";
import { format } from "date-fns";

const tagsQO = queryOptions({ queryKey: ["tags"], queryFn: () => listTags() });

export const Route = createFileRoute("/_authenticated/tags")({
  head: () => ({ meta: [{ title: "Minhas Tags · TagFlow" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(tagsQO),
  component: TagsPage,
});

function TagsPage() {
  const { data: tags } = useSuspenseQuery(tagsQO);
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => deleteTag({ data: { id } }),
    onSuccess: () => { toast.success("Tag removida."); qc.invalidateQueries({ queryKey: ["tags"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Minhas Tags</h1>
          <p className="text-sm text-muted-foreground">{tags.length} etiqueta(s).</p>
        </div>
        <Link to="/tags/new">
          <Button><Plus className="size-4" /> Nova tag</Button>
        </Link>
      </div>

      {tags.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma tag ainda.</p>
          <Link to="/tags/new" className="mt-4 inline-block">
            <Button variant="outline"><Plus className="size-4" /> Criar minha primeira tag</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Leituras</th>
                <th className="px-4 py-3 font-medium">Criada</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tags.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.id}</td>
                  <td className="px-4 py-3 text-muted-foreground">{DESTINATION_LABELS[t.destination_type]}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.read_count}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {format(new Date(t.created_at), "dd/MM/yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <a href={`/t/${t.id}`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost"><ExternalLink className="size-3.5" /></Button>
                      </a>
                      <Link to="/tags/$id" params={{ id: t.id }}>
                        <Button size="sm" variant="ghost"><Pencil className="size-3.5" /></Button>
                      </Link>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { if (confirm(`Remover "${t.name}"?`)) del.mutate(t.id); }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success",
    paused: "bg-warning/15 text-warning-foreground",
    archived: "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = { active: "Ativa", paused: "Pausada", archived: "Arquivada" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${map[status]}`}>{labels[status]}</span>;
}
