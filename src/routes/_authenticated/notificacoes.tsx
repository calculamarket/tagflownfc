import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listNotifications, markNotificationsRead, deleteNotification, clearNotifications,
} from "@/lib/notifications.functions";
import { pageTitle } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Bell, Trash2, MapPin, Smartphone, QrCode } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({ meta: [{ title: pageTitle("Notificações") }] }),
  component: NotificationsPage,
});

type ScanData = { tag_name?: string; city?: string | null; country?: string | null; source?: string | null; at?: string };

function NotificationsPage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
  });

  // Ao abrir a página, marca tudo como lido (some o badge).
  const markRead = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
  useEffect(() => {
    if (items.some((n) => !n.read)) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const del = useMutation({
    mutationFn: (id: string) => deleteNotification({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const clear = useMutation({
    mutationFn: () => clearNotifications(),
    onSuccess: () => { toast.success("Notificações limpas."); qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">Avisos de quando suas etiquetas são escaneadas.</p>
        </div>
        {items.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => clear.mutate()}>Limpar tudo</Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center">
          <Bell className="size-6 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Sem notificações. Ative “Avisar quando escanearem” numa etiqueta para receber aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const d = (n.data ?? {}) as ScanData;
            const place = [d.city, d.country].filter(Boolean).join(", ");
            const when = n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR }) : "";
            return (
              <div key={n.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <div className="mt-0.5 size-9 shrink-0 rounded-lg bg-primary/10 grid place-items-center text-primary">
                  <QrCode className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    “{d.tag_name || "Etiqueta"}” foi escaneada
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {place && <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {place}</span>}
                    {d.source && <span className="inline-flex items-center gap-1"><Smartphone className="size-3" /> {d.source === "nfc" ? "NFC" : "QR"}</span>}
                    {when && <span>{when}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => del.mutate(n.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
