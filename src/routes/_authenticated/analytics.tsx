import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { analyticsOverview } from "@/lib/analytics.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics · TagFlow" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [tagId, setTagId] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days, tagId],
    queryFn: () => analyticsOverview({ data: { days, tagId: tagId === "all" ? null : tagId } }),
  });

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Leituras, países, dispositivos e origem.</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tagId} onValueChange={setTagId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Todas as tags" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {(data?.tags ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Leituras no período" value={data?.totals.reads ?? 0} />
        <StatCard label="Dias com leituras" value={data?.totals.unique_days ?? 0} />
        <StatCard label="Países" value={data?.by_country.length ?? 0} />
        <StatCard label="Dispositivos" value={data?.by_device.length ?? 0} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Leituras por dia</CardTitle></CardHeader>
        <CardContent className="h-72">
          {isLoading ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.daily ?? []}>
                <defs>
                  <linearGradient id="fa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#fa)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <BreakdownCard title="Países" rows={data?.by_country ?? []} />
        <BreakdownCard title="Cidades" rows={data?.by_city ?? []} />
        <BreakdownCard title="Dispositivos" rows={data?.by_device ?? []} />
        <BreakdownCard title="Navegadores" rows={data?.by_browser ?? []} />
        <BreakdownCard title="Sistemas" rows={data?.by_os ?? []} />
        <BreakdownCard title="Origem" rows={data?.by_referrer ?? []} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas leituras</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-border text-sm">
            {(data?.recent ?? []).map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between gap-4">
                <div className="truncate">
                  <span className="font-mono text-xs text-muted-foreground">{r.tag_id}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  {r.city ?? "—"}, {r.country ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {r.device ?? "—"} · {r.browser ?? "—"} · {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
            ))}
            {(data?.recent ?? []).length === 0 && (
              <p className="text-muted-foreground py-6 text-center">Sem leituras no período.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight mt-1">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: { key: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-muted-foreground">Sem dados.</p>}
        {rows.map((r) => (
          <div key={r.key} className="text-xs">
            <div className="flex justify-between">
              <span className="truncate">{r.key}</span>
              <span className="text-muted-foreground">{r.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
