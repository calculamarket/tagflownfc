import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { categoryById, type CategoryId } from "@/lib/categories";
import { BarChart3, QrCode, ScanLine, Tags } from "lucide-react";

/** As únicas categorias oferecidas nesta área de ativação. */
const ATIVAR_IDS: CategoryId[] = ["pet", "kids", "idoso", "redes", "menu", "wifi"];

export const Route = createFileRoute("/ativar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ativar etiqueta · 3D QR" },
      {
        name: "description",
        content:
          "Ative sua etiqueta 3D QR em segundos: escaneie o QR da peça, crie sua conta e escolha o tipo — Pet Tag, QR Kids, QR 65+, Redes Sociais ou Links Inteligentes.",
      },
      { property: "og:title", content: "Ativar etiqueta · 3D QR" },
      {
        property: "og:description",
        content: "Escaneie, crie a conta e ative — sem código de ativação, com analytics em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivatePage,
});

function ActivatePage() {
  const [signedIn, setSignedIn] = useState(false);
  const categories = ATIVAR_IDS.map((id) => categoryById(id)!).filter(Boolean);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/ativar" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
              3D
            </span>
            Ativar etiqueta
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              to="/ativar/analytics"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <BarChart3 className="size-4" /> Analytics
            </Link>
            {signedIn ? (
              <Link
                to="/tags"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Tags className="size-4" /> Minhas etiquetas
              </Link>
            ) : (
              <Link to="/auth" search={{ mode: "signin", redirect: "/ativar" }}>
                <Button variant="outline" size="sm">Entrar</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <ScanLine className="size-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Ative sua etiqueta em menos de um minuto
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Não existe código de ativação. Escaneie o QR Code impresso na peça com a câmera do
            celular, crie sua conta grátis e escolha o que a etiqueta vai mostrar.
          </p>

          <ol className="mx-auto mt-6 grid gap-3 text-left sm:grid-cols-3">
            <Step n={1} title="Escaneie" desc="Aponte a câmera para o QR Code da peça." />
            <Step n={2} title="Crie sua conta" desc="Só e-mail e senha — sem burocracia." />
            <Step n={3} title="Configure" desc="Escolha o tipo e preencha os dados." />
          </ol>

          {!signedIn && (
            <div className="mx-auto mt-6 flex max-w-sm gap-2">
              <Link to="/auth" search={{ mode: "signup", redirect: "/ativar" }} className="flex-1">
                <Button className="w-full">Criar conta grátis</Button>
              </Link>
              <Link to="/auth" search={{ mode: "signin", redirect: "/ativar" }} className="flex-1">
                <Button variant="outline" className="w-full">Já tenho conta</Button>
              </Link>
            </div>
          )}
          {signedIn && (
            <div className="mx-auto mt-6 flex max-w-sm gap-2">
              <Link to="/tags" className="flex-1">
                <Button className="w-full"><Tags className="size-4" /> Minhas etiquetas</Button>
              </Link>
              <Link to="/ativar/analytics" className="flex-1">
                <Button variant="outline" className="w-full">
                  <BarChart3 className="size-4" /> Analytics
                </Button>
              </Link>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">O que sua etiqueta pode ser</h2>
            <p className="text-sm text-muted-foreground">
              Escolha na hora da ativação — e troque quando quiser, sem regravar nada.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((c) => {
              const href = c.id === "pet" ? "/ativar/pet" : "/tags/new";
              const search = c.id === "pet" ? undefined : { category: c.id };
              return (
                <Link
                  key={c.id}
                  to={href}
                  search={search}
                  className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-xl leading-none">{c.icon}</span>
                    {c.label}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.intro ?? "Configure em segundos."}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <QrCode className="mt-0.5 size-5 text-primary" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Já tem conta e escaneou a peça?</p>
              <p>A ativação acontece automaticamente logo após o login.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {n}
        </span>
        {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </li>
  );
}
