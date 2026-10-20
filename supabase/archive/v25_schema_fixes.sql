-- =============================================
-- MIGRATION: v25 - Fix Missing Schema Columns & Updates
-- Executar en el SQL Editor de Supabase
-- =============================================

-- 1. Add 'moneda' to opciones_financiamiento (Fixes the critical save error)
ALTER TABLE public.opciones_financiamiento 
ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'MXN';

COMMENT ON COLUMN public.opciones_financiamiento.moneda IS 'Moneda de la opción de financiamiento (MXN o USD)';

-- 2. Add missing columns to proyectos
ALTER TABLE public.proyectos 
ADD COLUMN IF NOT EXISTS tipo_instalacion TEXT,
ADD COLUMN IF NOT EXISTS incluye_mem BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS demanda_kw NUMERIC,
ADD COLUMN IF NOT EXISTS plan_bloqueado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS responsable_nodo_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS consumo_anual_gwh NUMERIC,
ADD COLUMN IF NOT EXISTS tarifa_actual_cfe NUMERIC,
ADD COLUMN IF NOT EXISTS codigo_postal TEXT;

-- 3. Relax 'tipo' check constraint in proyectos to allow 'FV' and 'FV+BESS'
-- Note: We must drop the old constraint first and recreate it, if it exists.
-- The standard naming for a check constraint on a column is usually `<table_name>_<column_name>_check`.
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.proyectos DROP CONSTRAINT proyectos_tipo_check;
    EXCEPTION
        WHEN undefined_object THEN
            -- Ignore if constraint doesn't exist
    END;
END $$;

ALTER TABLE public.proyectos
ADD CONSTRAINT proyectos_tipo_check CHECK (tipo IN ('BESS', 'MEM', 'BESS+MEM', 'FV', 'FV+BESS'));

-- 4. Create missing storage buckets (if they don't already exist)
-- This allows storing evidence and brand assets securely.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('evidencias', 'evidencias', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('evidencias-instalacion', 'evidencias-instalacion', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;
