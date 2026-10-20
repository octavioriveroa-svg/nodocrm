-- =============================================
-- MIGRATION: V2 Schema Update
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- 1. Actualizar Enum/Check de roles en Profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_rol_check 
  CHECK (rol IN ('epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador', 'pendiente'));

-- Migrar roles existentes
UPDATE public.profiles SET rol = 'epc' WHERE rol = 'epcista';
UPDATE public.profiles SET rol = 'nodo_analista' WHERE rol = 'analista';
UPDATE public.profiles SET rol = 'nodo_admin' WHERE rol = 'admin';

-- 2. Actualizar tabla Proyectos
ALTER TABLE public.proyectos DROP CONSTRAINT IF EXISTS proyectos_estado_check;
ALTER TABLE public.proyectos ADD CONSTRAINT proyectos_estado_check
  CHECK (estado IN ('recibido', 'en_analisis', 'propuesta_lista', 'enviada', 'negociacion', 'aprobado', 'en_construccion', 'operativo', 'completado', 'cliente_interesado'));

-- Agregar foreign keys para clientes y financieros
ALTER TABLE public.proyectos 
  ADD COLUMN cliente_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN financiero_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Crear tabla Hitos de Construcción (Gantt)
CREATE TABLE IF NOT EXISTS public.hitos_construccion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  fecha_estimada_inicio DATE,
  fecha_estimada_fin DATE,
  fecha_real_inicio DATE,
  fecha_real_fin DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_progreso', 'completado', 'retrasado')),
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hitos_construccion ENABLE ROW LEVEL SECURITY;

-- Políticas Hitos
CREATE POLICY "Ver hitos" ON public.hitos_construccion FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.proyectos pr WHERE pr.id = proyecto_id AND (pr.epcista_id = auth.uid() OR pr.cliente_id = auth.uid() OR pr.financiero_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rol IN ('nodo_analista', 'nodo_admin'))
  );

CREATE POLICY "EPC y Nodo editan hitos" ON public.hitos_construccion FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.proyectos pr WHERE pr.id = proyecto_id AND pr.epcista_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rol IN ('nodo_analista', 'nodo_admin'))
  );

-- Trigger para updated_at de hitos
CREATE TRIGGER hitos_updated_at
  BEFORE UPDATE ON public.hitos_construccion
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Crear tabla Ofertas MEM (Marketplace)
CREATE TABLE IF NOT EXISTS public.ofertas_mem (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  suministrador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  precio_kwh NUMERIC NOT NULL,
  vigencia_meses INTEGER NOT NULL,
  notas TEXT,
  estado TEXT NOT NULL DEFAULT 'enviada' CHECK (estado IN ('enviada', 'en_revision', 'aceptada', 'rechazada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ofertas_mem ENABLE ROW LEVEL SECURITY;

-- Políticas Ofertas
CREATE POLICY "Suministrador ve sus ofertas y EPC/Nodo/Cliente ven todas" ON public.ofertas_mem FOR SELECT
  USING (
    suministrador_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.proyectos pr WHERE pr.id = proyecto_id AND (pr.epcista_id = auth.uid() OR pr.cliente_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rol IN ('nodo_analista', 'nodo_admin'))
  );

CREATE POLICY "Suministrador crea ofertas" ON public.ofertas_mem FOR INSERT
  WITH CHECK (suministrador_id = auth.uid());

-- Trigger para updated_at de ofertas
CREATE TRIGGER ofertas_updated_at
  BEFORE UPDATE ON public.ofertas_mem
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Expandir Tipos de Archivo
ALTER TABLE public.archivos DROP CONSTRAINT IF EXISTS archivos_tipo_check;
ALTER TABLE public.archivos ADD CONSTRAINT archivos_tipo_check
  CHECK (tipo IN ('recibo_cfe', 'propuesta', 'machote_contrato', 'adjunto_epcista', 'propuesta_analista', 'evidencia_hito', 'oferta_suministrador'));

-- 6. Actualizar las Políticas RLS existentes para considerar los nuevos roles de Nodo
DROP POLICY IF EXISTS "Analista ve todos los perfiles" ON public.profiles;
CREATE POLICY "Nodo ve todos los perfiles" ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rol IN ('nodo_analista', 'nodo_admin')));

DROP POLICY IF EXISTS "Analista ve todos los proyectos" ON public.proyectos;
CREATE POLICY "Nodo, Cliente y Financiero ven proyectos" ON public.proyectos FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rol IN ('nodo_analista', 'nodo_admin'))
    OR cliente_id = auth.uid()
    OR financiero_id = auth.uid()
    OR epcista_id = auth.uid()
  );

DROP POLICY IF EXISTS "Analista actualiza proyectos" ON public.proyectos;
CREATE POLICY "Nodo actualiza proyectos" ON public.proyectos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rol IN ('nodo_analista', 'nodo_admin')));
