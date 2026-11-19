-- ============================================================================
-- MIGRATION: v29 — Energy & Monetary Savings Calculator / Simulator (R1-R4)
-- Dependencies: schema.sql, v3_fix_rls.sql, v15_fix_archivos_rls.sql,
--               v16_link_clientes_usuarios.sql, v22_configuraciones_tecnicas.sql,
--               v22_opciones_financiamiento.sql, v22_finder_role.sql,
--               v25_schema_fixes.sql, v28_annual_savings_and_storage.sql
-- ============================================================================

-- ── 0. Ensure baseline project columns referenced by triggers/calculator exist
ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS consumo_anual_gwh NUMERIC,
  ADD COLUMN IF NOT EXISTS codigo_postal TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'proyectos' AND column_name = 'tarifa_actual_cfe'
  ) THEN
    ALTER TABLE public.proyectos ADD COLUMN tarifa_actual_cfe VARCHAR(20);
  END IF;
END $$;

-- ── 1. Declarative Calculator Templates (append-only versioned, 1 active) ───
CREATE TABLE IF NOT EXISTS public.calculadora_templates (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version                INTEGER NOT NULL DEFAULT 1,
  nombre                 TEXT NOT NULL DEFAULT 'Plantilla Racional Nodo MX',
  descripcion            TEXT,
  modo                   TEXT NOT NULL DEFAULT 'default'
                           CHECK (modo IN ('default', 'custom_formulas', 'excel_import')),
  is_active              BOOLEAN NOT NULL DEFAULT FALSE,

  -- Declarative field schema array:
  -- [{ key, label, unit, type, group, min?, max?, step?, defaultValue, validationRules?, editableByUser, order }]
  campos                 JSONB NOT NULL CHECK (jsonb_typeof(campos) = 'array'),

  -- Ordered 7-formula expression array keyed to Platform Output Keys:
  -- [{ key, label, expression, unit, enabled, source_cell?, ast_validated }]
  formulas               JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(formulas) = 'array'),

  horizonte_opciones     INTEGER[] NOT NULL DEFAULT ARRAY[1, 3, 5, 10, 15, 20, 25],

  -- Excel import traceability (populated when modo = 'excel_import')
  excel_archivo_nombre   TEXT,
  excel_archivo_hash     TEXT,
  excel_hoja_origen      TEXT,
  excel_mapeo_campos     JSONB,
  excel_preview_snapshot JSONB,

  validation_status      TEXT NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'invalid')),
  validation_errors      JSONB NOT NULL DEFAULT '[]'::jsonb,
  notas                  TEXT,

  created_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_calc_templates_version UNIQUE (version),
  CONSTRAINT chk_calc_templates_horizonte_bounds CHECK (
    cardinality(horizonte_opciones) >= 1
    AND horizonte_opciones <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30]::integer[]
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calc_templates_active
  ON public.calculadora_templates (is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_calc_templates_version
  ON public.calculadora_templates (version DESC);

DROP TRIGGER IF EXISTS trg_calc_templates_updated_at ON public.calculadora_templates;
CREATE TRIGGER trg_calc_templates_updated_at
  BEFORE UPDATE ON public.calculadora_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Append-only immutability: existing template versions cannot mutate id, campos, formulas, or metadata;
-- only is_active (and updated_at) may rotate via atomic nodo_admin RPCs.
CREATE OR REPLACE FUNCTION public.enforce_calculadora_template_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.id IS DISTINCT FROM OLD.id)
     OR (NEW.version IS DISTINCT FROM OLD.version)
     OR (NEW.nombre IS DISTINCT FROM OLD.nombre)
     OR (NEW.descripcion IS DISTINCT FROM OLD.descripcion)
     OR (NEW.modo IS DISTINCT FROM OLD.modo)
     OR (NEW.campos IS DISTINCT FROM OLD.campos)
     OR (NEW.formulas IS DISTINCT FROM OLD.formulas)
     OR (NEW.horizonte_opciones IS DISTINCT FROM OLD.horizonte_opciones)
     OR (NEW.excel_archivo_nombre IS DISTINCT FROM OLD.excel_archivo_nombre)
     OR (NEW.excel_archivo_hash IS DISTINCT FROM OLD.excel_archivo_hash)
     OR (NEW.excel_hoja_origen IS DISTINCT FROM OLD.excel_hoja_origen)
     OR (NEW.excel_mapeo_campos IS DISTINCT FROM OLD.excel_mapeo_campos)
     OR (NEW.excel_preview_snapshot IS DISTINCT FROM OLD.excel_preview_snapshot)
     OR (NEW.validation_status IS DISTINCT FROM OLD.validation_status)
     OR (NEW.validation_errors IS DISTINCT FROM OLD.validation_errors)
     OR (NEW.notas IS DISTINCT FROM OLD.notas)
     OR (NEW.created_by IS DISTINCT FROM OLD.created_by)
     OR (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'Las versiones de calculadora_templates son inmutables; cree una nueva versión en lugar de modificarla.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_templates_immutable ON public.calculadora_templates;
CREATE TRIGGER trg_calc_templates_immutable
  BEFORE UPDATE ON public.calculadora_templates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_calculadora_template_immutability();

-- ── 2. Saved Project Savings Simulations (Slim: Sparse Overrides + KPIs) ────
-- Note: 1..360 month series is evaluated deterministically on the fly in TypeScript (< 1 ms)
-- from (template, projectData, parametros_override) — zero bloated time-series JSONB in DB.
CREATE TABLE IF NOT EXISTS public.simulaciones_ahorro (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id               UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  configuracion_id          UUID REFERENCES public.configuraciones_tecnicas(id) ON DELETE SET NULL,
  opcion_financiamiento_id  UUID REFERENCES public.opciones_financiamiento(id) ON DELETE SET NULL,

  nombre                    TEXT NOT NULL,
  descripcion               TEXT,
  usa_parametros_base       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Immutable template provenance & sparse user overrides ({} when usa_parametros_base = TRUE)
  template_id               UUID NOT NULL REFERENCES public.calculadora_templates(id) ON DELETE RESTRICT,
  template_version          INTEGER NOT NULL,
  parametros_override       JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(parametros_override) = 'object'),

  -- Calculation configuration
  moneda_calculo            TEXT NOT NULL DEFAULT 'MXN' CHECK (moneda_calculo IN ('MXN', 'USD')),
  tipo_cambio_usado         NUMERIC(10, 4) NOT NULL CHECK (tipo_cambio_usado > 0),
  horizonte_anios           INTEGER NOT NULL CHECK (horizonte_anios BETWEEN 1 AND 30),
  granularidad_default      TEXT NOT NULL DEFAULT 'anual' CHECK (granularidad_default IN ('mensual', 'trimestral', 'anual')),
  vista_financiamiento      TEXT NOT NULL DEFAULT 'bruto' CHECK (vista_financiamiento IN ('bruto', 'neto')),
  fuente_calculo            TEXT NOT NULL DEFAULT 'fisico_tarifario'
                              CHECK (fuente_calculo IN ('fisico_tarifario', 'ahorro_declarado', 'formula_personalizada')),

  -- Financial Gating Invariant: persisted simulations ALWAYS have positive CAPEX
  capex_snapshot            NUMERIC(16, 2) NOT NULL CHECK (capex_snapshot > 0),
  desembolso_inicial        NUMERIC(16, 2) NOT NULL CHECK (desembolso_inicial >= 0),

  -- Lightweight Summary KPIs
  payback_simple_meses      NUMERIC(10, 2),
  payback_simple_anios      NUMERIC(8, 2),
  payback_descontado_meses  NUMERIC(10, 2),
  payback_estado            TEXT NOT NULL CHECK (payback_estado IN ('inmediato', 'en_horizonte', 'fuera_horizonte', 'no_recuperable')),
  ahorro_energia_y1_kwh     NUMERIC(16, 2) NOT NULL DEFAULT 0,
  ahorro_energia_total_kwh  NUMERIC(18, 2) NOT NULL DEFAULT 0,
  ahorro_monetario_y1       NUMERIC(16, 2) NOT NULL DEFAULT 0,
  ahorro_monetario_total    NUMERIC(18, 2) NOT NULL DEFAULT 0,
  flujo_neto_total          NUMERIC(18, 2) NOT NULL DEFAULT 0,
  roi_pct                   NUMERIC(10, 2),
  tir_pct                   NUMERIC(10, 4),
  van                       NUMERIC(18, 2),

  -- Invalidation flag when project CAPEX / technical config / financing changes
  is_stale                  BOOLEAN NOT NULL DEFAULT FALSE,

  created_by                UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulaciones_proyecto
  ON public.simulaciones_ahorro (proyecto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulaciones_created_by
  ON public.simulaciones_ahorro (created_by);

DROP TRIGGER IF EXISTS trg_simulaciones_ahorro_updated_at ON public.simulaciones_ahorro;
CREATE TRIGGER trg_simulaciones_ahorro_updated_at
  BEFORE UPDATE ON public.simulaciones_ahorro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 2b. Cross-Project & Referential Integrity Trigger on simulaciones_ahorro ──
CREATE OR REPLACE FUNCTION public.validate_simulacion_ahorro_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.proyecto_id IS DISTINCT FROM OLD.proyecto_id THEN
    RAISE EXCEPTION 'proyecto_id es inmutable en simulaciones_ahorro';
  END IF;

  IF NEW.configuracion_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.configuraciones_tecnicas ct
     WHERE ct.id = NEW.configuracion_id
       AND ct.proyecto_id = NEW.proyecto_id
  ) THEN
    RAISE EXCEPTION 'configuracion_id (%) no pertenece al proyecto (%)', NEW.configuracion_id, NEW.proyecto_id;
  END IF;

  IF NEW.opcion_financiamiento_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.opciones_financiamiento ofin
     WHERE ofin.id = NEW.opcion_financiamiento_id
       AND ofin.proyecto_id = NEW.proyecto_id
  ) THEN
    RAISE EXCEPTION 'opcion_financiamiento_id (%) no pertenece al proyecto (%)', NEW.opcion_financiamiento_id, NEW.proyecto_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_simulaciones_ahorro_integrity ON public.simulaciones_ahorro;
