import { useState } from "react";
import { buildQrStl } from "@/lib/qr-stl";
import { buildQr3mf } from "@/lib/qr-3mf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Box } from "lucide-react";
import { toast } from "sonner";

type Format = "3mf" | "stl";

/** Parameters + download for the 3D-printable model of a tag's QR code. */
export function Qr3dDownload({ url, filename }: { url: string; filename: string }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("3mf");
  const [sizeMm, setSizeMm] = useState("60");
  const [baseHeightMm, setBaseHeightMm] = useState("2");
  const [moduleHeightMm, setModuleHeightMm] = useState("1.6");
  const [mode, setMode] = useState<"emboss" | "recess">("emboss");
  const [baseColor, setBaseColor] = useState("#ffffff");
  const [codeColor, setCodeColor] = useState("#111111");
  const [busy, setBusy] = useState(false);

  const download = async () => {
    const size = parseFloat(sizeMm.replace(",", "."));
    const base = parseFloat(baseHeightMm.replace(",", "."));
    const mod = parseFloat(moduleHeightMm.replace(",", "."));
    if (!(size > 0) || !(base > 0) || !(mod > 0)) {
      toast.error("Informe medidas válidas em milímetros.");
      return;
    }
    setBusy(true);
    try {
      const opts = {
        sizeMm: size,
        baseHeightMm: base,
        moduleHeightMm: mod,
        recessed: mode === "recess",
      };
      const blob =
        format === "3mf"
          ? await buildQr3mf(url, { ...opts, baseColor, codeColor })
          : buildQrStl(url, opts);

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${filename}.${format}`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success(`Arquivo .${format} gerado.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setOpen((o) => !o)}
      >
        <Box className="size-4" /> Impressão 3D
      </Button>

      {open && (
        <div className="rounded-md border border-border p-3 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Formato</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3mf">3MF · duas cores (AMS/MMU)</SelectItem>
                <SelectItem value="stl">STL · peça única</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Tamanho (mm)</Label>
              <Input className="h-8" inputMode="decimal" value={sizeMm} onChange={(e) => setSizeMm(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Base (mm)</Label>
              <Input className="h-8" inputMode="decimal" value={baseHeightMm} onChange={(e) => setBaseHeightMm(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Altura módulos (mm)</Label>
              <Input className="h-8" inputMode="decimal" value={moduleHeightMm} onChange={(e) => setModuleHeightMm(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modo</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "emboss" | "recess")}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emboss">Relevo</SelectItem>
                  <SelectItem value="recess">Baixo-relevo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {format === "3mf" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Cor da base</Label>
                <input
                  type="color"
                  value={baseColor}
                  onChange={(e) => setBaseColor(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cor do código</Label>
                <input
                  type="color"
                  value={codeColor}
                  onChange={(e) => setCodeColor(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background"
                />
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {format === "3mf" ? (
              <>
                Base e código saem como <strong>dois objetos</strong>, cada um com sua cor —
                é só atribuir o filamento de cada um no fatiador.
              </>
            ) : (
              <>
                Peça única. Para duas cores sem AMS, use <strong>troca de filamento</strong> na
                altura {baseHeightMm} mm — todos os módulos começam nessa camada.
              </>
            )}
          </p>

          <Button type="button" size="sm" className="w-full" disabled={busy} onClick={download}>
            {busy ? "Gerando…" : `Baixar .${format}`}
          </Button>
        </div>
      )}
    </div>
  );
}
