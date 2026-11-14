-- Migration: 20261112000001_create_notificaciones.sql
-- Description: Creates the missing in-app notifications table with RLS and indexes.

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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON public.notificaciones(usuario_id, leido, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_proyecto ON public.notificaciones(proyecto_id) WHERE proyecto_id IS NOT NULL;

-- Row Level Security
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
