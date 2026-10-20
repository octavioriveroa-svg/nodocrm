-- ============================================================================
-- MIGRATION: 20261021000002_dashboard_views_and_indexes.sql
-- Covers: PERF-01, PERF-03
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_telemetria_proyecto_time
  ON public.telemetria_egauge (proyecto_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_proyectos_estado_created
  ON public.proyectos (estado, created_at DESC);

-- Ensure foreign key constraint from proyectos.epcista_id to profiles.id exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proyectos_epcista_id_fkey'
  ) THEN
    ALTER TABLE public.proyectos
      ADD CONSTRAINT proyectos_epcista_id_fkey
      FOREIGN KEY (epcista_id) REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;
