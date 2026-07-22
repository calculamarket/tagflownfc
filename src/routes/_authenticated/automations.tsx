import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteWebhook, listWebhooks, testWebhook, upsertWebhook } from "@/lib/webhooks.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({ meta: [{ title: "Automações · TagFlow" }] }),
  component: AutomationsPage,
});

type EventType = "tag.read" | "tag.created" | "tag.updated";

function AutomationsPage() {
  const qc = useQueryClient();
  const { data: hooks = [] } = useQuery({ queryKey: ["webhooks"], queryFn: () => listWebhooks() });

  const [url, setUrl] = useState("");
  const [event, setEvent] = useState<EventType>("tag.read");

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

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Automações</h1>
        <p className="text-sm text-muted-foreground">
          Webhooks são disparados quando eventos acontecem no seu workspace.
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
              <div key={h.id} className="py-3 flex items-center gap-3">
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
