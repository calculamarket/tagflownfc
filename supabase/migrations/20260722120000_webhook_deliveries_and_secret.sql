-- Webhooks: HMAC secret + delivery log
-- Adds a per-webhook signing secret and a deliveries table so every real
-- dispatch (tag.read / tag.created / tag.updated) can be logged and retried.

-- 1. Signing secret on each webhook (used for the X-TagFlow-Signature HMAC header).
-- Uses gen_random_uuid() (core, no pgcrypto dependency): two UUIDs → 64 hex chars.
ALTER TABLE public.webhooks
  ADD COLUMN IF NOT EXISTS secret TEXT NOT NULL
  DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

-- 2. Delivery log
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event public.webhook_event NOT NULL,
  url TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_code INTEGER,
  ok BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX webhook_deliveries_webhook_id_idx ON public.webhook_deliveries(webhook_id);
CREATE INDEX webhook_deliveries_user_id_created_idx ON public.webhook_deliveries(user_id, created_at DESC);

GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Owners (and admins) can read their own delivery history. Inserts happen only
-- from the server via the service role, so there is no INSERT policy for users.
CREATE POLICY "Owners read their webhook deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
