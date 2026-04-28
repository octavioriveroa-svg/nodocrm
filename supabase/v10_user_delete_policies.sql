-- =============================================
-- MIGRATION: V10 Creator Delete Policies
-- =============================================
-- Asegurar que los usuarios puedan eliminar los registros
-- que ellos mismos han creado (Comentarios y Ofertas MEM).
-- Nota: Archivos y Proyectos ya tienen estas políticas.

-- 1. Comentarios
DROP POLICY IF EXISTS "Autor elimina sus propios comentarios" ON public.comentarios;
CREATE POLICY "Autor elimina sus propios comentarios"
  ON public.comentarios FOR DELETE
  USING (auth.uid() = autor_id);

-- 2. Ofertas MEM / Financiamiento
DROP POLICY IF EXISTS "Suministrador elimina sus propias ofertas" ON public.ofertas_mem;
CREATE POLICY "Suministrador elimina sus propias ofertas"
  ON public.ofertas_mem FOR DELETE
  USING (auth.uid() = suministrador_id);

-- 3. Hitos de Construcción
-- En v2_migration.sql ya se les dio acceso 'ALL' a los EPCistas
-- para editar/borrar hitos, pero lo hacemos explícito para Delete aquí 
-- por seguridad en caso de futuras refactorizaciones.
DROP POLICY IF EXISTS "EPCista elimina hitos de sus proyectos" ON public.hitos_construccion;
CREATE POLICY "EPCista elimina hitos de sus proyectos"
  ON public.hitos_construccion FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.proyectos pr
      WHERE pr.id = proyecto_id AND pr.epcista_id = auth.uid()
    )
  );
