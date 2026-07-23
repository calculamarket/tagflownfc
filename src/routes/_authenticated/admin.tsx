import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  adminStats, adminListUsers, adminListPlans, adminSetUserPlan,
  adminListBatches, adminCreateBatch, adminBatchTags,
} from "@/lib/admin.functions";
import { formatClaimCode } from "@/lib/claim-code";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Box } from "lucide-react";
import { buildQr3mfBytes } from "@/lib/qr-3mf";
import { createZip } from "@/lib/zip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · 3D QR" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AdminPage() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminStats() });
  const { data: plans = [] } = useQuery({ queryKey: ["admin-plans"], queryFn: () => adminListPlans() });
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => adminListUsers({ data: { search } }),
    placeholderData: keepPreviousData,
  });

  const setPlan = useMutation({
    mutationFn: (v: { userId: string; planId: string }) => adminSetUserPlan({ data: v }),
    onSuccess: () => {
      toast.success("Plano atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">Gestão da plataforma.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Usuários" value={stats?.users} />
        <Stat label="Tags" value={stats?.tags} />
        <Stat label="Leituras totais" value={stats?.reads_total} />
        <Stat label="Leituras hoje" value={stats?.reads_today} />
        <Stat label="Leituras no mês" value={stats?.reads_month} />
        <Stat label="Assinaturas ativas" value={stats?.active_subscriptions} />
        <Stat label="Receita mensal" value={stats ? brl(stats.revenue_cents) : undefined} />
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Distribuição de planos</div>
          <div className="mt-2 space-y-1">
            {(stats?.plan_distribution ?? []).map((p) => (
              <div key={p.name} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{p.name}</span>
                <span className="font-medium">{p.count}</span>
              </div>
            ))}
            {!stats && <div className="text-sm text-muted-foreground">…</div>}
          </div>
        </div>
      </div>

      <BatchesSection />

      <div className="rounded-lg border border-border bg-card">
        <div className="p-5 border-b border-border flex items-center justify-between gap-4">
          <div className="font-semibold">Usuários</div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome ou e-mail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-left">
                <th className="px-5 py-3 font-medium">Usuário</th>
                <th className="px-5 py-3 font-medium">Tags</th>
                <th className="px-5 py-3 font-medium">Plano</th>
                <th className="px-5 py-3 font-medium">Criado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      {u.is_admin && <Badge variant="secondary">admin</Badge>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{u.tag_count}</td>
                  <td className="px-5 py-3">
                    <Select
                      value={u.plan_id ?? plans.find((p) => p.name === u.plan_name)?.id ?? ""}
                      onValueChange={(planId) => setPlan.mutate({ userId: u.id, planId })}
                    >
                      <SelectTrigger className="h-8 w-36"><SelectValue placeholder={u.plan_name} /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.price_cents > 0 ? `· ${brl(p.price_cents)}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Production batches: generate unclaimed pieces and export them for printing. */
function BatchesSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("50");

  const { data: batches = [] } = useQuery({
    queryKey: ["admin-batches"],
    queryFn: () => adminListBatches(),
  });

  const create = useMutation({
    mutationFn: () =>
      adminCreateBatch({ data: { name: name.trim(), quantity: Number(quantity) } }),
    onSuccess: (res) => {
      toast.success(`Lote criado com ${res.quantity} peças.`);
      setName("");
      qc.invalidateQueries({ queryKey: ["admin-batches"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [modelsBusy, setModelsBusy] = useState<string | null>(null);

  const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  /** One .3mf per piece of the batch, zipped. Each QR encodes its own URL, so
   *  production needs a distinct model per piece. */
  const exportModels = async (batchId: string, batchName: string) => {
    setModelsBusy(batchId);
    try {
      const rows = await adminBatchTags({ data: { batchId } });
      const origin = window.location.origin;
      const entries = [];
      for (const r of rows) {
        const bytes = await buildQr3mfBytes(`${origin}/t/${r.id}`, {
          sizeMm: 60,
          baseHeightMm: 2,
          moduleHeightMm: 1.6,
          baseColor: "#ffffff",
          codeColor: "#111111",
        });
        entries.push({ name: `${r.id}.3mf`, data: bytes });
      }
      const zip = await createZip(entries);
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modelos-${slug(batchName)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${entries.length} modelos gerados.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setModelsBusy(null);
    }
  };

  const exportCsv = async (batchId: string, batchName: string) => {
    try {
      const rows = await adminBatchTags({ data: { batchId } });
      const origin = window.location.origin;
      const header = "id,codigo_ativacao,url_do_qr,ativada_em";
      const body = rows
        .map((r) =>
          [
            r.id,
            formatClaimCode(r.claim_code ?? ""),
            `${origin}/t/${r.id}`,
            r.claimed_at ?? "",
          ].join(","),
        )
        .join("\n");
      const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lote-${batchName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-5 border-b border-border">
        <div className="font-semibold">Lotes de produção</div>
        <p className="text-sm text-muted-foreground">
          Gere peças sem dono com código de ativação e exporte o CSV para a impressão.
        </p>
      </div>

      <div className="p-5 border-b border-border flex flex-wrap items-end gap-3">
        <div className="space-y-1 flex-1 min-w-48">
          <Label className="text-xs">Nome do lote</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Lote Janeiro" />
        </div>
        <div className="space-y-1 w-32">
          <Label className="text-xs">Quantidade</Label>
          <Input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <Button
          disabled={!name.trim() || !(Number(quantity) > 0) || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Gerando…" : "Gerar lote"}
        </Button>
      </div>

      <div className="divide-y divide-border">
        {batches.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum lote ainda.</p>
        )}
        {batches.map((b) => (
          <div key={b.id} className="px-5 py-3 flex items-center gap-4 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{b.name}</div>
              <div className="text-xs text-muted-foreground">
                {b.quantity} peças · {b.claimed} ativadas ·{" "}
                {new Date(b.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <Button
              variant="outline" size="sm"
              disabled={modelsBusy === b.id}
              onClick={() => exportModels(b.id, b.name)}
              title="Um .3mf por peça, prontos para o fatiador"
            >
              <Box className="size-4" /> {modelsBusy === b.id ? "Gerando…" : "Modelos 3D"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(b.id, b.name)}>
              <Download className="size-4" /> CSV
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold mt-2">{value ?? "…"}</div>
    </div>
  );
}
