-- =============================================
-- MIGRATION: V11 Admin Update Role Fix
-- =============================================
-- Actualiza la función RPC admin_update_role para que verifique
-- correctamente el nuevo rol 'nodo_admin' en lugar del obsoleto 'admin'.

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
  
  -- Verificar si es administrador (ahora 'nodo_admin' en lugar de 'admin')
  IF caller_rol != 'nodo_admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Validar el nuevo rol contra los permitidos en el sistema
  IF new_rol NOT IN ('epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador', 'pendiente') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Actualizar el perfil
  UPDATE public.profiles SET rol = new_rol, updated_at = NOW() WHERE id = target_id;
END;
$$;

-- Opcional: También agregamos una política UPDATE para los admins directamente
-- en caso de que quieran usar supabase.from('profiles').update()
DROP POLICY IF EXISTS "Admin actualiza perfiles" ON public.profiles;
CREATE POLICY "Admin actualiza perfiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'nodo_admin'
    )
  );
