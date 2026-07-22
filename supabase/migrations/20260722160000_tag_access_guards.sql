-- Access guards evaluated server-side (service role) by the public redirector.
-- These columns are intentionally NOT granted to anon: access_password must
-- never reach the client, and the guards are enforced on the server.
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS max_scans INTEGER,
  ADD COLUMN IF NOT EXISTS activate_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_password TEXT;
