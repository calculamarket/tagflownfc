import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listLeads, deleteLead } from "@/lib/leads.functions";
import { Button } from "@/components/ui/button";
import { Trash2, Download, Inbox } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads · 3D QR" }] }),
  component: LeadsPage,
});

function LeadsPage() {
  const qc = useQueryClient();
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => listLeads({ data: {} }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteLead({ data: { id } }),
    onSuccess: () => {
      toast.success("Lead removido.");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const exportCsv = () => {
    const head = ["Tag", "Nome", "E-mail", "Telefone", "Mensagem", "Data"];
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = leads.map((l) =>
      [
        l.tag_id, l.name ?? "", l.email ?? "", l.phone ?? "",
        (l.message ?? "").replace(/\n/g, " "),
        new Date(l.created_at).toLocaleString("pt-BR"),
      ].map((c) => esc(String(c))).join(","),
    );
    const csv = [head.map(esc).join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-3D QR.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Contatos capturados pelos formulários das suas landing pages.
          </p>
        </div>
        {leads.length > 0 && (
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> Exportar CSV
          </Button>
        )}
      </div>

      {leads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center">
          <Inbox className="size-6 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum lead ainda. Ative a “Captura de contatos” no editor da landing page de uma tag.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Mensagem</th>
                <th className="px-4 py-3 font-medium">Tag</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{l.name || "—"}</div>
                    {l.email && (
                      <a href={`mailto:${l.email}`} className="text-xs text-muted-foreground hover:underline">
                        {l.email}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.phone || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs">
                    <div className="line-clamp-3 whitespace-pre-line">{l.message || "—"}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.tag_id}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(l.created_at), "dd/MM/yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { if (confirm("Remover este lead?")) del.mutate(l.id); }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
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
