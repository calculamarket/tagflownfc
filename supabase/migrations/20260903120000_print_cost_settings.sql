-- Meta de lucro por máquina e capacidade mensal de produção, usada pela
-- Calculadora de Custos para indicar quanto vender de cada produto para
-- bater a meta, sempre dentro do limite de horas que a máquina roda por mês.
--
-- Uma linha por usuário (upsert por user_id) — não é histórico, é a
-- configuração corrente da meta/capacidade.

CREATE TABLE IF NOT EXISTS public.print_cost_settings (
  user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profit_goal_cents       INTEGER NOT NULL DEFAULT 100000,  -- meta de lucro líquido por máquina/mês (R$ 1.000)
  machine_hours_per_day   NUMERIC NOT NULL DEFAULT 16,      -- horas de operação por dia
  machine_days_per_month  NUMERIC NOT NULL DEFAULT 30,      -- dias de operação por mês
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_cost_settings TO authenticated;
GRANT ALL ON public.print_cost_settings TO service_role;
ALTER TABLE public.print_cost_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their settings" ON public.print_cost_settings;
CREATE POLICY "Owners manage their settings"
  ON public.print_cost_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id);
