-- =============================================
-- MIGRATION: V9 Admin Global Delete Policies
-- =============================================
-- Asegurar que el rol 'nodo_admin' pueda eliminar registros 
-- en todas las tablas principales de la base de datos.

-- 1. Profiles (Usuarios)
DROP POLICY IF EXISTS "Admin elimina perfiles" ON public.profiles;
CREATE POLICY "Admin elimina perfiles"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'nodo_admin'
    )
  );

-- 2. Comentarios
DROP POLICY IF EXISTS "Admin elimina comentarios" ON public.comentarios;
CREATE POLICY "Admin elimina comentarios"
  ON public.comentarios FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'nodo_admin'
    )
  );

-- 3. Hitos Construcción
DROP POLICY IF EXISTS "Admin elimina hitos" ON public.hitos_construccion;
CREATE POLICY "Admin elimina hitos"
  ON public.hitos_construccion FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'nodo_admin'
    )
  );

-- 4. Ofertas MEM / Financiamiento
DROP POLICY IF EXISTS "Admin elimina ofertas" ON public.ofertas_mem;
CREATE POLICY "Admin elimina ofertas"
  ON public.ofertas_mem FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'nodo_admin'
    )
  );

-- 5. Telemetría eGauge
DROP POLICY IF EXISTS "Admin elimina telemetria" ON public.telemetria_egauge;
CREATE POLICY "Admin elimina telemetria"
  ON public.telemetria_egauge FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'nodo_admin'
    )
  );

-- (Nota: Las políticas de eliminación para 'proyectos' y 'archivos' ya fueron 
-- agregadas en las migraciones v8_proyectos_delete_policy.sql y v7_archivos_delete_policy.sql respectivamente)
