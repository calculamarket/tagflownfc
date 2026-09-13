import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  PawPrint, Phone, MessageCircle, MapPin, Shield, Bell, ScanLine,
  ArrowRight, Heart, CheckCircle2, QrCode, User, Mail,
} from "lucide-react";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/ativar_/pet")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pet Tag · Ative a etiqueta do seu pet · 3D QR" },
      {
        name: "description",
        content:
          "Ative sua Pet Tag 3D QR: cadastre os dados do pet e os contatos de emergência. Quem encontrar basta escanear para avisar o tutor.",
      },
      {
        property: "og:title",
        content: "Pet Tag · Ative a etiqueta do seu pet · 3D QR",
      },
      {
        property: "og:description",
        content:
          "Cadastre os dados do pet e os contatos de emergência. Quem encontrar basta escanear para avisar o tutor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PetTagLanding,
});

const benefits = [
  {
    icon: Phone,
    title: "Contato direto",
    desc: "Telefone e WhatsApp do tutor aparecem em destaque para quem encontrar o pet.",
  },
  {
    icon: MessageCircle,
    title: "Aviso rápido",
    desc: "Basta um toque no botão para enviar uma mensagem informando a localização.",
  },
  {
    icon: MapPin,
    title: "Localização",
    desc: "Quem encontrar pode compartilhar onde o pet foi visto, sem instalar nada.",
  },
  {
    icon: Shield,
    title: "Dados seguros",
    desc: "Você escolhe o que mostrar e pode alterar as informações a qualquer momento.",
  },
];

const previewContacts = [
  { icon: Phone, label: "Ligar para o tutor", value: "(11) 99999-9999", primary: true },
  { icon: MessageCircle, label: "Enviar WhatsApp", value: "Avisei que encontrei o Rex!", primary: true },
  { icon: Mail, label: "E-mail do tutor", value: "tutor@email.com", primary: false },
];

function PetTagLanding() {
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setChecking(false);
    });
  }, []);

  const activateTo = signedIn ? "/tags/new?category=pet" : "/auth?mode=signup&redirect=%2Ftags%2Fnew%3Fcategory%3Dpet";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/ativar" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
              3D
            </span>
            Ativar etiqueta
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/ativar"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Voltar
            </Link>
            {signedIn ? (
              <Link to="/tags">
                <Button variant="outline" size="sm">Minhas etiquetas</Button>
              </Link>
            ) : (
              <Link to="/auth" search={{ mode: "signin", redirect: "/ativar/pet" }}>
                <Button variant="outline" size="sm">Entrar</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 space-y-12">
        {/* Hero */}
        <section className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <PawPrint className="size-8" />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Pet Tag
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
            A etiqueta que ajuda o seu pet a voltar para casa. Cadastre os dados dele e os contatos de emergência — quem encontrar basta escanear o QR Code para falar com você.
          </p>

          <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
            {signedIn ? (
              <Link to="/tags/new" search={{ category: "pet" }} className="flex-1">
                <Button className="w-full gap-2 text-base">
                  Ativar Pet Tag
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            ) : (
              <Link
                to="/auth"
                search={{ mode: "signup", redirect: "/tags/new?category=pet" }}
                className="flex-1"
              >
                <Button className="w-full gap-2 text-base">
                  Ativar Pet Tag
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            )}
            <Link to="/ativar" className="flex-1">
              <Button variant="outline" className="w-full">
                Ver outras etiquetas
              </Button>
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Sem código de ativação: escaneie, crie a conta e configure em menos de um minuto.
          </p>
        </section>

        {/* Para o tutor + Para quem encontrar */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Heart className="size-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Para o tutor</h2>
            </div>
            <ul className="mt-5 space-y-3">
              {[
                "Cadastre o nome, foto e características do pet.",
                "Adicione telefone, WhatsApp e e-mail de contato.",
                "Inclua observações importantes: castração, remédios, alergias…",
                "Altere os dados quando quiser, sem reimprimir a etiqueta.",
              ].map((text) => (
                <li key={text} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <ScanLine className="size-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Para quem encontrar</h2>
            </div>
            <ul className="mt-5 space-y-3">
              {[
                "Aponta a câmera do celular para o QR Code da coleira.",
                "Vê o nome do pet e os dados de contato do tutor.",
                "Liga ou envia WhatsApp com um toque.",
                "Pode informar a localização sem precisar de aplicativo.",
              ].map((text) => (
                <li key={text} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Preview da página pública */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="flex-1 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                <QrCode className="size-3.5" />
                Exemplo da página que quem encontrar o pet vai ver
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Contatos em destaque
              </h2>
              <p className="text-sm text-muted-foreground">
                A página mostra o nome do pet, uma mensagem de emergência e os meios de contato cadastrados pelo tutor. Tudo pensado para quem encontrar o pet agir rápido.
              </p>
            </div>

            <div className="w-full max-w-sm shrink-0 rounded-2xl border border-border bg-background p-5 shadow-sm">
              <div className="text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-3xl">
                  🐾
                </div>
                <h3 className="mt-3 font-semibold">Rex</h3>
                <p className="text-xs text-muted-foreground">
                  Me perdi! Se me encontrar, avise meus donos 🐾
                </p>
              </div>

              <div className="mt-5 space-y-2">
                {previewContacts.map((c) => (
                  <button
                    key={c.label}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      c.primary
                        ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border-border bg-muted/40 text-foreground hover:bg-accent"
                    }`}
                  >
                    <c.icon className="size-4 shrink-0" />
                    <span className="truncate">{c.label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
                <MapPin className="inline size-3.5 mr-1" />
                Informe onde o pet foi encontrado
              </div>
            </div>
          </div>
        </section>

        {/* Benefícios */}
        <section className="space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Por que usar Pet Tag?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Uma etiqueta simples que pode fazer toda a diferença.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <b.icon className="size-6 text-primary" />
                <h3 className="mt-3 font-semibold text-sm">{b.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="rounded-3xl border border-border bg-primary p-8 text-center text-primary-foreground sm:p-12">
          <Bell className="mx-auto size-8" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            Proteja seu pet em menos de um minuto
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-primary-foreground/80">
            Ative sua Pet Tag agora e tenha a tranquilidade de saber que, se ele se perder, quem encontrar terá os contatos certos na hora certa.
          </p>
          <div className="mx-auto mt-6 flex max-w-sm flex-col gap-3 sm:flex-row">
            {signedIn ? (
              <Link to="/tags/new" search={{ category: "pet" }} className="flex-1">
                <Button variant="secondary" className="w-full gap-2">
                  Ativar Pet Tag
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            ) : (
              <Link
                to="/auth"
                search={{ mode: "signup", redirect: "/tags/new?category=pet" }}
                className="flex-1"
              >
                <Button variant="secondary" className="w-full gap-2">
                  Ativar Pet Tag
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            )}
            <Link to="/ativar" className="flex-1">
              <Button
                variant="outline"
                className="w-full border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Outras opções
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <Link to="/ativar" className="hover:text-foreground">
            Voltar para ativação
          </Link>
        </div>
      </footer>
    </div>
  );
}
