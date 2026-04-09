-- =============================================
-- NODO CRM — Schema completo con RLS
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- Habilitar extensión uuid si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- TABLA: profiles
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  empresa    TEXT NOT NULL,
  rol        TEXT NOT NULL CHECK (rol IN ('epcista', 'analista')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- EPCista solo ve y edita su propio perfil
CREATE POLICY "Ver propio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Crear propio perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Actualizar propio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Analista puede ver todos los perfiles (para mostrar nombres en proyectos)
CREATE POLICY "Analista ve todos los perfiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'analista'
    )
  );

-- ─────────────────────────────────────────────
-- TABLA: proyectos
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proyectos (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  epcista_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo                     TEXT NOT NULL CHECK (tipo IN ('BESS', 'MEM', 'BESS+MEM')),
  nombre_proyecto          TEXT NOT NULL,
  estado                   TEXT NOT NULL DEFAULT 'recibido' CHECK (estado IN ('recibido', 'en_analisis', 'completado')),

  -- Cliente final
  cliente_final_nombre     TEXT NOT NULL,
  cliente_final_empresa    TEXT NOT NULL,
  cliente_final_contacto   TEXT NOT NULL,

  -- Técnico BESS
  capacidad_mwh            NUMERIC,
  capacidad_mw             NUMERIC,
  tecnologia_bateria       TEXT CHECK (tecnologia_bateria IN ('Li-ion', 'LFP', 'NMC', 'Otra')),
  duracion_descarga_hrs    NUMERIC,
  punto_interconexion      TEXT,

  -- Técnico MEM
  tipo_participacion_mem   TEXT,
  volumen_energia_mwh_anual NUMERIC,

  -- Financiero
  capex_estimado           NUMERIC,
  moneda                   TEXT NOT NULL DEFAULT 'MXN' CHECK (moneda IN ('MXN', 'USD')),
  ubicacion_estado         TEXT NOT NULL,
  modalidad_financiamiento TEXT[] NOT NULL DEFAULT '{}',
  notas_adicionales        TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;

-- EPCista solo ve sus proyectos
CREATE POLICY "EPCista ve sus proyectos"
  ON public.proyectos FOR SELECT
  USING (auth.uid() = epcista_id);

-- EPCista puede insertar proyectos propios
CREATE POLICY "EPCista inserta sus proyectos"
  ON public.proyectos FOR INSERT
  WITH CHECK (auth.uid() = epcista_id);

-- Analista ve todos los proyectos
CREATE POLICY "Analista ve todos los proyectos"
  ON public.proyectos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'analista'
    )
  );

-- Solo analista puede actualizar estado y demás campos
CREATE POLICY "Analista actualiza proyectos"
  ON public.proyectos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'analista'
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proyectos_updated_at
  BEFORE UPDATE ON public.proyectos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- TABLA: comentarios
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comentarios (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  autor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contenido   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;

-- Ver comentarios: el dueño del proyecto o un analista
CREATE POLICY "Ver comentarios del proyecto"
  ON public.comentarios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proyectos pr
      WHERE pr.id = proyecto_id AND pr.epcista_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'analista'
    )
  );

-- Insertar comentarios: el dueño o un analista
CREATE POLICY "Insertar comentarios"
  ON public.comentarios FOR INSERT
  WITH CHECK (
    auth.uid() = autor_id
    AND (
      EXISTS (
        SELECT 1 FROM public.proyectos pr
        WHERE pr.id = proyecto_id AND pr.epcista_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.rol = 'analista'
      )
    )
  );

-- ─────────────────────────────────────────────
-- TABLA: archivos
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.archivos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  autor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  url         TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('adjunto_epcista', 'propuesta_analista')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver archivos del proyecto"
  ON public.archivos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proyectos pr
      WHERE pr.id = proyecto_id AND pr.epcista_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.rol = 'analista'
    )
  );

CREATE POLICY "Insertar archivos"
  ON public.archivos FOR INSERT
  WITH CHECK (
    auth.uid() = autor_id
    AND (
      EXISTS (
        SELECT 1 FROM public.proyectos pr
        WHERE pr.id = proyecto_id AND pr.epcista_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.rol = 'analista'
      )
    )
  );

-- ─────────────────────────────────────────────
-- STORAGE BUCKET (ejecutar separado o vía dashboard)
-- ─────────────────────────────────────────────
-- Crear bucket "archivos-proyectos" en el dashboard de Supabase Storage
-- con acceso público para poder generar URLs públicas de descarga.
--
-- O via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('archivos-proyectos', 'archivos-proyectos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Subir archivos autenticados"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'archivos-proyectos');

CREATE POLICY "Ver archivos públicos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'archivos-proyectos');
