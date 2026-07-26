import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useSuspenseQuery, queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTags, deleteTag, deleteTags } from "@/lib/tags.functions";
import { getMyPlan } from "@/lib/plans.functions";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DESTINATION_LABELS } from "@/lib/destination";
import { format } from "date-fns";

const tagsQO = queryOptions({ queryKey: ["tags"], queryFn: () => listTags() });

export const Route = createFileRoute("/_authenticated/tags/")({
  head: () => ({ meta: [{ title: "Minhas Tags · 3D QR" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(tagsQO),
  component: TagsPage,
});

function TagsPage() {
  const { data: tags } = useSuspenseQuery(tagsQO);
  const { data: plan } = useQuery({ queryKey: ["my-plan"], queryFn: () => getMyPlan() });
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tags"] });
    qc.invalidateQueries({ queryKey: ["my-plan"] });
  };

  const del = useMutation({
    mutationFn: (id: string) => deleteTag({ data: { id } }),
    onSuccess: () => {
      toast.success("Tag removida.");
      setSelected((s) => { const n = new Set(s); return n; });
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const bulkDel = useMutation({
    mutationFn: (ids: string[]) => deleteTags({ data: { ids } }),
    onSuccess: (r) => {
      toast.success(`${r.count} tag(s) removida(s).`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const allIds = useMemo(() => tags.map((t) => t.id), [tags]);
  const allChecked = allIds.length > 0 && selected.size === allIds.length;
  const someChecked = selected.size > 0 && !allChecked;

  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(allIds));

  const removeSelected = () => {
    const ids = allIds.filter((id) => selected.has(id));
    if (ids.length === 0) return;
    if (confirm(`Remover ${ids.length} tag(s) selecionada(s)? Esta ação não pode ser desfeita.`))
      bulkDel.mutate(ids);
  };

  const atLimit = plan ? plan.used >= plan.plan.max_tags : false;
  const pct = plan && plan.plan.max_tags > 0
    ? Math.min(100, Math.round((plan.used / plan.plan.max_tags) * 100))
    : 0;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Minhas Tags</h1>
          <p className="text-sm text-muted-foreground">{tags.length} etiqueta(s).</p>
        </div>
        <div className="flex items-end gap-4">
          {plan && (
            <div className="hidden sm:block w-44 text-right">
              <div className="text-xs text-muted-foreground">
                Plano <span className="font-medium text-foreground">{plan.plan.name}</span> ·{" "}
                {plan.used}/{plan.plan.max_tags} tags
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${atLimit ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
          <Link to="/tags/new" disabled={atLimit}>
            <Button disabled={atLimit} title={atLimit ? "Limite do plano atingido" : undefined}>
              <Plus className="size-4" /> Nova tag
            </Button>
          </Link>
        </div>
      </div>

      {atLimit && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Você atingiu o limite de {plan?.plan.max_tags} tags do plano {plan?.plan.name}. Faça
          upgrade para criar mais.
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selecionada(s)</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={bulkDel.isPending}
              onClick={removeSelected}
            >
              <Trash2 className="size-3.5" /> Remover selecionadas
            </Button>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas"
                    className="size-4 align-middle accent-primary cursor-pointer"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked; }}
                    onChange={toggleAll}
                  />
                </th>
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
                <tr key={t.id} className={`hover:bg-muted/30 ${selected.has(t.id) ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${t.name}`}
                      className="size-4 align-middle accent-primary cursor-pointer"
                      checked={selected.has(t.id)}
                      onChange={() => toggleOne(t.id)}
                    />
                  </td>
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
