import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteWebhook, listDeliveries, listWebhooks, retryDelivery, testWebhook, upsertWebhook } from "@/lib/webhooks.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Send, Copy, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({ meta: [{ title: "Automações · 3D QR" }] }),
  component: AutomationsPage,
});

type EventType = "tag.read" | "tag.created" | "tag.updated";

function AutomationsPage() {
  const qc = useQueryClient();
  const { data: hooks = [] } = useQuery({ queryKey: ["webhooks"], queryFn: () => listWebhooks() });
  const { data: deliveries = [] } = useQuery({
    queryKey: ["webhook-deliveries"],
    queryFn: () => listDeliveries(),
    refetchInterval: 15_000,
  });

  const [url, setUrl] = useState("");
  const [event, setEvent] = useState<EventType>("tag.read");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const create = useMutation({
    mutationFn: () => upsertWebhook({ data: { url, event, active: true } }),
    onSuccess: () => {
      toast.success("Webhook criado");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const toggle = useMutation({
    mutationFn: (h: { id: string; url: string; event: EventType; active: boolean }) =>
      upsertWebhook({ data: h }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteWebhook({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
  const test = useMutation({
    mutationFn: (id: string) => testWebhook({ data: { id } }),
    onSuccess: (res) =>
      res.ok ? toast.success(`Enviado (HTTP ${res.status})`) : toast.error(`Falhou: ${res.error ?? res.status}`),
  });
  const retry = useMutation({
    mutationFn: (id: string) => retryDelivery({ data: { id } }),
    onSuccess: () => {
      toast.success("Reenvio disparado");
      qc.invalidateQueries({ queryKey: ["webhook-deliveries"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Automações</h1>
        <p className="text-sm text-muted-foreground">
          Webhooks são disparados automaticamente quando eventos acontecem no seu workspace.
          Cada requisição inclui o header <code className="text-xs">X-TagFlow-Signature: sha256=…</code>,
          um HMAC do corpo usando o segredo do webhook — valide-o no seu endpoint.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Novo webhook</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-[1fr_200px_auto] gap-3">
            <div>
              <Label className="text-xs">URL de destino</Label>
              <Input placeholder="https://exemplo.com/hook" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Evento</Label>
              <Select value={event} onValueChange={(v) => setEvent(v as EventType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag.read">tag.read</SelectItem>
                  <SelectItem value="tag.created">tag.created</SelectItem>
                  <SelectItem value="tag.updated">tag.updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                disabled={!url.trim() || create.isPending}
                onClick={() => create.mutate()}
                className="w-full"
              >
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Webhooks cadastrados</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {hooks.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum webhook ainda.</p>
            )}
            {hooks.map((h) => (
              <div key={h.id} className="py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">{h.url}</p>
                    <div className="mt-1 flex gap-2">
                      <Badge variant="secondary">{h.event}</Badge>
                      {!h.active && <Badge variant="outline">Pausado</Badge>}
                    </div>
                  </div>
                  <Switch
                    checked={h.active}
                    onCheckedChange={(v) =>
                      toggle.mutate({ id: h.id, url: h.url, event: h.event, active: v })
                    }
                  />
                  <Button variant="ghost" size="icon" onClick={() => test.mutate(h.id)} title="Testar">
                    <Send className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(h.id)} title="Remover">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <KeyRound className="size-3.5 shrink-0" />
                  <span className="font-mono truncate">
                    {revealed[h.id] ? h.secret : "•".repeat(24)}
                  </span>
                  <button
                    type="button"
                    className="underline hover:text-foreground shrink-0"
                    onClick={() => setRevealed((r) => ({ ...r, [h.id]: !r[h.id] }))}
                  >
                    {revealed[h.id] ? "Ocultar" : "Mostrar"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground shrink-0"
                    onClick={() => copy(h.secret, "Segredo")}
                  >
                    <Copy className="size-3.5" /> Copiar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Entregas recentes</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {deliveries.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma entrega ainda. Elas aparecem aqui assim que um evento dispara.
              </p>
            )}
            {deliveries.map((d) => (
              <div key={d.id} className="py-3 flex items-center gap-3 text-sm">
                <Badge variant={d.ok ? "secondary" : "destructive"}>
                  {d.ok ? d.status_code ?? "OK" : `Falha${d.status_code ? ` ${d.status_code}` : ""}`}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="truncate">{d.url}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{d.event}</span>
                    {d.error && <span className="truncate text-destructive">· {d.error}</span>}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(d.created_at).toLocaleString()}
                </span>
                {!d.ok && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    title="Reenviar"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(d.id)}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
