import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, QrCode, Zap, BarChart3, Shield } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TagFlow — Etiquetas NFC, QR Codes e Links Inteligentes" },
      { name: "description", content: "Uma plataforma. Todas as suas etiquetas. Gerencie NFC, QR Codes e links inteligentes com analytics em tempo real." },
      { property: "og:title", content: "TagFlow" },
      { property: "og:description", content: "Uma plataforma. Todas as suas etiquetas." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <div className="size-7 rounded-md bg-primary grid place-items-center text-primary-foreground text-xs font-bold">T</div>
            TagFlow
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
              Entrar
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Começar
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
          <span className="size-1.5 rounded-full bg-success" /> Plataforma completa · Sem cartão de crédito
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
          Uma plataforma.
          <br />
          <span className="text-muted-foreground">Todas as suas etiquetas.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Gerencie etiquetas NFC, QR Codes e links inteligentes com um único ID.
          Altere o destino a qualquer momento sem reimprimir nada.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Criar conta grátis
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            Entrar
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 grid gap-6 md:grid-cols-4">
        {[
          { icon: QrCode, title: "QR + NFC + Link", desc: "Um único ID para todos os formatos de etiqueta." },
          { icon: Zap, title: "Destino dinâmico", desc: "Altere para onde a tag aponta sem reimprimir." },
          { icon: BarChart3, title: "Analytics real-time", desc: "Cidade, dispositivo, origem, hora." },
          { icon: Shield, title: "Seguro por padrão", desc: "RLS, HTTPS e isolamento por usuário." },
        ].map((f) => (
          <div key={f.title} className="rounded-lg border border-border bg-card p-5">
            <f.icon className="size-5 text-primary" />
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border mt-16">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground flex justify-between">
          <span>© {new Date().getFullYear()} TagFlow</span>
          <span>Feito com Lovable</span>
        </div>
      </footer>
    </div>
  );
}
