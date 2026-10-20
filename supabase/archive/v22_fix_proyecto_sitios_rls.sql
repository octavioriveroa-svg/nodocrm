-- =============================================
-- MIGRATION: V22 Fix Proyecto Sitios RLS
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- Enable RLS
ALTER TABLE public.proyecto_sitios ENABLE ROW LEVEL SECURITY;

-- Drop old policies to avoid collision
DROP POLICY IF EXISTS "EPC gestiona sitios de sus proyectos" ON public.proyecto_sitios;
DROP POLICY IF EXISTS "Roles ven sitios de sus proyectos" ON public.proyecto_sitios;
DROP POLICY IF EXISTS "Nodo gestiona sitios de proyectos" ON public.proyecto_sitios;
DROP POLICY IF EXISTS "Finder gestiona sitios de sus proyectos" ON public.proyecto_sitios;

-- 1. EPC can manage (insert/select/update/delete) for their own projects
CREATE POLICY "EPC gestiona sitios de sus proyectos"
  ON public.proyecto_sitios FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.proyectos WHERE id = proyecto_id AND epcista_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.proyectos WHERE id = proyecto_id AND epcista_id = auth.uid())
  );

-- 2. Finder can manage for their own projects
CREATE POLICY "Finder gestiona sitios de sus proyectos"
  ON public.proyecto_sitios FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.proyectos WHERE id = proyecto_id AND finder_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.proyectos WHERE id = proyecto_id AND finder_id = auth.uid())
  );

-- 3. Nodo Admin and Analyst can manage all
CREATE POLICY "Nodo gestiona sitios de proyectos"
  ON public.proyecto_sitios FOR ALL
  USING (
    public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
  )
  WITH CHECK (
    public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
  );

-- 4. All roles (EPC, Nodo, Financiero, Cliente) can read
CREATE POLICY "Roles ven sitios de sus proyectos"
  ON public.proyecto_sitios FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.proyectos WHERE id = proyecto_id AND (
      epcista_id = auth.uid()
      OR finder_id = auth.uid()
      OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
      OR financiero_id = auth.uid()
      OR (public.get_my_rol() = 'cliente_final' AND cliente_id = public.get_my_cliente_crm_id())
    ))
  );
