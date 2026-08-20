-- Novo destino "emergency": cartão de emergência / "se encontrado" para Pet
-- Tag, mochila infantil, pulseira de idoso, bagagem, etc.
--
-- Só adiciona o valor ao enum; a config fica no JSONB destination (contatos,
-- info médica, mensagem). Nada mais muda.

ALTER TYPE public.destination_type ADD VALUE IF NOT EXISTS 'emergency';
