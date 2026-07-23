import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPublicView, DEFAULT_LEAD_FORM } from "@/lib/landing.functions";
import type { LandingButton, LeadForm } from "@/lib/landing.functions";
import { submitLead } from "@/lib/leads.functions";
import { QrCanvas } from "@/components/qr-canvas";
import { buildPixPayload, buildWifiPayload, buildVCard } from "@/lib/qr-payloads";

export const Route = createFileRoute("/t/$id/view")({
  ssr: false,
  head: () => ({ meta: [{ title: "3D QR" }, { name: "robots", content: "noindex" }] }),
  component: PublicViewPage,
});

type ViewData = Awaited<ReturnType<typeof getPublicView>>;

function PublicViewPage() {
  const { id } = Route.useParams();
  const [state, setState] = useState<"loading" | "not_found" | "ready">("loading");
  const [view, setView] = useState<ViewData | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getPublicView({ data: { id } });
      if (!res.ok) return setState("not_found");
      setView(res);
      setState("ready");
    })().catch(() => setState("not_found"));
  }, [id]);

  if (state === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }
  if (state === "not_found" || !view?.ok) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Esta tag não existe ou está inativa.</p>
        </div>
      </div>
    );
  }

  const { tag, landing } = view;
  if (tag.destination_type === "pix") return <PixView payload={tag.destination} name={tag.name} />;
  if (tag.destination_type === "wifi") return <WifiView payload={tag.destination} name={tag.name} />;
  if (tag.destination_type === "vcard") return <VCardView payload={tag.destination} name={tag.name} />;
  if (tag.destination_type === "review_gate") return <ReviewGateView payload={tag.destination} name={tag.name} />;
  return <LandingView landing={landing} tag={tag} />;
}

function LeadFormBlock({ tagId, config }: { tagId: string; config: LeadForm }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", message: "" });
  const fields = config.fields ?? DEFAULT_LEAD_FORM.fields;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await submitLead({
      data: {
        tag_id: tagId,
        name: fields.name ? f.name : null,
        email: fields.email ? f.email : null,
        phone: fields.phone ? f.phone : null,
        message: fields.message ? f.message : null,
      },
    }).catch(() => ({ ok: false as const }));
    setBusy(false);
    if (res.ok) setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
        {config.success_message || DEFAULT_LEAD_FORM.success_message}
      </div>
    );
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <form onSubmit={submit} className="space-y-2 text-left">
      <p className="text-sm font-medium text-center">
        {config.title || DEFAULT_LEAD_FORM.title}
      </p>
      {fields.name && (
        <input className={input} placeholder="Nome" value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })} />
      )}
      {fields.email && (
        <input className={input} type="email" placeholder="E-mail" value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })} />
      )}
      {fields.phone && (
        <input className={input} placeholder="Telefone" value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })} />
      )}
      {fields.message && (
        <textarea className={input} rows={3} placeholder="Mensagem" value={f.message}
          onChange={(e) => setF({ ...f, message: e.target.value })} />
      )}
      <button type="submit" disabled={busy}
        className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-50">
        {busy ? "Enviando…" : config.button_label || DEFAULT_LEAD_FORM.button_label}
      </button>
    </form>
  );
}

function LandingView({
  landing, tag,
}: {
  landing: NonNullable<Extract<ViewData, { ok: true }>["landing"]> | null;
  tag: { id: string; name: string };
}) {
  const title = (landing?.title as string) || tag.name;
  const description = landing?.description as string | null;
  const logoUrl = landing?.logo_url as string | null;
  const imageUrl = landing?.image_url as string | null;
  const rawBtns = landing?.buttons;
  const buttons: LandingButton[] = Array.isArray(rawBtns) ? (rawBtns as LandingButton[]) : [];
  const leadForm = {
    ...DEFAULT_LEAD_FORM,
    ...((landing?.lead_form ?? {}) as Partial<LeadForm>),
  } as LeadForm;

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-md mx-auto rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {imageUrl && <img src={imageUrl} alt="" className="w-full h-40 object-cover" />}
        <div className="p-6 text-center space-y-4">
          {logoUrl && <img src={logoUrl} alt="" className="mx-auto size-20 rounded-full object-cover border border-border" />}
          <h1 className="text-xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground whitespace-pre-line">{description}</p>}
          <div className="flex flex-col gap-2 pt-2">
            {buttons.map((b, i) => (
              <a key={i} href={b.url} target="_blank" rel="noreferrer"
                className={
                  b.style === "primary"
                    ? "rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90"
                    : "rounded-md border border-border py-2.5 text-sm hover:bg-accent"
                }>{b.label}</a>
            ))}
            {buttons.length === 0 && !description && !leadForm.enabled && (
              <p className="text-xs text-muted-foreground">Landing page em construção.</p>
            )}
          </div>
          {leadForm.enabled && (
            <div className="pt-4 mt-2 border-t border-border">
              <LeadFormBlock tagId={tag.id} config={leadForm} />
            </div>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-6">Powered by 3D QR</p>
    </div>
  );
}

