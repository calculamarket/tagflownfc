-- Which medium the scan came from: 'nfc', 'qr' or NULL when not identified.
-- The NFC tag is written with ?s=nfc appended to the URL; the printed QR keeps
-- the plain URL so it stays as small as possible for 3D printing.
-- anon already has table-level INSERT on reads, so it may write this column.
ALTER TABLE public.reads ADD COLUMN IF NOT EXISTS source TEXT;
