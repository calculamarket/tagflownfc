type Row = { key: string; count: number };

/** ISO-3166 alpha-2 → flag emoji (regional indicator symbols). */
function flagOf(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/**
 * Geographic "heat" ranking: bar length is share of the top entry and the fill
 * opacity encodes intensity, so hotspots stand out at a glance.
 */
export function GeoHeat({
  rows,
  showFlag = false,
  emptyLabel = "Sem dados no período.",
}: {
  rows: Row[];
  showFlag?: boolean;
  emptyLabel?: string;
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const share = total > 0 ? (r.count / total) * 100 : 0;
        const width = (r.count / max) * 100;
        // 0.25 → 1.0 opacity so even small values stay visible.
        const opacity = 0.25 + (r.count / max) * 0.75;
        return (
          <div key={r.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">
                {showFlag && <span className="mr-1.5">{flagOf(r.key)}</span>}
                {r.key}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {r.count.toLocaleString("pt-BR")} · {share.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${width}%`, opacity }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
