import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Download, QrCode as QrIcon } from "lucide-react";
import {
  buildPixPlate3mf,
  buildPixPlateGeometry,
  buildPixPlateStl,
  type PixPlateOptions,
  type ReliefMask,
} from "@/lib/pix-plate-3d";
import { imageToMask, maskToDataUrl, textToMask } from "@/lib/relief-raster";
import { buildPixPayload } from "@/lib/qr-payloads";
import { MaterialSlotFields, SlotCountField } from "@/components/material-slots";
import type { MaterialSlot } from "@/lib/three-mf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/placa-pix")({
  head: () => ({
    meta: [
      { title: "Placa Pix 3D · 3D QR" },
      {
        name: "description",
        content:
          "Gere a placa de balcão com QR Code Pix e base inclinada, escolha as cores de cada parte e adicione logotipo, imagem ou texto.",
      },
      { property: "og:title", content: "Placa Pix 3D · 3D QR" },
      {
        property: "og:description",
        content:
          "Placa Pix parametrizável: QR do Pix em relevo, área livre para logotipo e base com encaixe inclinado, em 3MF multicor ou STL.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PixPlatePage,
});

const num = (v: string) => parseFloat(v.replace(",", "."));
type Level = "L" | "M" | "Q" | "H";

function PixPlatePage() {
  // Conteúdo do QR
  const [source, setSource] = useState<"pix" | "livre">("pix");
  const [pixKey, setPixKey] = useState("");
  const [pixName, setPixName] = useState("");
  const [pixCity, setPixCity] = useState("");
  const [pixAmount, setPixAmount] = useState("");
  const [freeText, setFreeText] = useState("https://www.3dqr.com.br");
  const [level, setLevel] = useState<Level>("Q");

  // Placa
  const [plateWidthMm, setPlateWidthMm] = useState("80");
  const [plateHeightMm, setPlateHeightMm] = useState("117");
  const [plateThickMm, setPlateThickMm] = useState("3");
  const [radiusMm, setRadiusMm] = useState("4");
  const [qrSizeMm, setQrSizeMm] = useState("60");
  const [marginMm, setMarginMm] = useState("6");
  const [codeMm, setCodeMm] = useState("1");
  const [qrPosition, setQrPosition] = useState<"bottom" | "top">("bottom");
  const [mode, setMode] = useState<"emboss" | "recess">("emboss");

  // Segundo QR (cardápio, redes sociais, WhatsApp...)
  const [useSecond, setUseSecond] = useState(false);
  const [secondType, setSecondType] = useState<"link" | "whatsapp" | "instagram" | "texto">("link");
  const [secondValue, setSecondValue] = useState("https://www.3dqr.com.br");
  const [secondWhatsMsg, setSecondWhatsMsg] = useState("");
  const [secondQrSizeMm, setSecondQrSizeMm] = useState("34");

  // Área livre (logo / imagem / texto)
  const [artType, setArtType] = useState<"nenhum" | "texto" | "imagem">("texto");
  const [artText, setArtText] = useState("PAGUE COM PIX");
  const [artHeightMm, setArtHeightMm] = useState("1");
  const [artPocket, setArtPocket] = useState(false);
  const [artPocketDepthMm, setArtPocketDepthMm] = useState("0.8");
  const [imageMask, setImageMask] = useState<ReliefMask | null>(null);
  const [imageName, setImageName] = useState("");
  const [invertImage, setInvertImage] = useState(false);

  // Base
  const [includeBase, setIncludeBase] = useState(true);
  const [baseDepthMm, setBaseDepthMm] = useState("76");
  const [baseHeightMm, setBaseHeightMm] = useState("24");
  const [baseWidthMm, setBaseWidthMm] = useState("80");
  const [slotAngleDeg, setSlotAngleDeg] = useState("15");
  const [slotDepthMm, setSlotDepthMm] = useState("14");
  const [slotClearanceMm, setSlotClearanceMm] = useState("0.4");

  // Cores / slots
  const [printerSlots, setPrinterSlots] = useState(4);
  const [plateSlot, setPlateSlot] = useState<MaterialSlot>({ extruder: 1, material: "PLA", color: "#ffffff" });
  const [codeSlot, setCodeSlot] = useState<MaterialSlot>({ extruder: 2, material: "PLA", color: "#111111" });
  const [code2Slot, setCode2Slot] = useState<MaterialSlot>({ extruder: 2, material: "PLA", color: "#111111" });
  const [artSlot, setArtSlot] = useState<MaterialSlot>({ extruder: 3, material: "PLA", color: "#32bcad" });
  const [baseSlot, setBaseSlot] = useState<MaterialSlot>({ extruder: 1, material: "PLA", color: "#ffffff" });


  const [filename, setFilename] = useState("placa-pix");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);

  const payload = useMemo(() => {
    if (source === "livre") return freeText.trim();
    return buildPixPayload({
      key: pixKey,
      name: pixName,
      city: pixCity,
      amount: pixAmount ? num(pixAmount) : null,
    });
  }, [source, freeText, pixKey, pixName, pixCity, pixAmount]);

  const secondPayload = useMemo(() => {
    if (!useSecond) return "";
    const v = secondValue.trim();
    if (!v) return "";
    if (secondType === "whatsapp") {
      const digits = v.replace(/\D/g, "");
      if (!digits) return "";
      const phone = digits.length <= 11 ? `55${digits}` : digits;
      const msg = secondWhatsMsg.trim();
      return `https://wa.me/${phone}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
    }
    if (secondType === "instagram") {
      const handle = v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
      return `https://instagram.com/${handle}`;
    }
    if (secondType === "link") {
      return /^[a-z][\w+.-]*:/i.test(v) ? v : `https://${v}`;
    }
    return v;
  }, [useSecond, secondType, secondValue, secondWhatsMsg]);

  const artMask = useMemo(() => {
    if (artType === "texto") return textToMask(artText);
    if (artType === "imagem") return imageMask;
    return null;
  }, [artType, artText, imageMask]);

  const artPreview = useMemo(
    () => (artMask ? maskToDataUrl(artMask, codeSlot.color, plateSlot.color) : ""),
    [artMask, codeSlot.color, plateSlot.color],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, payload || " ", {
      width: 220,
      margin: 2,
      errorCorrectionLevel: level,
      color: { dark: codeSlot.color, light: plateSlot.color },
    }).catch(() => undefined);
  }, [payload, level, codeSlot.color, plateSlot.color]);

  useEffect(() => {
    const canvas = canvas2Ref.current;
    if (!canvas || !secondPayload) return;
    QRCode.toCanvas(canvas, secondPayload, {
      width: 160,
      margin: 2,
      errorCorrectionLevel: level,
      color: { dark: code2Slot.color, light: plateSlot.color },
    }).catch(() => undefined);
  }, [secondPayload, level, code2Slot.color, plateSlot.color]);

  const options = (): PixPlateOptions => {
    if (!payload) {
      throw new Error(
        source === "pix" ? "Informe a chave Pix." : "Informe o conteúdo do QR Code.",
      );
    }
    if (useSecond && !secondPayload) throw new Error("Informe o conteúdo do segundo QR Code.");
    const values = {
      plateWidthMm: num(plateWidthMm),
      plateHeightMm: num(plateHeightMm),
      plateThickMm: num(plateThickMm),
      radiusMm: num(radiusMm),
      qrSizeMm: num(qrSizeMm),
      marginMm: num(marginMm),
      codeMm: num(codeMm),
      secondQrSizeMm: num(secondQrSizeMm),
      artHeightMm: num(artHeightMm),
      artPocketDepthMm: num(artPocketDepthMm),
      baseDepthMm: num(baseDepthMm),
      baseHeightMm: num(baseHeightMm),
      baseWidthMm: num(baseWidthMm),
      slotAngleDeg: num(slotAngleDeg),
      slotDepthMm: num(slotDepthMm),
      slotClearanceMm: num(slotClearanceMm),
    };
    for (const [key, v] of Object.entries(values)) {
      if (!Number.isFinite(v) || v < 0) throw new Error(`Medida inválida: ${key}.`);
    }
    if (values.plateThickMm < 1.2) throw new Error("A placa precisa ter pelo menos 1,2 mm.");
    if (values.qrSizeMm + 2 * values.marginMm > values.plateWidthMm) {
      throw new Error("O QR é maior que a largura útil da placa.");
    }
    const gap = Math.min(values.marginMm, 6);
    if (
      useSecond &&
      values.qrSizeMm + values.secondQrSizeMm + gap + 2 * values.marginMm >
        values.plateHeightMm
    ) {
      throw new Error("Os dois QR Codes não cabem na altura da placa — reduza um deles.");
    }
    if (useSecond && values.secondQrSizeMm < 18) {
      throw new Error("O segundo QR precisa ter pelo menos 18 mm para ser lido.");
    }
    if (includeBase && values.slotDepthMm + 3 > values.baseHeightMm) {
      throw new Error("O encaixe é fundo demais para a altura da base.");
    }
    return {
      text: payload,
      ...values,
      secondText: useSecond ? secondPayload : null,
      qrPosition,
      errorCorrectionLevel: level,
      recessed: mode === "recess",
      artMask,
      artPocket,
      includeBase,
    };
  };

  const summary = useMemo(() => {
    try {
      const geo = buildPixPlateGeometry(options());
      return {
        plate: `${geo.plateWidthMm.toFixed(0)} × ${geo.plateHeightMm.toFixed(0)} × ${(geo.plateTopZ + num(codeMm)).toFixed(2)} mm`,
        qr: geo.qrSideMm,
        qr2: geo.qr2SideMm,
        maxQr: geo.maxQrSizeMm,
        area: `${geo.artAreaWMm.toFixed(0)} × ${geo.artAreaHMm.toFixed(0)} mm`,
        changeZ: geo.plateTopZ,
      };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    payload, secondPayload, useSecond, secondQrSizeMm, level, plateWidthMm, plateHeightMm,
    plateThickMm, radiusMm, qrSizeMm, marginMm,
    codeMm, qrPosition, mode, artMask, artHeightMm, artPocket, artPocketDepthMm, includeBase,
    baseDepthMm, baseHeightMm, baseWidthMm, slotAngleDeg, slotDepthMm, slotClearanceMm,
  ]);


  const onImage = async (file?: File) => {
    if (!file) return;
    try {
      const mask = await imageToMask(file, { invert: invertImage });
      if (!mask.cols) throw new Error("A imagem ficou vazia — tente uma arte com mais contraste.");
      setImageMask(mask);
      setImageName(file.name);
      setArtType("imagem");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const download = async (format: "3mf" | "stl") => {
    setBusy(true);
    try {
      const opts = options();
      const blob =
        format === "3mf"
          ? await buildPixPlate3mf({ ...opts, plateSlot, codeSlot, code2Slot, artSlot, baseSlot })
          : buildPixPlateStl(opts);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${filename || "placa-pix"}.${format}`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success(`Peça .${format} gerada.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <QrIcon className="size-5 text-primary" /> Placa Pix
        </h1>
        <p className="text-sm text-muted-foreground">
          Placa de balcão com QR Code do Pix em relevo, área livre para logotipo, imagem ou
          texto e base com encaixe inclinado. Cada parte sai em um slot de cor.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Conteúdo</Label>
              <Select value={source} onValueChange={(v) => setSource(v as "pix" | "livre")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix (Copia e Cola)</SelectItem>
                  <SelectItem value="livre">Texto / link livre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Correção de erro</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">L · ~7%</SelectItem>
                  <SelectItem value="M">M · ~15%</SelectItem>
                  <SelectItem value="Q">Q · ~25%</SelectItem>
                  <SelectItem value="H">H · ~30%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {source === "pix" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="chave">Chave Pix</Label>
                <Input id="chave" value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail, telefone ou aleatória" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome do recebedor</Label>
                <Input id="nome" value={pixName} onChange={(e) => setPixName(e.target.value)} placeholder="Loja do Rogerio" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" value={pixCity} onChange={(e) => setPixCity(e.target.value)} placeholder="Sao Paulo" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valor">Valor fixo (opcional)</Label>
                <Input id="valor" inputMode="decimal" value={pixAmount} onChange={(e) => setPixAmount(e.target.value)} placeholder="0,00" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="livre">Conteúdo do QR Code</Label>
              <Textarea id="livre" rows={3} value={freeText} onChange={(e) => setFreeText(e.target.value)} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Largura da placa (mm)</Label>
              <Input id="pw" inputMode="decimal" value={plateWidthMm} onChange={(e) => setPlateWidthMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Altura da placa (mm)</Label>
              <Input id="ph" inputMode="decimal" value={plateHeightMm} onChange={(e) => setPlateHeightMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt">Espessura da placa (mm)</Label>
              <Input id="pt" inputMode="decimal" value={plateThickMm} onChange={(e) => setPlateThickMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr">Raio dos cantos (mm)</Label>
              <Input id="pr" inputMode="decimal" value={radiusMm} onChange={(e) => setRadiusMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qs">Tamanho do QR (mm)</Label>
              <Input id="qs" inputMode="decimal" value={qrSizeMm} onChange={(e) => setQrSizeMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mg">Margem das bordas (mm)</Label>
              <Input id="mg" inputMode="decimal" value={marginMm} onChange={(e) => setMarginMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch">Altura do código (mm)</Label>
              <Input id="ch" inputMode="decimal" value={codeMm} onChange={(e) => setCodeMm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Posição do QR</Label>
              <Select value={qrPosition} onValueChange={(v) => setQrPosition(v as "bottom" | "top")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom">Embaixo (arte em cima)</SelectItem>
                  <SelectItem value="top">Em cima (arte embaixo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Modo do código</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "emboss" | "recess")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emboss">Relevo</SelectItem>
                  <SelectItem value="recess">Baixo-relevo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="segundo-qr">Segundo QR Code (cardápio, redes sociais, WhatsApp)</Label>
              <div className="flex items-center gap-2">
                <Switch id="segundo-qr" checked={useSecond} onCheckedChange={setUseSecond} />
                <span className="text-xs text-muted-foreground">
                  {useSecond ? "Pix + 2º QR" : "Somente Pix"}
                </span>
              </div>
            </div>

            {useSecond && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Tipo do conteúdo</Label>
                    <Select value={secondType} onValueChange={(v) => setSecondType(v as typeof secondType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="link">Link (cardápio, site, catálogo)</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="texto">Texto livre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q2s">Tamanho do 2º QR (mm)</Label>
                    <Input id="q2s" inputMode="decimal" value={secondQrSizeMm} onChange={(e) => setSecondQrSizeMm(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q2v">
                      {secondType === "whatsapp"
                        ? "Número com DDD"
                        : secondType === "instagram"
                          ? "Usuário do Instagram"
                          : secondType === "link"
                            ? "Endereço do link"
                            : "Texto"}
                    </Label>
                    <Input
                      id="q2v"
                      value={secondValue}
                      onChange={(e) => setSecondValue(e.target.value)}
                      placeholder={
                        secondType === "whatsapp"
                          ? "(11) 99999-9999"
                          : secondType === "instagram"
                            ? "@minhaloja"
                            : "https://www.3dqr.com.br/cardapio"
                      }
                    />
                  </div>
                  {secondType === "whatsapp" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="q2m">Mensagem inicial (opcional)</Label>
                      <Input id="q2m" value={secondWhatsMsg} onChange={(e) => setSecondWhatsMsg(e.target.value)} placeholder="Olá! Vim pelo QR do balcão." />
                    </div>
                  )}
                </div>
                {secondPayload && (
                  <p className="break-all text-xs text-muted-foreground">{secondPayload}</p>
                )}
              </>
            )}
          </div>



          <div className="space-y-4 rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <Label>Área livre — logotipo, imagem ou texto</Label>
              <Select value={artType} onValueChange={(v) => setArtType(v as typeof artType)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Deixar vazia</SelectItem>
                  <SelectItem value="texto">Texto</SelectItem>
                  <SelectItem value="imagem">Imagem / logotipo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {artType === "texto" && (
              <div className="space-y-1.5">
                <Label htmlFor="arte-texto">Texto (uma linha por quebra)</Label>
                <Textarea id="arte-texto" rows={2} value={artText} onChange={(e) => setArtText(e.target.value)} />
              </div>
            )}

            {artType === "imagem" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="arte-img">Arquivo (PNG, JPG ou SVG)</Label>
                  <Input id="arte-img" type="file" accept="image/*" onChange={(e) => onImage(e.target.files?.[0])} />
                  {imageName && <p className="text-xs text-muted-foreground">{imageName}</p>}
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <Label htmlFor="inverter">Inverter (arte clara em fundo escuro)</Label>
                  <div className="flex h-9 items-center gap-2">
                    <Switch id="inverter" checked={invertImage} onCheckedChange={setInvertImage} />
                    <span className="text-xs text-muted-foreground">
                      Reenvie o arquivo após alternar.
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ah">Altura do relevo (mm)</Label>
                <Input id="ah" inputMode="decimal" value={artHeightMm} onChange={(e) => setArtHeightMm(e.target.value)} />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <Label htmlFor="rebaixo">Rebaixo para colar arte</Label>
                <div className="flex h-9 items-center gap-2">
                  <Switch id="rebaixo" checked={artPocket} onCheckedChange={setArtPocket} />
                  <span className="text-xs text-muted-foreground">{artPocket ? "Com rebaixo" : "Superfície lisa"}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apd">Profundidade do rebaixo (mm)</Label>
                <Input id="apd" inputMode="decimal" disabled={!artPocket} value={artPocketDepthMm} onChange={(e) => setArtPocketDepthMm(e.target.value)} />
              </div>
            </div>

            {artPreview && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <img src={artPreview} alt="Prévia da arte em relevo" className="mx-auto max-h-24 object-contain" />
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="base">Base com encaixe</Label>
              <div className="flex items-center gap-2">
                <Switch id="base" checked={includeBase} onCheckedChange={setIncludeBase} />
                <span className="text-xs text-muted-foreground">{includeBase ? "Incluir base" : "Só a placa"}</span>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="bw">Largura da base (mm)</Label>
                <Input id="bw" inputMode="decimal" disabled={!includeBase} value={baseWidthMm} onChange={(e) => setBaseWidthMm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bd">Profundidade da base (mm)</Label>
                <Input id="bd" inputMode="decimal" disabled={!includeBase} value={baseDepthMm} onChange={(e) => setBaseDepthMm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bh">Altura da base (mm)</Label>
                <Input id="bh" inputMode="decimal" disabled={!includeBase} value={baseHeightMm} onChange={(e) => setBaseHeightMm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sa">Inclinação do encaixe (°)</Label>
                <Input id="sa" inputMode="decimal" disabled={!includeBase} value={slotAngleDeg} onChange={(e) => setSlotAngleDeg(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sd">Profundidade do encaixe (mm)</Label>
                <Input id="sd" inputMode="decimal" disabled={!includeBase} value={slotDepthMm} onChange={(e) => setSlotDepthMm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc">Folga do encaixe (mm)</Label>
                <Input id="sc" inputMode="decimal" disabled={!includeBase} value={slotClearanceMm} onChange={(e) => setSlotClearanceMm(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <SlotCountField value={printerSlots} onChange={setPrinterSlots} />
            <MaterialSlotFields label="Placa" idPrefix="placa" slots={printerSlots} value={plateSlot} onChange={setPlateSlot} />
            <MaterialSlotFields label="Código" idPrefix="codigo" slots={printerSlots} value={codeSlot} onChange={setCodeSlot} />
            {useSecond && (
              <MaterialSlotFields label="2º QR" idPrefix="codigo2" slots={printerSlots} value={code2Slot} onChange={setCode2Slot} />
            )}
            <MaterialSlotFields label="Arte" idPrefix="arte" slots={printerSlots} value={artSlot} onChange={setArtSlot} />

            <MaterialSlotFields label="Base" idPrefix="base-slot" slots={printerSlots} value={baseSlot} onChange={setBaseSlot} />
            <div className="space-y-1.5">
              <Label htmlFor="arquivo">Nome do arquivo</Label>
              <Input id="arquivo" value={filename} onChange={(e) => setFilename(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => download("3mf")} disabled={busy}>
              <Download className="size-4" /> Baixar 3MF multicor
            </Button>
            <Button variant="outline" onClick={() => download("stl")} disabled={busy}>
              <Download className="size-4" /> Baixar STL
            </Button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-medium">Prévia do QR</h2>
            <canvas ref={canvasRef} className="w-full rounded-md border border-border bg-white" />
            {useSecond && secondPayload && (
              <>
                <p className="text-xs text-muted-foreground">Segundo QR</p>
                <canvas ref={canvas2Ref} className="w-full rounded-md border border-border bg-white" />
              </>
            )}
            {summary ? (
              <dl className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><dt>Placa</dt><dd>{summary.plate}</dd></div>
                <div className="flex justify-between"><dt>QR</dt><dd>{summary.qr.toFixed(1)} mm</dd></div>
                {summary.qr2 > 0 && (
                  <div className="flex justify-between"><dt>2º QR</dt><dd>{summary.qr2.toFixed(1)} mm</dd></div>
                )}
                <div className="flex justify-between"><dt>QR máximo</dt><dd>{summary.maxQr.toFixed(1)} mm</dd></div>

                <div className="flex justify-between"><dt>Área livre</dt><dd>{summary.area}</dd></div>
                <div className="flex justify-between"><dt>Troca de cor em Z</dt><dd>{summary.changeZ.toFixed(2)} mm</dd></div>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">
                Preencha os dados para ver o resumo da peça.
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-5 text-xs text-muted-foreground space-y-2">
            <p>
              A placa e a base saem deitadas na mesa, com o QR para cima — sem suportes. Depois
              é só encaixar a placa na fenda inclinada da base.
            </p>
            <p>
              O modo baixo-relevo é ótimo quando a impressora tem só um bico: imprima a placa
              em cor clara e passe tinta ou uma segunda cor no rebaixo.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
