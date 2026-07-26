import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPublicView, DEFAULT_LEAD_FORM } from "@/lib/landing.functions";
import type { LandingButton, LeadForm } from "@/lib/landing.functions";
import { submitLead } from "@/lib/leads.functions";
import { QrCanvas } from "@/components/qr-canvas";
import { buildPixPayload, buildWifiPayload, buildVCard } from "@/lib/qr-payloads";
import { normalizeDestinationUrl } from "@/lib/destination";
import { parseLinkItems, defaultLabel, linkItemHref, opensInApp, type LinkItem } from "@/lib/link-menu";
import { parsePromoProducts, formatBRL, promoStatus, type PromoProduct } from "@/lib/promo";

export const Route = createFileRoute("/t/$id_/view")({
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
  if (tag.destination_type === "links") return <LinksView payload={tag.destination} name={tag.name} />;
  if (tag.destination_type === "promo") return <PromoView payload={tag.destination} name={tag.name} />;
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
              <a key={i} href={normalizeDestinationUrl(b.url) || "#"} target="_blank" rel="noreferrer"
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
            {/* Primary action: the visitor is already on their phone, so
                copy-and-paste into the bank app beats scanning our on-screen
                QR with the same phone. */}
            <button
              onClick={async () => { await navigator.clipboard.writeText(brcode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="w-full rounded-md bg-primary text-primary-foreground py-3 text-sm font-semibold">
              {copied ? "✓ Código copiado — cole no seu banco" : "Copiar código PIX (Copia e Cola)"}
            </button>
            <p className="text-xs text-muted-foreground">
              Copie o código e cole na opção <strong>PIX Copia e Cola</strong> do app do seu banco.
            </p>

            <div className="pt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid place-items-center rounded-lg border border-border bg-white p-4">
              <QrCanvas value={brcode} size={200} />
            </div>
            <p className="text-xs text-muted-foreground">
              Escaneie este QR com o app do banco a partir de <strong>outro</strong> aparelho.
            </p>
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
  const positiveUrl = normalizeDestinationUrl(payload.positive_url ?? "");
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

function LinksView({ payload, name }: { payload: Record<string, string>; name: string }) {
  const items = parseLinkItems(payload);
  const title = payload.title || name;
  const [openPix, setOpenPix] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-md mx-auto space-y-3">
        <h1 className="text-center text-xl font-semibold mb-4">{title}</h1>

        {items.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Nenhuma opção configurada ainda.</p>
        )}

        {items.map((item, i) => {
          const label = item.label || defaultLabel(item.type);
          if (item.type === "pix") {
            const open = openPix === i;
            return (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setOpenPix(open ? null : i)}
                  className="w-full px-4 py-3.5 text-sm font-medium flex items-center justify-between hover:bg-accent/50"
                >
                  {label}
                  <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
                </button>
                {open && <InlinePix item={item} />}
              </div>
            );
          }
          const href = linkItemHref(item);
          // App hand-off links (WhatsApp/tel/mailto) open in the same tab so the
          // browser doesn't kill an orphan tab before the app opens.
          const sameTab = opensInApp(item.type);
          return (
            <a
              key={i}
              href={href || undefined}
              target={sameTab ? undefined : "_blank"}
              rel={sameTab ? undefined : "noreferrer"}
              className="block rounded-xl border border-border bg-card px-4 py-3.5 text-center text-sm font-medium hover:bg-accent/50"
            >
              {label}
            </a>
          );
        })}

        <p className="text-center text-xs text-muted-foreground pt-4">Powered by 3D QR</p>
      </div>
    </div>
  );
}

function PromoView({ payload, name }: { payload: Record<string, string>; name: string }) {
  const products = parsePromoProducts(payload);
  const title = payload.title || name;
  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-center text-xl font-semibold">{title}</h1>
        {products.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Nenhuma oferta cadastrada ainda.</p>
        )}
        {products.map((p, i) => (
          <PromoCard key={i} product={p} />
        ))}
        <p className="text-center text-xs text-muted-foreground pt-2">Powered by 3D QR</p>
      </div>
    </div>
  );
}

function PromoCard({ product }: { product: PromoProduct }) {
  const images = (product.images ?? []).filter(Boolean);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const status = promoStatus(product.ends_at);
  const priceFrom = formatBRL(product.price_from);
  const priceTo = formatBRL(product.price_to);
  const ended = status.state === "ended";

  return (
    <div className={`rounded-2xl border border-border bg-card overflow-hidden shadow-sm ${ended ? "opacity-70" : ""}`}>
      {images.length > 0 && (
        <div>
          <img src={images[active]} alt={product.name} className="w-full aspect-square object-cover" />
          {images.length > 1 && (
            <div className="flex justify-center gap-2 py-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`size-2 rounded-full ${i === active ? "bg-primary" : "bg-muted-foreground/30"}`}
                  aria-label={`Foto ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
        <div>
          <h2 className="font-semibold">{product.name}</h2>
          {product.description && (
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{product.description}</p>
          )}
        </div>

        {(priceFrom || priceTo) && (
          <div className="flex items-baseline gap-2">
            {priceFrom && priceTo && <span className="text-sm text-muted-foreground line-through">{priceFrom}</span>}
            <span className="text-2xl font-bold text-primary">{priceTo || priceFrom}</span>
          </div>
        )}

        {product.coupon && !ended && (
          <button
            onClick={async () => { await navigator.clipboard.writeText(product.coupon!); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="w-full rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 py-2.5 text-sm font-semibold text-primary"
          >
            {copied ? "✓ Cupom copiado" : `Cupom: ${product.coupon} · toque para copiar`}
          </button>
        )}

        {status.text && (
          <p className={`text-xs ${ended ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}

function InlinePix({ item }: { item: LinkItem }) {
  const [copied, setCopied] = useState(false);
  const brcode = buildPixPayload({
    key: item.value ?? "",
    name: item.name,
    city: item.city,
    amount: item.amount,
  });
  if (!brcode) {
    return <div className="px-4 pb-4 text-sm text-muted-foreground">Chave PIX não configurada.</div>;
  }
  return (
    <div className="px-4 pb-4 space-y-3 border-t border-border pt-3 text-center">
      <div className="grid place-items-center rounded-lg border border-border bg-white p-3">
        <QrCanvas value={brcode} size={180} />
      </div>
      <button
        onClick={async () => { await navigator.clipboard.writeText(brcode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-semibold"
      >
        {copied ? "✓ Código copiado" : "Copiar código PIX"}
      </button>
      <p className="text-xs text-muted-foreground">Cole no PIX Copia e Cola do seu banco.</p>
    </div>
  );
}
