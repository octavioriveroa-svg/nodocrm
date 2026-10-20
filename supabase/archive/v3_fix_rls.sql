-- Fix infinite recursion in public.profiles policies
DROP POLICY IF EXISTS "Nodo ve todos los perfiles" ON public.profiles;

-- Create a security definer function to get the current user's role safely without recursion
CREATE OR REPLACE FUNCTION public.get_my_rol() RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT rol FROM public.profiles WHERE id = auth.uid();
$$;

-- Allow Nodo users to see all profiles, and everyone to see their own
CREATE POLICY "Nodo ve todos los perfiles" ON public.profiles FOR SELECT
  USING (
    id = auth.uid() 
    OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
  );

-- Fix the proyectos policies which might also cause recursion
DROP POLICY IF EXISTS "Nodo, Cliente y Financiero ven proyectos" ON public.proyectos;
CREATE POLICY "Nodo, Cliente y Financiero ven proyectos" ON public.proyectos FOR SELECT
  USING (
    cliente_id = auth.uid()
    OR financiero_id = auth.uid()
    OR epcista_id = auth.uid()
    OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
  );

DROP POLICY IF EXISTS "Nodo actualiza proyectos" ON public.proyectos;
CREATE POLICY "Nodo actualiza proyectos" ON public.proyectos FOR UPDATE
  USING (public.get_my_rol() IN ('nodo_analista', 'nodo_admin'));
