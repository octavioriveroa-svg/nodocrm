-- ============================================================
-- v19: EPC Project Management Tool — Schema
-- 6 new tables for the hierarchical plan builder
-- ============================================================

-- ── 1. Phases ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_fases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  orden INT NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#000000',
  fecha_inicio_estimada DATE,
  fecha_fin_estimada DATE,
  fecha_inicio_real DATE,
  fecha_fin_real DATE,
  porcentaje_completado NUMERIC(5,2) DEFAULT 0,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_progreso','completado','retrasado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Activities ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_actividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id UUID NOT NULL REFERENCES plan_fases(id) ON DELETE CASCADE,
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  orden INT NOT NULL DEFAULT 0,
  responsable_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  fecha_inicio_estimada DATE,
  fecha_fin_estimada DATE,
  duracion_dias INT,
  fecha_inicio_real DATE,
  fecha_fin_real DATE,
  dependencia_id UUID REFERENCES plan_actividades(id) ON DELETE SET NULL,
  tipo_dependencia TEXT DEFAULT 'FS' CHECK (tipo_dependencia IN ('FS','SS','FF','SF')),
  porcentaje_completado NUMERIC(5,2) DEFAULT 0,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_progreso','completado','retrasado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Tasks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actividad_id UUID NOT NULL REFERENCES plan_actividades(id) ON DELETE CASCADE,
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  orden INT NOT NULL DEFAULT 0,
  responsable_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  prioridad TEXT DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta','critica')),
  fecha_vencimiento DATE,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_progreso','completado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Subtasks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_subtareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES plan_tareas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  completado BOOLEAN DEFAULT false,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Financial Milestones ───────────────────────────────────
