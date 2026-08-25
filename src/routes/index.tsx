import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, QrCode, Zap, BarChart3, Shield, Smartphone, PawPrint,
  Wifi, HeartPulse, Box, Link2, ScanLine, LogIn, Settings2,
} from "lucide-react";
import { BRAND } from "@/lib/brand";

const HOME_TITLE = `${BRAND.name} — ${BRAND.tagline}`;
const HOME_DESC =
  "Ative sua etiqueta em segundos: escaneie o QR, crie sua conta e escolha o destino — PIX, WhatsApp, Instagram, Wi-Fi, cardápio ou página própria. Sem reimprimir a peça.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: ScanLine, title: "1. Escaneie a etiqueta", desc: "Aponte a câmera para o QR Code impresso na sua peça 3D ou cartão." },
  { icon: LogIn, title: "2. Crie sua conta", desc: "Cadastro em segundos, sem confirmação de e-mail e sem cartão de crédito." },
  { icon: Settings2, title: "3. Escolha o destino", desc: "PIX, WhatsApp, Instagram, Wi-Fi, cardápio ou uma landing page sua." },
];

const features = [
  { icon: Zap, title: "Destino dinâmico", desc: "Troque para onde a etiqueta aponta quando quiser — a peça impressa continua a mesma." },
  { icon: QrCode, title: "QR + NFC + Link", desc: "Um único ID atende todos os formatos, com QR gerado automaticamente." },
  { icon: BarChart3, title: "Analytics em tempo real", desc: "Cidade, país, dispositivo, navegador e horário de cada leitura." },
  { icon: Smartphone, title: "Landing page própria", desc: "Monte uma página com logo, botões e formulário de contato em minutos." },
  { icon: Link2, title: "Regras inteligentes", desc: "Destinos diferentes por horário, país ou dispositivo, e automações via webhook." },
  { icon: Shield, title: "Seguro por padrão", desc: "Isolamento por usuário, HTTPS e controle de acesso no banco de dados." },
];

const uses = [
  { icon: PawPrint, label: "Pet Tag", desc: "Contato do tutor sempre atualizado." },
  { icon: QrCode, label: "Placa PIX", desc: "Receba pagamentos na hora." },
  { icon: Wifi, label: "Wi-Fi", desc: "Conexão dos visitantes sem digitar senha." },
  { icon: HeartPulse, label: "Idoso — Emergência", desc: "Dados vitais e contatos de emergência." },
  { icon: Box, label: "Peças 3D", desc: "Etiquetas, ganchos e insertos personalizados." },
  { icon: Link2, label: "Links inteligentes", desc: "Cardápio, redes sociais e catálogos." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <div className="size-7 rounded-md bg-primary grid place-items-center text-primary-foreground text-[10px] font-bold">{BRAND.monogram}</div>
            {BRAND.name}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/ativar" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground">
              Ativar etiqueta
            </Link>
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

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-14 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
          <span className="size-1.5 rounded-full bg-success" /> Ative em segundos · Sem cartão de crédito
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
          Recebeu uma etiqueta?
          <br />
          <span className="text-muted-foreground">Ative e escolha o destino.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          {BRAND.name} é a plataforma para gerenciar etiquetas NFC, QR Codes e links inteligentes.
          Imprima uma vez e mude o conteúdo quantas vezes quiser.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link
            to="/ativar"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ativar minha etiqueta
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex items-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            Criar conta grátis
          </Link>
        </div>
      </section>

      {/* Passo a passo */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-center">Como funciona</h2>
          <p className="mt-2 text-sm text-muted-foreground text-center">Três passos e sua etiqueta está no ar.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.title} className="rounded-lg border border-border bg-card p-6">
                <div className="size-9 rounded-md bg-accent grid place-items-center text-accent-foreground">
                  <s.icon className="size-4" />
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Principais funcionalidades</h2>
        <p className="mt-2 text-sm text-muted-foreground">Tudo que você precisa para vender, entregar e gerenciar etiquetas.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-5">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Casos de uso */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Para que usar</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {uses.map((u) => (
              <div key={u.label} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <u.icon className="size-5 text-primary shrink-0" />
                <div>
                  <div className="font-medium text-sm">{u.label}</div>
                  <p className="text-sm text-muted-foreground">{u.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Pronto para ativar?</h2>
        <p className="mt-3 text-muted-foreground">
          Leve menos de um minuto para colocar sua primeira etiqueta em funcionamento.
        </p>
        <div className="mt-7 flex flex-wrap gap-3 justify-center">
          <Link
            to="/ativar"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ativar etiqueta
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground flex flex-wrap gap-2 justify-between">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-foreground">{BRAND.supportEmail}</a>
        </div>
      </footer>
    </div>
  );
}
