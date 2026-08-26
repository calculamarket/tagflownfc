import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/ativar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ativar etiqueta · 3D QR" },
      {
        name: "description",
        content:
          "Ative sua etiqueta 3D QR em segundos: escaneie o QR da peça, crie sua conta e escolha o destino.",
      },
      { property: "og:title", content: "Ativar etiqueta · 3D QR" },
      {
        property: "og:description",
        content: "Escaneie, crie a conta e pronto — sem código de ativação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivatePage,
});

function ActivatePage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto size-12 rounded-xl bg-primary/10 grid place-items-center text-2xl">
            📷
          </div>
          <h1 className="text-xl font-semibold">Ativar etiqueta</h1>
          <p className="text-sm text-muted-foreground">
            Não existe código de ativação. Basta escanear o QR Code da sua peça com a
            câmera do celular.
          </p>
        </div>

        <ol className="list-decimal space-y-2 rounded-lg border border-border bg-muted/40 p-4 pl-7 text-left text-sm text-muted-foreground">
          <li>Escaneie o QR Code impresso na peça.</li>
          <li>Crie sua conta grátis (ou entre, se já tiver uma).</li>
          <li>A etiqueta é ativada na hora e fica no seu nome.</li>
          <li>Escolha o destino: link, PIX, WhatsApp, cardápio, contatos e mais.</li>
        </ol>

        {signedIn ? (
          <Link to="/dashboard">
            <Button className="w-full">Ir para o painel</Button>
          </Link>
        ) : (
          <div className="flex gap-2">
            <Link to="/auth" search={{ mode: "signup" }} className="flex-1">
              <Button className="w-full">Criar conta</Button>
            </Link>
            <Link to="/auth" search={{ mode: "signin" }} className="flex-1">
              <Button variant="outline" className="w-full">
                Entrar
              </Button>
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Já tem conta e escaneou a peça? A ativação acontece automaticamente após o
          login.
        </p>
      </div>
    </div>
  );
}
