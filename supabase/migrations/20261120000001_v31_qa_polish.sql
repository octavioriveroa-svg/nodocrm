-- ============================================================================
-- MIGRATION: v31 — Post-Deploy QA Polish (proyectos->profiles FKs & v2 cleanup)
-- Dependencies: v30_live_qa_remediation.sql
-- Purpose:
--   1. Ensure proyectos(epcista_id, responsable_nodo_id, finder_id) FKs point to
--      public.profiles(id) so PostgREST joins on /admin/proyectos succeed 200 OK
--   2. Remove leftover inactive QA Excel import template (qa-solar-model)
--   3. Reload PostgREST schema cache
-- ============================================================================

-- ── 1. Align proyectos -> public.profiles foreign keys cleanly ───────────────
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT * FROM (VALUES
      ('proyectos_epcista_id_fkey', 'epcista_id'),
      ('proyectos_responsable_nodo_id_fkey', 'responsable_nodo_id'),
      ('proyectos_finder_id_fkey', 'finder_id')
    ) AS t(con_name, col_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = fk.con_name
        AND conrelid = 'public.proyectos'::regclass
        AND confrelid = 'public.profiles'::regclass
    ) THEN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = fk.con_name
          AND conrelid = 'public.proyectos'::regclass
      ) THEN
        EXECUTE format('ALTER TABLE public.proyectos DROP CONSTRAINT %I', fk.con_name);
      END IF;

      EXECUTE format(
        'UPDATE public.proyectos p SET %I = NULL WHERE %I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p.%I)',
        fk.col_name, fk.col_name, fk.col_name
      );

      EXECUTE format(
        'ALTER TABLE public.proyectos ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
        fk.con_name, fk.col_name
      );
    END IF;
  END LOOP;
END $$;

-- ── 2. Remove inactive QA Excel import v2 template trace ────────────────────
DELETE FROM public.calculadora_templates
WHERE is_active = FALSE
  AND (nombre LIKE '%qa-solar-model%' OR nombre LIKE '%E2E_QA%');

-- ── 3. Reload PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
