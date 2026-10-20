-- Enable RLS
ALTER TABLE proyecto_sitio_productos ENABLE ROW LEVEL SECURITY;

-- Drop old policies to avoid collision
DROP POLICY IF EXISTS "EPC inserta productos de sus proyectos" ON proyecto_sitio_productos;
DROP POLICY IF EXISTS "Roles ven productos de sus proyectos" ON proyecto_sitio_productos;
DROP POLICY IF EXISTS "EPC actualiza productos de sus proyectos" ON proyecto_sitio_productos;
DROP POLICY IF EXISTS "EPC elimina productos de sus proyectos" ON proyecto_sitio_productos;
DROP POLICY IF EXISTS "Nodo gestiona productos" ON proyecto_sitio_productos;

-- EPC can insert products for projects they own
CREATE POLICY "EPC inserta productos de sus proyectos"
  ON proyecto_sitio_productos FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM proyectos WHERE id = proyecto_id AND epcista_id = auth.uid())
  );

-- EPC can update products of projects they own
CREATE POLICY "EPC actualiza productos de sus proyectos"
  ON proyecto_sitio_productos FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM proyectos WHERE id = proyecto_id AND epcista_id = auth.uid())
  );

-- EPC can delete products of projects they own
CREATE POLICY "EPC elimina productos de sus proyectos"
  ON proyecto_sitio_productos FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM proyectos WHERE id = proyecto_id AND epcista_id = auth.uid())
  );

-- All relevant roles can select products
CREATE POLICY "Roles ven productos de sus proyectos"
  ON proyecto_sitio_productos FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM proyectos WHERE id = proyecto_id AND (
      epcista_id = auth.uid()
      OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
      OR financiero_id = auth.uid()
      OR (public.get_my_rol() = 'cliente_final' AND cliente_id = public.get_my_cliente_crm_id())
    ))
  );

-- Nodo admin and analista can manage all products
CREATE POLICY "Nodo gestiona productos"
  ON proyecto_sitio_productos FOR ALL
  USING (
    public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
  );
