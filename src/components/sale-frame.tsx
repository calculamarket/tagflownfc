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
  perPage: 2 | 3; // 10x15cm frames per A4 (3 = the third one printed rotated)
};

// A physical sticker is 10x15 cm. Fixed so print output is exact regardless of
// the art's own pixel size.
const FRAME_W_MM = 100;
const FRAME_H_MM = 150;

const DEFAULT_CFG: FrameCfg = { frameUrl: "", xPct: 33, yPct: 28, wPct: 52, perPage: 3 };

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
 * Compose each batch QR onto the sale frame (fixed 10x15 cm) and open a
 * print-ready A4 tab, packing as many stickers per sheet as fit.
 *
 * The frame is a foreground <img> (not a CSS background) so it prints without
 * the "background graphics" print option; the QR is absolutely positioned on
 * top by the configured percentages.
 *
 * A4 (21x29,7) fits two 10x15 stickers upright; with perPage=3 a third is laid
 * out rotated 90° at the bottom (the cut sticker is identical).
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

  const cell = (qr: string) =>
    `<img class="bg" src="${esc(cfg.frameUrl)}"/>` +
    `<img class="qr" src="${qr}" style="left:${cfg.xPct}%;top:${cfg.yPct}%;width:${cfg.wPct}%"/>`;

  const qrDataUrls = await Promise.all(
    rows.map((r) =>
      QRCode.toDataURL(`${origin}/t/${r.id}`, { width: 600, margin: 0, errorCorrectionLevel: "M" }),
    ),
  );

  // Group into pages and place each sticker at an exact mm position.
  const perPage = cfg.perPage;
  const pages: string[] = [];
  for (let i = 0; i < qrDataUrls.length; i += perPage) {
    const group = qrDataUrls.slice(i, i + perPage);
    const slots = group.map((qr, j) => {
      if (perPage === 3 && j === 2) {
        // Third sticker: rotated 90° into a 150x100 landscape box at the bottom.
        return `<div class="rotbox"><div class="frame rot">${cell(qr)}</div></div>`;
      }
      const left = j === 0 ? 3 : 107; // two upright columns
      return `<div class="frame up" style="left:${left}mm;top:3mm">${cell(qr)}</div>`;
    });
    pages.push(`<div class="page">${slots.join("")}</div>`);
  }

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Frames 10x15 para impressao</title><style>
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; }
.page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
.frame { position: absolute; width: ${FRAME_W_MM}mm; height: ${FRAME_H_MM}mm; }
.frame .bg { width: 100%; height: 100%; object-fit: contain; display: block; }
.frame .qr { position: absolute; }
.up { }
.rotbox { position: absolute; left: 30mm; top: 155mm; width: ${FRAME_H_MM}mm; height: ${FRAME_W_MM}mm; }
.rot { left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(90deg); transform-origin: center; }
.hint { position: fixed; top: 2mm; left: 2mm; font-family: system-ui, sans-serif; font-size: 10px; color: #999; }
@media print { .hint { display: none; } }
</style></head><body>
<div class="hint">${rows.length} etiquetas 10x15 — Ctrl/Cmd+P para imprimir ou salvar em PDF.</div>
${pages.join("")}
<img src="${esc(cfg.frameUrl)}" style="display:none" onload="setTimeout(function(){window.print();},500)"/>
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

          <div className="space-y-1 w-56">
            <Label className="text-xs">Etiquetas 10×15 por folha A4</Label>
            <Select value={String(cfg.perPage)} onValueChange={(v) => patch({ perPage: Number(v) as 2 | 3 })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 (ambas em pé)</SelectItem>
                <SelectItem value="3">3 (a 3ª sai deitada)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Cada etiqueta sai exatamente 10×15 cm.</p>
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
