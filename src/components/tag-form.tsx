import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertTag } from "@/lib/tags.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DESTINATION_LABELS, type DestinationType } from "@/lib/destination";
import { toast } from "sonner";
import { QrCode } from "lucide-react";
import { TagQrPreview } from "./tag-qr-preview";

export type TagFormValues = {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "active" | "paused" | "archived";
  destination_type: DestinationType;
  destination: Record<string, string>;
  qr_style: Record<string, string>;
};

export function TagForm({
  initial, editing, onSaved,
}: { initial: TagFormValues; editing?: boolean; onSaved: () => void }) {
  const [v, setV] = useState<TagFormValues>(initial);
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: () => upsertTag({ data: v }),
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id">ID único</Label>
              <Input id="id" required value={v.id} readOnly={editing}
                onChange={(e) => setV({ ...v, id: e.target.value })} className="font-mono" />
            </div>
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
        <div className="text-xs text-muted-foreground break-all">
          {typeof window !== "undefined" ? `${window.location.origin}/t/${v.id}` : `/t/${v.id}`}
        </div>

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
            <Label className="text-xs">Logo (URL)</Label>
            <Input className="h-8" placeholder="https://…/logo.png" value={v.qr_style.logo_url ?? ""} onChange={(e) => setQr("logo_url", e.target.value)} />
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
    case "pdf":
    case "mercadolivre":
    case "shopee":
    case "amazon":
      return url;
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
