import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Backpack, Download, Printer, FileCode, Box, Boxes } from "lucide-react";
import {
  qrLabelPng, qrLabelSvg, openRoundLabelSheet, openLabelSheetMulti,
  type QrLevel, type LabelShape,
} from "@/lib/round-label";
import { buildQr3mf, buildQr3mfBytes } from "@/lib/qr-3mf";
import { createZip } from "@/lib/zip";
import { adminCreateBatch, adminBatchTags } from "@/lib/admin.functions";
import { createStockTags } from "@/lib/stock.functions";
import { formatClaimCode } from "@/lib/claim-code";
import { supabase } from "@/integrations/supabase/client";
import { pageTitle } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/qr-kids")({
  head: () => ({
    meta: [
      { title: pageTitle("QR Kids") },
      {
        name: "description",
        content:
          "Gere QR ativável e a etiqueta (35×35 mm quadrada ou 26 mm redonda) para o frame da Tag NFC de mochila infantil.",
      },
    ],
  }),
  component: QrKidsPage,
});

const num = (v: string) => parseFloat(v.replace(",", "."));

function QrKidsPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.3dqr.com.br";

  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [url, setUrl] = useState(`${origin}/t/kids`);
  const [level, setLevel] = useState<QrLevel>("Q");
  const [shape, setShape] = useState<LabelShape>("square");
  const [size, setSize] = useState("35");
  const [qty, setQty] = useState("12");
  const [preview, setPreview] = useState("");

  // Inserto 3MF (2 cores)
  const [baseColor, setBaseColor] = useState("#ffffff");
  const [codeColor, setCodeColor] = useState("#111111");
  const [insertQty, setInsertQty] = useState("12");
  const [tmfBusy, setTmfBusy] = useState(false);

  // Produção (admin)
  const [isAdmin, setIsAdmin] = useState(false);
  const [batchName, setBatchName] = useState("QR Kids");
  const [batchQty, setBatchQty] = useState("50");
  const [prodBusy, setProdBusy] = useState(false);

  const sizeMm = Math.min(60, Math.max(10, num(size) || 35));

  const previewUrl = mode === "manual" ? url : `${origin}/t/exemplo`;

  useEffect(() => {
    let alive = true;
    qrLabelPng(previewUrl, level, shape, 600).then((d) => { if (alive) setPreview(d); }).catch(() => {});
    return () => { alive = false; };
  }, [previewUrl, level, shape]);

  /** Links das etiquetas: no modo automático cria tags reais (ativáveis),
   *  uma por etiqueta, como nos demais geradores. */
  const mintUrls = async (count: number): Promise<string[]> => {
    if (mode === "manual") return Array.from({ length: count }, () => url);
    const res = await createStockTags({
      data: { name: "QR Kids", quantity: count, model: "QR Kids" },
    });
    return res.tags.map((t) => `${origin}/t/${t.id}`);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    });
  }, []);

  const downloadPng = async () => {
    try {
      const [link] = await mintUrls(1);
      const data = await qrLabelPng(link, level, shape, 1200);
      triggerDownload(data, `qr-kids-${sizeMm}mm.png`);
      toast.success(mode === "auto" ? `PNG gerado com QR próprio (${link}).` : "PNG gerado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const downloadSvg = async () => {
    try {
      const [link] = await mintUrls(1);
      const svg = qrLabelSvg(link, level, shape, sizeMm);
      const href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      triggerDownload(href, `qr-kids-${sizeMm}mm.svg`, true);
      toast.success(mode === "auto" ? `SVG gerado com QR próprio (${link}).` : "SVG vetorial gerado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const printSheet = async () => {
    try {
      const count = Math.max(1, Math.min(200, Math.floor(num(qty)) || 1));
      const links = await mintUrls(count);
      const pngs = await Promise.all(links.map((l) => qrLabelPng(l, level, shape, 1000)));
      if (mode === "manual") {
        openRoundLabelSheet(pngs[0], sizeMm, count, shape);
      } else {
        openLabelSheetMulti(pngs, sizeMm, shape);
        toast.success(`${count} etiquetas com links únicos.`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Inserto quadrado do QR em 3MF (2 cores) para encaixar no frame.
  const download3mf = async () => {
    setTmfBusy(true);
    try {
      const plate = sizeMm - 0.4; // pequena folga para encaixar no frame
      const count = Math.max(1, Math.min(200, Math.floor(num(insertQty)) || 1));
      const links = await mintUrls(count);
      const baseName = `qr-kids-inserto-${sizeMm}mm`;

      if (count === 1) {
        const blob = await buildQr3mf(links[0], {
          sizeMm: Math.max(8, plate - 4),
          quietZoneMm: 2,
          baseHeightMm: 1.6,
          moduleHeightMm: 1,
          baseColor,
          codeColor,
        });
        const href = URL.createObjectURL(blob);
        triggerDownload(href, `${baseName}.3mf`, true);
        toast.success("Inserto 3MF (2 cores) gerado.");
        return;
      }

      const bytesArr = await Promise.all(
        links.map((link, i) =>
          buildQr3mfBytes(link, {
            sizeMm: Math.max(8, plate - 4),
            quietZoneMm: 2,
            baseHeightMm: 1.6,
            moduleHeightMm: 1,
            baseColor,
            codeColor,
          }).then((data) => ({ name: `${baseName}-${String(i + 1).padStart(3, "0")}.3mf`, data }))
        ),
      );
      const zip = await createZip(bytesArr);
      const href = URL.createObjectURL(zip);
      triggerDownload(href, `${baseName}-x${count}.zip`, true);
      toast.success(`${count} insertos 3MF empacotados em ZIP.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTmfBusy(false);
    }
  };

  // Lote ativável: cria tags sem dono (código de ativação) e exporta as
  // etiquetas + CSV. O comprador ativa escaneando e preenche os dados.
  const generateBatch = async () => {
    setProdBusy(true);
    try {
      const quantity = Math.max(1, Math.min(500, Math.floor(num(batchQty)) || 1));
      const res = await adminCreateBatch({
        data: { name: batchName.trim() || "QR Kids", quantity, model: "QR Kids", slots: 1 },
      });
      const rows = await adminBatchTags({ data: { batchId: res.batchId } });
      // Etiquetas distintas (uma por peça) prontas para inserir no frame.
      const pngs = await Promise.all(rows.map((r) => qrLabelPng(`${origin}/t/${r.id}`, level, shape, 800)));
      openLabelSheetMulti(pngs, sizeMm, shape);
      // CSV com o código de ativação de cada peça.
      const header = "codigo_ativacao,id,url_do_qr";
      const body = rows
        .map((r) => [formatClaimCode(r.claim_code ?? ""), r.id, `${origin}/t/${r.id}`].join(","))
        .join("\n");
      const href = URL.createObjectURL(new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" }));
      triggerDownload(href, `qr-kids-lote-${slug(batchName)}.csv`, true);
      toast.success(`Lote criado: ${res.tags} QR ativáveis. Também aparece em Admin → Lotes.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProdBusy(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
          <Backpack className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">QR Kids</h1>
          <p className="text-sm text-muted-foreground">
            QR ativável e etiquetas para o frame da Tag NFC de mochila infantil.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        A <strong>Tag NFC de mochila</strong> tem um campo para a etiqueta do QR
        (<strong>35×35 mm quadrada</strong> no frame novo, ou 26 mm redonda no antigo). Gere aqui a
        etiqueta, imprima em <strong>tamanho real (100%)</strong> e insira no frame. Para vender,
        gere um <strong>lote ativável</strong> abaixo: o comprador escaneia, ativa e preenche os
        próprios dados.
      </div>

      {/* Configuração comum */}
      <div className="grid gap-6 sm:grid-cols-[1fr_240px] items-start">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[240px_1fr] items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Endereço do QR</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "auto" | "manual")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Criar QR novo (link único)</SelectItem>
                  <SelectItem value="manual">Usar endereço manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "manual" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Destino</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`${origin}/t/...`} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cada etiqueta baixada recebe um <strong>link próprio</strong> ({origin}/t/…), ativável
                pelo cliente ao escanear — igual aos demais geradores.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Formato</Label>
              <Select value={shape} onValueChange={(v) => setShape(v as LabelShape)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Quadrada</SelectItem>
                  <SelectItem value="round">Redonda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tamanho (mm)</Label>
              <Input inputMode="numeric" value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Correção</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as QrLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Baixa (L)</SelectItem>
                  <SelectItem value="M">Média (M)</SelectItem>
                  <SelectItem value="Q">Alta (Q)</SelectItem>
                  <SelectItem value="H">Máxima (H)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Qtd. na folha</Label>
              <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadPng}><Download className="size-4" /> PNG</Button>
            <Button variant="outline" onClick={downloadSvg}><FileCode className="size-4" /> SVG</Button>
            <Button variant="outline" onClick={printSheet}>
              <Printer className="size-4" /> Folha A4 ({sizeMm} mm)
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Prévia ({sizeMm} mm)</Label>
          <div className="grid place-items-center rounded-lg border border-border bg-white p-4">
            {preview ? (
              <img
                src={preview}
                alt="Prévia da etiqueta"
                className={`w-40 h-40 ${shape === "round" ? "rounded-full" : "rounded-md"}`}
              />
            ) : (
              <div className={`w-40 h-40 bg-muted animate-pulse ${shape === "round" ? "rounded-full" : "rounded-md"}`} />
            )}
          </div>
        </div>
      </div>

      {/* Inserto 3MF de 2 cores */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Box className="size-4 text-primary" />
          <div className="font-semibold">Inserto do QR em 3MF (2 cores)</div>
        </div>
        <p className="text-sm text-muted-foreground">
          Em vez de etiqueta de papel, gere o QR como peça impressa para encaixar no frame. Escolha a
          cor do fundo e a cor do código. (A cor da <strong>borda/corpo da mochila</strong> é definida
          no fatiador — o modelo da mochila é uma peça única, sem regiões separadas.)
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <ColorField label="Cor do fundo" value={baseColor} onChange={setBaseColor} />
          <ColorField label="Cor do código" value={codeColor} onChange={setCodeColor} />
          <Button variant="outline" disabled={tmfBusy} onClick={download3mf}>
            <Box className="size-4" /> {tmfBusy ? "Gerando…" : "Baixar inserto 3MF"}
          </Button>
        </div>
      </div>

      {/* Lote ativável (produção) */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-primary" />
          <div className="font-semibold">Lote ativável (para vender)</div>
        </div>
        {isAdmin ? (
          <>
            <p className="text-sm text-muted-foreground">
              Cria peças <strong>sem dono</strong> com código de ativação. O comprador escaneia, ativa
              e preenche os próprios dados. Gera a folha de etiquetas ({sizeMm} mm, {shape === "round" ? "redonda" : "quadrada"})
              e um CSV com os códigos. O lote também aparece em <strong>Admin → Lotes de produção</strong>.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do lote</Label>
                <Input className="w-48" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantidade</Label>
                <Input className="w-28" inputMode="numeric" value={batchQty} onChange={(e) => setBatchQty(e.target.value)} />
              </div>
              <Button disabled={prodBusy} onClick={generateBatch}>
                <Boxes className="size-4" /> {prodBusy ? "Gerando…" : "Gerar lote ativável"}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            A produção de lotes ativáveis é feita por um administrador. Peça para o responsável gerar
            o lote em <strong>Admin → Lotes de produção</strong> (modelo “QR Kids”).
          </p>
        )}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-1"
        />
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "lote";

function triggerDownload(href: string, filename: string, revoke = false) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  if (revoke) URL.revokeObjectURL(href);
}
