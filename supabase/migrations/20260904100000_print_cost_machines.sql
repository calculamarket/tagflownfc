-- Perfis de máquina salvos na Calculadora de Custos — o usuário tem várias
-- impressoras de modelos diferentes e quer gravar preço, vida útil, potência e
-- custo do kWh de cada uma, para só selecionar depois na hora de calcular.
--
-- Nome único por usuário: salvar de novo com o mesmo nome atualiza o perfil
-- (upsert), então editar e regravar uma máquina existente não cria duplicata.

CREATE TABLE IF NOT EXISTS public.print_cost_machines (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  machine_price_cents  INTEGER NOT NULL DEFAULT 0,  -- preço da máquina (R$)
  machine_life_hours   NUMERIC NOT NULL DEFAULT 0,  -- vida útil (h)
  power_watts          NUMERIC NOT NULL DEFAULT 0,  -- potência (W)
  kwh_price_cents      INTEGER NOT NULL DEFAULT 0,  -- custo do kWh (R$)
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS print_cost_machines_user_idx ON public.print_cost_machines(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_cost_machines TO authenticated;
GRANT ALL ON public.print_cost_machines TO service_role;
ALTER TABLE public.print_cost_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their machines" ON public.print_cost_machines;
CREATE POLICY "Owners manage their machines"
  ON public.print_cost_machines FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id);
