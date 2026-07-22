
REVOKE SELECT ON public.tags FROM anon;
GRANT SELECT (id, name, status, destination_type, destination) ON public.tags TO anon;
