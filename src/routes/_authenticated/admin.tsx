import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  adminStats, adminListUsers, adminListPlans, adminSetUserPlan,
  adminListBatches, adminCreateBatch, adminBatchTags,
} from "@/lib/admin.functions";
import { formatClaimCode } from "@/lib/claim-code";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Box, Printer, Sticker, CircleDot, Store, Plus, Trash2, FileCode, CreditCard } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  adminListTenants, adminCreateTenant, adminUpdateTenant,
  adminAddTenantMember, adminRemoveTenantMember,
} from "@/lib/tenant.functions";
import QRCode from "qrcode";
import { buildQr3mfBytes } from "@/lib/qr-3mf";
import { createZip } from "@/lib/zip";
import { SaleFramePanel, openFrameSheet } from "@/components/sale-frame";
import { FileUpload } from "@/components/file-upload";
import { buildQrSvgSheet } from "@/lib/qr-svg-sheet";
import { openCr80Sheet, DEFAULT_CR80_PHRASE, type Cr80Orientation } from "@/lib/cr80-card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · 3D QR" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

const KEY_DIAM_LS = "3dqr-keychain-diam-mm";
const SVG_MM_LS = "3dqr-svg-plaque-mm";
const SVG_BORDER_LS = "3dqr-svg-plaque-border";
const CR80_PHRASE_LS = "3dqr-cr80-phrase";
const CR80_ORIENT_LS = "3dqr-cr80-orient";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AdminPage() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminStats() });
  const { data: plans = [] } = useQuery({ queryKey: ["admin-plans"], queryFn: () => adminListPlans() });
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => adminListUsers({ data: { search } }),
    placeholderData: keepPreviousData,
  });

  const setPlan = useMutation({
    mutationFn: (v: { userId: string; planId: string }) => adminSetUserPlan({ data: v }),
    onSuccess: () => {
      toast.success("Plano atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">Gestão da plataforma.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Usuários" value={stats?.users} />
        <Stat label="Tags" value={stats?.tags} />
        <Stat label="Leituras totais" value={stats?.reads_total} />
        <Stat label="Leituras hoje" value={stats?.reads_today} />
        <Stat label="Leituras no mês" value={stats?.reads_month} />
        <Stat label="Assinaturas ativas" value={stats?.active_subscriptions} />
        <Stat label="Receita mensal" value={stats ? brl(stats.revenue_cents) : undefined} />
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Distribuição de planos</div>
          <div className="mt-2 space-y-1">
            {(stats?.plan_distribution ?? []).map((p) => (
              <div key={p.name} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{p.name}</span>
                <span className="font-medium">{p.count}</span>
              </div>
            ))}
            {!stats && <div className="text-sm text-muted-foreground">…</div>}
          </div>
        </div>
      </div>

      <TenantsSection />

      <BatchesSection />

      <div className="rounded-lg border border-border bg-card">
        <div className="p-5 border-b border-border flex items-center justify-between gap-4">
          <div className="font-semibold">Usuários</div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome ou e-mail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-left">
                <th className="px-5 py-3 font-medium">Usuário</th>
                <th className="px-5 py-3 font-medium">Tags</th>
                <th className="px-5 py-3 font-medium">Plano</th>
                <th className="px-5 py-3 font-medium">Criado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      {u.is_admin && <Badge variant="secondary">admin</Badge>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{u.tag_count}</td>
                  <td className="px-5 py-3">
                    <Select
                      value={u.plan_id ?? plans.find((p) => p.name === u.plan_name)?.id ?? ""}
                      onValueChange={(planId) => setPlan.mutate({ userId: u.id, planId })}
                    >
                      <SelectTrigger className="h-8 w-36"><SelectValue placeholder={u.plan_name} /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.price_cents > 0 ? `· ${brl(p.price_cents)}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Super-admin console: create/manage resellers (tenants) and their staff. */
function TenantsSection() {
  const qc = useQueryClient();
  const { data: tenants = [] } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => adminListTenants(),
  });

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [monogram, setMonogram] = useState("");
  const [tagline, setTagline] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-tenants"] });

  const create = useMutation({
    mutationFn: () =>
      adminCreateTenant({
        data: { slug: slug.trim().toLowerCase(), name: name.trim(), monogram: monogram.trim(), tagline: tagline.trim() },
      }),
    onSuccess: () => {
      toast.success("Revendedor criado.");
      setSlug(""); setName(""); setMonogram(""); setTagline("");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const togglePowered = useMutation({
    mutationFn: (v: { id: string; powered_by: boolean }) => adminUpdateTenant({ data: v }),
    onSuccess: invalidate,
    onError: (e) => toast.error((e as Error).message),
  });

  const saveAppearance = useMutation({
    mutationFn: (v: { id: string; primary_color: string | null; logo_url: string | null }) =>
      adminUpdateTenant({ data: v }),
    onSuccess: () => { toast.success("Aparência salva."); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const addMember = useMutation({
    mutationFn: (v: { tenant_id: string; email: string }) =>
      adminAddTenantMember({ data: { tenant_id: v.tenant_id, email: v.email, role: "owner" } }),
    onSuccess: () => { toast.success("Membro adicionado."); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const removeMember = useMutation({
    mutationFn: (id: string) => adminRemoveTenantMember({ data: { id } }),
    onSuccess: () => { toast.success("Membro removido."); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-5 border-b border-border flex items-center gap-2">
        <Store className="size-4 text-primary" />
        <div>
          <div className="font-semibold">Revendedores (white-label)</div>
          <p className="text-sm text-muted-foreground">
            Cada revendedor tem a própria marca e vende para os clientes dele. O usuário precisa se
            cadastrar antes para poder ser adicionado como dono.
          </p>
        </div>
      </div>

      {/* Criar */}
      <div className="p-5 border-b border-border flex flex-wrap items-end gap-3">
        <div className="space-y-1 w-40">
          <Label className="text-xs">Slug (subdomínio)</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="marcadele" />
        </div>
        <div className="space-y-1 flex-1 min-w-40">
          <Label className="text-xs">Nome da marca</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marca do Cliente" />
        </div>
        <div className="space-y-1 w-24">
          <Label className="text-xs">Selo</Label>
          <Input value={monogram} onChange={(e) => setMonogram(e.target.value)} placeholder="MC" maxLength={4} />
        </div>
        <div className="space-y-1 flex-1 min-w-40">
          <Label className="text-xs">Slogan</Label>
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="opcional" />
        </div>
        <Button
          disabled={!slug.trim() || !name.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          <Plus className="size-4" /> {create.isPending ? "Criando…" : "Criar"}
        </Button>
      </div>

      {/* Lista */}
      <div className="divide-y divide-border">
        {tenants.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum revendedor ainda.</p>
        )}
        {tenants.map((t) => (
          <div key={t.id} className="px-5 py-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {t.logo_url ? (
                <img src={t.logo_url} alt="" className="size-8 rounded-md object-contain bg-white shrink-0" />
              ) : (
                <div
                  className="size-8 rounded-md bg-primary grid place-items-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: t.primary_color || undefined }}
                >
                  {t.monogram || "3D"}
                </div>
              )}
              <div className="flex-1 min-w-40">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{t.slug}</span> · {t.tag_count} tags · {t.members.length} membro(s)
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Powered by
                <Switch
                  checked={t.powered_by}
                  onCheckedChange={(v) => togglePowered.mutate({ id: t.id, powered_by: v })}
                />
              </label>
            </div>

            {/* Membros */}
            <div className="pl-11 space-y-2">
              {t.members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{m.role}</Badge>
                  <span className="truncate">{m.email || m.full_name || m.user_id}</span>
                  <Button
                    size="sm" variant="ghost" className="ml-auto"
                    onClick={() => { if (confirm("Remover este membro?")) removeMember.mutate(m.id); }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <AddMemberRow onAdd={(email) => addMember.mutate({ tenant_id: t.id, email })} busy={addMember.isPending} />
            </div>

            <TenantAppearance
              tenant={t}
              busy={saveAppearance.isPending}
              onSave={(primary_color, logo_url) => saveAppearance.mutate({ id: t.id, primary_color, logo_url })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AddMemberRow({ onAdd, busy }: { onAdd: (email: string) => void; busy: boolean }) {
  const [email, setEmail] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Input
        className="h-8 max-w-xs"
        placeholder="e-mail do dono…"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button
        size="sm" variant="outline"
        disabled={!email.trim() || busy}
        onClick={() => { onAdd(email.trim()); setEmail(""); }}
      >
        <Plus className="size-3.5" /> Adicionar dono
      </Button>
    </div>
  );
}

/** Editor de aparência (cor + logo) de um revendedor. */
function TenantAppearance({
  tenant, busy, onSave,
}: {
  tenant: { primary_color: string | null; logo_url: string | null };
  busy: boolean;
  onSave: (primaryColor: string | null, logoUrl: string | null) => void;
}) {
  const [color, setColor] = useState(tenant.primary_color || "");
  const [logo, setLogo] = useState(tenant.logo_url || "");
  return (
    <div className="pl-11 pt-1 space-y-2 border-t border-border/60 mt-1">
      <div className="text-xs font-medium text-muted-foreground pt-2">Aparência (white-label)</div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Cor primária</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color || "#4f46e5"}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-1"
            />
            <Input className="h-9 w-28 font-mono text-xs" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#4f46e5" />
            {color && (
              <Button variant="ghost" size="sm" onClick={() => setColor("")} title="Usar cor padrão">limpar</Button>
            )}
          </div>
        </div>
        <div className="space-y-1 w-56">
          <Label className="text-xs">Logo</Label>
          <FileUpload value={logo} onChange={setLogo} placeholder="URL do logo" />
        </div>
        <Button size="sm" disabled={busy} onClick={() => onSave(color.trim() || null, logo.trim() || null)}>
          {busy ? "Salvando…" : "Salvar aparência"}
        </Button>
      </div>
    </div>
  );
}

/** Production batches: generate unclaimed pieces and export them for printing. */
function BatchesSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("50");
  const [model, setModel] = useState("Placa");
  const [slots, setSlots] = useState("1");

  // Presets match the printed products; "Totem" leaves the count free.
  const MODELS = [
    { label: "Placa (1 QR)", model: "Placa", slots: 1 },
    { label: "Triângulo (3 QR)", model: "Triângulo", slots: 3 },
    { label: "Cubo (6 QR)", model: "Cubo", slots: 6 },
    { label: "Totem (personalizado)", model: "Totem", slots: 0 },
  ];

  const { data: batches = [] } = useQuery({
    queryKey: ["admin-batches"],
    queryFn: () => adminListBatches(),
  });

  const create = useMutation({
    mutationFn: () =>
      adminCreateBatch({
        data: {
          name: name.trim(),
          quantity: Number(quantity),
          model,
          slots: Math.max(1, Number(slots) || 1),
        },
      }),
    onSuccess: (res) => {
      toast.success(`Lote criado: ${res.kits} peças, ${res.tags} QR Codes.`);
      setName("");
      qc.invalidateQueries({ queryKey: ["admin-batches"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [modelsBusy, setModelsBusy] = useState<string | null>(null);
  const [sheetBusy, setSheetBusy] = useState<string | null>(null);
  const [frameBusy, setFrameBusy] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState<string | null>(null);
  // NFC keychain label diameter, in mm. Persisted so it survives sessions. Default 2,5 cm.
  const [keyDiam, setKeyDiam] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem(KEY_DIAM_LS)) || "25",
  );
  const setKeyDiamPersist = (v: string) => {
    setKeyDiam(v);
    try { localStorage.setItem(KEY_DIAM_LS, v); } catch {}
  };

  const [svgBusy, setSvgBusy] = useState<string | null>(null);
  // SVG plaque config for 3D printing. Persisted.
  const [svgMm, setSvgMm] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem(SVG_MM_LS)) || "30",
  );
  const [svgBorder, setSvgBorder] = useState(
    () => (typeof window === "undefined" ? true : localStorage.getItem(SVG_BORDER_LS) !== "0"),
  );
  const setSvgMmPersist = (v: string) => {
    setSvgMm(v);
    try { localStorage.setItem(SVG_MM_LS, v); } catch {}
  };
  const setSvgBorderPersist = (v: boolean) => {
    setSvgBorder(v);
    try { localStorage.setItem(SVG_BORDER_LS, v ? "1" : "0"); } catch {}
  };

  const [cr80Busy, setCr80Busy] = useState<string | null>(null);
  const [cr80Phrase, setCr80Phrase] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem(CR80_PHRASE_LS)) || DEFAULT_CR80_PHRASE,
  );
  const setCr80PhrasePersist = (v: string) => {
    setCr80Phrase(v);
    try { localStorage.setItem(CR80_PHRASE_LS, v); } catch {}
  };
  const [cr80Orient, setCr80Orient] = useState<Cr80Orientation>(
    () =>
      (typeof window !== "undefined" && localStorage.getItem(CR80_ORIENT_LS) === "landscape"
        ? "landscape"
        : "portrait"),
  );
  const setCr80OrientPersist = (v: Cr80Orientation) => {
    setCr80Orient(v);
    try { localStorage.setItem(CR80_ORIENT_LS, v); } catch {}
  };

  /** Folha A4 de cartões CR80 (QR + NFC + frase) para imprimir. */
  const exportCr80 = async (batchId: string) => {
    setCr80Busy(batchId);
    try {
      const rows = await adminBatchTags({ data: { batchId } });
      if (rows.length === 0) { toast.error("Lote sem QR Codes."); return; }
      await openCr80Sheet(rows, window.location.origin, { phrase: cr80Phrase, orientation: cr80Orient });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCr80Busy(null);
    }
  };

  /** Folha SVG vetorial (plaquinhas) para impressão 3D — um arquivo com o lote. */
  const exportSvgSheet = async (batchId: string, batchName: string) => {
    setSvgBusy(batchId);
    try {
      const rows = await adminBatchTags({ data: { batchId } });
      if (rows.length === 0) { toast.error("Lote sem QR Codes."); return; }
      const mm = Math.min(120, Math.max(10, Number(svgMm) || 30));
      const svg = buildQrSvgSheet(rows, window.location.origin, {
        qrMm: mm,
        border: svgBorder,
        columns: 5,
      });
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `plaquinhas-${slug(batchName)}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} plaquinhas exportadas em SVG.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSvgBusy(null);
    }
  };

  /** A4 sheet with each batch QR composed onto the sale frame art. */
  const exportFrames = async (batchId: string) => {
    setFrameBusy(batchId);
    try {
      const rows = await adminBatchTags({ data: { batchId } });
      await openFrameSheet(rows, window.location.origin);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFrameBusy(null);
    }
  };

  const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

  /**
   * Printable sheet: a grid of QR images (one per QR of the batch) opened in a
   * new tab that auto-triggers print. From there the browser can print on paper
   * / adhesive labels or "save as PDF". Each QR encodes the same URL as the
   * physical piece, so a printed sticker behaves exactly like the 3D part.
   */
  const printSheet = async (batchId: string, batchName: string) => {
    setSheetBusy(batchId);
    try {
      const rows = await adminBatchTags({ data: { batchId } });
      const origin = window.location.origin;
      const cells = await Promise.all(
        rows.map(async (r) => {
          const dataUrl = await QRCode.toDataURL(`${origin}/t/${r.id}`, {
            width: 300,
            margin: 1,
            errorCorrectionLevel: "M",
          });
          const label =
            r.kit_number != null
              ? `Peça ${r.kit_number}${r.slot != null ? ` · F${r.slot}` : ""}`
              : "";
          return `<div class="cell"><img src="${dataUrl}" alt=""/><div class="id">${esc(r.id)}</div>${
            label ? `<div class="lbl">${esc(label)}</div>` : ""
          }</div>`;
        }),
      );

      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>QR ${esc(batchName)}</title><style>
@page { margin: 8mm; }
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; margin: 0; color: #111; }
.head { padding: 6mm 6mm 0; font-size: 12px; color: #555; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6mm; padding: 6mm; }
.cell { text-align: center; page-break-inside: avoid; border: 1px solid #e5e5e5;
  border-radius: 6px; padding: 3mm; }
.cell img { width: 100%; height: auto; display: block; }
.id { font-family: ui-monospace, monospace; font-size: 10px; margin-top: 1.5mm; }
.lbl { font-size: 9px; color: #666; }
@media print { .no-print { display: none; } }
</style></head><body>
<div class="head no-print">${rows.length} QR Codes — use Ctrl/Cmd+P para imprimir ou salvar em PDF.</div>
<div class="grid">${cells.join("")}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;

      const w = window.open("", "_blank");
      if (!w) {
        toast.error("Permita pop-ups para abrir a folha de impressão.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSheetBusy(null);
    }
  };

  /**
   * A4 sheet of round cut-outs sized for NFC keychain labels (default Ø 2,5 cm).
   * Each cell is a dashed circle the exact diameter of the label with the QR
   * centered inside (~72% of the diameter, so the square fits within the round
   * area). Cells are inline-block so the browser packs the maximum per sheet and
   * paginates automatically across A4 pages.
   */
  const printKeychainSheet = async (batchId: string, batchName: string) => {
    setKeyBusy(batchId);
    try {
      const rows = await adminBatchTags({ data: { batchId } });
      const origin = window.location.origin;
      const d = Math.min(80, Math.max(10, Number(keyDiam) || 25)); // diameter mm
      const qrSide = +(d * 0.72).toFixed(2); // square QR that fits in the circle

      const cells = await Promise.all(
        rows.map(async (r) => {
          const dataUrl = await QRCode.toDataURL(`${origin}/t/${r.id}`, {
            width: 400,
            margin: 0,
            errorCorrectionLevel: "M",
          });
          return `<span class="cell"><span class="circle"><img src="${dataUrl}" alt=""/></span></span>`;
        }),
      );

      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Chaveiros ${esc(batchName)}</title><style>
@page { size: A4 portrait; margin: 6mm; }
* { box-sizing: border-box; }
body { margin: 0; }
.head { font-family: system-ui, sans-serif; font-size: 12px; color: #555; padding: 0 0 4mm; }
.wrap { font-size: 0; }
.cell { display: inline-block; width: ${d}mm; height: ${d}mm; margin: 1mm; vertical-align: top;
  page-break-inside: avoid; }
.circle { width: 100%; height: 100%; border-radius: 50%; border: 0.2mm dashed #c8c8c8;
  display: flex; align-items: center; justify-content: center; }
.circle img { width: ${qrSide}mm; height: ${qrSide}mm; display: block; }
@media print { .no-print { display: none; } }
</style></head><body>
<div class="head no-print">${rows.length} QR Codes · Ø ${d} mm — Ctrl/Cmd+P para imprimir ou salvar em PDF. A linha tracejada é só guia de corte.</div>
<div class="wrap">${cells.join("")}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;

      const w = window.open("", "_blank");
      if (!w) {
        toast.error("Permita pop-ups para abrir a folha de impressão.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setKeyBusy(null);
    }
  };

  /** One .3mf per piece of the batch, zipped. Each QR encodes its own URL, so
   *  production needs a distinct model per piece. */
  const exportModels = async (batchId: string, batchName: string) => {
    setModelsBusy(batchId);
    try {
      const rows = await adminBatchTags({ data: { batchId } });
      const origin = window.location.origin;
      const entries = [];
      for (const r of rows) {
        const bytes = await buildQr3mfBytes(`${origin}/t/${r.id}`, {
          sizeMm: 60,
          baseHeightMm: 2,
          moduleHeightMm: 1.6,
          baseColor: "#ffffff",
          codeColor: "#111111",
        });
        // Group by piece so the print queue mirrors what gets assembled.
        const folder = r.kit_number ? `peca-${String(r.kit_number).padStart(3, "0")}/` : "";
        const face = r.slot != null ? `face-${r.slot}-` : "";
        entries.push({ name: `${folder}${face}${r.id}.3mf`, data: bytes });
      }
      const zip = await createZip(entries);
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modelos-${slug(batchName)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${entries.length} modelos gerados.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setModelsBusy(null);
    }
  };

  const exportCsv = async (batchId: string, batchName: string) => {
    try {
      const rows = await adminBatchTags({ data: { batchId } });
      const origin = window.location.origin;
      // One row per QR. Pieces with several faces repeat the same activation
      // code, since the customer receives a single code per piece.
      const header = "peca,modelo,face,id,codigo_ativacao,url_do_qr,ativada_em";
      const body = rows
        .map((r) =>
          [
            r.kit_number ?? "",
            r.model ?? "",
            r.slot_label ?? (r.slot != null ? `Face ${r.slot}` : ""),
            r.id,
            formatClaimCode(r.claim_code ?? ""),
            `${origin}/t/${r.id}`,
            r.claimed_at ?? "",
          ].join(","),
        )
        .join("\n");
      const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lote-${batchName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-5 border-b border-border">
        <div className="font-semibold">Lotes de produção</div>
        <p className="text-sm text-muted-foreground">
          Gere peças sem dono com código de ativação e exporte o CSV para a impressão.
        </p>
      </div>

      <div className="p-5 border-b border-border flex flex-wrap items-end gap-3">
        <div className="space-y-1 flex-1 min-w-48">
          <Label className="text-xs">Nome do lote</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Lote Janeiro" />
        </div>
        <div className="space-y-1 w-48">
          <Label className="text-xs">Modelo</Label>
          <Select
            value={model}
            onValueChange={(m) => {
              setModel(m);
              const preset = MODELS.find((x) => x.model === m);
              if (preset && preset.slots > 0) setSlots(String(preset.slots));
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.model} value={m.model}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 w-28">
          <Label className="text-xs">QRs por peça</Label>
          <Input inputMode="numeric" value={slots} onChange={(e) => setSlots(e.target.value)} />
        </div>
        <div className="space-y-1 w-28">
          <Label className="text-xs">Peças</Label>
          <Input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <Button
          disabled={!name.trim() || !(Number(quantity) > 0) || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Gerando…" : "Gerar lote"}
        </Button>
      </div>

      <div className="p-5 border-b border-border">
        <SaleFramePanel />
      </div>

      <div className="px-5 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <Label className="text-xs">Diâmetro do chaveiro (mm)</Label>
        <Input
          className="w-24 h-8"
          inputMode="numeric"
          value={keyDiam}
          onChange={(e) => setKeyDiamPersist(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          usado na “Folha Chaveiro” — etiqueta NFC redonda (padrão 25 mm = 2,5 cm)
        </span>
      </div>

      <div className="px-5 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <Label className="text-xs">Plaquinha SVG 3D — tamanho do QR (mm)</Label>
        <Input
          className="w-24 h-8"
          inputMode="numeric"
          value={svgMm}
          onChange={(e) => setSvgMmPersist(e.target.value)}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
          <Switch checked={svgBorder} onCheckedChange={setSvgBorderPersist} />
          contorno da plaquinha
        </label>
        <span className="text-xs text-muted-foreground">
          usado na “Folha SVG (3D)” — vetor em mm para importar no CAD/slicer
        </span>
      </div>

      <div className="px-5 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <Label className="text-xs whitespace-nowrap">Frase do cartão CR80</Label>
        <Input
          className="h-8 min-w-64 flex-1"
          value={cr80Phrase}
          onChange={(e) => setCr80PhrasePersist(e.target.value)}
          placeholder={DEFAULT_CR80_PHRASE}
        />
        <Select value={cr80Orient} onValueChange={(v) => setCr80OrientPersist(v as Cr80Orientation)}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="portrait">Vertical (retrato)</SelectItem>
            <SelectItem value="landscape">Horizontal (paisagem)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          usado no “Cartão CR80” — tamanho de cartão de crédito (85,6 × 54 mm)
        </span>
      </div>

      <div className="divide-y divide-border">
        {batches.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum lote ainda.</p>
        )}
        {batches.map((b) => (
          <div key={b.id} className="px-5 py-3 flex flex-wrap items-center gap-2 text-sm">
            <div className="flex-1 min-w-40">
              <div className="font-medium truncate">{b.name}</div>
              <div className="text-xs text-muted-foreground">
                {b.model ?? "Peça"}
                {b.slots && b.slots > 1 ? ` · ${b.slots} QR cada` : ""} · {b.quantity} peças ·{" "}
                {b.claimed} ativadas · {new Date(b.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <Button
              variant="outline" size="sm"
              disabled={frameBusy === b.id}
              onClick={() => exportFrames(b.id)}
              title="Folha A4 com os QR dentro da arte de venda"
            >
              <Sticker className="size-4" /> {frameBusy === b.id ? "Gerando…" : "Frame A4"}
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={sheetBusy === b.id}
              onClick={() => printSheet(b.id, b.name)}
              title="Folha com todos os QR Codes para imprimir de uma vez"
            >
              <Printer className="size-4" /> {sheetBusy === b.id ? "Gerando…" : "Folha QR"}
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={keyBusy === b.id}
              onClick={() => printKeychainSheet(b.id, b.name)}
              title={`Folha A4 de QR redondos para chaveiros NFC (Ø ${keyDiam} mm)`}
            >
              <CircleDot className="size-4" /> {keyBusy === b.id ? "Gerando…" : "Folha Chaveiro"}
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={cr80Busy === b.id}
              onClick={() => exportCr80(b.id)}
              title="Folha A4 de cartões CR80 (QR + NFC + frase)"
            >
              <CreditCard className="size-4" /> {cr80Busy === b.id ? "Gerando…" : "Cartão CR80"}
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={modelsBusy === b.id}
              onClick={() => exportModels(b.id, b.name)}
              title="Um .3mf por peça, prontos para o fatiador"
            >
              <Box className="size-4" /> {modelsBusy === b.id ? "Gerando…" : "Modelos 3D"}
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={svgBusy === b.id}
              onClick={() => exportSvgSheet(b.id, b.name)}
              title="Folha SVG vetorial (plaquinhas) para importar no CAD/slicer e extrudar"
            >
              <FileCode className="size-4" /> {svgBusy === b.id ? "Gerando…" : "Folha SVG (3D)"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(b.id, b.name)}>
              <Download className="size-4" /> CSV
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold mt-2">{value ?? "…"}</div>
    </div>
  );
}
