import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPublicView } from "@/lib/landing.functions";
import type { LandingButton } from "@/lib/landing.functions";

export const Route = createFileRoute("/t/$id/view")({
  ssr: false,
  head: () => ({ meta: [{ title: "TagFlow" }, { name: "robots", content: "noindex" }] }),
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
  return <LandingView landing={landing} tag={tag} />;
}

function LandingView({
  landing, tag,
}: { landing: NonNullable<Extract<ViewData, { ok: true }>["landing"]> | null; tag: { name: string } }) {
  const title = (landing?.title as string) || tag.name;
  const description = landing?.description as string | null;
  const logoUrl = landing?.logo_url as string | null;
  const imageUrl = landing?.image_url as string | null;
  const rawBtns = landing?.buttons;
  const buttons: LandingButton[] = Array.isArray(rawBtns) ? (rawBtns as LandingButton[]) : [];

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
            {buttons.length === 0 && !description && (
              <p className="text-xs text-muted-foreground">Landing page em construção.</p>
            )}
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-6">Powered by TagFlow</p>
    </div>
  );
}

function PixView({ payload, name }: { payload: Record<string, string>; name: string }) {
  const key = payload.key ?? "";
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-sm">
        <h1 className="text-xl font-semibold">Pagar com PIX</h1>
        <p className="text-sm text-muted-foreground">{name}</p>
        <div className="rounded-lg border border-border bg-muted/50 p-4 font-mono text-sm break-all">{key || "Chave não configurada"}</div>
        <button
          disabled={!key}
          onClick={async () => { await navigator.clipboard.writeText(key); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-50">
          {copied ? "Copiado!" : "Copiar chave PIX"}
        </button>
      </div>
    </div>
  );
}

function WifiView({ payload, name }: { payload: Record<string, string>; name: string }) {
  const ssid = payload.ssid ?? "";
  const password = payload.password ?? "";
  const security = (payload.security ?? "WPA").toUpperCase();
  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-sm">
        <h1 className="text-xl font-semibold">Conectar ao Wi-Fi</h1>
        <p className="text-sm text-muted-foreground">{name}</p>
        <dl className="text-left space-y-2 text-sm">
          <div className="flex justify-between border-b border-border py-2"><dt className="text-muted-foreground">Rede</dt><dd className="font-medium">{ssid}</dd></div>
          <div className="flex justify-between border-b border-border py-2"><dt className="text-muted-foreground">Segurança</dt><dd className="font-medium">{security}</dd></div>
          <div className="flex justify-between py-2"><dt className="text-muted-foreground">Senha</dt><dd className="font-mono">{password}</dd></div>
        </dl>
        <button
          onClick={async () => { await navigator.clipboard.writeText(password); }}
          className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium">
          Copiar senha
        </button>
      </div>
    </div>
  );
}
