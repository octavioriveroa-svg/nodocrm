-- ============================================================================
-- MIGRATION: v32 — Rationalized FV + BESS MEM (8,760h + 100HC) Template v2
-- Dependencies: 20261119000000_v29_savings_calculator.sql
-- Purpose:
--   1. Append-only rotation of calculadora_templates (deactivate v1, insert v2 active)
--   2. Preserves all 28 CFE/AST fallback campos AND adds the 25 canonical Excel
--      MEM Inputs (23 editable blue inputs + 1 derived read-only Duracion + TC_Fecha)
--   3. Preserves all 7 canonical monthly fallback formulas so legacy & CFE projects
--      continue working identically alongside the two-stage 8,760h + 100HC engine
-- ============================================================================

DO $$
DECLARE
  v_mem_nombre CONSTANT TEXT := 'Plantilla Racional FV + BESS MEM (8,760h + 100HC) v2';
  v_base_campos JSONB;
  v_base_formulas JSONB;
  v_mem_campos JSONB;
  v_combined_campos JSONB;
  v_next_version INTEGER;
BEGIN
  -- Idempotency: skip if this rationalized MEM template was already inserted
  IF EXISTS (
    SELECT 1
      FROM public.calculadora_templates
     WHERE nombre = v_mem_nombre
  ) THEN
    RAISE NOTICE 'v32 MEM template (%) already exists; skipping.', v_mem_nombre;
    RETURN;
  END IF;

  -- Load active template's CFE campos & formulas (or v1) as fallback baseline
  SELECT campos, formulas
    INTO v_base_campos, v_base_formulas
    FROM public.calculadora_templates
   ORDER BY is_active DESC, version DESC
   LIMIT 1;

  IF v_base_campos IS NULL THEN
    v_base_campos := '[]'::jsonb;
  END IF;

  IF v_base_formulas IS NULL THEN
    v_base_formulas := '[
      {"key":"fv_kwh_mes","label":"Generación FV Mensual (kWh)","expression":"=generacion_fv_y1_kwh * autoconsumo_fv_pct * POWER(1 - degradacion_fv_anual, anio_indice) * peso_estacional_mes","unit":"kWh","enabled":true},
      {"key":"bess_kwh_mes","label":"Energía Desplazada BESS (kWh)","expression":"=energia_bess_y1_kwh * POWER(1 - degradacion_bess_anual, anio_indice) / 12","unit":"kWh","enabled":true},
      {"key":"energia_ahorrada_kwh_mes","label":"Ahorro Energético Total (kWh)","expression":"=fv_kwh_mes + bess_kwh_mes","unit":"kWh","enabled":true},
      {"key":"ahorro_bruto_mes","label":"Ahorro Monetario Bruto","expression":"=IF((ahorro_fv_y1 + ahorro_bess_y1 + ahorro_mem_y1) > 0, (ahorro_fv_y1 * POWER(1 - degradacion_fv_anual, anio_indice) * peso_estacional_mes + (ahorro_bess_y1 * POWER(1 - degradacion_bess_anual, anio_indice) + ahorro_mem_y1) / 12) * POWER(1 + escalacion_tarifa_anual, anio_indice), (ahorro_declarado_bruto_anual / 12) * POWER(1 + escalacion_tarifa_anual, anio_indice))","unit":"currency","enabled":true},
      {"key":"om_mes","label":"Costo O&M Mensual","expression":"=(capex_total * pct_om_anual * POWER(1 + inflacion_anual, anio_indice)) / 12","unit":"currency","enabled":true},
      {"key":"cuota_financiamiento_mes","label":"Servicio de Deuda / Cuota","expression":"=IF(vista_neta=1, IF(vehiculo_inversion=\"ensaas\", MAX(0, ahorro_bruto_mes * (1 - ensaas_factor_ahorro_pct) - om_mes), IF(AND(mes_indice<=plazo_meses, plazo_meses>0, principal_financiado>0), IF(tasa_interes_mensual>0, -PMT(tasa_interes_mensual, plazo_meses, principal_financiado), principal_financiado / plazo_meses), 0)), 0)","unit":"currency","enabled":true},
      {"key":"flujo_neto_mes","label":"Flujo Neto Mensual","expression":"=ahorro_bruto_mes - om_mes - cuota_financiamiento_mes","unit":"currency","enabled":true}
    ]'::jsonb;
  END IF;

  -- Canonical 25 Excel Input fields (Simulador FV + BESS MEM.xlsx -> Input!C5:C41)
  v_mem_campos := '[
    {"key":"cliente","label":"Cliente","unit":"texto","type":"text","group":"cliente","defaultValue":"Beetman","validationRules":{"required":true},"editableByUser":true,"order":101},
    {"key":"demanda_contratada_mw","label":"Demanda contratada","unit":"MW","type":"number","group":"cliente","min":0.001,"max":5000,"step":0.5,"defaultValue":10,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":102},
    {"key":"bess_potencia_mw","label":"Potencia BESS","unit":"MW","type":"number","group":"bess","min":0,"max":500,"step":0.5,"defaultValue":6,"validationRules":{"required":true},"editableByUser":true,"order":103},
    {"key":"bess_duracion_h","label":"Duración a potencia nominal","unit":"h","type":"number","group":"bess","min":0,"max":24,"step":0.5,"defaultValue":3,"validationRules":{"required":false},"editableByUser":false,"order":104},
    {"key":"bess_capacidad_mwh","label":"Capacidad de almacenamiento (energía)","unit":"MWh","type":"number","group":"bess","min":0,"max":2000,"step":0.5,"defaultValue":18,"validationRules":{"required":true},"editableByUser":true,"order":105},
    {"key":"bess_eficiencia_pct","label":"Eficiencia ida y vuelta","unit":"%","type":"percentage","group":"bess","min":0.01,"max":1,"step":0.01,"defaultValue":0.86,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":106},
    {"key":"bess_soc_min_pct","label":"Estado de carga mínimo (SOC)","unit":"%","type":"percentage","group":"bess","min":0,"max":0.5,"step":0.01,"defaultValue":0.10,"validationRules":{"required":true},"editableByUser":true,"order":107},
    {"key":"op_horas_carga","label":"Horas de carga por día (las más baratas)","unit":"h","type":"integer","group":"operacion","min":0,"max":24,"step":1,"defaultValue":5,"validationRules":{"required":true,"integer":true},"editableByUser":true,"order":108},
    {"key":"op_ini_carga","label":"Inicio ventana de carga","unit":"hora","type":"integer","group":"operacion","min":1,"max":24,"step":1,"defaultValue":2,"validationRules":{"required":true,"integer":true},"editableByUser":true,"order":109},
    {"key":"op_fin_carga","label":"Fin ventana de carga","unit":"hora","type":"integer","group":"operacion","min":1,"max":24,"step":1,"defaultValue":10,"validationRules":{"required":true,"integer":true},"editableByUser":true,"order":110},
    {"key":"op_ini_descarga","label":"Inicio ventana de descarga","unit":"hora","type":"integer","group":"operacion","min":1,"max":24,"step":1,"defaultValue":20,"validationRules":{"required":true,"integer":true},"editableByUser":true,"order":111},
    {"key":"op_fin_descarga","label":"Fin ventana de descarga","unit":"hora","type":"integer","group":"operacion","min":1,"max":24,"step":1,"defaultValue":22,"validationRules":{"required":true,"integer":true},"editableByUser":true,"order":112},
    {"key":"fv_potencia_mw","label":"Potencia FV","unit":"MW","type":"number","group":"fv","min":0,"max":500,"step":0.05,"defaultValue":0,"validationRules":{"required":true},"editableByUser":true,"order":113},
    {"key":"fv_degradacion_anual_pct","label":"Degradación anual FV","unit":"%/año","type":"percentage","group":"fv","min":0,"max":0.05,"step":0.001,"defaultValue":0.005,"validationRules":{"required":true},"editableByUser":true,"order":114},
    {"key":"tc_mxn_usd","label":"Tipo de cambio pactado (inversión)","unit":"MXN/USD","type":"number","group":"mercado_tc","min":0.01,"max":100,"step":0.1,"defaultValue":18.7,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":115},
    {"key":"tc_fecha","label":"Fecha del tipo de cambio pactado","unit":"fecha","type":"date","group":"mercado_tc","defaultValue":"2026-11-18","validationRules":{"required":true},"editableByUser":true,"order":116},
    {"key":"mbp_precio_mxn_mw_anio","label":"Precio MBP publicado (año 100HC)","unit":"MXN/MW-año","type":"number","group":"mercado_tc","min":1,"max":100000000,"step":10000,"defaultValue":4690767.66,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":117},
    {"key":"rap_factor","label":"Factor de ajuste RAP","unit":"factor","type":"number","group":"mercado_tc","min":0.001,"max":10,"step":0.001,"defaultValue":1.077,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":118},
    {"key":"capex_bess_usd_kwh","label":"CAPEX BESS","unit":"USD/kWh","type":"number","group":"costos","min":0,"max":10000,"step":5,"defaultValue":320,"validationRules":{"required":true},"editableByUser":true,"order":119},
    {"key":"capex_fv_usd_kwp","label":"CAPEX FV","unit":"USD/kWp","type":"number","group":"costos","min":0,"max":10000,"step":10,"defaultValue":0,"validationRules":{"required":true},"editableByUser":true,"order":120},
    {"key":"opex_bess_mxn_mwh_anio","label":"OPEX BESS","unit":"MXN/MWh-año","type":"number","group":"costos","min":0,"max":5000000,"step":500,"defaultValue":32198.4,"validationRules":{"required":true},"editableByUser":true,"order":121},
    {"key":"opex_fv_mxn_mw_anio","label":"OPEX FV","unit":"MXN/MW-año","type":"number","group":"costos","min":0,"max":50000000,"step":1000,"defaultValue":0,"validationRules":{"required":true},"editableByUser":true,"order":122},
    {"key":"fin_horizonte_anios","label":"Horizonte de evaluación","unit":"años","type":"integer","group":"evaluacion_financiera","min":1,"max":25,"step":1,"defaultValue":20,"validationRules":{"required":true,"integer":true},"editableByUser":true,"order":123},
    {"key":"fin_tasa_descuento_pct","label":"Tasa de descuento (WACC)","unit":"%","type":"percentage","group":"evaluacion_financiera","min":0,"max":0.5,"step":0.005,"defaultValue":0.12,"validationRules":{"required":true},"editableByUser":true,"order":124},
    {"key":"fin_esc_opex_pct","label":"Escalamiento anual OPEX (MXN)","unit":"%/año","type":"percentage","group":"evaluacion_financiera","min":-0.5,"max":1,"step":0.005,"defaultValue":0.035,"validationRules":{"required":true,"allowNegative":true},"editableByUser":true,"order":125}
  ]'::jsonb;

  -- Strip any pre-existing keys from v_base_campos that overlap with v_mem_campos keys
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    INTO v_base_campos
    FROM jsonb_array_elements(v_base_campos) AS elem
   WHERE (elem->>'key') NOT IN (
     SELECT (m->>'key') FROM jsonb_array_elements(v_mem_campos) AS m
   );

  v_combined_campos := v_base_campos || v_mem_campos;

  LOCK TABLE public.calculadora_templates IN SHARE ROW EXCLUSIVE MODE;

  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM public.calculadora_templates;

  UPDATE public.calculadora_templates
     SET is_active = FALSE
   WHERE is_active = TRUE;

  INSERT INTO public.calculadora_templates (
    version,
    nombre,
    descripcion,
    modo,
    is_active,
    campos,
    formulas,
    horizonte_opciones,
    notas
  )
  VALUES (
    v_next_version,
    v_mem_nombre,
    'Plantilla racionalizada conforme a Simulador FV + BESS MEM.xlsx (23 inputs azules, 8,760h + 100HC, Supuestos anuales 1-25, Sensibilidad BESS) conservando respaldo CFE tarifario y vistas Bruto/Neto Financiado.',
    'default',
    TRUE,
    v_combined_campos,
    v_base_formulas,
    ARRAY[1, 3, 5, 10, 15, 20, 25],
    'Migración v32: agrega parámetros MEM FV + BESS horarios conservando fórmulas y campos CFE v1.'
  );
END $$;

NOTIFY pgrst, 'reload schema';
