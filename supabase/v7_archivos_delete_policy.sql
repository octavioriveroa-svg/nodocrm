-- =============================================
-- MIGRATION: V7 Archivos Delete Policy
-- =============================================
-- Allows deletion of files by the file author or by nodo_admin users.

CREATE POLICY "Eliminar archivos propios o admin"
  ON public.archivos FOR DELETE
  USING (
    auth.uid() = autor_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol IN ('nodo_admin', 'nodo_analista')
    )
  );