function PixView({ payload, name }: { payload: Record<string, string>; name: string }) {
  const key = payload.key ?? "";
  const [copied, setCopied] = useState(false);
  const brcode = buildPixPayload({
    key,
    name: payload.merchant_name || name,
    city: payload.city,
    amount: payload.amount,
    txid: payload.txid,
  });
  const amountNum = parseFloat((payload.amount ?? "").replace(",", "."));
  const showAmount = !Number.isNaN(amountNum) && amountNum > 0;
  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-sm">
        <h1 className="text-xl font-semibold">Pagar com PIX</h1>
        <p className="text-sm text-muted-foreground">{name}</p>
        {showAmount && (
          <div className="text-2xl font-semibold">
            {amountNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        )}
        {brcode ? (
          <>
            <div className="grid place-items-center rounded-lg border border-border bg-white p-4">
              <QrCanvas value={brcode} size={220} />
            </div>
            <p className="text-xs text-muted-foreground">Escaneie no app do seu banco ou use o Copia e Cola.</p>
            <div className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs break-all text-left">{brcode}</div>
            <button
              onClick={async () => { await navigator.clipboard.writeText(brcode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium">
              {copied ? "Copiado!" : "Copiar código PIX"}
            </button>
          </>
        ) : (
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">Chave PIX não configurada</div>
        )}
      </div>
    </div>
  );
}

function WifiView({ payload, name }: { payload: Record<string, string>; name: string }) {
  const ssid = payload.ssid ?? "";
  const password = payload.password ?? "";
  const security = (payload.security ?? "WPA").toUpperCase();
  const wifi = buildWifiPayload({ ssid, password, security, hidden: payload.hidden === "true" });
  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-sm">
        <h1 className="text-xl font-semibold">Conectar ao Wi-Fi</h1>
        <p className="text-sm text-muted-foreground">{name}</p>
        {wifi && (
          <>
            <div className="grid place-items-center rounded-lg border border-border bg-white p-4">
              <QrCanvas value={wifi} size={200} />
            </div>
            <p className="text-xs text-muted-foreground">
              Aponte a câmera do celular para conectar automaticamente.
            </p>
          </>
        )}
        <dl className="text-left space-y-2 text-sm">
          <div className="flex justify-between border-b border-border py-2"><dt className="text-muted-foreground">Rede</dt><dd className="font-medium">{ssid}</dd></div>
          <div className="flex justify-between border-b border-border py-2"><dt className="text-muted-foreground">Segurança</dt><dd className="font-medium">{security === "NOPASS" ? "Aberta" : security}</dd></div>
          {security !== "NOPASS" && (
            <div className="flex justify-between py-2"><dt className="text-muted-foreground">Senha</dt><dd className="font-mono">{password}</dd></div>
          )}
        </dl>
        {security !== "NOPASS" && (
          <button
            onClick={async () => { await navigator.clipboard.writeText(password); }}
            className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium">
            Copiar senha
          </button>
        )}
      </div>
    </div>
  );
}

function VCardView({ payload, name }: { payload: Record<string, string>; name: string }) {
  const vcard = buildVCard(payload);
  const fullName =
    [payload.first_name, payload.last_name].filter(Boolean).join(" ") || payload.org || name;
  const href = `data:text/vcard;charset=utf-8,${encodeURIComponent(vcard)}`;
  const rows: [string, string | undefined][] = [
    ["Empresa", payload.org],
    ["Cargo", payload.title],
    ["Telefone", payload.phone],
    ["E-mail", payload.email],
    ["Site", payload.website],
  ];
  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-sm">
        <div className="mx-auto size-16 rounded-full bg-primary/10 grid place-items-center text-2xl font-semibold text-primary">
          {fullName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{fullName}</h1>
          {payload.title && <p className="text-sm text-muted-foreground">{payload.title}</p>}
        </div>
        <dl className="text-left space-y-2 text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-border py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium truncate max-w-[60%] text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <a
          href={href}
          download={`${fullName || "contato"}.vcf`}
          className="block w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium"
        >
          Adicionar aos contatos
        </a>
        <div className="grid place-items-center rounded-lg border border-border bg-white p-4">
          <QrCanvas value={vcard} size={180} />
        </div>
        <p className="text-xs text-muted-foreground">Ou escaneie este QR com a câmera.</p>
      </div>
    </div>
  );
}

function ReviewGateView({ payload, name }: { payload: Record<string, string>; name: string }) {
  const [choice, setChoice] = useState<"none" | "happy" | "sad">("none");
  const [message, setMessage] = useState("");
  const positiveUrl = payload.positive_url ?? "";
  const feedbackEmail = payload.feedback_email ?? "";

  const goPositive = () => {
    setChoice("happy");
    if (positiveUrl) window.location.href = positiveUrl;
  };

  const mailto =
    feedbackEmail &&
    `mailto:${feedbackEmail}?subject=${encodeURIComponent(`Feedback: ${name}`)}&body=${encodeURIComponent(message)}`;

  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center space-y-5 shadow-sm">
        <h1 className="text-xl font-semibold">Como foi sua experiência?</h1>
        <p className="text-sm text-muted-foreground">{name}</p>

        {choice === "none" && (
          <div className="flex justify-center gap-4">
            <button onClick={goPositive} className="rounded-xl border border-border px-6 py-4 text-3xl hover:bg-accent">😀</button>
            <button onClick={() => setChoice("sad")} className="rounded-xl border border-border px-6 py-4 text-3xl hover:bg-accent">😞</button>
          </div>
        )}

        {choice === "happy" && !positiveUrl && (
          <p className="text-sm text-muted-foreground">Obrigado pelo seu feedback! 💚</p>
        )}

        {choice === "sad" && (
          <div className="space-y-3 text-left">
            <p className="text-sm text-muted-foreground">Sentimos muito. Conte o que podemos melhorar:</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background p-2 text-sm"
              placeholder="Seu comentário…"
            />
            {mailto ? (
              <a href={mailto} className="block w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium text-center">
                Enviar feedback
              </a>
            ) : (
              <p className="text-xs text-muted-foreground text-center">Obrigado! Seu retorno é muito importante.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
