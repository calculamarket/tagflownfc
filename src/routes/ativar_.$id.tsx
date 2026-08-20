import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { claimByTagId } from "@/lib/claim.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/ativar_/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ativar etiqueta · 3D QR" }, { name: "robots", content: "noindex" }] }),
  component: ActivateByScan,
});

function ActivateByScan() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setChecking(false);
    });
  }, []);

  const activate = async () => {
    setBusy(true);
    try {
      const res = await claimByTagId({ data: { tagId: id } });
      if (res.kind === "kit") {
        toast.success(`${res.model} ativado! Configure cada face.`);
        navigate({ to: "/pecas/$id", params: { id: res.id } });
      } else {
        toast.success("Etiqueta ativada! Agora escolha o que ela vai fazer.");
        navigate({ to: "/configurar/$id", params: { id: res.id } });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Já chegou logado (ex.: acabou de criar a conta)? Ativa sozinho, sem clique.
  useEffect(() => {
    if (!checking && signedIn && !autoTried) {
      setAutoTried(true);
      activate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, signedIn, autoTried]);

  const backHere = `/ativar/${id}`;

  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5 text-center">
        <div className="mx-auto size-12 rounded-xl bg-primary/10 grid place-items-center text-2xl">📦</div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Ativar sua etiqueta</h1>
          <p className="text-sm text-muted-foreground">
            Esta peça ainda não foi configurada. Ative para escolher para onde ela aponta.
          </p>
        </div>

        {checking ? (
          <div className="py-4 grid place-items-center">
            <div className="size-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : signedIn ? (
          <Button className="w-full" disabled={busy} onClick={activate}>
            {busy ? "Ativando…" : "Ativar esta etiqueta"}
          </Button>
        ) : (
          <div className="space-y-3">
            <ol className="list-decimal space-y-2 rounded-lg border border-border bg-muted/40 p-4 pl-7 text-left text-sm text-muted-foreground">
              <li>Crie uma conta rápida — só e-mail e senha, sem burocracia.</li>
              <li>A etiqueta é <strong>ativada na hora</strong> e fica no seu nome.</li>
              <li>
                Escolha o destino e preencha os dados: link, PIX, WhatsApp, cardápio,
                contatos e mais.
              </li>
              <li>Pronto! Para trocar depois, é só editar — <strong>sem regravar nada</strong>.</li>
            </ol>
            <p className="text-sm text-muted-foreground">
              Entre ou crie uma conta grátis para ativar — leva menos de um minuto.
            </p>
            <div className="flex gap-2">
              <Link to="/auth" search={{ mode: "signup", redirect: backHere }} className="flex-1">
                <Button className="w-full">Criar conta</Button>
              </Link>
              <Link to="/auth" search={{ mode: "signin", redirect: backHere }} className="flex-1">
                <Button variant="outline" className="w-full">Entrar</Button>
              </Link>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Recebeu um código de ativação impresso?{" "}
          <Link to="/ativar" className="underline hover:text-foreground">Usar código</Link>
        </p>
      </div>
    </div>
  );
}
