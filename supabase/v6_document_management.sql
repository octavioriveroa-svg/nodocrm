-- =============================================
-- MIGRATION: V6 Document Management
-- =============================================

-- 1. Add new columns to archivos table
ALTER TABLE public.archivos ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE public.archivos ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[];

-- 2. Expand the archivos_tipo_check constraint
ALTER TABLE public.archivos DROP CONSTRAINT IF EXISTS archivos_tipo_check;
ALTER TABLE public.archivos ADD CONSTRAINT archivos_tipo_check
  CHECK (tipo IN ('recibo_cfe', 'propuesta', 'machote_contrato', 'adjunto_epcista', 'propuesta_analista', 'evidencia_hito', 'oferta_suministrador', 'documento_general'));
