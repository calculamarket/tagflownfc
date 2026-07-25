-- "Menu de links" destination: a link-in-bio style page with several typed
-- options (Instagram, WhatsApp, PIX, site, …). The configuration lives in the
-- tag's existing `destination` JSONB, so no new table is needed — only the enum
-- value. ADD VALUE is safe inside a transaction on PG12+ (not used here).
ALTER TYPE public.destination_type ADD VALUE IF NOT EXISTS 'links';
