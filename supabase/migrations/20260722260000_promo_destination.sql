-- "Promoção" destination: a small offer showcase (up to 3 products) with
-- photos, price de/por, coupon and validity. No checkout. Config lives in the
-- tag's existing destination JSONB, so only the enum value is needed.
ALTER TYPE public.destination_type ADD VALUE IF NOT EXISTS 'promo';
