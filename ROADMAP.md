# TagFlow — Roadmap & Status de Implementação

> Documento vivo que registra o que já foi construído, o que está em andamento e o que ainda precisa ser feito na plataforma TagFlow.
> Última atualização: 22 de julho de 2026.

---

## 1. Visão Geral

**TagFlow** é uma plataforma SaaS para gerenciamento de etiquetas NFC, QR Codes e Links Inteligentes. Cada tag recebe um ID curto único (`/t/{id}`) e pode apontar para diferentes destinos: URL, WhatsApp, PIX, Wi-Fi, landing page, redes sociais, telefone, e-mail, marketplaces e PDFs.

A arquitetura segue o padrão moderno full-stack com SSR/SSG, edge functions, autenticação, banco relacional com RLS e design system minimalista no estilo Linear/Stripe/Vercel.

### Stack
- **Framework:** React 19 + TypeScript + Vite 7 + TanStack Start v1
- **Estilo:** Tailwind CSS v4 + shadcn/ui + Lucide
- **Banco / Backend:** Lovable Cloud (Supabase gerenciado) — PostgreSQL + RLS + Auth
- **Gráficos:** Recharts
- **QR Code:** `qrcode` + `@types/qrcode`
- **IDs curtos:** `nanoid(8)`
- **Server functions:** `createServerFn` do TanStack Start
- **PWA:** manifest-only (sem service worker offline)

---

## 2. O que Já Está Implementado

### 2.1. Fundação (Fase 1) — Concluído

#### Design System
- Tokens semânticos de cores claras/escuras no `src/styles.css` usando OKLCH.
- Tipografia e espaçamento no estilo Linear/Vercel.
- Componentes base do shadcn/ui configurados (`Button`, `Card`, `Input`, `Label`, `Textarea`, `Select`, `Tabs`, etc.).
- Tema escuro com persistência em `localStorage` (`src/lib/theme.tsx`).

#### Banco de Dados / Schema
Migration executada em `supabase/migrations/20260722110357_fffd4507-1cb8-4213-a883-8c941c4853d1.sql`:

| Tabela | Propósito |
|--------|-----------|
| `profiles` | Perfil do usuário (e-mail, nome, avatar) |
| `user_roles` | Papéis (`admin`, `user`) com `has_role()` SECURITY DEFINER |
| `plans` | Planos de assinatura (Free, Pro, Business) com limites e features |
| `subscriptions` | Assinatura ativa de cada usuário |
| `tags` | Tags/etiquetas com ID curto, destino, status e contador de leituras |
| `reads` | Registro de cada leitura/escaneamento (IP, país, cidade, SO, navegador, dispositivo, referrer) |
| `landing_pages` | Página personalizada vinculada a uma tag |
| `webhooks` | Webhooks do usuário por evento (inclui `secret` para HMAC) |
| `webhook_deliveries` | Log de cada disparo de webhook (status, ok, erro) — migration `20260722120000` |
| `settings` | Configurações genéricas do usuário em JSONB |

Enums:
- `app_role`: `admin`, `user`
- `tag_status`: `active`, `paused`, `archived`
- `destination_type`: `url`, `whatsapp`, `instagram`, `facebook`, `tiktok`, `youtube`, `pdf`, `pix`, `wifi`, `phone`, `email`, `landing_page`, `mercadolivre`, `shopee`, `amazon`
- `webhook_event`: `tag.read`, `tag.created`, `tag.updated`

RLS ativado em todas as tabelas com grants apropriados para `authenticated`, `anon` e `service_role`.

#### Autenticação
- Login com e-mail/senha.
- Cadastro com criação automática de `profile` e role `user`.
- Recuperação de senha (`/reset-password`).
- Google OAuth configurado.
- Callback de autenticação.
- Layout autenticado protegido por `_authenticated/route.tsx`.

#### Layout Autenticado
Sidebar (`src/components/app-shell.tsx`) com navegação para:
- Dashboard
- Minhas Tags
- QR Codes
- Links
- Analytics
- Automações
- Equipe
- Integrações
- Configurações
- Minha Conta
- Admin (acesso por role)
- Landing Page (por tag)

#### Redirecionador Público `/t/:id`
- Rota pública `src/routes/t.$id.tsx`.
- Server function `resolveTag` em `src/lib/tags-public.functions.ts`:
  - Resolve a tag pelo ID curto.
  - Registra leitura com IP, país (header `cf-ipcountry`), cidade, SO, navegador, dispositivo e referrer.
  - Redireciona para o destino final via `buildDestinationUrl`.
- `reads` permite `INSERT` anônimo para o redirecionador público.

#### CRUD de Tags
- Server functions em `src/lib/tags.functions.ts`:
  - `listTags`, `getTag`, `createTag`, `updateTag`, `deleteTag`, `dashboardStats`.
