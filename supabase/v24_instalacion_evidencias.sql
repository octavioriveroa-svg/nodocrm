-- ============================================================
-- v24: Installation Evidence & Plan Lock System & Comments
-- ============================================================

-- 1. Add plan_bloqueado flag to proyectos table
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS plan_bloqueado BOOLEAN DEFAULT false;

-- 2. Create evidence table for installation monitoring
CREATE TABLE IF NOT EXISTS public.instalacion_evidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  
  -- Link to plan entity (exactly one must be set)
  fase_id UUID REFERENCES public.plan_fases(id) ON DELETE CASCADE,
  actividad_id UUID REFERENCES public.plan_actividades(id) ON DELETE CASCADE,
  tarea_id UUID REFERENCES public.plan_tareas(id) ON DELETE CASCADE,
  
  -- Evidence content
  tipo TEXT NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto', 'documento', 'nota')),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  url TEXT,  -- Supabase storage URL for photos/documents
  
  -- Metadata
  autor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes for evidences
CREATE INDEX IF NOT EXISTS idx_evidencias_proyecto ON public.instalacion_evidencias(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_evidencias_fase ON public.instalacion_evidencias(fase_id) WHERE fase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evidencias_actividad ON public.instalacion_evidencias(actividad_id) WHERE actividad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evidencias_tarea ON public.instalacion_evidencias(tarea_id) WHERE tarea_id IS NOT NULL;

-- 4. Enable RLS on evidences
ALTER TABLE public.instalacion_evidencias ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for evidence:

-- EPC: full CRUD on own projects
DROP POLICY IF EXISTS "EPC manages evidencias" ON public.instalacion_evidencias;
CREATE POLICY "EPC manages evidencias" ON public.instalacion_evidencias FOR ALL
  USING (is_project_epc(proyecto_id))
  WITH CHECK (is_project_epc(proyecto_id));

-- Nodo: read all + insert (admin/analyst can also upload evidence)
DROP POLICY IF EXISTS "Nodo reads evidencias" ON public.instalacion_evidencias;
CREATE POLICY "Nodo reads evidencias" ON public.instalacion_evidencias FOR SELECT
  USING (is_nodo_user());

DROP POLICY IF EXISTS "Nodo inserts evidencias" ON public.instalacion_evidencias;
CREATE POLICY "Nodo inserts evidencias" ON public.instalacion_evidencias FOR INSERT
  WITH CHECK (is_nodo_user());

-- Financiero: read linked projects
DROP POLICY IF EXISTS "Financiero reads evidencias" ON public.instalacion_evidencias;
CREATE POLICY "Financiero reads evidencias" ON public.instalacion_evidencias FOR SELECT
  USING (is_project_financiero(proyecto_id));

-- Cliente: read linked projects
DROP POLICY IF EXISTS "Cliente reads evidencias" ON public.instalacion_evidencias;
CREATE POLICY "Cliente reads evidencias" ON public.instalacion_evidencias FOR SELECT
  USING (is_project_cliente(proyecto_id));

-- 6. Conditionally update or create plan_comentarios table to support comments on evidence
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plan_comentarios') THEN
        -- Table exists, add evidencia_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plan_comentarios' AND column_name = 'evidencia_id') THEN
            ALTER TABLE public.plan_comentarios ADD COLUMN evidencia_id UUID REFERENCES public.instalacion_evidencias(id) ON DELETE CASCADE;
        END IF;
    ELSE
        -- Table does not exist, create it with all columns including evidencia_id
        CREATE TABLE public.plan_comentarios (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,

          -- Polymorphic target
          fase_id      UUID REFERENCES public.plan_fases(id) ON DELETE CASCADE,
          actividad_id UUID REFERENCES public.plan_actividades(id) ON DELETE CASCADE,
          tarea_id     UUID REFERENCES public.plan_tareas(id) ON DELETE CASCADE,
          subtarea_id  UUID REFERENCES public.plan_subtareas(id) ON DELETE CASCADE,
          hito_id      UUID REFERENCES public.hitos_financieros(id) ON DELETE CASCADE,
          evidencia_id UUID REFERENCES public.instalacion_evidencias(id) ON DELETE CASCADE,

          -- Thread support
          parent_id    UUID REFERENCES public.plan_comentarios(id) ON DELETE CASCADE,

          -- Content
          autor_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          contenido    TEXT NOT NULL,
          resuelto     BOOLEAN DEFAULT false,
          resuelto_por UUID REFERENCES public.profiles(id),

          created_at   TIMESTAMPTZ DEFAULT now(),
          updated_at   TIMESTAMPTZ DEFAULT now()
        );
        
        -- Enable RLS on comments since we just created it
        ALTER TABLE public.plan_comentarios ENABLE ROW LEVEL SECURITY;
        
        -- Create default policies for comments
        DROP POLICY IF EXISTS "Comentarios: lectura proyecto" ON public.plan_comentarios;
        CREATE POLICY "Comentarios: lectura proyecto" ON public.plan_comentarios
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM public.proyectos p
              WHERE p.id = plan_comentarios.proyecto_id
              AND (
                p.epcista_id = auth.uid()
                OR p.cliente_id = auth.uid()
                OR p.financiero_id = auth.uid()
                OR EXISTS (
                  SELECT 1 FROM public.profiles pr
                  WHERE pr.id = auth.uid()
                  AND pr.rol IN ('nodo_admin', 'nodo_analista')
                )
              )
            )
          );

        DROP POLICY IF EXISTS "Comentarios: insertar" ON public.plan_comentarios;
        CREATE POLICY "Comentarios: insertar" ON public.plan_comentarios
          FOR INSERT WITH CHECK (
            autor_id = auth.uid()
            AND EXISTS (
              SELECT 1 FROM public.proyectos p
              WHERE p.id = plan_comentarios.proyecto_id
              AND (
                p.epcista_id = auth.uid()
                OR p.cliente_id = auth.uid()
                OR p.financiero_id = auth.uid()
                OR EXISTS (
                  SELECT 1 FROM public.profiles pr
                  WHERE pr.id = auth.uid()
                  AND pr.rol IN ('nodo_admin', 'nodo_analista')
                )
              )
            )
          );

        DROP POLICY IF EXISTS "Comentarios: actualizar" ON public.plan_comentarios;
        CREATE POLICY "Comentarios: actualizar" ON public.plan_comentarios
          FOR UPDATE USING (
            autor_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.proyectos p
              WHERE p.id = plan_comentarios.proyecto_id
              AND p.epcista_id = auth.uid()
            )
            OR EXISTS (
              SELECT 1 FROM public.profiles pr
              WHERE pr.id = auth.uid()
              AND pr.rol = 'nodo_admin'
            )
          );

        DROP POLICY IF EXISTS "Comentarios: eliminar" ON public.plan_comentarios;
        CREATE POLICY "Comentarios: eliminar" ON public.plan_comentarios
          FOR DELETE USING (
            autor_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.profiles pr
              WHERE pr.id = auth.uid()
              AND pr.rol = 'nodo_admin'
            )
          );
    END IF;
END $$;

-- 7. Index for evidence comments
CREATE INDEX IF NOT EXISTS idx_comentarios_evidencia ON public.plan_comentarios(evidencia_id) WHERE evidencia_id IS NOT NULL;
