# TagFlow — Plano de Construção

O escopo é grande demais para uma única entrega. Proponho construir em fases incrementais, cada uma entregando valor funcional. Confirme a fase 1 (ou ajuste) para eu começar.

## Stack
- Frontend já existente: React 19 + TypeScript + Vite + TanStack Start + Tailwind v4 + shadcn/ui + Lucide.
- Backend: **Lovable Cloud** (Supabase gerenciado) — Postgres + RLS + Auth. Ativarei na Fase 1.
- Redirecionador `/t/:id`: rota TanStack pública que consulta o destino e faz `window.location.replace`, registrando a leitura via server function (captura IP/UA no servidor; geo por header ou API leve).
- PWA: manifest + ícones (installable) — sem service worker offline salvo pedido explícito.

## Fase 1 — Fundação (recomendado começar aqui)
1. Design system (tokens claros/escuros, tipografia estilo Linear/Vercel, componentes base).
2. Ativar Lovable Cloud.
3. Schema inicial + RLS + grants:
   - `profiles`, `user_roles` (enum: `admin`, `user`), `plans`, `subscriptions`
   - `tags` (id curto único, nome, descrição, categoria, status, destination_type, destination_payload jsonb, user_id)
   - `reads` (tag_id, created_at, ip, city, country, os, browser, device, referrer)
   - `landing_pages`, `webhooks`, `settings`
4. Auth: login, cadastro, recuperação de senha, callback (Email/senha + Google).
5. Layout autenticado com sidebar (Dashboard, Minhas Tags, QR Codes, Links, Analytics, Automações, Equipe, Integrações, Configurações, Minha Conta).
6. Rota pública `/t/$id` funcional: resolve destino, registra leitura, redireciona.
7. CRUD de Tags + geração de QR Code (lib `qrcode`) + tipos de destino: URL, WhatsApp, Instagram, telefone, email (os demais como stubs com o mesmo motor).
8. Dashboard com métricas reais (tags, leituras hoje/mês, total, gráfico diário com Recharts, últimas leituras).

## Fase 2 — Analytics & Landing Pages
- Analytics completo (país, cidade, dispositivo, origem) com filtros de período.
- Editor de landing page personalizada (logo, imagem, título, descrição, botões, mapa).
- Todos os tipos de destino restantes (PIX, WiFi, PDF, marketplaces, redes sociais restantes).

## Fase 3 — Automações, Equipe, Admin
- Webhooks (cadastro + disparo em eventos `tag.read`, `tag.created`, `tag.updated`) via server function.
- Equipe / convites básicos.
- Painel admin (`/admin`) com gate por role: listar/editar/bloquear usuários, ver planos, leituras, receita.
- Integrações e Configurações finais.

## Detalhes técnicos-chave
- **RLS**: cada tabela user-scoped filtra por `auth.uid()`; `reads` permite `INSERT` a `anon` (redirecionador é público) mas `SELECT` só ao dono da tag via policy com join/EXISTS.
- **Roles**: tabela `user_roles` + função `has_role()` `SECURITY DEFINER` (nunca papel no profile).
- **Redirecionador**: server function pública sem `requireSupabaseAuth`, usando client publishable + policy `TO anon` estrita, ou route handler em `/api/public/read` chamada pelo `/t/$id`.
- **ID da tag**: `nanoid(8)` — curto, colidível-improvável, único.
- **Geo**: enriquecer via `cf-ipcountry` header (Cloudflare) quando disponível; fallback vazio.
- **PWA**: manifest-only nesta primeira leva.

## O que NÃO farei sem confirmação
- Cobrança real (Stripe/Paddle) — a menos que peça, faço apenas modelo de planos.
- Domínio `app.tagflow.com` — usarei o domínio Lovable até você publicar/apontar.
- Service worker offline.

## Pergunta
Posso começar pela **Fase 1** exatamente como descrita? Se quiser reordenar (ex.: incluir landing page já na fase 1, ou pular admin), me diga antes de eu ativar o Cloud e criar o schema.