- Componentes:
  - `TagForm` com campos dinâmicos por tipo de destino.
  - `TagQrPreview` com geração de QR Code.
- Rotas:
  - `/tags` — lista de tags
  - `/tags/new` — criar tag
  - `/tags/$id` — editar tag

#### Dashboard
- Rota `/dashboard`.
- Métricas reais: total de tags, leituras hoje, leituras no mês, total de leituras.
- Gráfico diário com Recharts.
- Lista das últimas leituras.

### 2.2. Analytics & Landing Pages (Fase 2) — Concluído

#### Analytics
- Server function `analyticsOverview` em `src/lib/analytics.functions.ts`.
- Rota `/analytics` com:
  - Filtros por período (7, 30, 90, 365 dias) e por tag específica.
  - Gráfico de área (`AreaChart`) de tráfego diário.
  - Cards de estatísticas: total de leituras, dias únicos com leitura.
  - Quebras por: país, cidade, dispositivo, navegador, SO e origem (referrer).
  - Lista das últimas 20 leituras.

#### Landing Pages
- Server functions em `src/lib/landing.functions.ts`:
  - `getLandingForEditor` — carrega landing page para edição.
  - `upsertLanding` — salva landing page.
  - `getPublicView` — visualização pública.
- Rota autenticada `/landing/$tagId` com editor ao vivo e preview.
- Rota pública `/t/$id/view` renderiza landing page personalizada.
- Campos editáveis: título, descrição, logo, imagem de capa, botões (primary/secondary).
- Mapa ainda não implementado no editor, mas a coluna `map` existe no schema.

### 2.3. Automações, Equipe e Admin (Fase 3) — Parcial

#### Webhooks / Automações — Concluído (núcleo)
- Server functions em `src/lib/webhooks.functions.ts`:
  - `listWebhooks`, `upsertWebhook`, `deleteWebhook`, `testWebhook`, `listDeliveries`.
- Rota `/automations` com:
  - Formulário de cadastro de webhook (URL + evento).
  - Lista de webhooks com toggle ativo/pausado, segredo HMAC (mostrar/copiar) e botão de teste.
  - **Entregas recentes** com status HTTP, evento e erro (atualização automática).
- Eventos suportados: `tag.read`, `tag.created`, `tag.updated`.
- ✅ **Disparo real automático implementado:**
  - `tag.created`/`tag.updated` em `upsertTag` (`src/lib/tags.functions.ts`).
  - `tag.read` em `resolveTag` (fire-and-forget, não bloqueia o redirect).
  - Assinatura `X-TagFlow-Signature: sha256=<hmac>` por webhook (segredo `webhooks.secret`).
  - Log de cada entrega em `webhook_deliveries` (status, ok, erro) — base para retry.
- Helper server-only: `src/lib/webhook-delivery.server.ts` (usa service role via `supabaseAdmin`).
- **Ainda não implementado:** retry automático das entregas com falha; filtros por tag/tipo.

#### Painel Admin (`/admin`) — Concluído (núcleo)
- Server functions em `src/lib/admin.functions.ts` (middleware `requireAdmin`):
  `adminStats`, `adminListUsers` (com busca), `adminListPlans`, `adminSetUserPlan`.
- Rota em `src/routes/_authenticated/admin.tsx`:
  - Cards globais: usuários, tags, leituras (total/hoje/mês), assinaturas ativas e
    **receita mensal real** (soma dos planos ativos) + distribuição de planos.
  - Busca de usuários por nome/e-mail e **troca de plano** por usuário (inline).
- Gate por role `admin` via `has_role()` (redirect na UI + checagem no servidor).
- **Ainda não implementado:** bloqueio/ban de usuários (exige `auth.admin` API) e auditoria.

#### Links Inteligentes — Concluído
- Rota `/links` lista todas as tags como links curtos `/t/{id}` com copiar, abrir e editar.

#### Configurações — Concluído (núcleo)
- Rota `/settings` funcional: aparência (tema claro/escuro), segurança (trocar senha via
  `supabase.auth.updateUser`) e sessão (sair de todos os dispositivos).
- **Ainda não implementado:** preferências de notificação e exclusão de conta.

#### Equipe
- Rota `/team` criada, mas **ainda não implementada** (depende de convites por e-mail).

#### Integrações
- Rota `/integrations` criada, mas **ainda não implementada**.

---

## 3. O que Ainda Precisa Ser Construído (Backlog)