CREATE TABLE IF NOT EXISTS hitos_financieros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  fase_id UUID REFERENCES plan_fases(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  monto NUMERIC(14,2) NOT NULL,
  moneda TEXT DEFAULT 'MXN',
  porcentaje_del_total NUMERIC(5,2),
  condicion_desbloqueo TEXT,
  fase_gatillo_id UUID REFERENCES plan_fases(id) ON DELETE SET NULL,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','elegible','aprobado','pagado')),
  fecha_estimada DATE,
  fecha_pago_real DATE,
  comprobante_url TEXT,
  comprobante_tipo TEXT,
  notas TEXT,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 6. EPC Templates ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_plantillas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epcista_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo_proyecto TEXT,
  estructura JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plan_fases_proyecto ON plan_fases(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_plan_actividades_fase ON plan_actividades(fase_id);
CREATE INDEX IF NOT EXISTS idx_plan_actividades_proyecto ON plan_actividades(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_plan_tareas_actividad ON plan_tareas(actividad_id);
CREATE INDEX IF NOT EXISTS idx_plan_subtareas_tarea ON plan_subtareas(tarea_id);
CREATE INDEX IF NOT EXISTS idx_hitos_financieros_proyecto ON hitos_financieros(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_plan_plantillas_epcista ON plan_plantillas(epcista_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE plan_fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_subtareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitos_financieros ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_plantillas ENABLE ROW LEVEL SECURITY;

-- ── Helper: check if user is the EPC owner of a project ──────
CREATE OR REPLACE FUNCTION is_project_epc(p_proyecto_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM proyectos WHERE id = p_proyecto_id AND epcista_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Helper: check if user is Nodo admin or analyst ───────────
CREATE OR REPLACE FUNCTION is_nodo_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('nodo_admin', 'nodo_analista')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Helper: check if user is financiero linked to project ────
CREATE OR REPLACE FUNCTION is_project_financiero(p_proyecto_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM proyectos WHERE id = p_proyecto_id AND financiero_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Helper: check if user is client linked to project ────────
CREATE OR REPLACE FUNCTION is_project_cliente(p_proyecto_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM proyectos p
    JOIN profiles pr ON pr.id = auth.uid()
    WHERE p.id = p_proyecto_id
      AND pr.rol = 'cliente_final'
      AND p.cliente_id = pr.cliente_crm_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ════════════════════════════════════════════════════════════════
-- plan_fases RLS
-- ════════════════════════════════════════════════════════════════
-- EPC: full CRUD on own projects
DROP POLICY IF EXISTS "EPC manages plan_fases" ON plan_fases;
CREATE POLICY "EPC manages plan_fases" ON plan_fases FOR ALL
  USING (is_project_epc(proyecto_id))
  WITH CHECK (is_project_epc(proyecto_id));

-- Nodo: read all
DROP POLICY IF EXISTS "Nodo reads plan_fases" ON plan_fases;
CREATE POLICY "Nodo reads plan_fases" ON plan_fases FOR SELECT
  USING (is_nodo_user());

-- Financiero: read linked projects
DROP POLICY IF EXISTS "Financiero reads plan_fases" ON plan_fases;
CREATE POLICY "Financiero reads plan_fases" ON plan_fases FOR SELECT
  USING (is_project_financiero(proyecto_id));

-- Cliente: read linked projects
DROP POLICY IF EXISTS "Cliente reads plan_fases" ON plan_fases;
CREATE POLICY "Cliente reads plan_fases" ON plan_fases FOR SELECT
  USING (is_project_cliente(proyecto_id));

-- ════════════════════════════════════════════════════════════════
-- plan_actividades RLS
-- ════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "EPC manages plan_actividades" ON plan_actividades;
CREATE POLICY "EPC manages plan_actividades" ON plan_actividades FOR ALL
  USING (is_project_epc(proyecto_id))
  WITH CHECK (is_project_epc(proyecto_id));

DROP POLICY IF EXISTS "Nodo reads plan_actividades" ON plan_actividades;
CREATE POLICY "Nodo reads plan_actividades" ON plan_actividades FOR SELECT
  USING (is_nodo_user());

DROP POLICY IF EXISTS "Financiero reads plan_actividades" ON plan_actividades;
CREATE POLICY "Financiero reads plan_actividades" ON plan_actividades FOR SELECT
  USING (is_project_financiero(proyecto_id));

-- ════════════════════════════════════════════════════════════════
-- plan_tareas RLS
-- ════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "EPC manages plan_tareas" ON plan_tareas;
CREATE POLICY "EPC manages plan_tareas" ON plan_tareas FOR ALL
  USING (is_project_epc(proyecto_id))
  WITH CHECK (is_project_epc(proyecto_id));

DROP POLICY IF EXISTS "Nodo reads plan_tareas" ON plan_tareas;
CREATE POLICY "Nodo reads plan_tareas" ON plan_tareas FOR SELECT
  USING (is_nodo_user());

-- ════════════════════════════════════════════════════════════════
-- plan_subtareas RLS (via tarea → actividad → proyecto)
-- ════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "EPC manages plan_subtareas" ON plan_subtareas;
CREATE POLICY "EPC manages plan_subtareas" ON plan_subtareas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plan_tareas t
      JOIN plan_actividades a ON a.id = t.actividad_id
      WHERE t.id = plan_subtareas.tarea_id AND is_project_epc(a.proyecto_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plan_tareas t
      JOIN plan_actividades a ON a.id = t.actividad_id
      WHERE t.id = plan_subtareas.tarea_id AND is_project_epc(a.proyecto_id)
    )
  );

DROP POLICY IF EXISTS "Nodo reads plan_subtareas" ON plan_subtareas;
CREATE POLICY "Nodo reads plan_subtareas" ON plan_subtareas FOR SELECT
  USING (is_nodo_user());

-- ════════════════════════════════════════════════════════════════
-- hitos_financieros RLS
-- ════════════════════════════════════════════════════════════════
-- EPC: full CRUD
DROP POLICY IF EXISTS "EPC manages hitos_financieros" ON hitos_financieros;
CREATE POLICY "EPC manages hitos_financieros" ON hitos_financieros FOR ALL
  USING (is_project_epc(proyecto_id))
  WITH CHECK (is_project_epc(proyecto_id));

-- Nodo: read all
DROP POLICY IF EXISTS "Nodo reads hitos_financieros" ON hitos_financieros;
CREATE POLICY "Nodo reads hitos_financieros" ON hitos_financieros FOR SELECT
  USING (is_nodo_user());

-- Financiero: read + update status/proof on linked projects
DROP POLICY IF EXISTS "Financiero reads hitos_financieros" ON hitos_financieros;
CREATE POLICY "Financiero reads hitos_financieros" ON hitos_financieros FOR SELECT
  USING (is_project_financiero(proyecto_id));

DROP POLICY IF EXISTS "Financiero updates hitos_financieros" ON hitos_financieros;
CREATE POLICY "Financiero updates hitos_financieros" ON hitos_financieros FOR UPDATE
  USING (is_project_financiero(proyecto_id))
  WITH CHECK (is_project_financiero(proyecto_id));

-- Cliente: read status only
DROP POLICY IF EXISTS "Cliente reads hitos_financieros" ON hitos_financieros;
CREATE POLICY "Cliente reads hitos_financieros" ON hitos_financieros FOR SELECT
  USING (is_project_cliente(proyecto_id));

-- ════════════════════════════════════════════════════════════════
-- plan_plantillas RLS (EPC-only, own templates)
-- ════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "EPC manages own plantillas" ON plan_plantillas;
CREATE POLICY "EPC manages own plantillas" ON plan_plantillas FOR ALL
  USING (epcista_id = auth.uid())
  WITH CHECK (epcista_id = auth.uid());
