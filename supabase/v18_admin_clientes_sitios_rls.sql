-- v18: Allow Nodo Admin & Analyst full CRUD on clientes and sitios tables
-- Both roles can create clients/sites on behalf of EPCs during project creation.

-- Allow Admin + Analyst full CRUD on clientes
DROP POLICY IF EXISTS "Admin full access clientes" ON public.clientes;
CREATE POLICY "Admin full access clientes" ON public.clientes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.rol IN ('nodo_admin', 'nodo_analista')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.rol IN ('nodo_admin', 'nodo_analista')
    )
  );

-- Allow Admin + Analyst full CRUD on sitios
DROP POLICY IF EXISTS "Admin full access sitios" ON public.sitios;
CREATE POLICY "Admin full access sitios" ON public.sitios
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.rol IN ('nodo_admin', 'nodo_analista')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.rol IN ('nodo_admin', 'nodo_analista')
    )
  );