### 3.1. Funcionalidades Core
- [ ] **PWA completo:** adicionar service worker para cache/offline (opcional, conforme plano).
- [ ] **Upload de arquivos:** suporte a PDF e imagens de logo/capa no Storage da Lovable Cloud.
- [ ] **Domínio customizado:** `app.tagflow.com` ou domínio próprio do usuário.
- [ ] **Pagamentos:** integração real com Stripe/Paddle para assinaturas Pro/Business.
- [x] **Limites de plano (cadastro):** `max_tags` é validado em `upsertTag` ao criar tags; UI mostra uso (`getMyPlan` em `src/lib/plans.functions.ts`). Falta upgrade/downgrade de plano.

### 3.2. Tipos de Destino
- [ ] **PDF:** renderizador/apresentador de PDF próprio (hoje apenas redireciona para URL externa).
- [ ] **PIX:** validação e geração de payload BRCode; renderização específica em `/t/$id/view` (hoje renderiza genérico).
- [ ] **Wi-Fi:** renderização de cartão de rede com botão copiar senha em `/t/$id/view` (parcialmente feito, pode ser aprimorado).
- [ ] **Redes sociais:** handlers específicos para Instagram, Facebook, TikTok, YouTube (hoje tratados como URL).
- [ ] **Marketplaces:** Mercado Livre, Shopee, Amazon (hoje tratados como URL).
- [ ] **Landing page:** mapa/ localização no editor (coluna `map` já existe).

### 3.3. Automações
- [x] Disparo automático de webhooks nos eventos reais:
  - `tag.created` ao criar uma tag.
  - `tag.updated` ao editar uma tag.
  - `tag.read` ao escanear/ler uma tag.
- [x] Log de entrega de webhooks (tabela `webhook_deliveries`) — visível em `/automations`.
- [x] Assinaturas de webhook com segredo (HMAC-SHA256, header `X-TagFlow-Signature`).
- [x] Retry automático das entregas com falha:
  - Retry in-request com backoff para falhas transientes (429/5xx/rede) no `dispatchOne`.
  - Reenvio manual de qualquer entrega falha via UI (`retryDelivery` → `redeliverDelivery`).
  - Falta: retry durável agendado (endpoint fora do ar por horas) — exige Edge Function + `pg_cron`.
- [ ] Filtros por tag ou tipo de destino.

### 3.4. Equipe e Permissões
- [ ] Convites por e-mail.
- [ ] Papéis de equipe (owner, admin, editor, viewer).
- [ ] Compartilhamento de tags entre membros.
- [ ] Faturamento por equipe.

### 3.5. Admin
- [x] Lista de usuários com busca/filtros.
- [~] Edição de usuários: troca de plano implementada; bloqueio/ban ainda não.
- [~] Gerenciamento de planos: atribuição de plano por usuário feita; edição de preços/limites dos planos ainda não.
- [x] Dashboard global: usuários, tags, leituras (total/hoje/mês), assinaturas e receita real.
- [ ] Auditoria de atividades.

### 3.6. Integrações
- [ ] Google Analytics 4.
- [ ] Meta Pixel.
- [ ] Zapier/Make.
- [ ] API pública com chaves de API.
- [ ] Exportação de CSV/Excel de analytics.

### 3.7. Configurações
- [~] Perfil do usuário: edição de nome em `/account`; troca de senha em `/settings`. Falta avatar e troca de e-mail.
- [ ] Preferências de notificação.
- [ ] Configurações de webhook padrão.
- [ ] Fechamento/exclusão de conta.

### 3.8. Marketing / Site Público
- [ ] Landing page institucional em `/` (hoje pode ser apenas redirecionamento para `/auth` ou marketing básico).
- [ ] Página de preços.
- [ ] Página de termos/privacidade.
- [ ] Blog/documentação.

### 3.9. Qualidade & Infra
- [ ] Testes automatizados (unitários e E2E).
- [ ] Monitoramento de erros e performance.
- [ ] Rate limiting no redirecionador e webhooks.
- [ ] Validação de URL e prevenção de open redirect.
- [ ] Cache de consultas frequentes no banco.
- [ ] Documentação de API pública.

---

## 4. Estrutura de Arquivos Relevante

