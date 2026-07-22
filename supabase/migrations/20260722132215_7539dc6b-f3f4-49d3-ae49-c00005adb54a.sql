
-- Restrict public read on landing_pages to only rows whose tag is active
DROP POLICY IF EXISTS "Public read landing pages" ON public.landing_pages;
CREATE POLICY "Public read active landing pages" ON public.landing_pages
FOR SELECT
USING (EXISTS (SELECT 1 FROM public.tags t WHERE t.id = landing_pages.tag_id AND t.status = 'active'));

-- Restrict has_role EXECUTE: keep only for service_role and postgres; RLS policy evaluation
-- of SECURITY DEFINER functions uses the definer's rights, not the caller's EXECUTE grant,
-- so revoking from PUBLIC/authenticated/anon does not break RLS policies that call it.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