CREATE TRIGGER trg_simulaciones_ahorro_integrity
  BEFORE INSERT OR UPDATE ON public.simulaciones_ahorro
  FOR EACH ROW EXECUTE FUNCTION public.validate_simulacion_ahorro_integrity();

-- ── 3. Atomic Template Versioning & Activation RPCs (nodo_admin only) ────────
CREATE OR REPLACE FUNCTION public.crear_y_activar_calculadora_template(
  p_nombre TEXT,
  p_descripcion TEXT,
  p_modo TEXT,
  p_campos JSONB,
  p_formulas JSONB,
  p_horizonte_opciones INTEGER[] DEFAULT ARRAY[1, 3, 5, 10, 15, 20, 25],
  p_excel_archivo_nombre TEXT DEFAULT NULL,
  p_excel_archivo_hash TEXT DEFAULT NULL,
  p_excel_hoja_origen TEXT DEFAULT NULL,
  p_excel_mapeo_campos JSONB DEFAULT NULL,
  p_excel_preview_snapshot JSONB DEFAULT NULL,
  p_notas TEXT DEFAULT NULL
)
RETURNS public.calculadora_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version INTEGER;
  v_horizonte_opciones INTEGER[];
  v_row public.calculadora_templates;
BEGIN
  IF public.get_my_rol() IS DISTINCT FROM 'nodo_admin' THEN
    RAISE EXCEPTION 'Solo nodo_admin puede actualizar la plantilla de calculadora';
  END IF;

  IF p_modo NOT IN ('default', 'custom_formulas', 'excel_import') THEN
    RAISE EXCEPTION 'Modo de plantilla inválido: %', p_modo;
  END IF;

  IF jsonb_typeof(p_campos) IS DISTINCT FROM 'array' OR jsonb_typeof(p_formulas) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'campos y formulas deben ser arreglos JSONB';
  END IF;

  v_horizonte_opciones := COALESCE(p_horizonte_opciones, ARRAY[1, 3, 5, 10, 15, 20, 25]);
  IF cardinality(v_horizonte_opciones) = 0 OR EXISTS (
    SELECT 1 FROM unnest(v_horizonte_opciones) AS h
    WHERE h IS NULL OR h < 1 OR h > 30
  ) THEN
    RAISE EXCEPTION 'horizonte_opciones debe contener únicamente enteros entre 1 y 30 años';
  END IF;

  LOCK TABLE public.calculadora_templates IN SHARE ROW EXCLUSIVE MODE;

  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM public.calculadora_templates;

  UPDATE public.calculadora_templates
     SET is_active = FALSE
   WHERE is_active = TRUE;

  INSERT INTO public.calculadora_templates (
    version, nombre, descripcion, modo, is_active,
    campos, formulas, horizonte_opciones,
    excel_archivo_nombre, excel_archivo_hash, excel_hoja_origen,
    excel_mapeo_campos, excel_preview_snapshot,
    validation_status, validation_errors, notas, created_by
  )
  VALUES (
    v_next_version,
    COALESCE(NULLIF(p_nombre, ''), 'Plantilla Calculadora Nodo v' || v_next_version),
    p_descripcion,
    p_modo,
    TRUE,
    p_campos,
    p_formulas,
    v_horizonte_opciones,
    p_excel_archivo_nombre,
    p_excel_archivo_hash,
    p_excel_hoja_origen,
    p_excel_mapeo_campos,
    p_excel_preview_snapshot,
    'valid',
    '[]'::jsonb,
    p_notas,
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.activar_calculadora_template(p_template_id UUID)
RETURNS public.calculadora_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.calculadora_templates;
BEGIN
  IF public.get_my_rol() IS DISTINCT FROM 'nodo_admin' THEN
    RAISE EXCEPTION 'Solo nodo_admin puede activar versiones de plantilla';
  END IF;

  LOCK TABLE public.calculadora_templates IN SHARE ROW EXCLUSIVE MODE;

  SELECT * INTO v_row
    FROM public.calculadora_templates
   WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plantilla de calculadora no encontrada (%)', p_template_id;
  END IF;

  IF v_row.validation_status IS DISTINCT FROM 'valid' THEN
    RAISE EXCEPTION 'No se puede activar una plantilla con validation_status <> valid';
  END IF;

  UPDATE public.calculadora_templates
     SET is_active = FALSE
   WHERE is_active = TRUE
     AND id <> p_template_id;

  UPDATE public.calculadora_templates
     SET is_active = TRUE
   WHERE id = p_template_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_y_activar_calculadora_template(TEXT, TEXT, TEXT, JSONB, JSONB, INTEGER[], TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activar_calculadora_template(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_y_activar_calculadora_template(TEXT, TEXT, TEXT, JSONB, JSONB, INTEGER[], TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activar_calculadora_template(UUID) TO authenticated;

-- ── 4. Stale-Simulation Invalidation Triggers ───────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_project_simulations_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proyecto_id UUID;
BEGIN
  v_proyecto_id := COALESCE(NEW.proyecto_id, OLD.proyecto_id);
  IF v_proyecto_id IS NOT NULL THEN
    UPDATE public.simulaciones_ahorro
       SET is_stale = TRUE
     WHERE proyecto_id = v_proyecto_id
       AND is_stale = FALSE;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_proyecto_row_simulations_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.capex_estimado IS DISTINCT FROM NEW.capex_estimado)
     OR (OLD.moneda IS DISTINCT FROM NEW.moneda)
     OR (OLD.tarifa_actual_cfe IS DISTINCT FROM NEW.tarifa_actual_cfe)
     OR (OLD.consumo_anual_gwh IS DISTINCT FROM NEW.consumo_anual_gwh)
     OR (OLD.demanda_kw IS DISTINCT FROM NEW.demanda_kw)
     OR (OLD.capacidad_mw IS DISTINCT FROM NEW.capacidad_mw)
     OR (OLD.capacidad_mwh IS DISTINCT FROM NEW.capacidad_mwh)
     OR (OLD.volumen_energia_mwh_anual IS DISTINCT FROM NEW.volumen_energia_mwh_anual)
     OR (OLD.incluye_mem IS DISTINCT FROM NEW.incluye_mem)
     OR (OLD.tipo IS DISTINCT FROM NEW.tipo) THEN
    UPDATE public.simulaciones_ahorro
       SET is_stale = TRUE
     WHERE proyecto_id = NEW.id
       AND is_stale = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_sitio_simulations_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.demanda_contratada_kw IS DISTINCT FROM NEW.demanda_contratada_kw THEN
    UPDATE public.simulaciones_ahorro sa
       SET is_stale = TRUE
      FROM public.proyecto_sitios ps
     WHERE ps.sitio_id = NEW.id
       AND sa.proyecto_id = ps.proyecto_id
       AND sa.is_stale = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proyectos_stale_sims ON public.proyectos;
CREATE TRIGGER trg_proyectos_stale_sims
  AFTER UPDATE OF capex_estimado, moneda, tarifa_actual_cfe, consumo_anual_gwh, demanda_kw, capacidad_mw, capacidad_mwh, volumen_energia_mwh_anual, incluye_mem, tipo
  ON public.proyectos
  FOR EACH ROW EXECUTE FUNCTION public.mark_proyecto_row_simulations_stale();

DROP TRIGGER IF EXISTS trg_configs_stale_sims ON public.configuraciones_tecnicas;
CREATE TRIGGER trg_configs_stale_sims
  AFTER INSERT OR UPDATE OR DELETE ON public.configuraciones_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.mark_project_simulations_stale();

DROP TRIGGER IF EXISTS trg_opciones_stale_sims ON public.opciones_financiamiento;
CREATE TRIGGER trg_opciones_stale_sims
  AFTER INSERT OR UPDATE OR DELETE ON public.opciones_financiamiento
  FOR EACH ROW EXECUTE FUNCTION public.mark_project_simulations_stale();

DROP TRIGGER IF EXISTS trg_productos_stale_sims ON public.proyecto_sitio_productos;
CREATE TRIGGER trg_productos_stale_sims
  AFTER INSERT OR UPDATE OR DELETE ON public.proyecto_sitio_productos
  FOR EACH ROW EXECUTE FUNCTION public.mark_project_simulations_stale();

DROP TRIGGER IF EXISTS trg_ofertas_mem_stale_sims ON public.ofertas_mem;
CREATE TRIGGER trg_ofertas_mem_stale_sims
  AFTER INSERT OR UPDATE OR DELETE ON public.ofertas_mem
  FOR EACH ROW EXECUTE FUNCTION public.mark_project_simulations_stale();

DROP TRIGGER IF EXISTS trg_proyecto_sitios_stale_sims ON public.proyecto_sitios;
CREATE TRIGGER trg_proyecto_sitios_stale_sims
  AFTER INSERT OR UPDATE OR DELETE ON public.proyecto_sitios
  FOR EACH ROW EXECUTE FUNCTION public.mark_project_simulations_stale();

DROP TRIGGER IF EXISTS trg_sitios_stale_sims ON public.sitios;
CREATE TRIGGER trg_sitios_stale_sims
  AFTER UPDATE OF demanda_contratada_kw ON public.sitios
  FOR EACH ROW EXECUTE FUNCTION public.mark_sitio_simulations_stale();

-- ── 5. Seed Initial Declarative Template & Rational Formula Set (Idempotent) ─
INSERT INTO public.calculadora_templates (
  version, nombre, descripcion, modo, is_active, campos, formulas, horizonte_opciones, notas
)
SELECT
  1,
  'Plantilla Racional Estándar Nodo MX v1',
  'Conjunto racional por defecto para FV, BESS y MEM (con fallback ahorro_declarado, crédito, arrendamiento y EnSaaS).',
  'default',
  TRUE,
  '[
    {"key":"moneda_default","label":"Moneda base por defecto","unit":"código","type":"select","group":"moneda","defaultValue":"MXN","validationRules":{"required":true,"options":["MXN","USD"],"overrideKey":"moneda_calculo"},"editableByUser":true,"order":1},
    {"key":"tipo_cambio_usd_mxn","label":"Tipo de cambio USD/MXN","unit":"MXN/USD","type":"number","group":"moneda","min":0.01,"max":100,"step":0.1,"defaultValue":17.5,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":2},
    {"key":"tarifa_cfe_default_mxn","label":"Tarifa CFE por defecto","unit":"MXN/kWh","type":"number","group":"tarifas","min":0,"max":50,"step":0.05,"defaultValue":3.2,"validationRules":{"required":true,"overrideKey":"tarifa_cfe_kwh"},"editableByUser":true,"order":3},
    {"key":"cargo_demanda_mensual_kw_mxn","label":"Cargo por demanda CFE","unit":"MXN/kW-mes","type":"number","group":"tarifas","min":0,"max":5000,"step":10,"defaultValue":380,"validationRules":{"required":true,"overrideKey":"cargo_demanda_mensual_kw"},"editableByUser":true,"order":4},
    {"key":"diferencial_punta_base_mxn","label":"Diferencial punta-base BESS","unit":"MXN/kWh","type":"number","group":"tarifas","min":0,"max":20,"step":0.05,"defaultValue":1.4,"validationRules":{"required":true,"overrideKey":"diferencial_punta_base_kwh"},"editableByUser":true,"order":5},
    {"key":"tarifa_mem_default_mxn","label":"Tarifa MEM por defecto","unit":"MXN/kWh","type":"number","group":"tarifas","min":0,"max":50,"step":0.05,"defaultValue":2.45,"validationRules":{"required":true,"overrideKey":"tarifa_mem_kwh"},"editableByUser":true,"order":6},
    {"key":"hsp_horas_dia","label":"Horas Solar Pico (HSP)","unit":"kWh/m²/día","type":"number","group":"fv","min":0.1,"max":12,"step":0.1,"defaultValue":5.2,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":7},
    {"key":"performance_ratio_fv","label":"Performance Ratio FV","unit":"%","type":"percentage","group":"fv","min":0.01,"max":1,"step":0.01,"defaultValue":0.8,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":8},
    {"key":"autoconsumo_fv_pct","label":"Autoconsumo FV","unit":"%","type":"percentage","group":"fv","min":0,"max":1,"step":0.01,"defaultValue":1.0,"validationRules":{"required":true},"editableByUser":true,"order":9},
    {"key":"degradacion_fv_anual","label":"Degradación anual FV","unit":"%/año","type":"percentage","group":"fv","min":0,"max":0.19999,"step":0.001,"defaultValue":0.005,"validationRules":{"required":true,"exclusiveMax":0.2},"editableByUser":true,"order":10},
    {"key":"pesos_estacionales_fv","label":"Pesos estacionales FV (12 meses)","unit":"fracción","type":"number_array","group":"fv","defaultValue":[0.072,0.076,0.090,0.093,0.098,0.091,0.089,0.088,0.080,0.080,0.073,0.070],"validationRules":{"required":true,"arrayLength":12,"sumEquals":1,"sumTolerance":0.001},"editableByUser":false,"order":11},
    {"key":"bess_dod","label":"Profundidad de descarga BESS (DoD)","unit":"%","type":"percentage","group":"bess","min":0.01,"max":1,"step":0.01,"defaultValue":0.85,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":12},
    {"key":"bess_eficiencia_rt","label":"Eficiencia round-trip BESS","unit":"%","type":"percentage","group":"bess","min":0.01,"max":1,"step":0.01,"defaultValue":0.88,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":13},
    {"key":"bess_ciclos_anio","label":"Ciclos anuales BESS","unit":"ciclos/año","type":"integer","group":"bess","min":0,"max":730,"step":10,"defaultValue":260,"validationRules":{"required":true,"integer":true},"editableByUser":true,"order":14},
    {"key":"factor_recorte_demanda","label":"Factor recorte de demanda BESS","unit":"%","type":"percentage","group":"bess","min":0,"max":1,"step":0.05,"defaultValue":0.7,"validationRules":{"required":true},"editableByUser":true,"order":15},
    {"key":"degradacion_bess_anual","label":"Degradación anual BESS","unit":"%/año","type":"percentage","group":"bess","min":0,"max":0.24999,"step":0.005,"defaultValue":0.02,"validationRules":{"required":true,"exclusiveMax":0.25},"editableByUser":true,"order":16},
    {"key":"escalacion_tarifa_anual","label":"Escalación anual de tarifa","unit":"%/año","type":"percentage","group":"macro","min":-0.10,"max":0.50,"step":0.005,"defaultValue":0.045,"validationRules":{"required":true,"allowNegative":true},"editableByUser":true,"order":17},
    {"key":"inflacion_anual","label":"Inflación anual O&M","unit":"%/año","type":"percentage","group":"macro","min":-0.05,"max":0.50,"step":0.005,"defaultValue":0.04,"validationRules":{"required":true,"allowNegative":true},"editableByUser":true,"order":18},
    {"key":"pct_om_anual","label":"Costo anual O&M (% CAPEX)","unit":"%/año","type":"percentage","group":"macro","min":0,"max":0.25,"step":0.0025,"defaultValue":0.01,"validationRules":{"required":true},"editableByUser":true,"order":19},
    {"key":"tasa_descuento_anual","label":"Tasa de descuento anual (WACC)","unit":"%/año","type":"percentage","group":"macro","min":0,"max":0.50,"step":0.005,"defaultValue":0.10,"validationRules":{"required":true},"editableByUser":true,"order":20},
    {"key":"credito_enganche_pct","label":"Enganche de crédito","unit":"%","type":"percentage","group":"financiamiento","min":0,"max":0.99,"step":0.05,"defaultValue":0.20,"validationRules":{"required":true,"overrideKey":"enganche_pct"},"editableByUser":true,"order":21},
    {"key":"credito_tasa_interes_anual","label":"Tasa de interés anual (Crédito)","unit":"%/año","type":"percentage","group":"financiamiento","min":0,"max":0.60,"step":0.005,"defaultValue":0.125,"validationRules":{"required":true,"overrideKey":"tasa_interes_anual"},"editableByUser":true,"order":22},
    {"key":"credito_plazo_meses_default","label":"Plazo financiamiento por defecto","unit":"meses","type":"integer","group":"financiamiento","min":1,"max":300,"step":12,"defaultValue":60,"validationRules":{"required":true,"integer":true,"overrideKey":"plazo_meses","overrideMin":0,"overrideMax":360},"editableByUser":true,"order":23},
    {"key":"arrendamiento_tasa_equivalente_anual","label":"Tasa equivalente anual arrendamiento","unit":"%/año","type":"percentage","group":"financiamiento","min":0,"max":0.60,"step":0.005,"defaultValue":0.135,"validationRules":{"required":true},"editableByUser":false,"order":24},
    {"key":"ensaas_factor_ahorro_pct","label":"Factor ahorro retenido EnSaaS","unit":"%","type":"percentage","group":"financiamiento","min":0.01,"max":1,"step":0.05,"defaultValue":0.25,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":25},
    {"key":"horizonte_default_fv","label":"Horizonte por defecto FV","unit":"años","type":"integer","group":"horizontes","min":1,"max":30,"step":1,"defaultValue":25,"validationRules":{"required":true,"integer":true},"editableByUser":false,"order":26},
    {"key":"horizonte_default_bess","label":"Horizonte por defecto BESS","unit":"años","type":"integer","group":"horizontes","min":1,"max":30,"step":1,"defaultValue":10,"validationRules":{"required":true,"integer":true},"editableByUser":false,"order":27},
    {"key":"horizonte_default_mem","label":"Horizonte por defecto MEM","unit":"años","type":"integer","group":"horizontes","min":1,"max":30,"step":1,"defaultValue":5,"validationRules":{"required":true,"integer":true},"editableByUser":false,"order":28}
  ]'::jsonb,
  '[
    {"key":"fv_kwh_mes","label":"Generación FV Mensual (kWh)","expression":"=generacion_fv_y1_kwh * autoconsumo_fv_pct * POWER(1 - degradacion_fv_anual, anio_indice) * peso_estacional_mes","unit":"kWh","enabled":true},
    {"key":"bess_kwh_mes","label":"Energía Desplazada BESS (kWh)","expression":"=energia_bess_y1_kwh * POWER(1 - degradacion_bess_anual, anio_indice) / 12","unit":"kWh","enabled":true},
    {"key":"energia_ahorrada_kwh_mes","label":"Ahorro Energético Total (kWh)","expression":"=fv_kwh_mes + bess_kwh_mes","unit":"kWh","enabled":true},
    {"key":"ahorro_bruto_mes","label":"Ahorro Monetario Bruto","expression":"=IF((ahorro_fv_y1 + ahorro_bess_y1 + ahorro_mem_y1) > 0, (ahorro_fv_y1 * POWER(1 - degradacion_fv_anual, anio_indice) * peso_estacional_mes + (ahorro_bess_y1 * POWER(1 - degradacion_bess_anual, anio_indice) + ahorro_mem_y1) / 12) * POWER(1 + escalacion_tarifa_anual, anio_indice), (ahorro_declarado_bruto_anual / 12) * POWER(1 + escalacion_tarifa_anual, anio_indice))","unit":"currency","enabled":true},
    {"key":"om_mes","label":"Costo O&M Mensual","expression":"=(capex_total * pct_om_anual * POWER(1 + inflacion_anual, anio_indice)) / 12","unit":"currency","enabled":true},
    {"key":"cuota_financiamiento_mes","label":"Servicio de Deuda / Cuota","expression":"=IF(vista_neta=1, IF(vehiculo_inversion=\"ensaas\", MAX(0, ahorro_bruto_mes * (1 - ensaas_factor_ahorro_pct) - om_mes), IF(AND(mes_indice<=plazo_meses, plazo_meses>0, principal_financiado>0), IF(tasa_interes_mensual>0, -PMT(tasa_interes_mensual, plazo_meses, principal_financiado), principal_financiado / plazo_meses), 0)), 0)","unit":"currency","enabled":true},
    {"key":"flujo_neto_mes","label":"Flujo Neto Mensual","expression":"=ahorro_bruto_mes - om_mes - cuota_financiamiento_mes","unit":"currency","enabled":true}
  ]'::jsonb,
  ARRAY[1, 3, 5, 10, 15, 20, 25],
  'Configuración inicial racional declarativa para México (FV, BESS, MEM).'
WHERE NOT EXISTS (SELECT 1 FROM public.calculadora_templates WHERE is_active = TRUE);

-- ── 6. Enable RLS & Define Policies ─────────────────────────────────────────
ALTER TABLE public.calculadora_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulaciones_ahorro ENABLE ROW LEVEL SECURITY;

-- 6a. calculadora_templates: authorized authenticated roles read; all writes strictly via nodo_admin RPCs
REVOKE INSERT, UPDATE, DELETE ON public.calculadora_templates FROM anon, authenticated;

DROP POLICY IF EXISTS "Roles autorizados ven templates calculadora" ON public.calculadora_templates;
CREATE POLICY "Roles autorizados ven templates calculadora"
  ON public.calculadora_templates FOR SELECT
  USING (public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'finder', 'financiero', 'cliente_final'));

-- 6b. simulaciones_ahorro: authoritative server-side INSERT/UPDATE + membership-verified SELECT/DELETE
CREATE OR REPLACE FUNCTION public.has_simulacion_project_access(p_proyecto_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_rol() NOT IN ('pendiente', 'suministrador')
    AND EXISTS (
      SELECT 1
      FROM public.proyectos p
      WHERE p.id = p_proyecto_id
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'finder' AND p.finder_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
          OR (
            public.get_my_rol() = 'cliente_final'
            AND p.cliente_id IS NOT NULL
            AND p.cliente_id = public.get_my_cliente_crm_id()
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.has_simulacion_project_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_simulacion_project_access(UUID) TO authenticated;

-- Prevent direct client-side PostgREST INSERT/UPDATE forgery of KPIs, capex_snapshot, or overrides;
-- all creates/recalculations/renames run through app/actions/simulaciones.ts (createAdminClient after auth + membership checks).
REVOKE INSERT, UPDATE ON public.simulaciones_ahorro FROM anon, authenticated;

DROP POLICY IF EXISTS "Usuarios ven simulaciones de sus proyectos" ON public.simulaciones_ahorro;
CREATE POLICY "Usuarios ven simulaciones de sus proyectos"
  ON public.simulaciones_ahorro FOR SELECT
  USING (public.has_simulacion_project_access(proyecto_id));

DROP POLICY IF EXISTS "Usuarios autorizados crean simulaciones" ON public.simulaciones_ahorro;
DROP POLICY IF EXISTS "Creador o Nodo/EPC actualiza simulaciones" ON public.simulaciones_ahorro;

DROP POLICY IF EXISTS "Creador o Nodo/EPC elimina simulaciones" ON public.simulaciones_ahorro;
CREATE POLICY "Creador o Nodo/EPC elimina simulaciones"
  ON public.simulaciones_ahorro FOR DELETE
  USING (
    public.has_simulacion_project_access(proyecto_id)
    AND (
      public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
      OR (
        public.get_my_rol() = 'epc'
        AND EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id AND p.epcista_id = auth.uid())
      )
      OR created_by = auth.uid()
    )
  );

-- ── 7. Existing RLS & Storage Fixes (v2, v18, v22 & FinancialMilestoneModal) ─
-- 7a. Allow cliente_final to SELECT config_financiamiento links for their projects
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
      OR (
        public.get_my_rol() = 'cliente_final'
        AND p.cliente_id IS NOT NULL
        AND p.cliente_id = public.get_my_cliente_crm_id()
      )
    )
  ));

-- 7b. Complete Finder UPDATE/DELETE policies on proyecto_sitio_productos
DROP POLICY IF EXISTS "Finder actualiza productos" ON public.proyecto_sitio_productos;
CREATE POLICY "Finder actualiza productos"
  ON public.proyecto_sitio_productos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id AND p.finder_id = auth.uid()));

DROP POLICY IF EXISTS "Finder elimina productos" ON public.proyecto_sitio_productos;
CREATE POLICY "Finder elimina productos"
  ON public.proyecto_sitio_productos FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id AND p.finder_id = auth.uid()));

-- 7c. Project/role-scoped Storage policies on existing 'archivos-proyectos' bucket
--     Covers BOTH prefixes (replacing global authenticated insert):
--       1) comprobantes/<proyecto_id>/* (FinancialMilestoneModal.tsx:85,87 migrated from 'archivos')
--       2) <proyecto_id>/* (DocumentCenter.tsx:189-193 across /admin, /analista, /epc, /finder;
--          note DocumentCenter.tsx:138 deletes rows in public.archivos, not storage.objects,
--          and cliente_final has no DocumentCenter upload access)
DROP POLICY IF EXISTS "Subir archivos autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Archivos autenticados CRUD" ON storage.objects;

DROP POLICY IF EXISTS "Subir comprobantes proyecto" ON storage.objects;
CREATE POLICY "Subir comprobantes proyecto"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'archivos-proyectos'
    AND public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'financiero')
    AND (storage.foldername(name))[1] = 'comprobantes'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = CASE
        WHEN (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN ((storage.foldername(name))[2])::uuid
      END
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Subir documentos proyecto" ON storage.objects;
CREATE POLICY "Subir documentos proyecto"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'archivos-proyectos'
    AND public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'finder', 'financiero')
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN ((storage.foldername(name))[1])::uuid
      END
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'finder' AND p.finder_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Actualizar comprobantes proyecto" ON storage.objects;
CREATE POLICY "Actualizar comprobantes proyecto"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'archivos-proyectos'
    AND public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'financiero')
    AND (storage.foldername(name))[1] = 'comprobantes'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = CASE
        WHEN (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN ((storage.foldername(name))[2])::uuid
      END
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    bucket_id = 'archivos-proyectos'
    AND public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'financiero')
    AND (storage.foldername(name))[1] = 'comprobantes'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = CASE
        WHEN (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN ((storage.foldername(name))[2])::uuid
      END
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Eliminar comprobantes proyecto" ON storage.objects;
CREATE POLICY "Eliminar comprobantes proyecto"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'archivos-proyectos'
    AND public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'financiero')
    AND (storage.foldername(name))[1] = 'comprobantes'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = CASE
        WHEN (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN ((storage.foldername(name))[2])::uuid
      END
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
        )
    )
  );

-- 7d. Allow cliente_final, financiero, and project-assigned finder to SELECT sitios linked to their projects
--     (enables demanda_contratada_kw sourcing on /cliente/proyectos/[id], /financiero/proyectos/[id],
--      and covers finders assigned by admin to projects of another finder's client vs v22_finder_role.sql:74-79)
DROP POLICY IF EXISTS "Cliente y Financiero ven sitios de sus proyectos" ON public.sitios;
DROP POLICY IF EXISTS "Cliente, Financiero y Finder ven sitios de sus proyectos" ON public.sitios;
CREATE POLICY "Cliente, Financiero y Finder ven sitios de sus proyectos"
  ON public.sitios FOR SELECT
  USING (
    (
      public.get_my_rol() = 'cliente_final'
      AND (
        cliente_id = public.get_my_cliente_crm_id()
        OR EXISTS (
          SELECT 1
          FROM public.proyecto_sitios ps
          JOIN public.proyectos p ON p.id = ps.proyecto_id
          WHERE ps.sitio_id = public.sitios.id
            AND p.cliente_id IS NOT NULL
            AND p.cliente_id = public.get_my_cliente_crm_id()
        )
      )
    )
    OR (
      public.get_my_rol() = 'financiero'
      AND EXISTS (
        SELECT 1
        FROM public.proyecto_sitios ps
        JOIN public.proyectos p ON p.id = ps.proyecto_id
        WHERE ps.sitio_id = public.sitios.id
          AND p.financiero_id = auth.uid()
      )
    )
    OR (
      public.get_my_rol() = 'finder'
      AND EXISTS (
        SELECT 1
        FROM public.proyecto_sitios ps
        JOIN public.proyectos p ON p.id = ps.proyecto_id
        WHERE ps.sitio_id = public.sitios.id
          AND p.finder_id = auth.uid()
      )
    )
  );

-- 7e. Fix legacy pre-v16 ofertas_mem SELECT policy (v2_migration.sql:78-83 checked pr.cliente_id = auth.uid())
DROP POLICY IF EXISTS "Suministrador ve sus ofertas y EPC/Nodo/Cliente ven todas" ON public.ofertas_mem;
CREATE POLICY "Suministrador ve sus ofertas y roles del proyecto ven ofertas"
  ON public.ofertas_mem FOR SELECT
  USING (
    (public.get_my_rol() = 'suministrador' AND suministrador_id = auth.uid())
    OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
    OR EXISTS (
      SELECT 1 FROM public.proyectos pr
      WHERE pr.id = proyecto_id
        AND (
          (public.get_my_rol() = 'epc' AND pr.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'finder' AND pr.finder_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND pr.financiero_id = auth.uid())
          OR (
            public.get_my_rol() = 'cliente_final'
            AND pr.cliente_id IS NOT NULL
            AND pr.cliente_id = public.get_my_cliente_crm_id()
          )
        )
    )
  );

-- 7f. Grant finder SELECT & INSERT access on public.archivos while preserving
--     v16_link_clientes_usuarios.sql:70-87 (cliente_final SELECT via get_my_cliente_crm_id()
--     and project-scoped financiero p.financiero_id = auth.uid()) and v15_fix_archivos_rls.sql:9-33
--     (matching DocumentCenter.tsx:189-211 and v29 §7c "Subir documentos proyecto").
--     Note: DELETE policy "Eliminar archivos" (v15_fix_archivos_rls.sql:38-43) already authorizes
--     auth.uid() = autor_id OR get_my_rol() IN ('nodo_admin', 'nodo_analista'), matching DocumentCenter.tsx:138,249-250.
DROP POLICY IF EXISTS "Ver archivos del proyecto" ON public.archivos;
CREATE POLICY "Ver archivos del proyecto"
  ON public.archivos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = archivos.proyecto_id
        AND (
          p.epcista_id = auth.uid()
          OR p.financiero_id = auth.uid()
          OR (
            public.get_my_rol() = 'finder'
            AND p.finder_id = auth.uid()
          )
          OR public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'analista')
          OR (
            public.get_my_rol() = 'cliente_final'
            AND p.cliente_id IS NOT NULL
            AND p.cliente_id = public.get_my_cliente_crm_id()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Insertar archivos" ON public.archivos;
CREATE POLICY "Insertar archivos"
  ON public.archivos FOR INSERT
  WITH CHECK (
    auth.uid() = autor_id
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = archivos.proyecto_id
        AND (
          p.epcista_id = auth.uid()
          OR p.financiero_id = auth.uid()
          OR (
            public.get_my_rol() = 'finder'
            AND p.finder_id = auth.uid()
          )
          OR public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'analista')
        )
    )
  );
