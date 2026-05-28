-- =============================================
-- MIGRATION: V22 Finder Role Setup
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- 1. Update profiles role check constraint to include 'finder'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador', 'pendiente', 'finder'));

-- 2. Add finder_id to clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS finder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Add finder_id to proyectos
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS finder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Update admin_update_role to support 'finder'
CREATE OR REPLACE FUNCTION public.admin_update_role(target_id UUID, new_rol TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT rol FROM profiles WHERE id = auth.uid()) != 'nodo_admin' THEN
    RAISE EXCEPTION 'Solo administradores pueden cambiar roles';
  END IF;
  IF new_rol NOT IN ('epc','nodo_analista','nodo_admin','cliente_final','financiero','suministrador','pendiente','finder') THEN
    RAISE EXCEPTION 'Rol no válido';
  END IF;
  UPDATE profiles SET rol = new_rol WHERE id = target_id;
END;
$$;

-- 5. RLS Policies for Finder Comercial on clientes
DROP POLICY IF EXISTS "Finder gestiona sus clientes" ON public.clientes;
CREATE POLICY "Finder gestiona sus clientes"
  ON public.clientes FOR ALL
  USING (finder_id = auth.uid())
  WITH CHECK (finder_id = auth.uid());

-- 6. RLS Policies for Finder Comercial on proyectos
DROP POLICY IF EXISTS "Finder ve sus proyectos" ON public.proyectos;
CREATE POLICY "Finder ve sus proyectos"
  ON public.proyectos FOR SELECT
  USING (finder_id = auth.uid());

DROP POLICY IF EXISTS "Finder inserta sus proyectos" ON public.proyectos;
CREATE POLICY "Finder inserta sus proyectos"
  ON public.proyectos FOR INSERT
  WITH CHECK (finder_id = auth.uid());

DROP POLICY IF EXISTS "Finder actualiza sus proyectos" ON public.proyectos;
CREATE POLICY "Finder actualiza sus proyectos"
  ON public.proyectos FOR UPDATE
  USING (finder_id = auth.uid());

-- 7. RLS Policies for Finder Comercial on proyecto_sitio_productos
DROP POLICY IF EXISTS "Finder inserta productos" ON public.proyecto_sitio_productos;
CREATE POLICY "Finder inserta productos"
  ON public.proyecto_sitio_productos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.proyectos WHERE id = proyecto_id AND finder_id = auth.uid()));

DROP POLICY IF EXISTS "Finder ve productos" ON public.proyecto_sitio_productos;
CREATE POLICY "Finder ve productos"
  ON public.proyecto_sitio_productos FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.proyectos WHERE id = proyecto_id AND finder_id = auth.uid()));

-- 8. RLS Policies for Finder Comercial on configuraciones_tecnicas
DROP POLICY IF EXISTS "Finder gestiona configs" ON public.configuraciones_tecnicas;
CREATE POLICY "Finder gestiona configs"
  ON public.configuraciones_tecnicas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.proyectos WHERE id = proyecto_id AND finder_id = auth.uid()));

-- 9. RLS Policies for Finder Comercial on sitios
-- Finder will use sites created by EPCs or created by themselves
DROP POLICY IF EXISTS "Finder gestiona sitios" ON public.sitios;
CREATE POLICY "Finder gestiona sitios"
  ON public.sitios FOR ALL
  USING (epcista_id = auth.uid() OR EXISTS (
    -- Allow Finder to manage sites of their own clients
    SELECT 1 FROM public.clientes WHERE id = cliente_id AND finder_id = auth.uid()
  ));
