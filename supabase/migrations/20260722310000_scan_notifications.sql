-- Notificações de escaneamento.
--
-- Quando uma tag com notify_on_scan=true é lida, o resolvedor (service role)
-- grava uma notificação para o dono. O app mostra um sino com o total não lido.
-- Canais externos (e-mail/WhatsApp) podem ler desta tabela depois.

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id     TEXT REFERENCES public.tags(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'scan',
  data       JSONB NOT NULL DEFAULT '{}',
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications(user_id) WHERE read = false;

-- authenticated lê/marca-como-lida/apaga as próprias; o INSERT vem do service role.
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own notifications" ON public.notifications;
CREATE POLICY "Read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Update own notifications" ON public.notifications;
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own notifications" ON public.notifications;
CREATE POLICY "Delete own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Liga/desliga o aviso por tag.
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS notify_on_scan BOOLEAN NOT NULL DEFAULT false;
