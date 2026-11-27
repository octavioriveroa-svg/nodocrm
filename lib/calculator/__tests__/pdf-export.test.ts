import { describe, expect, it } from 'vitest'
import { buildPdfFilename, buildPdfReportModel } from '@/lib/calculator/pdf-export'
import { createDefaultMemAnnualAssumptions, getBaseline100HC, getBaselineMemHourlyDataset } from '@/lib/calculator/datasets/mem-baseline'
import { runMemSimulation } from '@/lib/calculator/mem-hourly-engine'
import { buildFallbackCalculatorTemplate } from '@/lib/calculator/load-context'
import { evaluateSimulation } from '@/lib/calculator/engine'
import type { MemSimulatorInputs, Proyecto, SimulacionAhorro } from '@/lib/types'

const FIXED_DATE = new Date('2026-11-27T12:00:00.000Z')

const SAMPLE_MEM_INPUTS: MemSimulatorInputs = {
  cliente: 'Hotel Azul Ixtapa',
  demanda_contratada_mw: 4.595,
  bess_potencia_mw: 2.58,
  bess_capacidad_mwh: 5.004,
  bess_eficiencia_pct: 0.86,
  bess_soc_min_pct: 0.1,
  op_horas_carga: 5,
  op_ini_carga: 2,
  op_fin_carga: 10,
  op_ini_descarga: 20,
  op_fin_descarga: 22,
  fv_potencia_mw: 0.5,
  fv_degradacion_anual_pct: 0.005,
  tc_mxn_usd: 18.7,
  tc_fecha: '2026-11-18',
  mbp_precio_mxn_mw_anio: 4_690_767.66,
  rap_factor: 1.0715,
  capex_bess_usd_kwh: 285,
  capex_fv_usd_kwp: 750,
  opex_bess_mxn_mwh_anio: 55_000,
  opex_fv_mxn_mw_anio: 180_000,
  fin_horizonte_anios: 15,
  fin_tasa_descuento_pct: 0.12,
  fin_esc_opex_pct: 0.035,
}

const SAMPLE_PROJECT: Proyecto = {
  id: '00000000-0000-4000-8000-000000000001',
  epcista_id: null,
  responsable_nodo_id: null,
  cliente_id: null,
  finder_id: null,
  financiero_id: null,
  tipo: 'FV+BESS',
  nombre_proyecto: 'Planta Industrial Bajío',
  estado: 'en_analisis',
  cliente_final_nombre: 'Ana López',
  cliente_final_empresa: 'Manufactura Bajío SA',
  cliente_final_contacto: 'ana@example.com',
  capacidad_mwh: 0.4,
  capacidad_mw: 0.5,
  tecnologia_bateria: 'LFP',
  duracion_descarga_hrs: 2,
  punto_interconexion: null,
  tipo_participacion_mem: null,
  volumen_energia_mwh_anual: 1200,
  capex_estimado: 5_000_000,
  moneda: 'MXN',
  ubicacion_estado: 'Guanajuato',
  modalidad_financiamiento: ['no_sabe'],
  notas_adicionales: null,
  tipo_instalacion: null,
  incluye_mem: false,
  demanda_kw: 450,
  tarifa_actual_cfe: 'GDMTH',
  consumo_anual_gwh: 1.2,
  codigo_postal: null,
  created_at: '2026-11-27T00:00:00Z',
  updated_at: '2026-11-27T00:00:00Z',
}

