-- Create new table for alternative technical configurations
CREATE TABLE configuraciones_tecnicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,                           -- e.g. "Opción A – Solo FV"
  descripcion TEXT,
  inversion_total NUMERIC,                        -- total investment amount
  moneda TEXT DEFAULT 'MXN',
  vehiculo_inversion TEXT,                        -- credito, arrendamiento, ensaas, etc.
  ahorro_estimado_mensual NUMERIC,                -- monthly savings
  seleccionada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add configuracion_id FK to existing products table
ALTER TABLE proyecto_sitio_productos
  ADD COLUMN configuracion_id UUID REFERENCES configuraciones_tecnicas(id) ON DELETE CASCADE;

-- Migrate existing products: create a default configuration per project
INSERT INTO configuraciones_tecnicas (proyecto_id, nombre, inversion_total, moneda)
  SELECT DISTINCT p.id, 'Configuración original', p.capex_estimado, p.moneda
  FROM proyectos p
  WHERE EXISTS (SELECT 1 FROM proyecto_sitio_productos psp WHERE psp.proyecto_id = p.id);

-- Link existing products to their default configuration
UPDATE proyecto_sitio_productos psp
  SET configuracion_id = ct.id
  FROM configuraciones_tecnicas ct
  WHERE ct.proyecto_id = psp.proyecto_id
    AND ct.nombre = 'Configuración original';

-- RLS policies
ALTER TABLE configuraciones_tecnicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven configs de sus proyectos" ON configuraciones_tecnicas;
CREATE POLICY "Usuarios ven configs de sus proyectos"
  ON configuraciones_tecnicas FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proyectos p WHERE p.id = proyecto_id AND (
      p.epcista_id = auth.uid()
      OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
      OR p.financiero_id = auth.uid()
      OR (public.get_my_rol() = 'cliente_final' AND p.cliente_id = public.get_my_cliente_crm_id())
    )
  ));

DROP POLICY IF EXISTS "EPC y Nodo gestionan configs" ON configuraciones_tecnicas;
CREATE POLICY "EPC y Nodo gestionan configs"
  ON configuraciones_tecnicas FOR ALL
  USING (EXISTS (
    SELECT 1 FROM proyectos p WHERE p.id = proyecto_id AND (
      p.epcista_id = auth.uid()
      OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
    )
  ));
