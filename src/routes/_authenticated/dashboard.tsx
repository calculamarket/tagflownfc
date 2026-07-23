import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { dashboardStats } from "@/lib/tags.functions";
import { Tags, Eye, Calendar, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";

const statsQO = queryOptions({
  queryKey: ["dashboard-stats"],
  queryFn: () => dashboardStats(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · 3D QR" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQO),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(statsQO);

  const cards = [
    { label: "Tags totais", value: data.total_tags, icon: Tags, hint: `${data.active_tags} ativas` },
    { label: "Leituras hoje", value: data.reads_today, icon: Eye },
    { label: "Leituras no mês", value: data.reads_month, icon: Calendar },
    { label: "Total acumulado", value: data.reads_total, icon: TrendingUp },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral das suas etiquetas.</p>
        </div>
        <Link to="/tags" className="text-sm text-primary hover:underline">Ver tags →</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{c.value}</div>
            {c.hint && <div className="mt-1 text-xs text-muted-foreground">{c.hint}</div>}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Leituras (últimos 30 dias)</h2>
        </div>
        <div className="h-72 -mx-2">
          <ResponsiveContainer>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12}
                tickFormatter={(v) => format(new Date(v), "dd/MM")} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                labelFormatter={(v) => format(new Date(v as string), "dd/MM/yyyy")}
              />
              <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold">Últimas leituras</h2>
        </div>
        {data.recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Ainda sem leituras.</div>
        ) : (
          <div className="divide-y divide-border">
            {data.recent.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <div className="font-mono text-xs text-muted-foreground w-24 truncate">{r.tag_id}</div>
                <div className="flex-1 text-muted-foreground truncate">
                  {[r.city, r.country].filter(Boolean).join(", ") || "—"}
                </div>
                <div className="text-muted-foreground hidden sm:block">{r.device} · {r.browser}</div>
                <div className="text-muted-foreground text-xs">{format(new Date(r.created_at), "dd/MM HH:mm")}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
