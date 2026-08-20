import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { upsertTag } from "@/lib/tags.functions";
import { buildPixPayload } from "@/lib/qr-payloads";
import type { DestinationType } from "@/lib/destination";
import {
  LINK_ITEM_TYPES, parseLinkItems, itemIcon, type LinkItem, type LinkItemType,
} from "@/lib/link-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { QrCode, Link2, Copy, Check, Download, Plus, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";

type Mode = "choose" | "pix" | "links";

/** Campos preservados no upsert (para não perder config avançada ao salvar). */
export type PreserveFields = {
  description?: string | null;
  category?: string | null;
  max_scans?: number | null;
  activate_at?: string | null;
  expire_at?: string | null;
  access_password?: string | null;
  qr_style?: Record<string, string>;
  status?: "active" | "paused" | "archived";
};

export function SimpleTagConfig({
  id, initialName, editableName, initialType, initialDestination, preserve, newTag = false,
}: {
  id: string;
  initialName: string;
  editableName: boolean;
  initialType: DestinationType;
  initialDestination: Record<string, string>;
  preserve?: PreserveFields;
  /** true na criação: a tag só existe após salvar, então o link avançado
   *  (→ /tags/:id) só aparece depois de salva. */
  newTag?: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [mode, setMode] = useState<Mode>(
    initialType === "pix" ? "pix" : initialType === "links" ? "links" : "choose",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [pixKey, setPixKey] = useState(initialDestination.key ?? "");
  const [pixName, setPixName] = useState(initialDestination.merchant_name ?? "");
  const [pixCity, setPixCity] = useState(initialDestination.city ?? "");
  const [pixAmount, setPixAmount] = useState(initialDestination.amount ?? "");
  const [items, setItems] = useState<LinkItem[]>(
    initialType === "links" ? parseLinkItems(initialDestination) : [],
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const tagUrl = `${origin}/t/${id}`;

  const save = async (destination_type: "pix" | "links", destination: Record<string, string>) => {
    setSaving(true);
    try {
      await upsertTag({
        data: {
          id,
          name: name.trim() || (destination_type === "pix" ? "PIX" : "Menu de links"),
          status: preserve?.status ?? "active",
          destination_type,
          destination,
          qr_style: preserve?.qr_style ?? {},
          description: preserve?.description ?? null,
          category: preserve?.category ?? null,
          max_scans: preserve?.max_scans ?? null,
          activate_at: preserve?.activate_at ?? null,
          expire_at: preserve?.expire_at ?? null,
          access_password: preserve?.access_password ?? null,
        },
      });
      setSaved(true);
      toast.success("Etiqueta salva!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const savePix = () => {
    if (!pixKey.trim()) { toast.error("Informe a chave PIX."); return; }
    save("pix", {
      key: pixKey.trim(), merchant_name: pixName.trim(), city: pixCity.trim(), amount: pixAmount.trim(),
    });
  };
  const saveLinks = () => {
    const clean = items.filter((it) => (it.value ?? "").trim() !== "");
    if (clean.length === 0) { toast.error("Adicione ao menos um link."); return; }
    save("links", { items: JSON.stringify(clean) });
  };

  return (
    <div className="space-y-6">
      {editableName && (
        <div className="space-y-1.5 max-w-sm">
          <Label className="text-xs">Nome da etiqueta (opcional)</Label>
          <Input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="Ex.: PIX da loja" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={mode === "pix"}
          icon={<QrCode className="size-5" />}
          title="Receber PIX"
          desc="Vira uma tela de pagamento PIX. Ideal para cobrar."
          onClick={() => { setMode("pix"); setSaved(false); }}
        />
        <ModeCard
          active={mode === "links"}
          icon={<Link2 className="size-5" />}
          title="Menu de links"
          desc="Uma página com seus links: site, WhatsApp, Instagram…"
          onClick={() => { setMode("links"); setSaved(false); }}
        />
      </div>

      {mode === "pix" && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Chave PIX" value={pixKey} onChange={(v) => { setPixKey(v); setSaved(false); }} placeholder="CPF, e-mail, telefone ou aleatória" />
            <Field label="Nome do recebedor" value={pixName} onChange={(v) => { setPixName(v); setSaved(false); }} placeholder={name || "Sua loja"} />
            <Field label="Cidade" value={pixCity} onChange={(v) => { setPixCity(v); setSaved(false); }} placeholder="SAO PAULO" />
            <Field label="Valor (opcional)" value={pixAmount} onChange={(v) => { setPixAmount(v); setSaved(false); }} placeholder="0,00" />
          </div>
          <Button disabled={saving} onClick={savePix}>{saving ? "Salvando…" : "Salvar PIX"}</Button>
          {saved && pixKey.trim() && (
            <PixResult
              tagUrl={tagUrl}
              brcode={buildPixPayload({ key: pixKey.trim(), name: pixName.trim() || name, city: pixCity.trim(), amount: pixAmount.trim() })}
            />
          )}
        </div>
      )}

      {mode === "links" && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <LinksMiniBuilder items={items} onChange={(i) => { setItems(i); setSaved(false); }} />
          <Button disabled={saving} onClick={saveLinks}>{saving ? "Salvando…" : "Salvar menu de links"}</Button>
          {saved && <SavedLink tagUrl={tagUrl} />}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        {(!newTag || saved) ? (
          <Link to="/tags/$id" params={{ id }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Settings2 className="size-3.5" /> Modo avançado (todos os tipos)
          </Link>
        ) : (
          <span />
        )}
        <Link to="/tags" className="text-xs text-muted-foreground hover:text-foreground">Minhas Tags</Link>
      </div>
    </div>
  );
}

export function ModeCard({ active, icon, title, desc, onClick }: {
  active: boolean; icon: React.ReactNode; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-2 p-4 text-left transition-colors ${
        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        <span className="text-primary">{icon}</span>{title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function LinksMiniBuilder({ items, onChange }: { items: LinkItem[]; onChange: (i: LinkItem[]) => void }) {
  const add = () => onChange([...items, { type: "url", label: "" }]);
  const patch = (i: number, p: Partial<LinkItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const meta = useMemo(() => new Map(LINK_ITEM_TYPES.map((t) => [t.type, t])), []);

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Adicione seus links (site, WhatsApp, Instagram, cardápio…).</p>
      )}
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-6 text-center">{itemIcon(it.type)}</span>
          <Select value={it.type} onValueChange={(v) => patch(i, { type: v as LinkItemType })}>
            <SelectTrigger className="h-9 w-36 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LINK_ITEM_TYPES.map((t) => (
                <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-9 flex-1"
            value={it.value ?? ""}
            onChange={(e) => patch(i, { value: e.target.value })}
            placeholder={meta.get(it.type)?.placeholder ?? "https://…"}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      {items.length < 8 && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" /> Adicionar link
        </Button>
      )}
    </div>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="group flex w-full items-center gap-3 rounded-lg border-2 border-primary/40 bg-primary/5 px-4 py-3 text-left hover:bg-primary/10"
    >
      <span className="flex-1 break-all font-mono text-sm font-medium">{url}</span>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copiado!" : "Copiar"}
      </span>
    </button>
  );
}

function SavedLink({ tagUrl }: { tagUrl: string }) {
  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-4">
      <div className="text-sm font-medium">Pronto! Link da sua etiqueta:</div>
      <CopyLink url={tagUrl} />
    </div>
  );
}

function PixResult({ tagUrl, brcode }: { tagUrl: string; brcode: string }) {
  const [staticQr, setStaticQr] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!brcode) { setStaticQr(""); return; }
    QRCode.toDataURL(brcode, { width: 600, margin: 1, errorCorrectionLevel: "M" }).then(setStaticQr).catch(() => {});
  }, [brcode]);

  const downloadStatic = () => {
    if (!staticQr) return;
    const a = document.createElement("a");
    a.href = staticQr;
    a.download = "qr-pix-estatico.png";
    a.click();
  };

  return (
    <div className="space-y-4 rounded-lg bg-muted/40 p-4">
      <div className="space-y-2">
        <div className="text-sm font-medium">Etiqueta reconfigurável (câmera do celular):</div>
        <CopyLink url={tagUrl} />
        <p className="text-xs text-muted-foreground">Ao escanear com a câmera, cai direto na tela de pagamento PIX.</p>
      </div>
      {brcode && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="text-sm font-medium">QR PIX estático (o app do banco lê direto):</div>
          <div className="flex items-center gap-4">
            {staticQr && <img src={staticQr} alt="QR PIX" className="size-28 rounded bg-white p-1" />}
            <div className="space-y-2">
              <Button variant="outline" size="sm" onClick={downloadStatic}>
                <Download className="size-4" /> Baixar QR PIX
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={async () => { await navigator.clipboard.writeText(brcode); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500); }}
              >
                {copiedCode ? "Código copiado!" : "Copiar código PIX"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Este QR é fixo (chave/valor definidos agora) — imprima para o cliente pagar com o próprio
            app do banco. Ele não muda se você reconfigurar a etiqueta depois.
          </p>
        </div>
      )}
    </div>
  );
}
