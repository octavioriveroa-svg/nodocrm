import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import type {
  CalculadoraTemplate,
  ConfiguracionTecnica,
  OpcionFinanciamiento,
  Proyecto,
  ProyectoSitioProducto,
  SimulationEvaluationResult,
} from '@/lib/types'
import {
  FALLBACK_TEMPLATE_CAMPOS,
  FALLBACK_TEMPLATE_FORMULAS,
  validateOverridesAgainstTemplate,
} from '@/lib/calculator/template-schema'
import {
  getPlatformVariable,
  isKnownPlatformIdentifier,
  PLATFORM_OUTPUT_DEFINITIONS,
  PLATFORM_VARIABLES,
} from '@/lib/calculator/variable-dictionary'
import {
  clearCompiledFormulaCache,
  compileAndSortFormulas,
  evaluateExcelExpression,
  extractFormulaCellRefs,
  FormulaError,
  normalizeCellRef,
  rewriteFormulaCellRefs,
} from '@/lib/calculator/formula-engine'
import { aggregateSeries } from '@/lib/calculator/aggregate'
import {
  evaluateSimulation,
  findPermanentBreakEvenMonth,
  hasValidFinancialFigures,
  resolveCapexTotal,
  type SimulationEngineInput,
} from '@/lib/calculator/engine'
import {
  parseWorkbookWithExcelJs,
  previewFormulaRewrite,
} from '@/lib/calculator/excel-mapper'
import {
  LEGACY_XLS_ERROR_MESSAGE,
  preflightValidateSpreadsheetBuffer,
} from '@/lib/calculator/zip-preflight'
import {
  buildProjectionCsv,
  formatCsvNumericCell,
  neutralizeCsvStringCell,
} from '@/lib/calculator/csv-export'

// ── Test Fixtures ─────────────────────────────────────────────────────────────

const V1_TEMPLATE: Pick<CalculadoraTemplate, 'id' | 'modo' | 'campos' | 'formulas'> = {
  id: '00000000-0000-4000-8000-000000000001',
  modo: 'default',
  campos: FALLBACK_TEMPLATE_CAMPOS,
  formulas: FALLBACK_TEMPLATE_FORMULAS,
}

const V1_AST_TEMPLATE: Pick<CalculadoraTemplate, 'id' | 'modo' | 'campos' | 'formulas'> = {
  id: '00000000-0000-4000-8000-000000000002',
  modo: 'custom_formulas',
  campos: FALLBACK_TEMPLATE_CAMPOS,
  formulas: FALLBACK_TEMPLATE_FORMULAS,
}

function makeBaseProyecto(overrides: Partial<Proyecto> = {}): SimulationEngineInput['proyecto'] {
  return {
    tipo: 'FV',
    capex_estimado: 100_000,
    moneda: 'USD',
    incluye_mem: false,
    demanda_kw: 200,
    capacidad_mw: null,
    capacidad_mwh: null,
    consumo_anual_gwh: null,
    volumen_energia_mwh_anual: null,
    tarifa_actual_cfe: null,
    ...overrides,
  }
}

