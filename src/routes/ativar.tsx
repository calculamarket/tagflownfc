import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { claimTag } from "@/lib/claim.functions";
import { formatClaimCode, normalizeClaimCode } from "@/lib/claim-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/ativar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ativar etiqueta · 3D QR" }] }),
  component: ActivatePage,
});

function ActivatePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setCheckingSession(false);
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (normalizeClaimCode(code).length < 8) {
      toast.error("Digite o código completo que veio na embalagem.");
      return;
    }
    setBusy(true);
    try {
      const res = await claimTag({ data: { code } });
      if (res.kind === "kit") {
        toast.success(`${res.model} ativado! Configure cada face.`);
        navigate({ to: "/pecas/$id", params: { id: res.id } });
      } else {
        toast.success("Etiqueta ativada! Agora escolha o destino.");
        navigate({ to: "/tags/$id", params: { id: res.id } });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto size-12 rounded-xl bg-primary/10 grid place-items-center text-2xl">📦</div>
          <h1 className="text-xl font-semibold">Ativar etiqueta</h1>
          <p className="text-sm text-muted-foreground">
            Digite o código que veio impresso na embalagem da sua peça.
          </p>
        </div>

        {checkingSession ? (
          <div className="py-6 grid place-items-center">
            <div className="size-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : !signedIn ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Para ativar, entre na sua conta ou crie uma — é grátis e leva menos de um minuto.
            </p>
            <div className="flex gap-2">
              <Link to="/auth" search={{ mode: "signup" }} className="flex-1">
                <Button className="w-full">Criar conta</Button>
              </Link>
              <Link to="/auth" className="flex-1">
                <Button variant="outline" className="w-full">Entrar</Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">Código de ativação</Label>
              <Input
                id="code"
                autoFocus
                value={code}
                onChange={(e) => setCode(formatClaimCode(e.target.value))}
                placeholder="XXXXX-XXXXX"
                className="text-center font-mono tracking-widest uppercase"
                maxLength={11}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || !code}>
              {busy ? "Ativando…" : "Ativar etiqueta"}
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Não encontrou o código? Ele fica na etiqueta de papel que acompanha a peça.
        </p>
      </div>
    </div>
  );
}
