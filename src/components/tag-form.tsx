import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertTag, renameTag } from "@/lib/tags.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DESTINATION_LABELS, type DestinationType } from "@/lib/destination";
import { toast } from "sonner";
import { QrCode, Copy, Check } from "lucide-react";
import { TagQrPreview } from "./tag-qr-preview";
import { FileUpload } from "./file-upload";

export type TagFormValues = {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "active" | "paused" | "archived";
  destination_type: DestinationType;
  destination: Record<string, string>;
  qr_style: Record<string, string>;
  max_scans: string;
  activate_at: string;
  expire_at: string;
  access_password: string;
};

export function TagForm({
  initial, editing, onSaved, onRenamed,
}: {
  initial: TagFormValues;
  editing?: boolean;
  onSaved: () => void;
  onRenamed?: (newId: string) => void;
}) {
  const [v, setV] = useState<TagFormValues>(initial);
  const [renaming, setRenaming] = useState(false);
  const [newId, setNewId] = useState(initial.id);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const tagUrl = `${origin}/t/${v.id}`;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(tagUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Endereço copiado");
  };

  const rename = useMutation({
    mutationFn: () => renameTag({ data: { oldId: v.id, newId: newId.trim() } }),
    onSuccess: (res) => {
      const id = res.id;
      toast.success("ID alterado.");
      setV((prev) => ({ ...prev, id }));
      setRenaming(false);
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["tag", v.id] });
      onRenamed?.(id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const save = useMutation({
    mutationFn: () =>
      upsertTag({
        data: {
          id: v.id,
          name: v.name,
          description: v.description,
          category: v.category,
          status: v.status,
          destination_type: v.destination_type,
          destination: v.destination,
          qr_style: v.qr_style,
          max_scans: v.max_scans ? Number(v.max_scans) : null,
          activate_at: v.activate_at ? new Date(v.activate_at).toISOString() : null,
          expire_at: v.expire_at ? new Date(v.expire_at).toISOString() : null,
          access_password: v.access_password || null,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Tag atualizada." : "Tag criada.");
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["tag", v.id] });
      qc.invalidateQueries({ queryKey: ["my-plan"] });
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  const setDest = (k: string, val: string) => setV({ ...v, destination: { ...v.destination, [k]: val } });
  const setQr = (k: string, val: string) => setV({ ...v, qr_style: { ...v.qr_style, [k]: val } });

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className={`grid gap-4 ${editing ? "" : "sm:grid-cols-2"}`}>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="id">ID único</Label>
                <Input id="id" required value={v.id} pattern="[A-Za-z0-9_-]{4,32}"
                  onChange={(e) => setV({ ...v, id: e.target.value })} className="font-mono" />
                <p className="text-xs text-muted-foreground">Letras, números, hífen e underline (4–32).</p>
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat">Categoria</Label>
              <Input id="cat" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={v.status} onValueChange={(x) => setV({ ...v, status: x as TagFormValues["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="archived">Arquivada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição</Label>
            <Textarea id="desc" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="font-medium">Destino</h3>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={v.destination_type} onValueChange={(x) => setV({ ...v, destination_type: x as DestinationType, destination: {} })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(DESTINATION_LABELS) as DestinationType[]).map((k) => (
                  <SelectItem key={k} value={k}>{DESTINATION_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DestinationFields type={v.destination_type} value={v.destination} onChange={setDest} />
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <h3 className="font-medium">Regras de acesso</h3>
            <p className="text-xs text-muted-foreground">Opcional. Controle quando e quantas vezes a tag pode ser acessada.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Limite de escaneamentos</Label>
              <Input inputMode="numeric" placeholder="Sem limite" value={v.max_scans} onChange={(e) => setV({ ...v, max_scans: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Senha de acesso</Label>
              <Input placeholder="Sem senha" value={v.access_password} onChange={(e) => setV({ ...v, access_password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ativar em</Label>
              <Input type="datetime-local" value={v.activate_at} onChange={(e) => setV({ ...v, activate_at: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Expirar em</Label>
              <Input type="datetime-local" value={v.expire_at} onChange={(e) => setV({ ...v, expire_at: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : editing ? "Salvar alterações" : "Criar tag"}
          </Button>
        </div>
      </div>

      <aside className="rounded-lg border border-border bg-card p-5 space-y-3 h-fit">
        <div className="flex items-center gap-2 text-sm font-medium">
          <QrCode className="size-4" /> QR Code
        </div>
        <TagQrPreview id={v.id} style={v.qr_style} downloadable />

        <div className="pt-3 border-t border-border space-y-2">
          <Label className="text-xs">Endereço da etiqueta</Label>
          <p className="text-xs text-muted-foreground">
            Cole este link no app de gravação da etiqueta NFC.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={tagUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="h-8 font-mono text-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={copyUrl} title="Copiar endereço">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        {editing && (
          <div className="pt-3 border-t border-border space-y-2">
            <Label className="text-xs">ID da etiqueta</Label>
            {!renaming ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{v.id}</code>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => { setNewId(v.id); setRenaming(true); }}
                >
                  Alterar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  className="h-8 font-mono text-xs"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="novo-id"
                />
                <p className="text-xs text-destructive">
                  Atenção: etiquetas NFC e QR Codes já gravados com o ID atual deixarão de
                  funcionar. As leituras e regras já existentes são preservadas.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button" size="sm"
                    disabled={rename.isPending || !newId.trim() || newId.trim() === v.id}
                    onClick={() => rename.mutate()}
                  >
                    {rename.isPending ? "Salvando…" : "Salvar ID"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-border space-y-3">
          <div className="text-xs font-medium text-muted-foreground">Personalização</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cor</Label>
              <input
                type="color"
                value={v.qr_style.dark || "#0f172a"}
                onChange={(e) => setQr("dark", e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fundo</Label>
              <input
                type="color"
                value={v.qr_style.light || "#ffffff"}
                onChange={(e) => setQr("light", e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Logo no centro</Label>
            <FileUpload
              value={v.qr_style.logo_url ?? ""}
              onChange={(url) => setQr("logo_url", url)}
              placeholder="https://…/logo.png"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Legenda</Label>
            <Input className="h-8" placeholder="Aponte a câmera" value={v.qr_style.caption ?? ""} onChange={(e) => setQr("caption", e.target.value)} />
          </div>
        </div>
      </aside>
    </form>
  );
}

function DestinationFields({
  type, value, onChange,
}: { type: DestinationType; value: Record<string, string>; onChange: (k: string, v: string) => void }) {
  const url = (
    <div className="space-y-1.5">
      <Label>URL</Label>
      <Input placeholder="https://" value={value.url ?? ""} onChange={(e) => onChange("url", e.target.value)} />
    </div>
  );
  switch (type) {
    case "url":
    case "instagram":
    case "facebook":
    case "tiktok":
    case "youtube":
    case "mercadolivre":
    case "shopee":
    case "amazon":
      return url;
    case "pdf":
      return (
        <div className="space-y-1.5">
          <Label>Arquivo PDF</Label>
          <FileUpload
            value={value.url ?? ""}
            onChange={(u) => onChange("url", u)}
            accept="application/pdf"
            placeholder="https://…/documento.pdf"
            preview="file"
          />
          <p className="text-xs text-muted-foreground">
            Envie o PDF (até 10 MB) ou cole a URL de um arquivo existente.
          </p>
        </div>
      );
    case "whatsapp":
      return (
        <>
          <div className="space-y-1.5">
            <Label>Telefone (com DDI)</Label>
            <Input placeholder="5511999999999" value={value.phone ?? ""} onChange={(e) => onChange("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem (opcional)</Label>
            <Input value={value.message ?? ""} onChange={(e) => onChange("message", e.target.value)} />
          </div>
        </>
      );
    case "phone":
      return (
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input value={value.phone ?? ""} onChange={(e) => onChange("phone", e.target.value)} />
        </div>
      );
    case "email":
      return (
        <>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={value.email ?? ""} onChange={(e) => onChange("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Assunto (opcional)</Label>
            <Input value={value.subject ?? ""} onChange={(e) => onChange("subject", e.target.value)} />
          </div>
        </>
      );
    case "pix":
      return (
        <>
          <div className="space-y-1.5">
            <Label>Chave PIX</Label>
            <Input placeholder="e-mail, CPF/CNPJ, telefone ou aleatória" value={value.key ?? ""} onChange={(e) => onChange("key", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome do recebedor</Label>
              <Input placeholder="Ex.: Loja do João" value={value.merchant_name ?? ""} onChange={(e) => onChange("merchant_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input placeholder="Ex.: SAO PAULO" value={value.city ?? ""} onChange={(e) => onChange("city", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Valor (opcional)</Label>
              <Input inputMode="decimal" placeholder="0,00" value={value.amount ?? ""} onChange={(e) => onChange("amount", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Identificador / txid (opcional)</Label>
              <Input value={value.txid ?? ""} onChange={(e) => onChange("txid", e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Gera QR Code e Copia e Cola escaneáveis no app do banco.</p>
        </>
      );
    case "wifi":
      return (
        <>
          <div className="space-y-1.5">
            <Label>Nome da rede (SSID)</Label>
            <Input value={value.ssid ?? ""} onChange={(e) => onChange("ssid", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Segurança</Label>
              <Select value={value.security ?? "WPA"} onValueChange={(x) => onChange("security", x)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WPA">WPA/WPA2</SelectItem>
                  <SelectItem value="WEP">WEP</SelectItem>
                  <SelectItem value="nopass">Aberta (sem senha)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input
                disabled={(value.security ?? "WPA") === "nopass"}
                value={value.password ?? ""}
                onChange={(e) => onChange("password", e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Gera um QR Code que conecta o celular automaticamente.</p>
        </>
      );
    case "landing_page":
      return <p className="text-sm text-muted-foreground">Configure a landing page personalizada em uma etapa futura.</p>;
    case "vcard":
      return (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={value.first_name ?? ""} onChange={(e) => onChange("first_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Sobrenome</Label>
              <Input value={value.last_name ?? ""} onChange={(e) => onChange("last_name", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input value={value.org ?? ""} onChange={(e) => onChange("org", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={value.title ?? ""} onChange={(e) => onChange("title", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={value.phone ?? ""} onChange={(e) => onChange("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={value.email ?? ""} onChange={(e) => onChange("email", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Site</Label>
            <Input placeholder="https://" value={value.website ?? ""} onChange={(e) => onChange("website", e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Ao escanear, o celular adiciona o contato na agenda.</p>
        </>
      );
    case "review_gate":
      return (
        <>
          <div className="space-y-1.5">
            <Label>Link para avaliação positiva (ex.: Google Reviews)</Label>
            <Input placeholder="https://g.page/…/review" value={value.positive_url ?? ""} onChange={(e) => onChange("positive_url", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail para feedback privado (opcional)</Label>
            <Input type="email" value={value.feedback_email ?? ""} onChange={(e) => onChange("feedback_email", e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Clientes satisfeitos vão para a avaliação; insatisfeitos deixam feedback privado.</p>
        </>
      );
    case "ab_test":
      return (
        <>
          <div className="space-y-1.5">
            <Label>URL A</Label>
            <Input placeholder="https://" value={value.url_a ?? ""} onChange={(e) => onChange("url_a", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>URL B</Label>
            <Input placeholder="https://" value={value.url_b ?? ""} onChange={(e) => onChange("url_b", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>% de tráfego para A (resto vai para B)</Label>
            <Input inputMode="numeric" placeholder="50" value={value.weight_a ?? ""} onChange={(e) => onChange("weight_a", e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">O sistema divide os acessos e registra qual variante foi mostrada.</p>
        </>
      );
  }
}
