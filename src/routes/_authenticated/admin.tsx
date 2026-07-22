import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminStats, adminListUsers, adminListPlans, adminSetUserPlan } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · TagFlow" }] }),
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

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold mt-2">{value ?? "…"}</div>
    </div>
  );
}
