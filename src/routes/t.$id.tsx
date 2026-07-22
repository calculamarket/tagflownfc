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
  const [state, setState] = useState<"loading" | "error" | "password">("loading");
  const [reason, setReason] = useState<keyof typeof MESSAGES>("not_found");
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const go = async (pw?: string) => {
    const res = await resolveTag({
      data: { id, referrer: document.referrer || null, password: pw ?? null },
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
          <>
            <div className="mx-auto size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="mt-4 text-sm text-muted-foreground">Redirecionando…</p>
          </>
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
