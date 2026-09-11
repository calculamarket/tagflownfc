import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { analyticsOverview } from "@/lib/analytics.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { GeoHeat } from "@/components/geo-heat";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/ativar_/analytics")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Analytics em tempo real · Ativar etiqueta · 3D QR" },
      {
        name: "description",
        content: "Acompanhe as leituras das suas etiquetas em tempo real: cidades, países, dispositivos e origem.",
      },
      { property: "og:title", content: "Analytics em tempo real · 3D QR" },
      {
        property: "og:description",
        content: "Leituras das suas etiquetas atualizadas a cada 10 segundos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveAnalytics,
});

function LiveAnalytics() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [days, setDays] = useState(30);
  const [tagId, setTagId] = useState("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({
          to: "/auth",
          search: { mode: "signin", redirect: "/ativar/analytics" },
          replace: true,
        });
        return;
      }
      setReady(true);
    });
  }, [navigate]);

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["ativar-analytics", days, tagId],
    queryFn: () => analyticsOverview({ data: { days, tagId: tagId === "all" ? null : tagId } }),
    enabled: ready,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30">
        <div className="size-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/ativar" className="inline-flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="size-4" /> Ativar etiqueta
          </Link>
          <Link to="/tags">
            <Button variant="outline" size="sm">Minhas etiquetas</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              Analytics em tempo real
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" /> ao vivo
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Atualiza sozinho a cada 10 segundos
              {dataUpdatedAt ? ` · última atualização ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ""}
            </p>
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
              <SelectTrigger className="w-52"><SelectValue placeholder="Todas as etiquetas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as etiquetas</SelectItem>
                {(data?.tags ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
                    <linearGradient id="fa-live" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#fa-live)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Onde escanearam</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Países</p>
              <GeoHeat rows={data?.by_country ?? []} showFlag />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cidades</p>
              <GeoHeat rows={data?.by_city ?? []} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BreakdownCard title="NFC vs QR Code" rows={data?.by_source ?? []} />
          <BreakdownCard title="Dispositivos" rows={data?.by_device ?? []} />
          <BreakdownCard title="Sistemas" rows={data?.by_os ?? []} />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Últimas leituras</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-border text-sm">
              {(data?.recent ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 py-2">
                  <div className="truncate">
                    <span className="font-mono text-xs text-muted-foreground">{r.tag_id}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    {r.city ?? "—"}, {r.country ?? "—"}
                  </div>
                  <div className="whitespace-nowrap text-xs text-muted-foreground">
                    {r.device ?? "—"} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {(data?.recent ?? []).length === 0 && (
                <p className="py-6 text-center text-muted-foreground">Sem leituras ainda.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value.toLocaleString()}</p>
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
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
