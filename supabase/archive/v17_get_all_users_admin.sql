-- =============================================
-- MIGRATION: V17 — get_all_users_admin RPC
-- =============================================
-- Creates a SECURITY DEFINER function that joins auth.users with
-- public.profiles so that nodo_admin and nodo_analista can see
-- user emails without needing direct access to the auth schema.

CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  empresa TEXT,
  rol TEXT,
  email TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_rol TEXT;
BEGIN
  -- Only nodo_admin and nodo_analista can call this
  SELECT p.rol INTO caller_rol FROM public.profiles p WHERE p.id = auth.uid();

  IF caller_rol NOT IN ('nodo_admin', 'nodo_analista') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.nombre,
      p.empresa,
      p.rol,
      u.email::TEXT,
      p.created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
END;
$$;
