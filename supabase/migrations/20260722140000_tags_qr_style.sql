-- Per-tag QR customization (colors, center logo, caption). Only read by the
-- authenticated owner in the panel; the public redirector never needs it, so
-- no anon column grant is added.
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS qr_style JSONB NOT NULL DEFAULT '{}'::jsonb;