```text
src/
├── components/
│   ├── app-shell.tsx          # Layout autenticado com sidebar
│   ├── placeholder-page.tsx   # Página de stub
│   ├── tag-form.tsx           # Formulário dinâmico de tag
│   └── tag-qr-preview.tsx     # Preview e geração de QR Code
├── lib/
│   ├── analytics.functions.ts # Server functions de analytics
│   ├── destination.ts         # Construtor de URLs por tipo de destino
│   ├── landing.functions.ts   # Server functions de landing page
│   ├── plans.ts               # Helper puro: plano efetivo + uso de tags
│   ├── plans.functions.ts     # Server function getMyPlan
│   ├── tags.functions.ts      # CRUD de tags protegido + limite de plano + eventos
│   ├── tags-public.functions.ts # Redirecionador público + leitura + evento tag.read
│   ├── user-agent.ts          # Parser de user-agent
│   ├── webhook-delivery.server.ts # Dispatcher server-only (HMAC + log)
│   └── webhooks.functions.ts  # CRUD de webhooks + listDeliveries
├── routes/
│   ├── __root.tsx             # Root layout
│   ├── index.tsx              # Landing/marketing
│   ├── auth.tsx               # Login/cadastro
│   ├── reset-password.tsx     # Recuperação de senha
│   ├── t.$id.tsx              # Redirecionador público
│   ├── t.$id.view.tsx         # Visualização pública (landing, PIX, Wi-Fi)
│   └── _authenticated/
│       ├── route.tsx          # Gate de autenticação
│       ├── dashboard.tsx
│       ├── tags.tsx
│       ├── tags.index.tsx
│       ├── tags.new.tsx
│       ├── tags.$id.tsx
│       ├── landing.$tagId.tsx
│       ├── analytics.tsx
│       ├── automations.tsx
│       ├── admin.tsx
│       ├── account.tsx
│       ├── team.tsx
│       ├── settings.tsx
│       ├── integrations.tsx
│       ├── qr-codes.tsx
│       └── links.tsx
└── integrations/supabase/
    ├── client.ts              # Cliente browser Supabase
    ├── client.server.ts       # Cliente admin (service role)
    ├── auth-middleware.ts     # Middleware de autenticação em server functions
    ├── auth-attacher.ts       # Anexa bearer token em chamadas client-side
    └── types.ts               # Tipos gerados do schema
```

---

## 5. Decisões Técnicas Importantes

1. **RLS e segurança:**
   - Todas as tabelas user-scoped filtram por `auth.uid()` ou usam `public.has_role()`.
   - Roles em tabela separada (`user_roles`), nunca no `profiles`.
   - `reads` permite `INSERT` anônimo para o redirecionador, mas `SELECT` só para o dono da tag.

2. **Redirecionador público:**
   - Server function sem autenticação, usando client publishable.
   - Captura de geo via headers `cf-ipcountry` / `cf-ipcity` quando disponíveis (Cloudflare).
   - Contador denormalizado `tags.read_count` não é atualizado por usuários anônimos; dashboard usa `COUNT(*)` em `reads` para maior precisão.

3. **Server functions:**
   - Funções autenticadas usam `.middleware([requireSupabaseAuth])`.
   - Funções públicas (redirecionador, landing view) não usam autenticação.
   - `process.env` só é lido dentro do handler.

4. **IDs:**
   - Tags usam `nanoid(8)` para URLs curtas e memoráveis.

5. **Design:**
   - Cores semânticas via CSS variables do Tailwind v4; nenhum hardcode de `bg-[#...]` ou `text-white` em componentes.

---

## 6. Próximos Passos Recomendados

1. **Finalizar Fase 3:**
   - ✅ Disparo real de webhooks (`tag.read`, `tag.created`, `tag.updated`) com HMAC e log de entregas.
   - Retry automático das entregas com falha (usar `webhook_deliveries`).
   - Construir o painel admin funcional (busca, bloqueio, gestão de planos).
   - Implementar convites e gerenciamento de equipe.

2. **Ativar monetização:**
   - Integrar Stripe/Paddle e permitir upgrade/downgrade de plano.
   - ✅ Limite de `max_tags` já aplicado no cadastro de tags; falta gating de features por plano.

3. **Melhorar tipos de destino:**
   - Renderizadores específicos para PIX, Wi-Fi e PDF.
   - Upload de PDF e imagens via Storage.

4. **Expandir marketing:**
   - Landing page institucional rica em `/`.
   - Página de preços dinâmica vinda dos planos do banco.

5. **Polimento:**
   - Loading states e skeletons.
   - Empty states informativos.
   - Testes E2E críticos (signup, criar tag, redirecionador, analytics).

---

## 7. Como Contribuir / Rodar Localmente

```bash
# Clone o repositório (GitHub)
git clone <repo-url>
cd <repo-name>

# Instale dependências
bun install
# ou npm install

# Rode em desenvolvimento
bun run dev
# ou npm run dev

# Build de desenvolvimento
bun run build:dev
```

> Nota: variáveis de ambiente do Supabase são gerenciadas pela Lovable Cloud. Em ambiente local com Supabase próprio, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no `.env`.

---

## 8. Licença e Propriedade

O código deste projeto é propriedade do criador do projeto e pode ser publicado/hospedado fora da Lovable via GitHub. Para hospedar em infraestrutura própria, gerencie as variáveis de ambiente e credenciais no provedor escolhido.
