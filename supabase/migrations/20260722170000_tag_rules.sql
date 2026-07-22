-- Dynamic redirect rules: one tag can point to different URLs based on the
-- scan context (device platform, country, time window, scan count).
-- Evaluated server-side by the redirector (service role); owners manage them.
CREATE TABLE public.tag_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id TEXT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  condition_type TEXT NOT NULL,        -- device | country | time | scan_count
  condition_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  destination_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tag_rules_tag_priority_idx ON public.tag_rules(tag_id, priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tag_rules TO authenticated;
GRANT ALL ON public.tag_rules TO service_role;
ALTER TABLE public.tag_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage tag rules" ON public.tag_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);
