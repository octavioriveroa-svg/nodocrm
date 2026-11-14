-- Migration: 20261112000003_tarifa_cfe_varchar.sql
-- Description: Idempotently ensures proyectos.tarifa_actual_cfe is VARCHAR(20) to store tariff codes (GDMTH, DIST, DIT, DAC, etc.)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'proyectos' AND column_name = 'tarifa_actual_cfe'
  ) THEN
    ALTER TABLE public.proyectos ADD COLUMN tarifa_actual_cfe VARCHAR(20);
  ELSE
    ALTER TABLE public.proyectos ALTER COLUMN tarifa_actual_cfe TYPE VARCHAR(20) USING tarifa_actual_cfe::text;
  END IF;
END $$;
