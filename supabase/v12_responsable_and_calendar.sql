-- =============================================
-- MIGRATION: V12 — Responsable Nodo + Calendario URL
-- =============================================

-- 1. Add responsable_nodo_id to proyectos
ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS responsable_nodo_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Add calendario_url to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calendario_url TEXT;

-- 3. RLS: Allow EPCs to read the calendario_url of their project's responsable
-- (They already can SELECT profiles via existing policies, but this ensures
-- the new column is accessible through the standard select)

-- 4. Allow admin to update responsable_nodo_id on any project
-- (The existing admin UPDATE policy on proyectos should cover this,
-- but let's ensure it exists)
DROP POLICY IF EXISTS "Admin actualiza proyectos" ON public.proyectos;
CREATE POLICY "Admin actualiza proyectos"
  ON public.proyectos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'nodo_admin'
    )
  );

-- 5. Allow admin to INSERT projects (currently only EPCs can)
DROP POLICY IF EXISTS "Admin crea proyectos" ON public.proyectos;
CREATE POLICY "Admin crea proyectos"
  ON public.proyectos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.rol = 'nodo_admin' OR p.rol = 'nodo_analista')
    )
  );
