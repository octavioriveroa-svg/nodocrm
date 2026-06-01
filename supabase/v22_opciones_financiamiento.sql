-- =============================================
-- MIGRATION: V22 Decoupled Financing Options Setup
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- 1. Create table for standalone financing options per project
CREATE TABLE IF NOT EXISTS public.opciones_financiamiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,                              -- e.g. "Crédito a 5 años"
  vehiculo_inversion TEXT NOT NULL,                  -- credito, arrendamiento, ensaas, mem, no_sabe
  ahorro_estimado_mensual NUMERIC,                   -- monthly savings estimate
  plazo_meses INTEGER,                               -- term length
  notas TEXT,
  seleccionada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create junction table for many-to-many configurations and financing options
CREATE TABLE IF NOT EXISTS public.config_financiamiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuracion_id UUID NOT NULL REFERENCES public.configuraciones_tecnicas(id) ON DELETE CASCADE,
  opcion_financiamiento_id UUID NOT NULL REFERENCES public.opciones_financiamiento(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(configuracion_id, opcion_financiamiento_id)
);

-- 3. Migrate existing data: create a financing option for configurations with vehiculo_inversion
-- We do a SELECT DISTINCT/GROUP or insert one per config since they were previously 1:1.
INSERT INTO public.opciones_financiamiento (proyecto_id, nombre, vehiculo_inversion, ahorro_estimado_mensual, seleccionada)
  SELECT proyecto_id,
         CASE 
           WHEN vehiculo_inversion = 'credito' THEN 'Crédito'
           WHEN vehiculo_inversion = 'arrendamiento' THEN 'Arrendamiento'
           WHEN vehiculo_inversion = 'ensaas' THEN 'EnSaaS'
           WHEN vehiculo_inversion = 'mem' THEN 'MEM'
           WHEN vehiculo_inversion = 'no_sabe' THEN 'No Sabe'
           ELSE COALESCE(vehiculo_inversion, 'No Sabe')
         END,
         COALESCE(vehiculo_inversion, 'no_sabe'),
         ahorro_estimado_mensual,
         seleccionada
  FROM public.configuraciones_tecnicas
  WHERE vehiculo_inversion IS NOT NULL;

-- 4. Link migrated financing options to their configurations in config_financiamiento
-- We can join on proyecto_id and matching columns to link them.
INSERT INTO public.config_financiamiento (configuracion_id, opcion_financiamiento_id)
  SELECT ct.id, of.id
  FROM public.configuraciones_tecnicas ct
  JOIN public.opciones_financiamiento of ON of.proyecto_id = ct.proyecto_id
    AND of.vehiculo_inversion = ct.vehiculo_inversion
    AND (
      (of.ahorro_estimado_mensual IS NULL AND ct.ahorro_estimado_mensual IS NULL)
      OR (of.ahorro_estimado_mensual = ct.ahorro_estimado_mensual)
    )
  WHERE ct.vehiculo_inversion IS NOT NULL;

-- 5. Drop the now-redundant columns from configuraciones_tecnicas
ALTER TABLE public.configuraciones_tecnicas DROP COLUMN IF EXISTS vehiculo_inversion;
ALTER TABLE public.configuraciones_tecnicas DROP COLUMN IF EXISTS ahorro_estimado_mensual;

-- 6. Enable RLS on new tables
ALTER TABLE public.opciones_financiamiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_financiamiento ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for opciones_financiamiento
DROP POLICY IF EXISTS "Usuarios ven opciones de sus proyectos" ON public.opciones_financiamiento;
CREATE POLICY "Usuarios ven opciones de sus proyectos"
  ON public.opciones_financiamiento FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id AND (
      p.epcista_id = auth.uid()
      OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
      OR p.financiero_id = auth.uid()
      OR p.finder_id = auth.uid()
      OR (public.get_my_rol() = 'cliente_final' AND p.cliente_id = public.get_my_cliente_crm_id())
    )
  ));

DROP POLICY IF EXISTS "EPC, Finder y Nodo gestionan opciones" ON public.opciones_financiamiento;
CREATE POLICY "EPC, Finder y Nodo gestionan opciones"
  ON public.opciones_financiamiento FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id AND (
      p.epcista_id = auth.uid()
      OR p.finder_id = auth.uid()
      OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id AND (
      p.epcista_id = auth.uid()
      OR p.finder_id = auth.uid()
      OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
    )
  ));

-- 8. RLS policies for config_financiamiento
DROP POLICY IF EXISTS "Usuarios ven links config-fin" ON public.config_financiamiento;
CREATE POLICY "Usuarios ven links config-fin"
  ON public.config_financiamiento FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.configuraciones_tecnicas ct
    JOIN public.proyectos p ON p.id = ct.proyecto_id
    WHERE ct.id = configuracion_id AND (
      p.epcista_id = auth.uid()
      OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
      OR p.financiero_id = auth.uid()
      OR p.finder_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "EPC, Finder y Nodo gestionan links" ON public.config_financiamiento;
CREATE POLICY "EPC, Finder y Nodo gestionan links"
  ON public.config_financiamiento FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.configuraciones_tecnicas ct
    JOIN public.proyectos p ON p.id = ct.proyecto_id
    WHERE ct.id = configuracion_id AND (
      p.epcista_id = auth.uid()
      OR p.finder_id = auth.uid()
      OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.configuraciones_tecnicas ct
    JOIN public.proyectos p ON p.id = ct.proyecto_id
    WHERE ct.id = configuracion_id AND (
      p.epcista_id = auth.uid()
      OR p.finder_id = auth.uid()
      OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
    )
  ));
