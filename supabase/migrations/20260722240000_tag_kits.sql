-- Products carrying more than one QR (triangle = 3 faces, cube = 6, totem = N).
--
-- A kit groups the tags of one physical piece under a SINGLE activation code,
-- so the customer types one code and gets every face at once. Each face stays a
-- normal tag, keeping destinations, rules, analytics and the redirector intact.
--
-- Single-QR pieces already produced keep using tags.claim_code; the claim flow
-- falls back to it, so existing stock is unaffected.

CREATE TABLE IF NOT EXISTS public.tag_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.tag_batches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,               -- "Cubo", "Triângulo", "Totem"…
  slots INTEGER NOT NULL,            -- how many QR codes the piece carries
  claim_code TEXT,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Secret, like tags.claim_code: never granted to anon, only the service role
-- reads it during activation.
CREATE UNIQUE INDEX IF NOT EXISTS tag_kits_claim_code_key
  ON public.tag_kits(claim_code) WHERE claim_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS tag_kits_batch_idx ON public.tag_kits(batch_id);

GRANT SELECT ON public.tag_kits TO authenticated;
GRANT ALL ON public.tag_kits TO service_role;
ALTER TABLE public.tag_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their kits" ON public.tag_kits;
CREATE POLICY "Owners read their kits" ON public.tag_kits FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Which piece a tag belongs to, and which face of it.
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS kit_id UUID REFERENCES public.tag_kits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slot INTEGER,
  ADD COLUMN IF NOT EXISTS slot_label TEXT;

CREATE INDEX IF NOT EXISTS tags_kit_slot_idx ON public.tags(kit_id, slot);

-- Record what was produced, for traceability of a batch.
ALTER TABLE public.tag_batches
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS slots INTEGER;
