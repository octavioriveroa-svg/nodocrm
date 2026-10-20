-- =============================================
-- MIGRATION: V15 Fix Archivos RLS for Nodo Roles
-- =============================================
-- The original archivos RLS policies only allowed 'epc' (project owner)
-- and 'analista' roles. Nodo internal roles (nodo_admin, nodo_analista,
-- financiero) were blocked from inserting, selecting, and deleting.

-- 1. Fix SELECT policy to include all Nodo roles
DROP POLICY IF EXISTS "Ver archivos del proyecto" ON public.archivos;
CREATE POLICY "Ver archivos del proyecto"
  ON public.archivos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proyectos pr
      WHERE pr.id = proyecto_id AND pr.epcista_id = auth.uid()
    )
    OR public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'analista', 'financiero')
  );

-- 2. Fix INSERT policy to include all Nodo roles
DROP POLICY IF EXISTS "Insertar archivos" ON public.archivos;
CREATE POLICY "Insertar archivos"
  ON public.archivos FOR INSERT
  WITH CHECK (
    auth.uid() = autor_id
    AND (
      EXISTS (
        SELECT 1 FROM public.proyectos pr
        WHERE pr.id = proyecto_id AND pr.epcista_id = auth.uid()
      )
      OR public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'analista', 'financiero')
    )
  );

-- 3. Fix DELETE policy to include all Nodo roles
DROP POLICY IF EXISTS "Admin elimina archivos" ON public.archivos;
DROP POLICY IF EXISTS "Eliminar archivos" ON public.archivos;
CREATE POLICY "Eliminar archivos"
  ON public.archivos FOR DELETE
  USING (
    auth.uid() = autor_id
    OR public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
  );

-- =============================================
-- Also fix comentarios RLS (same issue)
-- =============================================

-- 4. Fix comentarios SELECT policy
DROP POLICY IF EXISTS "Ver comentarios del proyecto" ON public.comentarios;
CREATE POLICY "Ver comentarios del proyecto"
  ON public.comentarios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proyectos pr
      WHERE pr.id = proyecto_id AND pr.epcista_id = auth.uid()
    )
    OR public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'analista', 'financiero')
  );

-- 5. Fix comentarios INSERT policy
DROP POLICY IF EXISTS "Insertar comentarios" ON public.comentarios;
CREATE POLICY "Insertar comentarios"
  ON public.comentarios FOR INSERT
  WITH CHECK (
    auth.uid() = autor_id
    AND (
      EXISTS (
        SELECT 1 FROM public.proyectos pr
        WHERE pr.id = proyecto_id AND pr.epcista_id = auth.uid()
      )
      OR public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'analista', 'financiero')
    )
  );
