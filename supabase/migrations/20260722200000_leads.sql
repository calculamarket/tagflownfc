-- Lead capture from the public landing page.
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id TEXT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leads_user_created_idx ON public.leads(user_id, created_at DESC);
CREATE INDEX leads_tag_idx ON public.leads(tag_id);

-- Owners read/delete their own leads. There is deliberately NO insert policy:
-- submissions go through a server function using the service role, which
-- resolves the tag owner itself. That way the public form cannot forge user_id.
GRANT SELECT, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their leads" ON public.leads FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners delete their leads" ON public.leads FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Lead-form configuration for a tag's landing page
-- (enabled, which fields, labels, success message).
ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS lead_form JSONB NOT NULL DEFAULT '{}'::jsonb;
