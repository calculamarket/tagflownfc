-- Fase 1a — Fundação multi-tenant (white-label).
--
-- Introduz "tenants" (revendedores/agências) e "tenant_members" (staff de cada
-- tenant), adiciona tenant_id às tabelas de dados e cria o isolamento por RLS.
--
-- Estratégia à prova de janela de quebra:
--   * cria um "tenant 0" com id FIXO (a operação atual);
--   * faz backfill de tudo que já existe para o tenant 0;
--   * define tenant_id com DEFAULT = tenant 0, então inserções novas do app
--     atual (que ainda não conhece tenant) caem no tenant 0 automaticamente;
--   * só então torna tenant_id NOT NULL.
--
-- As policies de tenant são ADITIVAS (permissivas, OR com as existentes): staff
-- do tenant passa a enxergar tudo do próprio tenant, sem tocar nas regras atuais
-- (cliente final continua vendo só as próprias linhas via user_id).

-- Id fixo do tenant da operação atual.
-- 00000000-0000-0000-0000-000000000001
BEGIN;

-- 1) Tabelas novas ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,        -- subdomínio: "marcadele"
  name          TEXT NOT NULL,               -- marca exibida
  monogram      TEXT NOT NULL DEFAULT '',    -- selo do menu
  tagline       TEXT NOT NULL DEFAULT '',
  powered_by    BOOLEAN NOT NULL DEFAULT true,
  support_email TEXT,
  primary_color TEXT,                        -- tema opcional (Fase 2)
  logo_url      TEXT,                         -- logo opcional (Fase 2)
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'owner',  -- 'owner' | 'member'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_members_user_idx ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS tenant_members_tenant_idx ON public.tenant_members(tenant_id);

-- 2) Helper de associação (SECURITY DEFINER, ignora RLS — sem recursão) -----

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant_id AND user_id = _user_id
  );
$$;

-- IMPORTANTE: garantir EXECUTE para authenticated (senão a RLS quebra, como
-- já aconteceu com has_role).
GRANT EXECUTE ON FUNCTION public.is_tenant_member(UUID, UUID) TO authenticated, service_role;

-- 3) Tenant 0 (a operação atual) -------------------------------------------

INSERT INTO public.tenants (id, slug, name, monogram, tagline, powered_by, support_email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'app',
  '3D QR',
  '3D',
  'QR Codes em impressão 3D, reconfiguráveis',
  true,
  'contato@3dqr.com.br'
)
ON CONFLICT (id) DO NOTHING;

-- Você como owner do tenant 0 (ignora se o e-mail não existir ainda).
INSERT INTO public.tenant_members (tenant_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', u.id, 'owner'
FROM auth.users u
WHERE u.email = 'aabbrogerio@gmail.com'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- 4) tenant_id nas tabelas de dados + backfill + default + NOT NULL --------
-- Ordem por tabela: ADD (nullable) -> backfill -> DEFAULT -> NOT NULL.

-- tags
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.tags SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.tags ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.tags ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS tags_tenant_idx ON public.tags(tenant_id);

-- tag_kits
ALTER TABLE public.tag_kits ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.tag_kits SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.tag_kits ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.tag_kits ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS tag_kits_tenant_idx ON public.tag_kits(tenant_id);

-- tag_batches
ALTER TABLE public.tag_batches ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.tag_batches SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.tag_batches ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.tag_batches ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS tag_batches_tenant_idx ON public.tag_batches(tenant_id);

-- leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.leads SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.leads ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.leads ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS leads_tenant_idx ON public.leads(tenant_id);

-- webhooks
ALTER TABLE public.webhooks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.webhooks SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.webhooks ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.webhooks ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS webhooks_tenant_idx ON public.webhooks(tenant_id);

-- subscriptions (PK = user_id)
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.subscriptions SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.subscriptions ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.subscriptions ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_tenant_idx ON public.subscriptions(tenant_id);

-- print_cost_calculations (pode ainda não existir se a migration da
-- calculadora não foi aplicada; por isso é condicional).
DO $$
BEGIN
  IF to_regclass('public.print_cost_calculations') IS NOT NULL THEN
    ALTER TABLE public.print_cost_calculations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.print_cost_calculations SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
    ALTER TABLE public.print_cost_calculations ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
    ALTER TABLE public.print_cost_calculations ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS print_cost_calc_tenant_idx ON public.print_cost_calculations(tenant_id);
    EXECUTE 'DROP POLICY IF EXISTS "Tenant staff read calculations" ON public.print_cost_calculations';
    EXECUTE 'CREATE POLICY "Tenant staff read calculations" ON public.print_cost_calculations FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id, auth.uid()))';
  END IF;
END $$;

-- 5) RLS das tabelas novas -------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read their tenant" ON public.tenants;
CREATE POLICY "Members read their tenant" ON public.tenants FOR SELECT TO authenticated
  USING (public.is_tenant_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Superadmin manages tenants" ON public.tenants;
CREATE POLICY "Superadmin manages tenants" ON public.tenants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own memberships" ON public.tenant_members;
CREATE POLICY "Read own memberships" ON public.tenant_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_tenant_member(tenant_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Superadmin manages members" ON public.tenant_members;
CREATE POLICY "Superadmin manages members" ON public.tenant_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6) Policies ADITIVAS de staff nas tabelas de dados -----------------------
-- (OR com as regras existentes; cliente final continua vendo só as próprias.)

DROP POLICY IF EXISTS "Tenant staff read tags" ON public.tags;
CREATE POLICY "Tenant staff read tags" ON public.tags FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "Tenant staff read kits" ON public.tag_kits;
CREATE POLICY "Tenant staff read kits" ON public.tag_kits FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "Tenant staff read batches" ON public.tag_batches;
CREATE POLICY "Tenant staff read batches" ON public.tag_batches FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "Tenant staff read leads" ON public.leads;
CREATE POLICY "Tenant staff read leads" ON public.leads FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "Tenant staff read webhooks" ON public.webhooks;
CREATE POLICY "Tenant staff read webhooks" ON public.webhooks FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

COMMIT;
