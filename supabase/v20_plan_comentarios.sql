-- ============================================================
-- v20: Plan Comments & In-App Notifications
-- Threaded comments on plan entities + notification system
-- ============================================================

-- ── 1. Plan Comments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_comentarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,

  -- Polymorphic target (exactly one should be set)
  fase_id      UUID REFERENCES plan_fases(id) ON DELETE CASCADE,
  actividad_id UUID REFERENCES plan_actividades(id) ON DELETE CASCADE,
  tarea_id     UUID REFERENCES plan_tareas(id) ON DELETE CASCADE,
  subtarea_id  UUID REFERENCES plan_subtareas(id) ON DELETE CASCADE,
  hito_id      UUID REFERENCES hitos_financieros(id) ON DELETE CASCADE,

  -- Thread support
  parent_id    UUID REFERENCES plan_comentarios(id) ON DELETE CASCADE,

  -- Content
  autor_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contenido    TEXT NOT NULL,
  resuelto     BOOLEAN DEFAULT false,
  resuelto_por UUID REFERENCES profiles(id),

  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Partial indexes for fast entity-specific lookups
CREATE INDEX IF NOT EXISTS idx_comentarios_fase ON plan_comentarios(fase_id) WHERE fase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comentarios_actividad ON plan_comentarios(actividad_id) WHERE actividad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comentarios_tarea ON plan_comentarios(tarea_id) WHERE tarea_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comentarios_subtarea ON plan_comentarios(subtarea_id) WHERE subtarea_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comentarios_hito ON plan_comentarios(hito_id) WHERE hito_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comentarios_proyecto ON plan_comentarios(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_parent ON plan_comentarios(parent_id) WHERE parent_id IS NOT NULL;

-- ── 2. In-App Notifications ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notificaciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL DEFAULT 'comentario',
  titulo       TEXT NOT NULL,
  mensaje      TEXT,
  enlace       TEXT,  -- deep link path e.g. /epc/proyectos/{id}/plan

  -- Source references (optional, for grouping)
  proyecto_id  UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  comentario_id UUID REFERENCES plan_comentarios(id) ON DELETE CASCADE,

  leido        BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id, leido);
CREATE INDEX IF NOT EXISTS idx_notificaciones_proyecto ON notificaciones(proyecto_id) WHERE proyecto_id IS NOT NULL;

-- ── 3. RLS: plan_comentarios ─────────────────────────────────
ALTER TABLE plan_comentarios ENABLE ROW LEVEL SECURITY;

-- Read: anyone who can see the project
CREATE POLICY "Comentarios: lectura proyecto" ON plan_comentarios
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = plan_comentarios.proyecto_id
      AND (
        p.epcista_id = auth.uid()
        OR p.cliente_id = auth.uid()
        OR p.financiero_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles pr
          WHERE pr.id = auth.uid()
          AND pr.rol IN ('nodo_admin', 'nodo_analista')
        )
      )
    )
  );

-- Insert: anyone linked to the project can comment
CREATE POLICY "Comentarios: insertar" ON plan_comentarios
  FOR INSERT WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = plan_comentarios.proyecto_id
      AND (
        p.epcista_id = auth.uid()
        OR p.cliente_id = auth.uid()
        OR p.financiero_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles pr
          WHERE pr.id = auth.uid()
          AND pr.rol IN ('nodo_admin', 'nodo_analista')
        )
      )
    )
  );

-- Update: author can edit their text; EPC/admin can resolve
CREATE POLICY "Comentarios: actualizar" ON plan_comentarios
  FOR UPDATE USING (
    autor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = plan_comentarios.proyecto_id
      AND p.epcista_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
      AND pr.rol = 'nodo_admin'
    )
  );

-- Delete: author or admin
CREATE POLICY "Comentarios: eliminar" ON plan_comentarios
  FOR DELETE USING (
    autor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
      AND pr.rol = 'nodo_admin'
    )
  );

-- ── 4. RLS: notificaciones ───────────────────────────────────
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Notificaciones: solo propias" ON notificaciones
  FOR SELECT USING (usuario_id = auth.uid());

-- System inserts (via service role) — users can't insert directly
-- We keep insert open for server actions using service role key

-- Users can mark their own notifications as read
CREATE POLICY "Notificaciones: marcar leído" ON notificaciones
  FOR UPDATE USING (usuario_id = auth.uid());
