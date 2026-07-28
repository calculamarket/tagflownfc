-- Calculadora de custos de impressão 3D.
--
-- Cada linha é um cálculo salvo (histórico), opcionalmente vinculado a uma tag
-- do próprio usuário. Guarda tanto as entradas quanto os resultados, para o
-- histórico não precisar recalcular. Não altera nenhuma tabela existente — só
-- referencia tags(id) para o vínculo opcional.

CREATE TABLE IF NOT EXISTS public.print_cost_calculations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id        TEXT REFERENCES public.tags(id) ON DELETE SET NULL,  -- vínculo opcional
  label         TEXT,                 -- nome livre do cálculo (fallback quando sem tag)

  -- Entradas (inputs) — exatamente os campos da calculadora
  machine_price_cents      INTEGER NOT NULL,   -- preço da máquina (R$)
  machine_life_hours       NUMERIC NOT NULL,   -- vida útil (h)
  power_watts              NUMERIC NOT NULL,    -- potência (W)
  kwh_price_cents          INTEGER NOT NULL,    -- custo do kWh (R$)
  filament_grams           NUMERIC NOT NULL,    -- peso do filamento (g)
  filament_price_kg_cents  INTEGER NOT NULL,    -- preço do filamento (R$/kg)
  waste_pct                NUMERIC NOT NULL,    -- % perda/purga
  print_hours              NUMERIC NOT NULL,    -- tempo de impressão (h)
  prep_minutes             NUMERIC NOT NULL,    -- tempo de preparo/pós (min)
  labor_hour_cents         INTEGER NOT NULL,    -- valor da hora de trabalho (R$)
  failure_rate_pct         NUMERIC NOT NULL,    -- % taxa de falha
  extra_costs_cents        INTEGER NOT NULL,    -- custos extras (R$)
  margin_pct               NUMERIC NOT NULL,    -- % margem desejada
  sells_marketplace        BOOLEAN NOT NULL DEFAULT false,
  marketplace_fee_pct      NUMERIC NOT NULL DEFAULT 0,  -- % comissão do marketplace

  -- Resultados calculados (guardados para o histórico)
  cost_filament_cents      INTEGER NOT NULL,
  cost_energy_cents        INTEGER NOT NULL,
  cost_depreciation_cents  INTEGER NOT NULL,
  cost_labor_cents         INTEGER NOT NULL,
  cost_base_cents          INTEGER NOT NULL,
  cost_with_failure_cents  INTEGER NOT NULL,
  suggested_price_cents    INTEGER NOT NULL,
  net_profit_cents         INTEGER NOT NULL,
  real_margin_pct          NUMERIC NOT NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS print_cost_calc_user_idx ON public.print_cost_calculations(user_id);
CREATE INDEX IF NOT EXISTS print_cost_calc_tag_idx  ON public.print_cost_calculations(tag_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_cost_calculations TO authenticated;
GRANT ALL ON public.print_cost_calculations TO service_role;
ALTER TABLE public.print_cost_calculations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their calculations" ON public.print_cost_calculations;
CREATE POLICY "Owners manage their calculations"
  ON public.print_cost_calculations FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id);
