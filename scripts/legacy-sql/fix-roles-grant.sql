-- Grant table-level SELECT permission to authenticated role
-- (RLS policies only work AFTER this basic permission is granted)
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.roles TO anon;
