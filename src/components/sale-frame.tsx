import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { FileUpload } from "@/components/file-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const LS_KEY = "3dqr-sale-frame";

export type FrameCfg = {
  frameUrl: string;
  xPct: number; // QR top-left X, as % of frame width
  yPct: number; // QR top-left Y, as % of frame height
  wPct: number; // QR width, as % of frame width
  cols: number; // frames per row on the A4
};

const DEFAULT_CFG: FrameCfg = { frameUrl: "", xPct: 33, yPct: 28, wPct: 52, cols: 1 };

export function getFrameCfg(): FrameCfg {
  if (typeof window === "undefined") return DEFAULT_CFG;
  try {
    return { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(LS_KEY) || "{}") };
  } catch {
    return DEFAULT_CFG;
  }
}

function saveFrameCfg(cfg: FrameCfg) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Compose each batch QR onto the sale frame and open a print-ready A4 tab.
 * The frame is a foreground <img> (not a CSS background) so it prints without
 * the "background graphics" print option; the QR is an absolutely-positioned
 * <img> on top, placed by the configured percentages.
 */
export async function openFrameSheet(
  rows: { id: string }[],
  origin: string,
): Promise<void> {
  const cfg = getFrameCfg();
  if (!cfg.frameUrl) {
    toast.error("Envie a arte do frame primeiro.");
    return;
  }

  const cells = await Promise.all(
    rows.map(async (r) => {
      const qr = await QRCode.toDataURL(`${origin}/t/${r.id}`, {
        width: 500,
        margin: 0,
        errorCorrectionLevel: "M",
      });
      return `<div class="frame"><img class="bg" src="${esc(cfg.frameUrl)}"/><img class="qr" src="${qr}"/></div>`;
    }),
  );

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Frames para impressao</title><style>
@page { size: A4; margin: 6mm; }
* { box-sizing: border-box; }
body { margin: 0; }
.grid { display: grid; grid-template-columns: repeat(${cfg.cols}, 1fr); gap: 4mm; }
.frame { position: relative; page-break-inside: avoid; }
.frame .bg { width: 100%; display: block; }
.frame .qr { position: absolute; left: ${cfg.xPct}%; top: ${cfg.yPct}%; width: ${cfg.wPct}%; }
.hint { font-family: system-ui, sans-serif; font-size: 11px; color: #555; padding: 4mm 6mm; }
@media print { .hint { display: none; } }
</style></head><body>
<div class="hint">${rows.length} frames — Ctrl/Cmd+P para imprimir ou salvar em PDF.</div>
<div class="grid">${cells.join("")}</div>
<img src="${esc(cfg.frameUrl)}" style="display:none" onload="setTimeout(function(){window.print();},400)"/>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Permita pop-ups para abrir a folha de impressão.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Admin panel: upload the sale-frame art and position the QR over it. */
export function SaleFramePanel() {
  const [cfg, setCfg] = useState<FrameCfg>(DEFAULT_CFG);
  const [sampleQr, setSampleQr] = useState("");

  useEffect(() => {
    setCfg(getFrameCfg());
    QRCode.toDataURL("https://3dqr.com.br/t/exemplo12", { width: 300, margin: 0 })
      .then(setSampleQr)
      .catch(() => {});
  }, []);

  const patch = (p: Partial<FrameCfg>) => {
    const next = { ...cfg, ...p };
    setCfg(next);
    saveFrameCfg(next);
  };

  const numInput = (key: "xPct" | "yPct" | "wPct", label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        className="h-8"
        value={cfg[key]}
        onChange={(e) => patch({ [key]: Number(e.target.value) } as Partial<FrameCfg>)}
      />
    </div>
  );

  return (
    <div className="rounded-md border border-border p-4 space-y-4">
      <div>
        <div className="text-sm font-medium">Frame de venda (adesivo A4)</div>
        <p className="text-xs text-muted-foreground">
          Envie a arte uma vez e ajuste onde o QR se encaixa. Cada frame do lote sai com um QR
          diferente. Vale para qualquer arte.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Arte do frame (PNG/JPG)</Label>
            <FileUpload value={cfg.frameUrl} onChange={(url) => patch({ frameUrl: url })} placeholder="URL da arte" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {numInput("xPct", "QR ← esquerda (%)")}
            {numInput("yPct", "QR ↑ topo (%)")}
            {numInput("wPct", "QR tamanho (%)")}
          </div>

          <div className="space-y-1 w-40">
            <Label className="text-xs">Colunas por folha</Label>
            <Select value={String(cfg.cols)} onValueChange={(v) => patch({ cols: Number(v) })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 por linha</SelectItem>
                <SelectItem value="2">2 por linha</SelectItem>
                <SelectItem value="3">3 por linha</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Prévia</Label>
          <div className="relative w-full border border-border rounded bg-muted/30">
            {cfg.frameUrl ? (
              <>
                <img src={cfg.frameUrl} alt="" className="w-full block" />
                {sampleQr && (
                  <img
                    src={sampleQr}
                    alt=""
                    className="absolute"
                    style={{ left: `${cfg.xPct}%`, top: `${cfg.yPct}%`, width: `${cfg.wPct}%` }}
                  />
                )}
              </>
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Envie a arte para ver a prévia.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