describe('Branded PDF Export Report Model', () => {
  it('sanitizes Spanish accents, spaces, and punctuation into clean filenames', () => {
    expect(buildPdfFilename('Simulación México — León / FV+BESS', FIXED_DATE)).toBe(
      'Nodo_Simulacion_simulacion_mexico_leon_fv_bess_2026-11-27.pdf',
    )
  })

  it('builds complete MEM Horario PDF model without NaN or Infinity values', () => {
    const res = runMemSimulation({
      inputs: SAMPLE_MEM_INPUTS,
      assumptions: createDefaultMemAnnualAssumptions(),
      hourly: getBaselineMemHourlyDataset(),
      criticalHours100HC: getBaseline100HC(),
      financialOptions: { moneda: 'MXN', vistaFinanciamiento: 'bruto' },
    })
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return

    const model = buildPdfReportModel({
      kind: 'mem_horaria',
      title: 'Escenario Manual MEM 15a',
      originLabel: 'Simulación manual (sin proyecto vinculado)',
      moneda: 'MXN',
      vistaFinanciamiento: 'bruto',
      inputs: res.inputs,
      year1: res.year1,
      financial: res.financial,
      datasetLabel: '2025 CENACE MEM Baseline',
      generatedAt: FIXED_DATE,
    })

    expect(model.kpis).toHaveLength(6)
    expect(model.tableRows.length).toBe(16) // Año 0 .. Año 15
    const flatText = [
      ...model.kpis.map((k) => `${k.label} ${k.value} ${k.sublabel ?? ''}`),
      ...model.tableRows.flat(),
    ].join(' ')
    expect(flatText).not.toContain('NaN')
    expect(flatText).not.toContain('Infinity')
  })

  it('builds complete CFE Tarifario PDF model including regulatory warning when attached', () => {
    const template = buildFallbackCalculatorTemplate()
    const outcome = evaluateSimulation({
      proyecto: SAMPLE_PROJECT,
      activeConfig: null,
      configProducts: [],
      activeFinancing: null,
      sitios: [],
      ofertasMem: [],
      template,
      monedaCalculo: 'MXN',
      horizonteAnios: 10,
      vistaFinanciamiento: 'bruto',
      overrides: {},
    })
    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return

    const model = buildPdfReportModel({
      kind: 'cfe_tarifario',
      title: 'Caso Manual CFE GDMTH',
      originLabel: 'Simulación manual (sin proyecto vinculado)',
      moneda: 'MXN',
      vistaFinanciamiento: 'bruto',
      horizonteAnios: 10,
      proyecto: SAMPLE_PROJECT,
      outcome,
      fxUsed: 18.7,
      templateVersion: template.version,
      regulatoryWarning: 'Demanda menor a 1 MW.',
      generatedAt: FIXED_DATE,
    })

    expect(model.modeLabel).toBe('CFE Tarifario')
    expect(model.kpis).toHaveLength(6)
    expect(model.tableRows.length).toBe(10)
    expect(model.regulatoryWarning).toBe('Demanda menor a 1 MW.')
  })

  it('re-evaluates saved_snapshot cleanly when project context is supplied', () => {
    const template = buildFallbackCalculatorTemplate()
    const sim: SimulacionAhorro = {
      id: 'sim-1',
      proyecto_id: SAMPLE_PROJECT.id,
      configuracion_id: null,
      opcion_financiamiento_id: null,
      nombre: 'Escenario Base 10 años',
      descripcion: null,
      usa_parametros_base: true,
      template_id: template.id,
      template_version: template.version,
      parametros_override: {},
      moneda_calculo: 'MXN',
      tipo_cambio_usado: 18.7,
      horizonte_anios: 10,
      granularidad_default: 'anual',
      vista_financiamiento: 'bruto',
      fuente_calculo: 'fisico_tarifario',
      capex_snapshot: 5_000_000,
      desembolso_inicial: 5_000_000,
      payback_simple_meses: 48,
      payback_simple_anios: 4,
      payback_descontado_meses: 60,
      payback_estado: 'en_horizonte',
      ahorro_energia_y1_kwh: 150_000,
      ahorro_energia_total_kwh: 1_500_000,
      ahorro_monetario_y1: 1_250_000,
      ahorro_monetario_total: 14_000_000,
      flujo_neto_total: 8_500_000,
      roi_pct: 170,
      tir_pct: 22.5,
      van: 3_100_000,
      is_stale: false,
      created_by: null,
      created_at: FIXED_DATE.toISOString(),
      updated_at: FIXED_DATE.toISOString(),
    }

    const model = buildPdfReportModel({
      kind: 'saved_snapshot',
      simulacion: sim,
      proyecto: SAMPLE_PROJECT,
      template,
      generatedAt: FIXED_DATE,
    })

    expect(model.kpis).toHaveLength(6)
    expect(model.tableRows.length).toBe(10)
    expect(model.title).toContain('Planta Industrial Bajío')
  })
})
