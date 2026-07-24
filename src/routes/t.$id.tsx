import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { resolveTag } from "@/lib/tags-public.functions";
import { buildDestinationUrl } from "@/lib/destination";

export const Route = createFileRoute("/t/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Redirecionando…" }, { name: "robots", content: "noindex" }] }),
  component: RedirectPage,
});

type Reason =
  | "not_found"
  | "inactive"
  | "scheduled"
  | "expired"
  | "limit_reached"
  | "unclaimed"
  | "password_required"
  | "password_incorrect";

const MESSAGES: Record<
  "not_found" | "inactive" | "scheduled" | "expired" | "limit_reached",
  { title: string; body: string }
> = {
  not_found: { title: "Tag não encontrada", body: "Este endereço não corresponde a nenhuma etiqueta." },
  inactive: { title: "Tag inativa", body: "Esta etiqueta está pausada ou arquivada." },
  scheduled: { title: "Ainda não disponível", body: "Esta etiqueta ainda não foi ativada. Volte mais tarde." },
  expired: { title: "Campanha encerrada", body: "Esta etiqueta expirou e não está mais ativa." },
  limit_reached: { title: "Limite atingido", body: "Esta etiqueta atingiu o número máximo de acessos." },
};

function RedirectPage() {
  const { id } = Route.useParams();
  const [state, setState] = useState<"loading" | "error" | "password" | "unclaimed">("loading");
  const [reason, setReason] = useState<keyof typeof MESSAGES>("not_found");
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const go = async (pw?: string) => {
    // Which medium was used: the NFC tag is written with ?s=nfc, the printed QR
    // keeps the plain URL (kept short on purpose for 3D printing).
    const source = new URLSearchParams(window.location.search).get("s");
    const res = await resolveTag({
      data: { id, referrer: document.referrer || null, password: pw ?? null, source },
    });
    if (res.ok) {
      const target = buildDestinationUrl(res.destination_type, res.destination, id);
      if (target) {
        window.location.replace(target);
        return;
      }
      setReason("not_found");
      setState("error");
      return;
    }
    const r = res.reason as Reason;
    if (r === "password_required") {
      setState("password");
    } else if (r === "password_incorrect") {
      setPwError(true);
      setState("password");
    } else if (r === "unclaimed") {
      setState("unclaimed");
    } else {
      setReason(r);
      setState("error");
    }
  };

  useEffect(() => {
    go().catch(() => {
      setReason("not_found");
      setState("error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setPwError(false);
    await go(password).catch(() => {});
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="text-center max-w-sm w-full">
        {state === "loading" && (
          <div className="flex flex-col items-center gap-6">
            {/* Brand mark with the ring sweeping around it: reads as "opening"
                rather than "waiting", which matters because this screen should
                be gone in a few hundred milliseconds. */}
            <div className="relative grid size-20 place-items-center">
              <div className="absolute inset-0 rounded-2xl border-2 border-primary/15" />
              <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-primary animate-spin [animation-duration:0.9s]" />
              <div className="grid size-12 place-items-center rounded-xl bg-primary text-[13px] font-bold text-primary-foreground">
                3D
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-base font-medium">Abrindo sua etiqueta</p>
              <p className="text-sm text-muted-foreground">Um instante…</p>
            </div>

            <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 rounded-full bg-primary/70 animate-[loadingSlide_1.1s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {state === "password" && (
          <form onSubmit={submitPassword} className="space-y-4">
            <h1 className="text-2xl font-semibold">Conteúdo protegido</h1>
            <p className="text-sm text-muted-foreground">Digite a senha para acessar.</p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center"
              placeholder="Senha"
            />
            {pwError && <p className="text-sm text-destructive">Senha incorreta.</p>}
            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Verificando…" : "Acessar"}
            </button>
          </form>
        )}

        {state === "unclaimed" && (
          <div className="space-y-4">
            <div className="mx-auto size-12 rounded-xl bg-primary/10 grid place-items-center text-2xl">📦</div>
            <h1 className="text-2xl font-semibold">Etiqueta ainda não ativada</h1>
            <p className="text-sm text-muted-foreground">
              Esta peça ainda não foi configurada. Se ela é sua, ative com o código que veio
              na embalagem e escolha para onde ela deve apontar.
            </p>
            <a
              href={`/ativar/${id}`}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Ativar minha etiqueta
            </a>
          </div>
        )}

        {state === "error" && (
          <>
            <h1 className="text-2xl font-semibold">{MESSAGES[reason].title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{MESSAGES[reason].body}</p>
          </>
        )}
      </div>
    </div>
  );
}
