-- =============================================
-- MIGRATION: v28 - Annual Savings & Storage Buckets
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- 1. Ensure columns for Annual Savings on configuraciones_tecnicas
ALTER TABLE public.configuraciones_tecnicas
ADD COLUMN IF NOT EXISTS ahorro_estimado_anual NUMERIC,
ADD COLUMN IF NOT EXISTS ahorro_estimado_mensual NUMERIC,
ADD COLUMN IF NOT EXISTS ahorro_moneda TEXT DEFAULT 'MXN';

-- Migrate existing monthly savings to annual if annual is NULL
UPDATE public.configuraciones_tecnicas
SET ahorro_estimado_anual = ahorro_estimado_mensual * 12
WHERE ahorro_estimado_anual IS NULL AND ahorro_estimado_mensual IS NOT NULL;

COMMENT ON COLUMN public.configuraciones_tecnicas.ahorro_estimado_anual IS 'Ahorro bruto estimado anual generado por la solución técnica instalada';
COMMENT ON COLUMN public.configuraciones_tecnicas.ahorro_estimado_mensual IS 'Ahorro mensual derivado o legacy';
COMMENT ON COLUMN public.configuraciones_tecnicas.ahorro_moneda IS 'Moneda del ahorro bruto estimado (MXN o USD)';

-- 2. Ensure columns for Annual Savings on opciones_financiamiento
ALTER TABLE public.opciones_financiamiento
ADD COLUMN IF NOT EXISTS ahorro_estimado_anual NUMERIC;

-- Migrate existing monthly financing savings to annual if annual is NULL
UPDATE public.opciones_financiamiento
SET ahorro_estimado_anual = ahorro_estimado_mensual * 12
WHERE ahorro_estimado_anual IS NULL AND ahorro_estimado_mensual IS NOT NULL;

COMMENT ON COLUMN public.opciones_financiamiento.ahorro_estimado_anual IS 'Ahorro neto anual estimado post-financiamiento';

-- 3. Storage Bucket: recibos-cfe
INSERT INTO storage.buckets (id, name, public)
VALUES ('recibos-cfe', 'recibos-cfe', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for recibos-cfe
DROP POLICY IF EXISTS "Subir recibos autenticados" ON storage.objects;
CREATE POLICY "Subir recibos autenticados"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recibos-cfe');

DROP POLICY IF EXISTS "Actualizar recibos autenticados" ON storage.objects;
CREATE POLICY "Actualizar recibos autenticados"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'recibos-cfe');

DROP POLICY IF EXISTS "Eliminar recibos autenticados" ON storage.objects;
CREATE POLICY "Eliminar recibos autenticados"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'recibos-cfe');

DROP POLICY IF EXISTS "Ver recibos publicos" ON storage.objects;
CREATE POLICY "Ver recibos publicos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'recibos-cfe');
