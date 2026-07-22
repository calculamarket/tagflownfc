-- New destination types + A/B variant tracking.
-- ALTER TYPE ADD VALUE is allowed inside a transaction on PG12+; the new values
-- are only referenced by application code (later), never within this migration.
ALTER TYPE public.destination_type ADD VALUE IF NOT EXISTS 'vcard';
ALTER TYPE public.destination_type ADD VALUE IF NOT EXISTS 'review_gate';
ALTER TYPE public.destination_type ADD VALUE IF NOT EXISTS 'ab_test';

-- Which A/B variant a scan was routed to ("A"/"B"); null for other types.
-- anon already has table-level INSERT on reads, so it may write this column.
ALTER TABLE public.reads ADD COLUMN IF NOT EXISTS variant TEXT;
