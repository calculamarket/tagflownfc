import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listTags } from "@/lib/tags.functions";
import { DESTINATION_LABELS } from "@/lib/destination";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const tagsQO = queryOptions({ queryKey: ["tags"], queryFn: () => listTags() });

export const Route = createFileRoute("/_authenticated/links")({
  head: () => ({ meta: [{ title: "Links Inteligentes · 3D QR" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(tagsQO),
  component: LinksPage,
});

function LinksPage() {
  const { data: tags } = useSuspenseQuery(tagsQO);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Links Inteligentes</h1>
          <p className="text-sm text-muted-foreground">
            Cada tag tem um link curto <span className="font-mono">/t/id</span> que você pode
            redirecionar a qualquer momento sem reimprimir.
          </p>
        </div>
        <Link to="/tags/new">
          <Button><Plus className="size-4" /> Novo link</Button>
        </Link>
      </div>

      {tags.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center">
          <p className="text-sm text-muted-foreground">Você ainda não tem links.</p>
          <Link to="/tags/new" className="mt-4 inline-block">
            <Button variant="outline"><Plus className="size-4" /> Criar meu primeiro link</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tags.map((t) => {
            const url = `${origin}/t/${t.id}`;
            return (
              <div key={t.id} className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {DESTINATION_LABELS[t.destination_type]}
                    </span>
                    {t.status !== "active" && (
                      <span className="text-xs text-warning-foreground">· {t.status}</span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground truncate">{url}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" title="Copiar" onClick={() => copy(url)}>
                    <Copy className="size-4" />
                  </Button>
                  <a href={`/t/${t.id}`} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="icon" title="Abrir"><ExternalLink className="size-4" /></Button>
                  </a>
                  <Link to="/tags/$id" params={{ id: t.id }}>
                    <Button variant="ghost" size="icon" title="Editar"><Pencil className="size-4" /></Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
