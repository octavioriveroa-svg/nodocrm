-- =============================================
-- MIGRATION: Add Moneda to Standalone Financing Options
-- Executar en el SQL Editor de Supabase
-- =============================================

ALTER TABLE public.opciones_financiamiento 
ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'MXN';
