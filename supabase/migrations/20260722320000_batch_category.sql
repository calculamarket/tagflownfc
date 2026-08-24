-- Guarda a categoria de ativação no lote (além das tags), para a UI de produção
-- mostrar/condicionar ações por categoria (ex.: botão "Cartão Emergência" só
-- em lotes Idoso/Emergência).

ALTER TABLE public.tag_batches
  ADD COLUMN IF NOT EXISTS category TEXT;
