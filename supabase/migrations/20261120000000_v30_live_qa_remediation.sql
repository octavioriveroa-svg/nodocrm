-- ============================================================================
-- MIGRATION: v30 — Live QA Remediation (FKs, MEM RLS, Storage DELETE, Schema Reload)
-- Dependencies: v29_savings_calculator.sql
-- Purpose:
--   1. Guarantee proyecto_sitios foreign keys to sitios & proyectos exist in PostgREST cache
--   2. Allow 'suministrador' role to SELECT MEM-eligible proyectos on /mem
--   3. Allow authorized project members to DELETE project documents (<proyecto_id>/*) in storage
--   4. Clean up any inactive E2E_QA test template rows & reload PostgREST schema cache
-- ============================================================================

-- ── 1. Ensure FK constraints on public.proyecto_sitios exist cleanly ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proyecto_sitios_sitio_id_fkey'
  ) THEN
    DELETE FROM public.proyecto_sitios ps
    WHERE NOT EXISTS (SELECT 1 FROM public.sitios s WHERE s.id = ps.sitio_id);

    ALTER TABLE public.proyecto_sitios
      ADD CONSTRAINT proyecto_sitios_sitio_id_fkey
      FOREIGN KEY (sitio_id) REFERENCES public.sitios(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proyecto_sitios_proyecto_id_fkey'
  ) THEN
    DELETE FROM public.proyecto_sitios ps
    WHERE NOT EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = ps.proyecto_id);

    ALTER TABLE public.proyecto_sitios
      ADD CONSTRAINT proyecto_sitios_proyecto_id_fkey
      FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 2. Wholesale Market (/mem): allow suministrador to read MEM projects ──────
DROP POLICY IF EXISTS "Suministrador ve proyectos MEM" ON public.proyectos;
CREATE POLICY "Suministrador ve proyectos MEM"
  ON public.proyectos FOR SELECT
  TO authenticated
  USING (
    public.get_my_rol() = 'suministrador'
    AND (incluye_mem = TRUE OR tipo IN ('MEM', 'BESS+MEM'))
  );

-- ── 3. Storage: allow DELETE on <proyecto_id>/* in archivos-proyectos ─────────
DROP POLICY IF EXISTS "Eliminar documentos proyecto" ON storage.objects;
CREATE POLICY "Eliminar documentos proyecto"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'archivos-proyectos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN ((storage.foldername(name))[1])::uuid
      END
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR p.epcista_id = auth.uid()
          OR p.finder_id = auth.uid()
          OR p.financiero_id = auth.uid()
        )
    )
  );

-- ── 4. Zero-Trace cleanup of inactive E2E QA template + PostgREST reload ──────
DELETE FROM public.calculadora_templates
WHERE is_active = FALSE
  AND nombre LIKE '%E2E_QA%';

NOTIFY pgrst, 'reload schema';
