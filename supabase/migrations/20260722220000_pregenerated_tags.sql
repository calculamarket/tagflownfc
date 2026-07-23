-- Pre-generated (unclaimed) tags for the physical 3D-printed product.
--
-- Production flow: admin generates a batch -> tags exist with user_id NULL and
-- a secret claim_code -> the piece is printed and shipped with the code on a
-- paper label -> the buyer enters the code and the tag becomes theirs.
--
-- RLS note: with user_id nullable, "auth.uid() = user_id" evaluates to NULL for
-- unclaimed rows, which RLS treats as false. So unclaimed tags are invisible to
-- regular users automatically; only admins (has_role) and the service role see
-- them. The claim itself runs through the service role.

ALTER TABLE public.tags ALTER COLUMN user_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.tag_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tag_batches TO authenticated;
GRANT ALL ON public.tag_batches TO service_role;
ALTER TABLE public.tag_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage batches" ON public.tag_batches;
CREATE POLICY "Admins manage batches" ON public.tag_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS claim_code TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.tag_batches(id) ON DELETE SET NULL;

-- claim_code is secret. It is NOT added to the anon column grant, so the public
-- redirector can never read it; only the service role does, during the claim.
CREATE UNIQUE INDEX IF NOT EXISTS tags_claim_code_key
  ON public.tags(claim_code) WHERE claim_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS tags_batch_id_idx ON public.tags(batch_id);
