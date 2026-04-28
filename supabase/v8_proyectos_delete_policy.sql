-- =============================================
-- MIGRATION: V8 Proyectos Delete Policy
-- =============================================
-- Permite borrar proyectos a:
-- 1. Usuarios con rol 'nodo_admin'
-- 2. El EPCista creador del proyecto (epcista_id = auth.uid())

CREATE POLICY "Admin y EPCista eliminan proyectos"
  ON public.proyectos FOR DELETE
  USING (
    auth.uid() = epcista_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'nodo_admin'
    )
  );
