-- =============================================================================
-- Nodo CRM — Consolidated Sprint 3 DDL Bundle (Idempotent One-Click Script)
-- Target Database: Supabase PostgreSQL (nlqrdxwyxmgdwawedweh)
-- Contents:
--   1. TASK-002: public.notificaciones table, indexes & RLS policies
--   2. TASK-005: sync_profile_role_to_app_metadata() trigger + auth.users backfill
--   3. TASK-006: public.proyectos.tarifa_actual_cfe VARCHAR(20) alignment
--   4. TASK-007: 10 Foreign Key B-Tree indexes across core tables
-- Safe to run multiple times in Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: TASK-002 — Notifications Table & RLS (20261112000001)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL DEFAULT 'comentario'
                CHECK (tipo IN ('comentario', 'respuesta', 'resuelto', 'sistema', 'evidencia')),
  titulo        TEXT NOT NULL,
  mensaje       TEXT,
  enlace        TEXT,
  proyecto_id   UUID REFERENCES public.proyectos(id) ON DELETE CASCADE,
  comentario_id UUID REFERENCES public.plan_comentarios(id) ON DELETE CASCADE,
  leido         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON public.notificaciones(usuario_id, leido, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_proyecto ON public.notificaciones(proyecto_id) WHERE proyecto_id IS NOT NULL;

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notificaciones: solo propias" ON public.notificaciones;
CREATE POLICY "Notificaciones: solo propias" ON public.notificaciones
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Notificaciones: marcar leído" ON public.notificaciones;
CREATE POLICY "Notificaciones: marcar leído" ON public.notificaciones
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Notificaciones: insercion autenticados" ON public.notificaciones;
CREATE POLICY "Notificaciones: insercion autenticados" ON public.notificaciones
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Notificaciones: eliminar propias" ON public.notificaciones;
CREATE POLICY "Notificaciones: eliminar propias" ON public.notificaciones
  FOR DELETE TO authenticated USING (usuario_id = auth.uid());

-- -----------------------------------------------------------------------------
-- SECTION 2: TASK-005 — Profile Role to JWT Custom Claims Trigger (20261112000002)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_app_metadata()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', NEW.rol)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role_to_app_metadata ON public.profiles;

CREATE TRIGGER trg_sync_profile_role_to_app_metadata
AFTER INSERT OR UPDATE OF rol ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_role_to_app_metadata();

UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', p.rol)
FROM public.profiles p
WHERE u.id = p.id AND (u.raw_app_meta_data->>'user_role' IS DISTINCT FROM p.rol);

-- -----------------------------------------------------------------------------
-- SECTION 3: TASK-006 — Proyectos CFE Tariff Code Column Alignment (20261112000003)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- SECTION 4: TASK-007 — Foreign Key B-Tree Performance Indexes (20261112000004)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_proyectos_cliente_id
  ON public.proyectos(cliente_id)
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_epcista_id
  ON public.proyectos(epcista_id)
  WHERE epcista_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_financiero_id
  ON public.proyectos(financiero_id)
  WHERE financiero_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_finder_id
  ON public.proyectos(finder_id)
  WHERE finder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_responsable_nodo_id
  ON public.proyectos(responsable_nodo_id)
  WHERE responsable_nodo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sitios_cliente_id
  ON public.sitios(cliente_id);

CREATE INDEX IF NOT EXISTS idx_proyecto_sitios_proyecto_id
  ON public.proyecto_sitios(proyecto_id);

CREATE INDEX IF NOT EXISTS idx_proyecto_sitios_sitio_id
  ON public.proyecto_sitios(sitio_id);

CREATE INDEX IF NOT EXISTS idx_configuraciones_tecnicas_proyecto_id
  ON public.configuraciones_tecnicas(proyecto_id);

CREATE INDEX IF NOT EXISTS idx_opciones_financiamiento_proyecto_id
  ON public.opciones_financiamiento(proyecto_id);
