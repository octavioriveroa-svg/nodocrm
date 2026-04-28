-- =============================================
-- MIGRATION: V11 Admin Update Role Fix
-- =============================================
-- Corrige la función admin_update_role:
--   1. Ahora verifica 'nodo_admin' (no el viejo 'admin')
--   2. No intenta escribir en 'updated_at' (esa columna no existe en profiles)
--   3. Acepta todos los roles vigentes del sistema

CREATE OR REPLACE FUNCTION public.admin_update_role(target_id UUID, new_rol TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_rol TEXT;
BEGIN
  -- Obtener el rol del usuario que hace la llamada
  SELECT rol INTO caller_rol FROM public.profiles WHERE id = auth.uid();
  
  -- Solo nodo_admin puede cambiar roles
  IF caller_rol != 'nodo_admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Validar el nuevo rol
  IF new_rol NOT IN ('epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador', 'pendiente') THEN
    RAISE EXCEPTION 'Invalid role: %', new_rol;
  END IF;

  -- Actualizar solo la columna rol (profiles no tiene updated_at)
  UPDATE public.profiles SET rol = new_rol WHERE id = target_id;
END;
$$;

-- Política UPDATE para que el admin pueda modificar cualquier perfil
DROP POLICY IF EXISTS "Admin actualiza perfiles" ON public.profiles;
CREATE POLICY "Admin actualiza perfiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'nodo_admin'
    )
  );
