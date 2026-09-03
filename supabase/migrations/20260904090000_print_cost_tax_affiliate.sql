-- Imposto sobre a venda e comissão de afiliados na Calculadora de Custos.
--
-- tax_pct incide sempre que há venda (ex.: Simples Nacional). affiliate_fee_pct
-- só é aplicada quando sells_marketplace = true, junto com marketplace_fee_pct
-- — ambas percentuais deduzidas do preço de venda sugerido, mesmo padrão de
-- marketplace_fee_pct já existente na tabela.

ALTER TABLE public.print_cost_calculations
  ADD COLUMN IF NOT EXISTS tax_pct NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affiliate_fee_pct NUMERIC NOT NULL DEFAULT 0;
