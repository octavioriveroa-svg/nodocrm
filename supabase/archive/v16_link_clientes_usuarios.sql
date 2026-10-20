-- =============================================
-- V16: Link Client CRM Cards ↔ User Profiles
-- =============================================
-- This migration:
--   1. Adds cliente_crm_id to profiles (already applied manually)
--   2. Creates get_my_cliente_crm_id() helper (already applied manually)
--   3. Fixes the FK on proyectos.cliente_id (profiles → clientes)
--   4. Updates RLS so cliente_final users see their company's projects

-- ─── 1. Add cliente_crm_id to profiles (idempotent) ───
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cliente_crm_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

-- ─── 2. Helper function (idempotent) ───
CREATE OR REPLACE FUNCTION public.get_my_cliente_crm_id() RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT cliente_crm_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ─── 3. Fix proyectos.cliente_id FK ───
-- Drop the old FK that points to profiles(id)
-- The constraint name follows Postgres naming: {table}_{column}_fkey
ALTER TABLE public.proyectos DROP CONSTRAINT IF EXISTS proyectos_cliente_id_fkey;

-- Re-add as FK to clientes(id)
ALTER TABLE public.proyectos
  ADD CONSTRAINT proyectos_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

-- ─── 4. Update RLS policies for proyectos ───
-- Drop old policy that uses cliente_id = auth.uid() (direct user match)
DROP POLICY IF EXISTS "Nodo, Cliente y Financiero ven proyectos" ON public.proyectos;

-- Recreate: cliente_final users see projects via their company's cliente_crm_id
CREATE POLICY "Nodo, Cliente y Financiero ven proyectos" ON public.proyectos FOR SELECT
  USING (
    epcista_id = auth.uid()
    OR financiero_id = auth.uid()
    OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
    OR (
      public.get_my_rol() = 'cliente_final'
      AND cliente_id IS NOT NULL
      AND cliente_id = public.get_my_cliente_crm_id()
    )
  );

-- Also update hitos, archivos, comentarios visibility for cliente_final
-- Hitos: cliente_final can see hitos of their projects
DROP POLICY IF EXISTS "Ver hitos" ON public.hitos_construccion;
CREATE POLICY "Ver hitos" ON public.hitos_construccion FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = proyecto_id
      AND (
        p.epcista_id = auth.uid()
        OR p.financiero_id = auth.uid()
        OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
        OR (
          public.get_my_rol() = 'cliente_final'
          AND p.cliente_id IS NOT NULL
          AND p.cliente_id = public.get_my_cliente_crm_id()
        )
      )
    )
  );

-- Archivos: cliente_final can see documents of their projects
DROP POLICY IF EXISTS "Ver archivos del proyecto" ON public.archivos;
CREATE POLICY "Ver archivos del proyecto" ON public.archivos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = proyecto_id
      AND (
        p.epcista_id = auth.uid()
        OR p.financiero_id = auth.uid()
        OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
        OR (
          public.get_my_rol() = 'cliente_final'
          AND p.cliente_id IS NOT NULL
          AND p.cliente_id = public.get_my_cliente_crm_id()
        )
      )
    )
  );

-- Comentarios: cliente_final can see comments of their projects
DROP POLICY IF EXISTS "Ver comentarios" ON public.comentarios;
CREATE POLICY "Ver comentarios" ON public.comentarios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = proyecto_id
      AND (
        p.epcista_id = auth.uid()
        OR p.financiero_id = auth.uid()
        OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
        OR (
          public.get_my_rol() = 'cliente_final'
          AND p.cliente_id IS NOT NULL
          AND p.cliente_id = public.get_my_cliente_crm_id()
        )
      )
    )
  );

-- Telemetria: cliente_final can see telemetry of their projects
DROP POLICY IF EXISTS "Clientes ven telemetria de sus proyectos" ON public.telemetria_egauge;
CREATE POLICY "Clientes ven telemetria de sus proyectos" ON public.telemetria_egauge FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = proyecto_id
      AND (
        p.epcista_id = auth.uid()
        OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
        OR (
          public.get_my_rol() = 'cliente_final'
          AND p.cliente_id IS NOT NULL
          AND p.cliente_id = public.get_my_cliente_crm_id()
        )
      )
    )
  );

-- Allow EPC to see profiles of users linked to their clients
DROP POLICY IF EXISTS "EPC ve usuarios de sus clientes" ON public.profiles;
CREATE POLICY "EPC ve usuarios de sus clientes" ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
    OR (
      public.get_my_rol() = 'epc'
      AND cliente_crm_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_crm_id
        AND c.epcista_id = auth.uid()
      )
    )
  );
