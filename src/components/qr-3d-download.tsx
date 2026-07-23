import { useState } from "react";
import { downloadQrStl } from "@/lib/qr-stl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Box } from "lucide-react";
import { toast } from "sonner";

/** Parameters + download button for the 3D-printable STL of a tag's QR code. */
export function Qr3dDownload({ url, filename }: { url: string; filename: string }) {
  const [open, setOpen] = useState(false);
  const [sizeMm, setSizeMm] = useState("60");
  const [baseHeightMm, setBaseHeightMm] = useState("2");
  const [moduleHeightMm, setModuleHeightMm] = useState("1.6");
  const [mode, setMode] = useState<"emboss" | "recess">("emboss");
  const [busy, setBusy] = useState(false);

  const download = () => {
    const size = parseFloat(sizeMm.replace(",", "."));
    const base = parseFloat(baseHeightMm.replace(",", "."));
    const mod = parseFloat(moduleHeightMm.replace(",", "."));
    if (!(size > 0) || !(base > 0) || !(mod > 0)) {
      toast.error("Informe medidas válidas em milímetros.");
      return;
    }
    setBusy(true);
    try {
      downloadQrStl(url, filename, {
        sizeMm: size,
        baseHeightMm: base,
        moduleHeightMm: mod,
        recessed: mode === "recess",
      });
      toast.success("Arquivo .stl gerado.");
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

          <p className="text-xs text-muted-foreground">
            Para o QR ser lido, imprima em duas cores (base clara, módulos escuros). Só o
            relevo costuma não dar contraste suficiente.
          </p>

          <Button type="button" size="sm" className="w-full" disabled={busy} onClick={download}>
            {busy ? "Gerando…" : "Baixar .stl"}
          </Button>
        </div>
      )}
    </div>
  );
}