function makeConfig(overrides: Partial<ConfiguracionTecnica> = {}): ConfiguracionTecnica {
  return {
    id: 'cfg-1',
    proyecto_id: 'proj-1',
    nombre: 'Alternativa Base',
    descripcion: null,
    inversion_total: 100_000,
    moneda: 'USD',
    ahorro_estimado_anual: null,
    ahorro_estimado_mensual: null,
    ahorro_moneda: 'MXN',
    seleccionada: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeFvProduct(overrides: Partial<ProyectoSitioProducto> = {}): ProyectoSitioProducto {
  return {
    id: 'prod-fv-1',
    proyecto_id: 'proj-1',
    sitio_id: 'sitio-1',
    configuracion_id: 'cfg-1',
    tipo: 'fv',
    datos: {
      num_modulos: 200,
      potencia_modulos_w: 500,
      generacion_anual_kwh: 160_000,
      capex: 100_000,
      capex_moneda: 'USD',
    },
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeBessProduct(overrides: Partial<ProyectoSitioProducto> = {}): ProyectoSitioProducto {
  return {
    id: 'prod-bess-1',
    proyecto_id: 'proj-1',
    sitio_id: 'sitio-1',
    configuracion_id: 'cfg-1',
    tipo: 'bess',
    datos: {
      potencia_kw: 150,
      capacidad_kwh: 300,
      uso: 'load_shifting',
      capex: 850_000,
      capex_moneda: 'MXN',
    },
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeFinancing(overrides: Partial<OpcionFinanciamiento> = {}): OpcionFinanciamiento {
  return {
    id: 'fin-1',
    proyecto_id: 'proj-1',
    nombre: 'Crédito 60m',
    vehiculo_inversion: 'credito',
    ahorro_estimado_anual: null,
    ahorro_estimado_mensual: null,
    moneda: 'MXN',
    plazo_meses: 60,
    notas: null,
    seleccionada: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function expectOk(outcome: ReturnType<typeof evaluateSimulation>): SimulationEvaluationResult {
  expect(outcome.status).toBe('ok')
  if (outcome.status !== 'ok') {
    throw new Error(`Expected ok outcome, got ${outcome.status}`)
  }
  return outcome
}

/**
 * Helper constructing a valid minimal ZIP buffer with custom Central Directory sizes
 * to test ZIP bomb (> 100:1 with > 1 MB floor) and > 50 MB uncompressed cap without allocating huge RAM.
 */
function buildSyntheticZipBuffer(compressedSize: number, uncompressedSize: number): Buffer {
  const fileName = Buffer.from('xl/workbook.xml', 'utf8')
  const payload = Buffer.alloc(16, 0x41)

  // Local File Header (30 + fileName.length + payload.length)
  const lfh = Buffer.alloc(30 + fileName.length)
  lfh.writeUInt32LE(0x04034b50, 0)
  lfh.writeUInt16LE(20, 4)
  lfh.writeUInt16LE(0, 6)
  lfh.writeUInt16LE(8, 8)
  lfh.writeUInt32LE(compressedSize, 18)
  lfh.writeUInt32LE(uncompressedSize, 22)
  lfh.writeUInt16LE(fileName.length, 26)
  lfh.writeUInt16LE(0, 28)
  fileName.copy(lfh, 30)

  const cdOffset = lfh.length + payload.length

  // Central Directory Header (46 + fileName.length)
  const cdh = Buffer.alloc(46 + fileName.length)
  cdh.writeUInt32LE(0x02014b50, 0)
  cdh.writeUInt16LE(20, 4)
  cdh.writeUInt16LE(20, 6)
  cdh.writeUInt16LE(0, 8)
  cdh.writeUInt16LE(8, 10)
  cdh.writeUInt32LE(compressedSize, 20)
  cdh.writeUInt32LE(uncompressedSize, 24)
  cdh.writeUInt16LE(fileName.length, 28)
  cdh.writeUInt16LE(0, 30)
  cdh.writeUInt16LE(0, 32)
  cdh.writeUInt32LE(0, 42)
  fileName.copy(cdh, 46)

  // End of Central Directory (22 bytes)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(cdh.length, 12)
  eocd.writeUInt32LE(cdOffset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([lfh, payload, cdh, eocd])
}

// ── 1. Canonical Variable Dictionary ──────────────────────────────────────────

describe('Canonical Platform Variable Dictionary (§4.1)', () => {
  it('defines all 57 canonical platform variables (including tasa_interes_anual) and 7 output keys', () => {
    expect(PLATFORM_VARIABLES).toHaveLength(57)
    expect(PLATFORM_OUTPUT_DEFINITIONS).toHaveLength(7)
    expect(getPlatformVariable('tasa_interes_anual')).toBeDefined()
    expect(getPlatformVariable('capex_total')?.unit).toBe('moneda_calculo')
    expect(isKnownPlatformIdentifier('tasa_interes_anual')).toBe(true)
    expect(isKnownPlatformIdentifier('flujo_neto_mes')).toBe(true)
    expect(isKnownPlatformIdentifier('constructor')).toBe(false)
    expect(isKnownPlatformIdentifier('__proto__')).toBe(false)
  })
})

// ── 2. Scenario S1 — Baseline vs User-Overridden Context Parameters ───────────

describe('S1: Baseline Parameters vs. User-Overridden Context Parameters', () => {
  it('Run A (Baseline): matches exact blueprint §7.1 KPIs, payback, VAN, TIR, ROI, and sparse {}', () => {
    const res = expectOk(
      evaluateSimulation({
        proyecto: makeBaseProyecto(),
        activeConfig: makeConfig(),
        configProducts: [makeFvProduct()],
        activeFinancing: null,
        template: V1_TEMPLATE,
        monedaCalculo: 'MXN',
        horizonteAnios: 25,
        vistaFinanciamiento: 'bruto',
        overrides: {},
      }),
    )

    expect(res.capex_total).toBeCloseTo(1_750_000, 2)
    expect(res.desembolso_inicial).toBeCloseTo(1_750_000, 2)
    expect(res.ahorro_energia_y1_kwh).toBeCloseTo(160_000, 2)
    expect(res.ahorro_monetario_y1).toBeCloseTo(512_000, 2)
    expect(res.serie_mensual.slice(0, 12).reduce((s, m) => s + m.costo_om, 0)).toBeCloseTo(
      17_500,
      2,
    )
    expect(res.serie_mensual.slice(0, 12).reduce((s, m) => s + m.flujo_neto, 0)).toBeCloseTo(
      494_500,
      2,
    )

    expect(res.payback_estado).toBe('en_horizonte')
    expect(res.payback_simple_meses).toBeCloseTo(40.42, 2)
    expect(res.payback_simple_anios).toBeCloseTo(3.37, 2)
    expect(res.payback_descontado_meses).toBeCloseTo(48.65, 2)
    expect((res.payback_descontado_meses ?? 0) / 12).toBeCloseTo(4.05, 2)

    expect(res.van).toBeCloseTo(4_735_959.16, 2)
    expect(res.tir_pct).toBeCloseTo(36.78, 2)
    expect(res.roi_pct).toBeCloseTo(1073.11, 2)
    expect(res.usa_parametros_base).toBe(true)
    expect(res.parametros_override_sparse).toEqual({})
    expect(res.serie_mensual).toHaveLength(300)
  })

  it('Run B (User Override): matches exact blueprint §7.1 KPIs and sparse diff', () => {
    const res = expectOk(
      evaluateSimulation({
        proyecto: makeBaseProyecto(),
        activeConfig: makeConfig(),
        configProducts: [makeFvProduct()],
        activeFinancing: null,
        template: V1_TEMPLATE,
        monedaCalculo: 'MXN',
        horizonteAnios: 25,
        vistaFinanciamiento: 'bruto',
        overrides: {
          tarifa_cfe_kwh: 4.2,
          escalacion_tarifa_anual: 0.06,
        },
      }),
    )

    expect(res.ahorro_monetario_y1).toBeCloseTo(672_000, 2)
    expect(res.serie_mensual.slice(0, 12).reduce((s, m) => s + m.flujo_neto, 0)).toBeCloseTo(
      654_500,
      2,
    )
    expect(res.payback_simple_meses).toBeCloseTo(30.4, 2)
    expect(res.payback_simple_anios).toBeCloseTo(2.53, 2)
    expect(res.payback_descontado_meses).toBeCloseTo(34.91, 2)
    expect((res.payback_descontado_meses ?? 0) / 12).toBeCloseTo(2.91, 2)

    expect(res.van).toBeCloseTo(8_113_510.43, 2)
    expect(res.tir_pct).toBeCloseTo(51.17, 2)
    expect(res.roi_pct).toBeCloseTo(1814.42, 2)
    expect(res.usa_parametros_base).toBe(false)
    expect(res.parametros_override_sparse).toEqual({
      tarifa_cfe_kwh: 4.2,
      escalacion_tarifa_anual: 0.06,
    })
  })
})

// ── 3. Scenario S2 — Gating, Overflow, Override Separation & Currency Neutrality

describe('S2: Missing Financial Figures Gating, Overflow & Override Validation', () => {
  it('gates nodo_busca projects with null or 0 CAPEX', () => {
    const resNull = evaluateSimulation({
      proyecto: makeBaseProyecto({ capex_estimado: null }),
      activeConfig: makeConfig({ inversion_total: null }),
      configProducts: [],
      activeFinancing: null,
      template: V1_TEMPLATE,
    })
    expect(resNull.status).toBe('gated')

    const resZero = evaluateSimulation({
      proyecto: makeBaseProyecto({ capex_estimado: 0 }),
      activeConfig: makeConfig({ inversion_total: 0 }),
      configProducts: [],
      activeFinancing: null,
      template: V1_TEMPLATE,
    })
    expect(resZero.status).toBe('gated')
  })

  it('never falls through to proyecto.capex_estimado when activeConfig exists with null/0 inversion_total', () => {
    const capex = resolveCapexTotal({
      activeConfig: makeConfig({ inversion_total: null }),
      configProducts: [],
      proyecto: { capex_estimado: 2_500_000, moneda: 'MXN' },
      monedaCalculo: 'MXN',
      fx: 17.5,
    })
    expect(capex).toBeNull()
    expect(hasValidFinancialFigures(capex)).toBe(false)

    // Only falls back to proyecto.capex_estimado when activeConfig is null
    const legacyCapex = resolveCapexTotal({
      activeConfig: null,
      configProducts: [],
      proyecto: { capex_estimado: 2_500_000, moneda: 'MXN' },
      monedaCalculo: 'MXN',
      fx: 17.5,
    })
    expect(legacyCapex).toBe(2_500_000)
  })

  it('guards against Number.isFinite overflow (1e308 * 17.5 -> null)', () => {
    const overflowCapex = resolveCapexTotal({
      activeConfig: makeConfig({ inversion_total: 1e308, moneda: 'USD' }),
      configProducts: [],
      proyecto: { capex_estimado: 1e308, moneda: 'USD' },
      monedaCalculo: 'MXN',
      fx: 17.5,
    })
    expect(overflowCapex).toBeNull()
    expect(hasValidFinancialFigures(overflowCapex)).toBe(false)
  })

  it('separates project gating from live user override validation (FX = 0 returns invalid_override, NOT gated)', () => {
    const outcome = evaluateSimulation({
      proyecto: makeBaseProyecto(),
      activeConfig: makeConfig(),
      configProducts: [makeFvProduct()],
      activeFinancing: null,
      template: V1_TEMPLATE,
      monedaCalculo: 'MXN',
      overrides: { tipo_cambio_usd_mxn: 0 },
    })
    expect(outcome.status).toBe('invalid_override')
    if (outcome.status === 'invalid_override') {
      expect(outcome.errors.tipo_cambio_usd_mxn).toBeDefined()
    }
  })

  it('enforces strict 24-key allowlist and plazo_meses [0, 360] override bounds', () => {
    const okZeroAndMax = validateOverridesAgainstTemplate(FALLBACK_TEMPLATE_CAMPOS, {
      plazo_meses: 0,
    })
    expect(okZeroAndMax.valid).toBe(true)

    const ok360 = validateOverridesAgainstTemplate(FALLBACK_TEMPLATE_CAMPOS, {
      plazo_meses: 360,
    })
    expect(ok360.valid).toBe(true)

    const bad361 = validateOverridesAgainstTemplate(FALLBACK_TEMPLATE_CAMPOS, {
      plazo_meses: 361,
    })
    expect(bad361.valid).toBe(false)

    // Reject unknown, prototype, non-editable, and top-level DB config keys
    const jsonWithProto = JSON.parse(
      '{"__proto__":1,"constructor":2,"pesos_estacionales_fv":[1],"arrendamiento_tasa_equivalente_anual":0.1,"moneda_calculo":"USD","horizonte_anios":10,"vista_financiamiento":"neto","unknown_var":5}',
    ) as Record<string, unknown>
    const badCheck = validateOverridesAgainstTemplate(FALLBACK_TEMPLATE_CAMPOS, jsonWithProto)
    expect(badCheck.valid).toBe(false)
    expect(Object.keys(badCheck.errors)).toEqual(
      expect.arrayContaining([
        '__proto__',
        'constructor',
        'pesos_estacionales_fv',
        'arrendamiento_tasa_equivalente_anual',
        'moneda_calculo',
        'horizonte_anios',
        'vista_financiamiento',
        'unknown_var',
      ]),
    )
  })

  it('keeps currency-neutral sparse overrides {} when toggling moneda_calculo to USD or arrendamiento tasa_interes_anual', () => {
    // Switching currency to USD with default tariff (3.20 / 17.50) remains usa_parametros_base = true
    const usdRes = expectOk(
      evaluateSimulation({
        proyecto: makeBaseProyecto(),
        activeConfig: makeConfig(),
        configProducts: [makeFvProduct()],
        activeFinancing: null,
        template: V1_TEMPLATE,
        monedaCalculo: 'USD',
        horizonteAnios: 15,
        vistaFinanciamiento: 'bruto',
        overrides: {
          tarifa_cfe_kwh: 3.2 / 17.5,
          cargo_demanda_mensual_kw: 380 / 17.5,
        },
      }),
    )
    expect(usdRes.usa_parametros_base).toBe(true)
    expect(usdRes.parametros_override_sparse).toEqual({})

    // Arrendamiento resolves Tier 2 tasa_interes_anual = 0.135 -> passing 0.135 keeps sparse {}
    const leasingRes = expectOk(
      evaluateSimulation({
        proyecto: makeBaseProyecto(),
        activeConfig: makeConfig(),
        configProducts: [makeFvProduct()],
        activeFinancing: makeFinancing({ vehiculo_inversion: 'arrendamiento', plazo_meses: 60 }),
        template: V1_TEMPLATE,
        monedaCalculo: 'MXN',
        horizonteAnios: 10,
        vistaFinanciamiento: 'neto',
        overrides: { tasa_interes_anual: 0.135 },
      }),
    )
    expect(leasingRes.usa_parametros_base).toBe(true)
    expect(leasingRes.parametros_override_sparse).toEqual({})
  })
})

// ── 4. Scenario S3 — Safe Excel-Language AST Formula Engine ───────────────────

describe('S3: Excel-Language AST Engine (EN + ES, Precedence, Cycles, Security)', () => {
  it('matches Excel unary - vs ^ precedence (-2^2 = 4) and left-associativity (2^3^2 = 64)', () => {
    const empty = new Map<string, number>()
    expect(evaluateExcelExpression('=-2^2', empty)).toBe(4)
    expect(evaluateExcelExpression('=2^3^2', empty)).toBe(64)
    expect(evaluateExcelExpression('=2^-3', empty)).toBeCloseTo(0.125, 12)
    expect(evaluateExcelExpression('=1-2^2', empty)).toBe(-3)
    expect(evaluateExcelExpression('=4.5%', empty)).toBeCloseTo(0.045, 12)
  })

  it('supports lazy IF/SI and IFERROR/SI.ERROR without dividing by zero in dead branches', () => {
    const scope = new Map<string, number>([['plazo_meses', 0]])
    expect(evaluateExcelExpression('=IF(plazo_meses > 0, 100 / plazo_meses, 0)', scope)).toBe(0)
    expect(evaluateExcelExpression('=SI(plazo_meses > 0; 100 / plazo_meses; 42)', scope)).toBe(42)
    expect(evaluateExcelExpression('=SI.ERROR(100 / plazo_meses; 99)', scope)).toBe(99)
  })

  it('evaluates S3 Spanish Excel formula with SI, ; separator, POTENCIA, and bilingual functions', () => {
    const s3Formulas = FALLBACK_TEMPLATE_FORMULAS.map((f) =>
      f.key === 'ahorro_bruto_mes'
        ? {
            ...f,
            expression:
              '=SI(mes_indice<=12; energia_ahorrada_kwh_mes * tarifa_cfe_kwh * 1.05; energia_ahorrada_kwh_mes * tarifa_cfe_kwh * POTENCIA(1 + escalacion_tarifa_anual; anio_indice))',
          }
        : f,
    )

    const customTemplate: Pick<CalculadoraTemplate, 'id' | 'modo' | 'campos' | 'formulas'> = {
      id: 's3-custom-es-template',
      modo: 'custom_formulas',
      campos: FALLBACK_TEMPLATE_CAMPOS,
      formulas: s3Formulas,
    }

    const res = expectOk(
      evaluateSimulation({
        proyecto: makeBaseProyecto(),
        activeConfig: makeConfig(),
        configProducts: [makeFvProduct()],
        activeFinancing: null,
        template: customTemplate,
        monedaCalculo: 'MXN',
        horizonteAnios: 5,
      }),
    )

    expect(res.fuente_calculo).toBe('formula_personalizada')
    // Year 1 has 1.05 boost: 160,000 * 3.20 * 1.05 = 537,600
    expect(res.ahorro_monetario_y1).toBeCloseTo(537_600, 2)

    // Bilingual math & financial aliases
    const s = new Map<string, number>()
    expect(evaluateExcelExpression('=SUMA(10; 20; 30)', s)).toBe(60)
    expect(evaluateExcelExpression('=PROMEDIO(10; 20; 30)', s)).toBe(20)
    expect(evaluateExcelExpression('=RAIZ(144)', s)).toBe(12)
    expect(evaluateExcelExpression('=REDONDEAR(3.14159; 2)', s)).toBe(3.14)
    expect(evaluateExcelExpression('=REDONDEAR.MAS(3.11; 1)', s)).toBe(3.2)
    expect(evaluateExcelExpression('=REDONDEAR.MENOS(3.19; 1)', s)).toBe(3.1)
    expect(evaluateExcelExpression('=Y(1=1; NO(0=1))', s)).toBe(true)
    expect(evaluateExcelExpression('=O(1=2; 2=2)', s)).toBe(true)
    expect(evaluateExcelExpression('=-PAGO(0.01; 12; 1200)', s)).toBeCloseTo(106.6185, 3)
  })

  it('detects circular dependencies (#CYCLE!), unknown functions (#NAME?), and prototype pollution (#NAME?)', () => {
    const cyclicFormulas = FALLBACK_TEMPLATE_FORMULAS.map((f) => {
      if (f.key === 'om_mes') return { ...f, expression: '=ahorro_bruto_mes * 2' }
      if (f.key === 'ahorro_bruto_mes') return { ...f, expression: '=om_mes + 100' }
      return f
    })
    expect(() => compileAndSortFormulas(cyclicFormulas)).toThrowError(FormulaError)
    try {
      compileAndSortFormulas(cyclicFormulas)
    } catch (e) {
      expect((e as FormulaError).code).toBe('#CYCLE!')
    }

    const unknownFnFormulas = FALLBACK_TEMPLATE_FORMULAS.map((f) =>
      f.key === 'om_mes' ? { ...f, expression: '=UNKNOWN_FN(1)' } : f,
    )
    try {
      compileAndSortFormulas(unknownFnFormulas)
      expect.unreachable('Should have thrown #NAME?')
    } catch (e) {
      expect((e as FormulaError).code).toBe('#NAME?')
    }

    for (const dangerous of ['=constructor', '=__proto__', '=prototype', '=toString']) {
      const empty = new Map<string, number>()
      try {
        evaluateExcelExpression(dangerous, empty)
        expect.unreachable(`Should reject ${dangerous}`)
      } catch (e) {
        expect((e as FormulaError).code).toBe('#NAME?')
      }
    }
  })

  it('normalizes $ cell references and extracts/rewrites cleanly', () => {
    expect(normalizeCellRef('$B$5')).toBe('B5')
    expect(normalizeCellRef("'Hoja 1'!$B$5")).toBe('Hoja 1!B5')
    expect(extractFormulaCellRefs('=B3*B4*(1+$B$5)^A10/12')).toEqual(
      expect.arrayContaining(['B3', 'B4', 'B5', 'A10']),
    )

    const map = new Map<string, string>([
      ['B3', 'generacion_fv_y1_kwh'],
      ['B4', 'tarifa_cfe_kwh'],
      ['B5', 'escalacion_tarifa_anual'],
      ['A10', 'anio_indice'],
    ])
    const rw = rewriteFormulaCellRefs('=B3*B4*(1+$B$5)^A10/12', map)
    expect(rw.unresolvedRefs).toEqual([])
    expect(rw.rewritten).toBe(
      '=generacion_fv_y1_kwh * tarifa_cfe_kwh * POWER(1 + escalacion_tarifa_anual, anio_indice) / 12',
    )
  })
})

// ── 5. Scenario S4 — Real ExcelJS Workbook Parse, Mapping & Pre-Flight Security

describe('S4: ExcelJS Workbook Parse, Mapping, Rewrite & Pre-Flight Security', () => {
  it('parses real S4 .xlsx buffer, detects labeled & unlabeled referenced cells (A10), suggests mappings, and rewrites formula', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Modelo')
    ws.getCell('A2').value = 'Inversión CAPEX'
    ws.getCell('B2').value = 1_750_000
    ws.getCell('A3').value = 'Gen Anual kWh'
    ws.getCell('B3').value = 160_000
    ws.getCell('A4').value = 'Tarifa CFE'
    ws.getCell('B4').value = 3.5
    ws.getCell('A5').value = 'Escalación'
    ws.getCell('B5').value = 0.045
    // Unlabeled axis cell A10 referenced by formula D10
    ws.getCell('A10').value = 2
    ws.getCell('C10').value = 'Ahorro Mensual'
    ws.getCell('D10').value = {
      formula: 'B3*B4*(1+$B$5)^A10/12',
      result: (160_000 * 3.5 * Math.pow(1.045, 2)) / 12,
    }

    const rawBuffer = Buffer.from(await wb.xlsx.writeBuffer())

    // Pre-flight check passes
    const preflight = preflightValidateSpreadsheetBuffer(rawBuffer, 'Modelo_Solar_BESS.xlsx')
    expect(preflight.ok).toBe(true)

    // Real ExcelJS parse
    const parsed = await parseWorkbookWithExcelJs(rawBuffer, 'Modelo_Solar_BESS.xlsx', 'xlsx')
    expect(parsed.defaultSheet).toBe('Modelo')
    expect(parsed.fileHash).toMatch(/^[0-9a-f]{64}$/)

    // Both labeled B2..B5 AND unlabeled referenced A10 are extracted
    const candidateRefs = parsed.candidateInputs.map((c) => c.cellRef)
    expect(candidateRefs).toEqual(expect.arrayContaining(['B2', 'B3', 'B4', 'B5', 'A10']))

    const byCell = new Map(parsed.suggestedInputMappings.map((m) => [m.cellRef, m.suggestedVar]))
    expect(byCell.get('B2')).toBe('capex_total')
    expect(byCell.get('B3')).toBe('generacion_fv_y1_kwh')
    expect(byCell.get('B4')).toBe('tarifa_cfe_kwh')
    expect(byCell.get('B5')).toBe('escalacion_tarifa_anual')

    const d10 = parsed.suggestedOutputMappings.find((o) => o.cellRef === 'D10')
    expect(d10).toBeDefined()
    expect(d10?.suggestedOutputKey).toBe('ahorro_bruto_mes')
    expect(d10?.dependencies).toEqual(expect.arrayContaining(['B3', 'B4', 'B5', 'A10']))

    // Leaving A10 unmapped yields unresolvedRefs: ['A10'] and compile rejection
    const partial = previewFormulaRewrite(
      d10!.rawFormula,
      [
        { cellRef: 'B3', sheetName: 'Modelo', platformVar: 'generacion_fv_y1_kwh' },
        { cellRef: 'B4', sheetName: 'Modelo', platformVar: 'tarifa_cfe_kwh' },
        { cellRef: 'B5', sheetName: 'Modelo', platformVar: 'escalacion_tarifa_anual' },
      ],
      'Modelo',
    )
    expect(partial.unresolvedRefs).toEqual(['A10'])
    expect(() =>
      compileAndSortFormulas([
        {
          key: 'ahorro_bruto_mes',
          label: 'Ahorro',
          expression: partial.rewritten,
          unit: 'currency',
          enabled: true,
        },
      ]),
    ).toThrowError(FormulaError)

    // Mapping A10 -> anio_indice yields clean rewritten expression matching S4 verbatim
    const complete = previewFormulaRewrite(
      d10!.rawFormula,
      [
        { cellRef: 'B3', sheetName: 'Modelo', platformVar: 'generacion_fv_y1_kwh' },
        { cellRef: 'B4', sheetName: 'Modelo', platformVar: 'tarifa_cfe_kwh' },
        { cellRef: 'B5', sheetName: 'Modelo', platformVar: 'escalacion_tarifa_anual' },
        { cellRef: 'A10', sheetName: 'Modelo', platformVar: 'anio_indice' },
      ],
      'Modelo',
    )
    expect(complete.unresolvedRefs).toEqual([])
    expect(complete.rewritten).toBe(
      '=generacion_fv_y1_kwh * tarifa_cfe_kwh * POWER(1 + escalacion_tarifa_anual, anio_indice) / 12',
    )
  })

  it('rejects legacy .xls, spoofed binaries, ZIP bombs (>100:1 over >1MB floor), >50MB ZIP, and CSV with NUL bytes', async () => {
    // Legacy .xls OLE2 magic
    const xlsBuf = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00, 0x00, 0x00])
    const xlsRes = preflightValidateSpreadsheetBuffer(xlsBuf, 'viejo.xls')
    expect(xlsRes.ok).toBe(false)
    if (!xlsRes.ok) {
      expect(xlsRes.status).toBe(422)
      expect(xlsRes.error).toBe(LEGACY_XLS_ERROR_MESSAGE)
    }

    // Spoofed non-ZIP .xlsx
    const spoofed = Buffer.from('not a real zip file', 'utf8')
    const spoofRes = preflightValidateSpreadsheetBuffer(spoofed, 'spoof.xlsx')
    expect(spoofRes.ok).toBe(false)
    if (!spoofRes.ok) expect(spoofRes.status).toBe(422)

    // ZIP bomb: 2 MB uncompressed from 10 KB compressed (ratio 200:1 > 100:1, above 1 MB floor)
    const bombBuf = buildSyntheticZipBuffer(10_000, 2_000_000)
    const bombRes = preflightValidateSpreadsheetBuffer(bombBuf, 'bomb.xlsx')
    expect(bombRes.ok).toBe(false)
    if (!bombRes.ok) {
      expect(bombRes.status).toBe(413)
      expect(bombRes.code).toBe('zip_bomb_ratio')
    }

    // Small legitimate XML under 1 MB floor with high ratio (e.g., 500 KB from 2 KB) is NOT falsely rejected
    const smallHighRatioBuf = buildSyntheticZipBuffer(2_000, 500_000)
    const smallRes = preflightValidateSpreadsheetBuffer(smallHighRatioBuf, 'small.xlsx')
    expect(smallRes.ok).toBe(true)

    // Exceeds 50 MB uncompressed cap
    const hugeBuf = buildSyntheticZipBuffer(5_000_000, 60_000_000)
    const hugeRes = preflightValidateSpreadsheetBuffer(hugeBuf, 'huge.xlsx')
    expect(hugeRes.ok).toBe(false)
    if (!hugeRes.ok) {
      expect(hugeRes.status).toBe(413)
      expect(hugeRes.code).toBe('zip_uncompressed_limit')
    }

    // CSV with NUL byte rejected (422)
    const nulCsv = Buffer.from('Parametro,Valor\nTarifa\x00,3.2\n', 'utf8')
    const nulRes = preflightValidateSpreadsheetBuffer(nulCsv, 'bad.csv')
    expect(nulRes.ok).toBe(false)
    if (!nulRes.ok) {
      expect(nulRes.status).toBe(422)
      expect(nulRes.code).toBe('csv_binary_content')
    }

    // Valid UTF-8 CSV passes pre-flight and parses
    const okCsv = Buffer.from('Parametro,Valor\nTarifa CFE,3.45\nInversión CAPEX,1500000\n', 'utf8')
    const okCsvPre = preflightValidateSpreadsheetBuffer(okCsv, 'ok.csv')
    expect(okCsvPre.ok).toBe(true)
    const parsedCsv = await parseWorkbookWithExcelJs(okCsv, 'ok.csv', 'csv')
    expect(parsedCsv.candidateInputs.length).toBeGreaterThanOrEqual(2)
  })
})

// ── 6. Scenario S5 — Granularity Rollups & All Payback Edge Cases ─────────────

describe('S5: Monthly/Quarterly/Yearly Sum Parity & Payback Edge Cases', () => {
  it('5a: 10-year FV+BESS series has exact sum parity & cumulative continuity across Mensual, Trimestral, Anual', () => {
    const res = expectOk(
      evaluateSimulation({
        proyecto: makeBaseProyecto({ tipo: 'FV+BESS', capex_estimado: 2_600_000, moneda: 'MXN' }),
        activeConfig: makeConfig({ inversion_total: 2_600_000, moneda: 'MXN' }),
        configProducts: [makeFvProduct(), makeBessProduct()],
        activeFinancing: null,
        template: V1_TEMPLATE,
        monedaCalculo: 'MXN',
        horizonteAnios: 10,
      }),
    )

    const monthly = aggregateSeries(res.serie_mensual, 'mensual')
    const quarterly = aggregateSeries(res.serie_mensual, 'trimestral')
    const yearly = aggregateSeries(res.serie_mensual, 'anual')

    expect(monthly).toHaveLength(120)
    expect(quarterly).toHaveLength(40)
    expect(yearly).toHaveLength(10)

    const sumFlow = (rows: typeof monthly) => rows.reduce((s, r) => s + r.flujo_neto, 0)
    const sumEnergy = (rows: typeof monthly) => rows.reduce((s, r) => s + r.energia_total_kwh, 0)

    expect(sumFlow(quarterly)).toBeCloseTo(sumFlow(monthly), 6)
    expect(sumFlow(yearly)).toBeCloseTo(sumFlow(monthly), 6)
    expect(sumEnergy(quarterly)).toBeCloseTo(sumEnergy(monthly), 6)
    expect(sumEnergy(yearly)).toBeCloseTo(sumEnergy(monthly), 6)

    // End-of-period cumulative cashflow continuity
    expect(quarterly[quarterly.length - 1].flujo_acumulado).toBeCloseTo(
      monthly[monthly.length - 1].flujo_acumulado,
      8,
    )
    expect(yearly[yearly.length - 1].flujo_acumulado).toBeCloseTo(
      monthly[monthly.length - 1].flujo_acumulado,
      8,
    )
  })

  it('5b: short horizon returns fuera_horizonte with extended 30y payback estimate', () => {
    // High CAPEX relative to generation so payback ~6.4 years, user selects 5 years
    const res = expectOk(
      evaluateSimulation({
        proyecto: makeBaseProyecto({ capex_estimado: 3_500_000, moneda: 'MXN' }),
        activeConfig: makeConfig({ inversion_total: 3_500_000, moneda: 'MXN' }),
        configProducts: [
          makeFvProduct({
            datos: {
              num_modulos: 200,
              potencia_modulos_w: 500,
              generacion_anual_kwh: 160_000,
              capex: 3_500_000,
              capex_moneda: 'MXN',
            },
          }),
        ],
        activeFinancing: null,
        template: V1_TEMPLATE,
        monedaCalculo: 'MXN',
        horizonteAnios: 5,
      }),
    )

    expect(res.payback_estado).toBe('fuera_horizonte')
    expect(res.payback_simple_meses).toBeNull()
    expect(res.payback_extendido_anios).not.toBeNull()
    expect(res.payback_extendido_anios!).toBeGreaterThan(5)
    expect(res.payback_extendido_anios!).toBeLessThan(8)
  })

  it('5c: unrecoverable project returns no_recuperable', () => {
    const res = expectOk(
      evaluateSimulation({
        proyecto: makeBaseProyecto({ capex_estimado: 10_000_000, moneda: 'MXN' }),
        activeConfig: makeConfig({ inversion_total: 10_000_000, moneda: 'MXN' }),
        configProducts: [
          makeFvProduct({
            datos: {
              num_modulos: 10,
              potencia_modulos_w: 500,
              generacion_anual_kwh: 5_000,
              capex: 10_000_000,
              capex_moneda: 'MXN',
            },
          }),
        ],
        activeFinancing: null,
        template: V1_TEMPLATE,
        monedaCalculo: 'MXN',
        horizonteAnios: 10,
        overrides: { pct_om_anual: 0.05 },
      }),
    )

    expect(res.payback_estado).toBe('no_recuperable')
    expect(res.payback_simple_meses).toBeNull()
    expect(res.payback_extendido_anios).toBeNull()
  })

  it('5d: financed credito applies 20% enganche, PMT debt service months 1..60, 0 in 61..120, and dual ROI', () => {
    const res = expectOk(
      evaluateSimulation({
        proyecto: makeBaseProyecto(),
        activeConfig: makeConfig(),
        configProducts: [makeFvProduct()],
        activeFinancing: makeFinancing({ vehiculo_inversion: 'credito', plazo_meses: 60 }),
        template: V1_TEMPLATE,
        monedaCalculo: 'MXN',
        horizonteAnios: 10,
        vistaFinanciamiento: 'neto',
      }),
    )

    expect(res.desembolso_inicial).toBeCloseTo(1_750_000 * 0.2, 2)
    expect(res.serie_mensual[0].cuota_financiamiento).toBeGreaterThan(0)
    expect(res.serie_mensual[59].cuota_financiamiento).toBeGreaterThan(0)
    expect(res.serie_mensual[60].cuota_financiamiento).toBe(0)
    expect(res.serie_mensual[119].cuota_financiamiento).toBe(0)
    expect(res.roi_pct).not.toBeNull()
    expect(res.roi_desembolso_pct).not.toBeNull()
    expect(res.roi_desembolso_pct!).toBeCloseTo(res.roi_pct! * 5, 2)
  })

  it('reports immediate payback for EnSaaS (zero outlay & positive flows) and ignores transient double-crossing', () => {
    const ensaasRes = expectOk(
      evaluateSimulation({
        proyecto: makeBaseProyecto(),
        activeConfig: makeConfig(),
        configProducts: [makeFvProduct()],
        activeFinancing: makeFinancing({ vehiculo_inversion: 'ensaas', plazo_meses: 60 }),
        template: V1_TEMPLATE,
        monedaCalculo: 'MXN',
        horizonteAnios: 10,
        vistaFinanciamiento: 'neto',
      }),
    )
    expect(ensaasRes.desembolso_inicial).toBe(0)
    expect(ensaasRes.payback_estado).toBe('inmediato')
    expect(ensaasRes.payback_simple_meses).toBe(0)

    // Double-crossing series: crosses 0 transiently at month 1 (+20), dips to -30 at month 2,
    // permanently crosses 0 at month 3 (+30) -> permanent break-even is 2.5, NOT 0.833!
    const perm = findPermanentBreakEvenMonth(100, [120, -50, 60, 40])
    expect(perm).toBeCloseTo(2.5, 6)
  })
})

// ── 7. Bit-Identity Parity: defaults.ts <-> v29 Seed 7 AST Formulas (1e-9) ────

describe('Parity: defaults.ts <-> v29 v1 Seeded 7 AST Formulas (within 1e-9)', () => {
  const modes: Array<{ name: string; input: Omit<SimulationEngineInput, 'template'> }> = [
    {
      name: 'FV Bruto',
      input: {
        proyecto: makeBaseProyecto({ tipo: 'FV' }),
        activeConfig: makeConfig(),
        configProducts: [makeFvProduct()],
        activeFinancing: null,
        monedaCalculo: 'MXN',
        horizonteAnios: 25,
        vistaFinanciamiento: 'bruto',
      },
    },
    {
      name: 'FV+BESS Crédito Neto',
      input: {
        proyecto: makeBaseProyecto({ tipo: 'FV+BESS' }),
        activeConfig: makeConfig(),
        configProducts: [makeFvProduct(), makeBessProduct()],
        activeFinancing: makeFinancing({ vehiculo_inversion: 'credito', plazo_meses: 60 }),
        sitios: [{ demanda_contratada_kw: 200 }],
        monedaCalculo: 'MXN',
        horizonteAnios: 15,
        vistaFinanciamiento: 'neto',
      },
    },
    {
      name: 'BESS Arrendamiento Neto',
      input: {
        proyecto: makeBaseProyecto({ tipo: 'BESS' }),
        activeConfig: makeConfig({ inversion_total: 850_000, moneda: 'MXN' }),
        configProducts: [makeBessProduct()],
        activeFinancing: makeFinancing({ vehiculo_inversion: 'arrendamiento', plazo_meses: 48 }),
        monedaCalculo: 'MXN',
        horizonteAnios: 10,
        vistaFinanciamiento: 'neto',
      },
    },
    {
      name: 'FV EnSaaS Neto',
      input: {
        proyecto: makeBaseProyecto({ tipo: 'FV' }),
        activeConfig: makeConfig(),
        configProducts: [makeFvProduct()],
        activeFinancing: makeFinancing({ vehiculo_inversion: 'ensaas', plazo_meses: 120 }),
        monedaCalculo: 'MXN',
        horizonteAnios: 10,
        vistaFinanciamiento: 'neto',
      },
    },
    {
      name: 'MEM + Oferta Aceptada',
      input: {
        proyecto: makeBaseProyecto({
          tipo: 'MEM',
          incluye_mem: true,
          capex_estimado: 500_000,
          moneda: 'MXN',
          consumo_anual_gwh: 2.5,
          tarifa_actual_cfe: 3.3,
        }),
        activeConfig: makeConfig({ inversion_total: 500_000, moneda: 'MXN' }),
        configProducts: [],
        activeFinancing: null,
        ofertasMem: [{ precio_kwh: 2.4, estado: 'aceptada' }],
        monedaCalculo: 'MXN',
        horizonteAnios: 5,
        vistaFinanciamiento: 'bruto',
      },
    },
    {
      name: 'Declared Savings Fallback (ahorro_declarado)',
      input: {
        proyecto: makeBaseProyecto({ tipo: 'BESS', capex_estimado: 1_000_000, moneda: 'MXN' }),
        activeConfig: makeConfig({
          inversion_total: 1_000_000,
          moneda: 'MXN',
          ahorro_estimado_anual: 360_000,
          ahorro_moneda: 'MXN',
        }),
        configProducts: [
          makeBessProduct({
            datos: {
              potencia_kw: 100,
              capacidad_kwh: 200,
              uso: 'ups',
              capex: 1_000_000,
              capex_moneda: 'MXN',
            },
          }),
        ],
        activeFinancing: null,
        monedaCalculo: 'MXN',
        horizonteAnios: 10,
        vistaFinanciamiento: 'bruto',
      },
    },
  ]

  for (const tc of modes) {
    it(`matches bit-identically within 1e-9 for mode: ${tc.name}`, () => {
      const defRes = expectOk(evaluateSimulation({ ...tc.input, template: V1_TEMPLATE }))
      const astRes = expectOk(evaluateSimulation({ ...tc.input, template: V1_AST_TEMPLATE }))

      expect(Math.abs(defRes.ahorro_energia_total_kwh - astRes.ahorro_energia_total_kwh)).toBeLessThan(1e-9)
      expect(Math.abs(defRes.ahorro_monetario_total - astRes.ahorro_monetario_total)).toBeLessThan(1e-9)
      expect(Math.abs(defRes.flujo_neto_total - astRes.flujo_neto_total)).toBeLessThan(1e-9)
      expect(Math.abs((defRes.van ?? 0) - (astRes.van ?? 0))).toBeLessThan(1e-9)
      expect(Math.abs((defRes.roi_pct ?? 0) - (astRes.roi_pct ?? 0))).toBeLessThan(1e-9)
      expect(defRes.payback_estado).toBe(astRes.payback_estado)

      for (let i = 0; i < defRes.serie_mensual.length; i++) {
        const d = defRes.serie_mensual[i]
        const a = astRes.serie_mensual[i]
        expect(Math.abs(d.energia_total_kwh - a.energia_total_kwh)).toBeLessThan(1e-9)
        expect(Math.abs(d.ahorro_bruto - a.ahorro_bruto)).toBeLessThan(1e-9)
        expect(Math.abs(d.costo_om - a.costo_om)).toBeLessThan(1e-9)
        expect(Math.abs(d.cuota_financiamiento - a.cuota_financiamiento)).toBeLessThan(1e-9)
        expect(Math.abs(d.flujo_neto - a.flujo_neto)).toBeLessThan(1e-9)
        expect(Math.abs(d.flujo_acumulado - a.flujo_acumulado)).toBeLessThan(1e-9)
      }
    })
  }
})

// ── 8. Performance Check (< 1 ms for 360 months) ──────────────────────────────

describe('Performance: < 1 ms 360-Month Evaluation', () => {
  it('evaluates 360 months in < 1 ms (median) for both default mode and memoized AST mode', () => {
    clearCompiledFormulaCache()
    const baseInput: Omit<SimulationEngineInput, 'template'> = {
      proyecto: makeBaseProyecto({ tipo: 'FV+BESS' }),
      activeConfig: makeConfig(),
      configProducts: [makeFvProduct(), makeBessProduct()],
      activeFinancing: makeFinancing({ vehiculo_inversion: 'credito', plazo_meses: 60 }),
      monedaCalculo: 'MXN',
      horizonteAnios: 30,
      vistaFinanciamiento: 'neto',
    }

    // Warm JIT & per-template AST cache
    for (let i = 0; i < 5; i++) {
      expectOk(evaluateSimulation({ ...baseInput, template: V1_TEMPLATE }))
      expectOk(evaluateSimulation({ ...baseInput, template: V1_AST_TEMPLATE }))
    }

    const runs = 25
    const defTimes: number[] = []
    const astTimes: number[] = []

    for (let i = 0; i < runs; i++) {
      const t0 = performance.now()
      expectOk(evaluateSimulation({ ...baseInput, template: V1_TEMPLATE }))
      defTimes.push(performance.now() - t0)

      const t1 = performance.now()
      expectOk(evaluateSimulation({ ...baseInput, template: V1_AST_TEMPLATE }))
      astTimes.push(performance.now() - t1)
    }

    defTimes.sort((a, b) => a - b)
    astTimes.sort((a, b) => a - b)
    const defMedian = defTimes[Math.floor(runs / 2)]
    const astMedian = astTimes[Math.floor(runs / 2)]

    expect(defMedian).toBeLessThan(1.0)
    expect(astMedian).toBeLessThan(2.5) // Generous CI headroom; locally ~0.5 ms
  })
})

// ── 9. CSV Export CWE-1236 String-Only Neutralization ─────────────────────────

describe('CSV Export: UTF-8 BOM & CWE-1236 String-Only Neutralization', () => {
  it('neutralizes formula-injection prefixes on string cells while keeping negative numbers raw & unquoted', () => {
    expect(neutralizeCsvStringCell('=CMD()')).toBe("'=CMD()")
    expect(neutralizeCsvStringCell('+1+2')).toBe("'+1+2")
    expect(neutralizeCsvStringCell('-1+2')).toBe("'-1+2")
    expect(neutralizeCsvStringCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(neutralizeCsvStringCell('  =HYPERLINK("http://x")')).toBe('"\'  =HYPERLINK(""http://x"")"')
    expect(neutralizeCsvStringCell('\t=1+1')).toBe("'\t=1+1")
    expect(neutralizeCsvStringCell('Año 1')).toBe('Año 1')

    expect(formatCsvNumericCell(-12500)).toBe('-12500.00')
    expect(formatCsvNumericCell(0)).toBe('0.00')

    const csv = buildProjectionCsv(
      [
        {
          periodo: 1,
          anio: 1,
          etiqueta: 'Año 1',
          energia_fv_kwh: 160_000,
          energia_bess_kwh: 0,
          energia_total_kwh: 160_000,
          ahorro_bruto: 512_000,
          costo_om: 17_500,
          cuota_financiamiento: 0,
          flujo_neto: 494_500,
          flujo_acumulado: -1_255_500,
          flujo_descontado_acumulado: -1_276_000,
        },
      ],
      {
        moneda: 'MXN',
        granularidad: 'anual',
        proyectoNombre: '=EVIL_PROJECT',
        escenarioNombre: 'Base Nodo',
      },
    )

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain("Proyecto,'=EVIL_PROJECT")
    expect(csv).toContain('Año 1,160000.00,0.00,160000.00,512000.00,17500.00,0.00,494500.00,-1255500.00,-1276000.00')
    expect(csv).not.toContain("'-1255500.00")
  })
})
