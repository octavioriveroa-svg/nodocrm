import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import {
  createDefaultMemAnnualAssumptions,
  DEFAULT_MEM_INPUTS,
  DEFAULT_MEM_SENSITIVITY_CONFIG,
  getBaseline100HC,
  getBaselineMemHourlyDataset,
} from '@/lib/calculator/datasets/mem-baseline'
import {
  buildAnnualAssumptionsRows,
  runMemBessSensitivity,
  runMemSimulation,
  simulateMemYear1,
  validateMemInputs,
} from '@/lib/calculator/mem-hourly-engine'
import { aggregateSeries } from '@/lib/calculator/aggregate'
import {
  evaluateSimulation,
  resolveMemInputsFromProject,
  runSimulation,
  runTemplateDryRun,
} from '@/lib/calculator/engine'
import {
  compileAndSortFormulas,
  evaluateExcelExpression,
  parseExcelFormula,
  previewFormulaRewrite as previewFormulaRewriteFromEngine,
  rewriteFormulaCellRefs,
} from '@/lib/calculator/formula-engine'
import {
  FALLBACK_TEMPLATE_FORMULAS,
  MEM_TEMPLATE_CAMPOS,
  validateOverridesAgainstTemplate,
} from '@/lib/calculator/template-schema'
import {
  parseWorkbookWithExcelJs,
  previewFormulaRewrite,
} from '@/lib/calculator/excel-mapper'
import { handleSpreadsheetParseUpload } from '@/lib/calculator/spreadsheet-upload-route'
import {
  buildMemImportApplyPayload,
  evaluateMemImportSelection,
  getDefaultMemImportSelection,
  inspectMemImportPreview,
} from '@/lib/calculator/mem-import-wizard'
import {
  LEGACY_XLS_ERROR_MESSAGE,
  MAX_UPLOAD_BYTES,
  preflightValidateSpreadsheetBuffer,
  validateSpreadsheetFileClient,
} from '@/lib/calculator/zip-preflight'
import type { MemHourlyDataset, MemSimulatorInputs, Rol } from '@/lib/types'

const EXTERNAL_MEM_XLSX_PATH = 'C:\\Users\\vmont\\projects\\Nodo\\nodocrm\\Simulador FV + BESS MEM.xlsx'

function expectClosePct(actual: number, expected: number, maxRelErr = 0.0001) {
  if (expected === 0) {
    expect(Math.abs(actual)).toBeLessThan(1e-6)
    return
  }
  const relErr = Math.abs(actual - expected) / Math.abs(expected)
  expect(relErr).toBeLessThanOrEqual(maxRelErr)
}

describe('MEM FV + BESS + 100HC Excel Baseline Parity', () => {
  it('reproduces all 13 canonical Simulador FV + BESS MEM.xlsx KPI benchmarks within ±0.01%', () => {
    const inputs = { ...DEFAULT_MEM_INPUTS }
    const assumptions = createDefaultMemAnnualAssumptions()
    const hourly = getBaselineMemHourlyDataset()
    const hc100 = getBaseline100HC()

    const outcome = runMemSimulation({
      inputs,
      assumptions,
      hourly,
      criticalHours100HC: hc100,
    })

    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return

    const { year1, financial } = outcome

    // 1..7 Year 1 Resultados benchmarks
    expectClosePct(year1.ahorro_e_total_mxn, 3_304_135.06)
    expectClosePct(year1.ahorro_c_total_mxn, 22_618_697.59)
    expectClosePct(year1.ahorro_total_mxn, 25_922_832.64)
    expectClosePct(year1.res_pct_reduccion, 0.3816, 0.0005)
    expectClosePct(year1.res_rap_reduccion_mw, 4.822, 0.0005)
    expectClosePct(year1.res_descarga_mwh, 5_698.03, 0.0002)
    expectClosePct(year1.res_ciclos, 316.56, 0.0002)

    // 8..13 Financial Evaluation benchmarks (MXN, 20a, WACC 12%)
    expectClosePct(financial.capex_total_mxn, 107_712_000)
    expectClosePct(financial.capex_total_usd, 5_760_000)
    expectClosePct(financial.opex_y1_mxn, 579_571.2)
    expectClosePct(financial.vpn, 112_509_753.35)
    expect(financial.tir_pct).not.toBeNull()
    expectClosePct(financial.tir_pct!, 25.54, 0.0005)
    expect(financial.payback_simple_anios).not.toBeNull()
    expectClosePct(financial.payback_simple_anios!, 4.09, 0.001)
    expect(financial.payback_descontado_anios).not.toBeNull()
    expectClosePct(financial.payback_descontado_anios!, 5.85, 0.001)

    // Energy balance sanity
    expect(year1.res_consumo_mwh).toBeCloseTo(50_205.34, 1)
    expect(year1.duplicate_100hc_count).toBe(0)
    expect(year1.missing_100hc_count).toBe(0)
    expect(financial.rows).toHaveLength(26)
  })

  it('reproduces Sensibilidad BESS benchmarks including 3 MW/9 MWh case & 5 MW/15 MWh optimal VPN', () => {
    const inputs = { ...DEFAULT_MEM_INPUTS }
    const assumptions = createDefaultMemAnnualAssumptions()
    const hourly = getBaselineMemHourlyDataset()
    const hc100 = getBaseline100HC()

    const suite = runMemBessSensitivity(
      inputs,
      assumptions,
      hourly,
      hc100,
      DEFAULT_MEM_SENSITIVITY_CONFIG,
    )

    expect(suite.cases).toHaveLength(10)
    expect(suite.elapsedMs).toBeLessThan(1000)

    const case3Mw = suite.cases.find((c) => Math.abs(c.bess_potencia_mw - 3) < 1e-6)
    expect(case3Mw).toBeDefined()
    expectClosePct(case3Mw!.ahorro_total_y1, 13_267_582.43)

    expect(suite.bestVpnCaseIndex).toBe(9) // Case 10: 5.0 MW / 15.0 MWh
    const bestCase = suite.cases[suite.bestVpnCaseIndex]
    expect(bestCase.bess_potencia_mw).toBe(5)
    expect(bestCase.bess_capacidad_mwh).toBe(15)
    expectClosePct(bestCase.vpn, 98_674_124.13)
  })
})

describe('MEM Engine Edge Cases, Financing Modes & Rollups', () => {
  it('handles 0 BESS + 0 FV cleanly with zero NaNs and na payback', () => {
    const inputs: MemSimulatorInputs = {
      ...DEFAULT_MEM_INPUTS,
      bess_potencia_mw: 0,
      bess_capacidad_mwh: 0,
      fv_potencia_mw: 0,
      capex_bess_usd_kwh: 0,
      capex_fv_usd_kwp: 0,
    }
    const res = runMemSimulation({
      inputs,
      assumptions: createDefaultMemAnnualAssumptions(),
      hourly: getBaselineMemHourlyDataset(),
      criticalHours100HC: getBaseline100HC(),
    })
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.year1.ahorro_total_mxn).toBe(0)
    expect(res.year1.res_ciclos).toBe(0)
    expect(res.year1.bess_duracion_h).toBe(0)
    expect(res.financial.payback_simple_estado).toBe('na')
    expect(res.financial.tir_pct).toBeNull()
  })

  it('handles P>0 with Cap=0 safely without division by zero', () => {
    const inputs: MemSimulatorInputs = {
      ...DEFAULT_MEM_INPUTS,
      bess_potencia_mw: 4,
      bess_capacidad_mwh: 0,
    }
    const y1 = simulateMemYear1(inputs, getBaselineMemHourlyDataset(), getBaseline100HC())
    expect(Number.isFinite(y1.res_ciclos)).toBe(true)
    expect(y1.res_ciclos).toBe(0)
    expect(y1.bess_duracion_h).toBe(0)
    expect(y1.res_descarga_mwh).toBe(0)
  })

  it('simulates synthetic solar curve conservation & weighted FV/BESS degradation', () => {
    const base = getBaselineMemHourlyDataset()
    const solarCurve = new Float64Array(8760)
    for (let i = 0; i < 8760; i++) {
      const h = base.horas[i]
      // Peak bell between hours 9..17
      solarCurve[i] = h >= 9 && h <= 17 ? Math.sin(((h - 8) / 10) * Math.PI) * 0.85 : 0
    }
    const solarHourly: MemHourlyDataset = {
      ...base,
      label: 'Test Solar 2025',
      curva_solar_mw: solarCurve,
    }
    const inputs: MemSimulatorInputs = {
      ...DEFAULT_MEM_INPUTS,
      fv_potencia_mw: 2.5,
      capex_fv_usd_kwp: 900,
      opex_fv_mxn_mw_anio: 220_000,
    }
    const res = runMemSimulation({
      inputs,
      assumptions: createDefaultMemAnnualAssumptions(),
      hourly: solarHourly,
      criticalHours100HC: getBaseline100HC(),
    })
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return

    const { year1, financial } = res
    expect(year1.res_gen_fv_mwh).toBeGreaterThan(1000)
    expect(
      year1.res_fv_auto_mwh + year1.res_fv_a_bess_mwh + year1.res_fv_perdida_mwh,
    ).toBeCloseTo(year1.res_gen_fv_mwh, 4)
    expect(financial.peso_fv).toBeGreaterThan(0)
    expect(financial.peso_fv).toBeLessThan(1)
    expect(financial.capex_fv_mxn).toBeCloseTo(2.5 * 1000 * 900 * inputs.tc_mxn_usd, 2)
  })

  it('respects strict < tie-breaking in Op_HorasCarga=0/24 and fixed MBP override priority', () => {
    const base = getBaselineMemHourlyDataset()
    // Construct tied PML on window hours 2..10 every day:
    // hours 2..5 = 100 (4 cheaper hours -> count < 5)
    // hours 6..7 = 200 (tied; both have exactly 4 strictly cheaper hours -> 4 < 5, so BOTH charge!)
    // hours 8..10 = 400 (count = 6 >= 5 -> never charge)
    const tiePml = new Float64Array(8760).fill(900)
    for (let i = 0; i < 8760; i++) {
      const h = base.horas[i]
      if (h >= 2 && h <= 5) tiePml[i] = 100
      else if (h === 6 || h === 7) tiePml[i] = 200
      else if (h >= 8 && h <= 10) tiePml[i] = 400
    }
    const tiedHourly: MemHourlyDataset = { ...base, pml_mxn_mwh: tiePml }
    const tieInputs: MemSimulatorInputs = {
      ...DEFAULT_MEM_INPUTS,
      demanda_contratada_mw: 50,
      bess_potencia_mw: 1,
      bess_capacidad_mwh: 10,
      bess_eficiencia_pct: 1,
      bess_soc_min_pct: 0,
      op_horas_carga: 5,
      op_ini_descarga: 15,
      op_fin_descarga: 22,
    }
    const y1Tied = simulateMemYear1(tieInputs, tiedHourly, getBaseline100HC())
    // With 5 non-tied hours max would be 5 * 365 = 1,825 MWh; strict COUNTIFS("<") charges 6h/day = 2,190 MWh
    expect(y1Tied.res_carga_red_mwh).toBeGreaterThan(2000)

    const y1ZeroHrs = simulateMemYear1(
      { ...DEFAULT_MEM_INPUTS, op_horas_carga: 0 },
      base,
      getBaseline100HC(),
    )
    expect(y1ZeroHrs.res_carga_red_mwh).toBe(0)

    const assumptions = createDefaultMemAnnualAssumptions()
    assumptions.pct_mbp[1] = 0.04
    assumptions.fijo_mbp[1] = 6_000_000
    const rows = buildAnnualAssumptionsRows(DEFAULT_MEM_INPUTS, assumptions, 760)
    expect(rows[1].precio_mbp_mxn_mw_anio).toBe(6_000_000)
    expect(rows[1].idx_potencia).toBeCloseTo(6_000_000 / DEFAULT_MEM_INPUTS.mbp_precio_mxn_mw_anio, 8)
  })

  it('supports horizons 1 and 25, plus Neto Financiado, USD conversion, and aggregateSeries parity', () => {
    const resH1 = runMemSimulation({
      inputs: { ...DEFAULT_MEM_INPUTS, fin_horizonte_anios: 1 },
      assumptions: createDefaultMemAnnualAssumptions(),
      hourly: getBaselineMemHourlyDataset(),
      criticalHours100HC: getBaseline100HC(),
    })
    expect(resH1.status).toBe('ok')
    if (resH1.status !== 'ok') return
    expect(resH1.financial.rows).toHaveLength(26)
    expect(resH1.financial.rows[1].activo).toBe(1)
    expect(resH1.financial.rows[2].activo).toBe(0)
    expect(resH1.financial.payback_simple_estado).toBe('fuera_horizonte')

    const resMxn = runMemSimulation({
      inputs: DEFAULT_MEM_INPUTS,
      assumptions: createDefaultMemAnnualAssumptions(),
      hourly: getBaselineMemHourlyDataset(),
      criticalHours100HC: getBaseline100HC(),
      financialOptions: { moneda: 'MXN', vistaFinanciamiento: 'bruto' },
    })
    const resUsd = runMemSimulation({
      inputs: DEFAULT_MEM_INPUTS,
      assumptions: createDefaultMemAnnualAssumptions(),
      hourly: getBaselineMemHourlyDataset(),
      criticalHours100HC: getBaseline100HC(),
      financialOptions: { moneda: 'USD', vistaFinanciamiento: 'bruto' },
    })
    const resNeto = runMemSimulation({
      inputs: DEFAULT_MEM_INPUTS,
      assumptions: createDefaultMemAnnualAssumptions(),
      hourly: getBaselineMemHourlyDataset(),
      criticalHours100HC: getBaseline100HC(),
      financialOptions: {
        moneda: 'MXN',
        vistaFinanciamiento: 'neto',
        financing: {
          vehiculo_inversion: 'credito',
          enganche_pct: 0.2,
          tasa_interes_anual: 0.12,
          plazo_meses: 60,
        },
      },
    })

    expect(resMxn.status).toBe('ok')
    expect(resUsd.status).toBe('ok')
    expect(resNeto.status).toBe('ok')
    if (resMxn.status !== 'ok' || resUsd.status !== 'ok' || resNeto.status !== 'ok') return

    expect(resUsd.financial.vpn).toBeCloseTo(resMxn.financial.vpn / DEFAULT_MEM_INPUTS.tc_mxn_usd, 2)
    expect(resUsd.financial.tir_pct).toBeCloseTo(resMxn.financial.tir_pct!, 6)
    expect(resNeto.financial.desembolso_inicial).toBeCloseTo(resMxn.financial.capex_total_mxn * 0.2, 2)
    expect(resNeto.financial.rows[1].cuota_financiamiento).toBeLessThan(0)
    expect(resNeto.financial.serie_mensual[0].cuota_financiamiento).toBeGreaterThan(0)
    expect(resNeto.financial.rows[6].cuota_financiamiento).toBe(0)

    const annualAgg = aggregateSeries(resMxn.financial.serie_mensual, 'anual')
    const qtrAgg = aggregateSeries(resMxn.financial.serie_mensual, 'trimestral')
    expect(annualAgg).toHaveLength(DEFAULT_MEM_INPUTS.fin_horizonte_anios)
    expect(qtrAgg).toHaveLength(DEFAULT_MEM_INPUTS.fin_horizonte_anios * 4)
    const sumAnnualFlow = annualAgg.reduce((s, r) => s + r.flujo_neto, 0)
    const sumQtrFlow = qtrAgg.reduce((s, r) => s + r.flujo_neto, 0)
    expect(sumAnnualFlow).toBeCloseTo(resMxn.financial.flujo_neto_total, 2)
    expect(sumQtrFlow).toBeCloseTo(resMxn.financial.flujo_neto_total, 2)
  })

  it('flags 100HC duplicates and missing keys cleanly', () => {
    const hc = getBaseline100HC()
    const modified = [...hc]
    modified[1] = { ...modified[0], no: 2 } // duplicate key at rows 1 & 2
    modified[2] = { no: 3, fecha: '1999-01-01', hora: 1 } // missing key

    const y1 = simulateMemYear1(DEFAULT_MEM_INPUTS, getBaselineMemHourlyDataset(), modified)
    expect(y1.duplicate_100hc_count).toBe(2)
    expect(y1.missing_100hc_count).toBe(1)
    expect(y1.critical_hours_rows[0].repetida).toBe(true)
    expect(y1.critical_hours_rows[1].repetida).toBe(true)
    expect(y1.critical_hours_rows[2].encontrada).toBe(false)
  })

  it('rejects inverted windows & enforces prototype/allowlist protection on MEM overrides', () => {
    const badWin = validateMemInputs({
      ...DEFAULT_MEM_INPUTS,
      op_ini_carga: 15,
      op_fin_carga: 8,
    })
    expect(badWin.errors.op_fin_carga).toBeDefined()

    const ovPayload = JSON.parse(
      '{"modo_motor":"mem_horaria","bess_potencia_mw":4,"__proto__":{"polluted":true}}',
    ) as Record<string, unknown>
    const checked = validateOverridesAgainstTemplate(MEM_TEMPLATE_CAMPOS, ovPayload)
    expect(checked.valid).toBe(false)
    expect(Object.getOwnPropertyDescriptor(checked.errors, '__proto__')?.value).toBeDefined()

    const validOv = validateOverridesAgainstTemplate(MEM_TEMPLATE_CAMPOS, {
      modo_motor: 'mem_horaria',
      bess_potencia_mw: 4.5,
      bess_capacidad_mwh: 13.5,
      fin_horizonte_anios: 15,
    })
    expect(validOv.valid).toBe(true)
    expect(validOv.sanitized.bess_potencia_mw).toBe(4.5)

    // Unified entry point works in both modes
    const memUnified = runSimulation({
      mode: 'mem_horaria',
      ignoreProjectGating: true,
      proyecto: {
        tipo: 'MEM',
        capex_estimado: null,
        moneda: 'MXN',
        incluye_mem: true,
        demanda_kw: null,
        capacidad_mw: null,
        capacidad_mwh: null,
        consumo_anual_gwh: null,
        volumen_energia_mwh_anual: null,
        tarifa_actual_cfe: null,
      },
      activeConfig: null,
      configProducts: [],
      activeFinancing: null,
      template: { id: 't', modo: 'default', campos: MEM_TEMPLATE_CAMPOS, formulas: [] },
      monedaCalculo: 'MXN',
      horizonteAnios: 20,
      vistaFinanciamiento: 'bruto',
      overrides: {},
    })
    expect(memUnified.status).toBe('ok')
  })
})

describe('Extended Excel Formula AST & Multi-Sheet Importer', () => {
  it('evaluates COUNTIFS, XLOOKUP, INDEX/MATCH, ISNUMBER, MONTH, ROW and rewrites Defined Names', () => {
    const scope = new Map<string, number | string | boolean>([
      ['A1', '2025-01-01'],
      ['A2', '2025-01-01'],
      ['A3', '2025-02-15'],
      ['B1', 1],
      ['B2', 1],
      ['B3', 0],
      ['C1', 300],
      ['C2', 450],
      ['C3', 200],
      ['Análisis!G2', 123.45],
      ['BESS_Capacidad', 18],
      ['CAPEX_BESS', 320],
      ['TC', 18.7],
    ])

    expect(evaluateExcelExpression('=COUNTIFS(A1:A3, A2, B1:B3, 1, C1:C3, "<"&C2)', scope)).toBe(1)
    expect(evaluateExcelExpression('=_xlfn.XLOOKUP("2025-02-15", A1:A3, C1:C3, 0)', scope)).toBe(200)
    expect(evaluateExcelExpression('=INDEX(C1:C3, MATCH(450, C1:C3, 0))', scope)).toBe(450)
    expect(evaluateExcelExpression('=ISNUMBER(Análisis!G2)', scope)).toBe(true)
    expect(evaluateExcelExpression('=MONTH(A3)', scope)).toBe(2)
    expect(evaluateExcelExpression('=ROW(A5)', scope)).toBe(5)

    const ast = parseExcelFormula('=BESS_Capacidad*1000*CAPEX_BESS*TC')
    expect(ast.type).toBe('BinaryOp')

    const rewritten = rewriteFormulaCellRefs(
      '=BESS_Capacidad*1000*CAPEX_BESS*TC',
      new Map([
        ['BESS_Capacidad', 'bess_capacidad_mwh'],
        ['CAPEX_BESS', 'capex_bess_usd_kwh'],
        ['TC', 'tc_mxn_usd'],
      ]),
    )
    expect(rewritten.unresolvedRefs).toEqual([])
    expect(rewritten.rewritten).toContain('bess_capacidad_mwh')
    expect(rewritten.rewritten).toContain('tc_mxn_usd')

    const preview = previewFormulaRewrite(
      '=Input!C11*1000*Input!C33*TC',
      [
        { cellRef: 'C11', sheetName: 'Input', platformVar: 'bess_capacidad_mwh' },
        { cellRef: 'C33', sheetName: 'Input', platformVar: 'capex_bess_usd_kwh' },
        { cellRef: 'C27', sheetName: 'Input', platformVar: 'tc_mxn_usd' },
      ],
      'Input',
    )
    expect(preview.unresolvedRefs).toEqual([])
  })

  it('imports synthetic multi-sheet MEM workbook with Defined Names cleanly', async () => {
    const wb = new ExcelJS.Workbook()
    const wsIn = wb.addWorksheet('Input')
    wsIn.getCell('B5').value = 'Cliente'
    wsIn.getCell('C5').value = 'Cliente Demo Import'
    wsIn.getCell('C5').name = 'Cliente'
    wsIn.getCell('B9').value = 'Potencia BESS'
    wsIn.getCell('C9').value = 4
    wsIn.getCell('C9').name = 'BESS_Potencia'
    wsIn.getCell('B11').value = 'Capacidad'
    wsIn.getCell('C11').value = 12
    wsIn.getCell('C11').name = 'BESS_Capacidad'
    wsIn.getCell('B27').value = 'TC'
    wsIn.getCell('C27').value = 19.2
    wsIn.getCell('C27').name = 'TC'
    wsIn.getCell('B33').value = 'CAPEX BESS'
    wsIn.getCell('C33').value = 300
    wsIn.getCell('C33').name = 'CAPEX_BESS'

    const wsFin = wb.addWorksheet('Evaluación financiera')
    wsFin.getCell('B5').value = 'CAPEX BESS'
    wsFin.getCell('C5').value = { formula: 'BESS_Capacidad*1000*CAPEX_BESS*TC', result: 69120000 }
    wsFin.getCell('C5').name = 'Fin_CAPEX_BESS'

    const wsDatos = wb.addWorksheet('Datos')
    wsDatos.addRow(['Fecha', 'Hora', 'Consumo (MWh)', 'PML (MXN/MWh)'])
    wsDatos.addRow(['2025-01-01', 1, 2.5, 410])

    const wsHc = wb.addWorksheet('100HC')
    wsHc.addRow(['No.', 'Fecha', 'Hora'])
    wsHc.addRow([1, '2025-01-01', 1])

    const buffer = Buffer.from(await wb.xlsx.writeBuffer())
    const parsed = await parseWorkbookWithExcelJs(buffer, 'demo-mem.xlsx', 'xlsx')

    expect(parsed.memWorkbookPreview?.isMemModel).toBe(true)
    expect(parsed.memWorkbookPreview?.definedNamesMatched).toBeGreaterThanOrEqual(5)
    expect(parsed.memWorkbookPreview?.extractedInputs.cliente).toBe('Cliente Demo Import')
    expect(parsed.memWorkbookPreview?.extractedInputs.bess_potencia_mw).toBe(4)
    expect(parsed.memWorkbookPreview?.extractedInputs.bess_capacidad_mwh).toBe(12)
    expect(parsed.memWorkbookPreview?.extractedInputs.tc_mxn_usd).toBe(19.2)
    expect(parsed.suggestedInputMappings.some((s) => s.definedName === 'BESS_Capacidad' && s.confidence === 1)).toBe(true)
  })

  it('imports the canonical external Simulador FV + BESS MEM.xlsx workbook verbatim when available', async () => {
    if (!fs.existsSync(EXTERNAL_MEM_XLSX_PATH)) {
      return
    }
    const buf = fs.readFileSync(EXTERNAL_MEM_XLSX_PATH)
    const preflight = await preflightValidateSpreadsheetBuffer(buf, path.basename(EXTERNAL_MEM_XLSX_PATH))
    expect(preflight.ok).toBe(true)
    if (!preflight.ok) return
    expect(preflight.extension).toBe('xlsx')

    const parsed = await parseWorkbookWithExcelJs(buf, path.basename(EXTERNAL_MEM_XLSX_PATH), 'xlsx')
    expect(parsed.memWorkbookPreview?.isMemModel).toBe(true)
    expect(parsed.memWorkbookPreview?.hourlySummary.datosRows).toBe(8760)
    expect(parsed.memWorkbookPreview?.hourlySummary.criticalHoursCount).toBe(100)
    expect(parsed.memWorkbookPreview?.extractedInputs.cliente).toBe('Beetman')
    expect(parsed.memWorkbookPreview?.extractedInputs.bess_potencia_mw).toBe(6)
    expect(parsed.memWorkbookPreview?.extractedInputs.bess_capacidad_mwh).toBe(18)
    expect(parsed.memWorkbookPreview?.extractedAssumptions).not.toBeNull()

    const hd = parsed.memWorkbookPreview!.hourlyDataset!
    const outcome = runMemSimulation({
      inputs: { ...DEFAULT_MEM_INPUTS, ...parsed.memWorkbookPreview!.extractedInputs },
      assumptions: parsed.memWorkbookPreview!.extractedAssumptions!,
      hourly: {
        label: parsed.fileName,
        year: 2025,
        fechas: hd.fechas,
        horas: hd.horas,
        consumo_mwh: Float64Array.from(hd.consumo_mwh),
        pml_mxn_mwh: Float64Array.from(hd.pml_mxn_mwh),
        curva_solar_mw: Float64Array.from(hd.curva_solar_mw),
      },
      criticalHours100HC: parsed.memWorkbookPreview!.criticalHours100HC!,
    })
    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return
    expectClosePct(outcome.year1.ahorro_total_mxn, 25_922_832.64)
    expectClosePct(outcome.financial.vpn, 112_509_753.35)
    expectClosePct(outcome.financial.tir_pct!, 25.54, 0.0005)

    // Verify clean hourly diagnostics on canonical Excel workbook
    expect(parsed.memWorkbookPreview?.hourlySummary.skippedDatosRows ?? 0).toBe(0)
    expect(parsed.memWorkbookPreview?.hourlySummary.skippedSolarRows ?? 0).toBe(0)
    expect(parsed.memWorkbookPreview?.hourlySummary.invalid100HcRows ?? 0).toBe(0)
    expect(parsed.memWorkbookPreview?.hourlySummary.alignmentMismatchCount ?? 0).toBe(0)

    // Verify Excel-imported MEM formula (e.g. Fin_OPEX1 / Evaluación financiera!C8) rewrites and dry-runs cleanly without #NAME?
    const finOpexCell = parsed.formulaCells.find(
      (f) =>
        f.sheetName === 'Evaluación financiera' &&
        (parsed.definedNames.some((dn) => dn.name === 'Fin_OPEX1' && dn.ranges.some((r) => r.includes(f.cellRef))) ||
          f.cellRef === 'C8'),
    )
    expect(finOpexCell).toBeDefined()
    const inputMappings = parsed.suggestedInputMappings
      .filter((s) => s.suggestedVar !== null)
      .map((s) => ({
        cellRef: s.cellRef,
        sheetName: s.sheetName,
        platformVar: s.suggestedVar!,
      }))
    const rewrittenOpex = previewFormulaRewrite(
      finOpexCell!.rawFormula,
      inputMappings,
      finOpexCell!.sheetName,
    )
    expect(rewrittenOpex.unresolvedRefs).toEqual([])
    const customFormulas = FALLBACK_TEMPLATE_FORMULAS.map((f) =>
      f.key === 'om_mes' ? { ...f, expression: rewrittenOpex.rewritten } : f,
    )
    compileAndSortFormulas(customFormulas, { allowCellRefs: false, validateIdentifiers: true })
    const dryRun = evaluateSimulation({
      proyecto: {
        tipo: 'MEM',
        capex_estimado: 107_712_000,
        moneda: 'MXN',
        incluye_mem: true,
        demanda_kw: 10_000,
        capacidad_mw: 6,
        capacidad_mwh: 18,
        consumo_anual_gwh: null,
        volumen_energia_mwh_anual: null,
        tarifa_actual_cfe: null,
      },
      activeConfig: null,
      configProducts: [],
      activeFinancing: null,
      template: {
        id: 'excel-mem-test',
        modo: 'excel_import',
        campos: MEM_TEMPLATE_CAMPOS,
        formulas: customFormulas,
      },
      monedaCalculo: 'MXN',
      horizonteAnios: 20,
      vistaFinanciamiento: 'bruto',
      overrides: {},
    })
    expect(dryRun.status).toBe('ok')
  })

  it('evaluates imported MEM variable formulas cleanly in evaluateSimulation without #NAME?', () => {
    const rewritten = rewriteFormulaCellRefs(
      '=BESS_Capacidad*OPEX_BESS+FV_Potencia*OPEX_FV',
      new Map([
        ['BESS_Capacidad', 'bess_capacidad_mwh'],
        ['OPEX_BESS', 'opex_bess_mxn_mwh_anio'],
        ['FV_Potencia', 'fv_potencia_mw'],
        ['OPEX_FV', 'opex_fv_mxn_mw_anio'],
      ]),
    )
    expect(rewritten.unresolvedRefs).toEqual([])
    const customFormulas = FALLBACK_TEMPLATE_FORMULAS.map((f) =>
      f.key === 'om_mes' ? { ...f, expression: rewritten.rewritten } : f,
    )
    const outcome = evaluateSimulation({
      proyecto: {
        tipo: 'FV+BESS',
        capex_estimado: 10_000_000,
        moneda: 'MXN',
        incluye_mem: true,
        demanda_kw: 5000,
        capacidad_mw: 6,
        capacidad_mwh: 18,
        consumo_anual_gwh: null,
        volumen_energia_mwh_anual: null,
        tarifa_actual_cfe: 2.5,
      },
      activeConfig: null,
      configProducts: [],
      activeFinancing: null,
      template: {
        id: 'mem-ast-test',
        modo: 'excel_import',
        campos: MEM_TEMPLATE_CAMPOS,
        formulas: customFormulas,
      },
      monedaCalculo: 'MXN',
      horizonteAnios: 20,
      vistaFinanciamiento: 'bruto',
      overrides: {},
    })
    expect(outcome.status).toBe('ok')
    if (outcome.status === 'ok') {
      expectClosePct(outcome.serie_mensual[0].costo_om, 18 * 32_198.4)
    }
  })

  it('parses standalone 3-col solar MW CSV, fractional Excel serial dates, and detects malformed/misaligned sheets', async () => {
    // 1. Standalone 3-column CSV with bare "MW" header
    const rows = ['Fecha,Hora,MW']
    for (let h = 1; h <= 24; h++) {
      rows.push(`2025-01-01,${h},${h === 12 ? 2.5 : 0}`)
    }
    // Pad past 250 rows so rowCount threshold identifies time-series
    for (let d = 2; d <= 12; d++) {
      const dd = String(d).padStart(2, '0')
      for (let h = 1; h <= 24; h++) {
        rows.push(`2025-01-${dd},${h},0`)
      }
    }
    const csvBuf = Buffer.from(rows.join('\n'), 'utf8')
    const parsedSolar = await parseWorkbookWithExcelJs(csvBuf, 'solar-3col.csv', 'csv')
    expect(parsedSolar.memWorkbookPreview?.isMemModel).toBe(true)
    expect(parsedSolar.memWorkbookPreview?.hourlyDataset?.curva_solar_mw[11]).toBeCloseTo(2.5, 6)

    // 2. Single-sheet XLSX named "Datos" with fractional Excel serial date 45658.5 (2025-01-01 noon)
    const wbSingle = new ExcelJS.Workbook()
    const wsSingle = wbSingle.addWorksheet('Datos')
    wsSingle.addRow(['Fecha', 'Hora', 'Consumo (MWh)', 'PML (MXN/MWh)'])
    wsSingle.addRow([45658.5, 1, 3.2, 500])
    const singleBuf = Buffer.from(await wbSingle.xlsx.writeBuffer())
    const parsedSingle = await parseWorkbookWithExcelJs(singleBuf, 'datos-solo.xlsx', 'xlsx')
    expect(parsedSingle.memWorkbookPreview?.isMemModel).toBe(true)
    expect(parsedSingle.memWorkbookPreview?.hourlyDataset?.fechas[0]).toBe('2025-01-01')

    // 3. Misaligned Datos + Curva Solar + invalid 100HC
    const wbBad = new ExcelJS.Workbook()
    const wsBadD = wbBad.addWorksheet('Datos')
    wsBadD.addRow(['Fecha', 'Hora', 'Consumo (MWh)', 'PML (MXN/MWh)'])
    wsBadD.addRow(['2025-01-01', 1, 2.0, 400])
    wsBadD.addRow(['2025-01-01', 2, null, 400]) // invalid incomplete row

    const wsBadS = wbBad.addWorksheet('Curva Solar')
    wsBadS.addRow(['Fecha', 'Hora', 'MW'])
    wsBadS.addRow(['2025-01-02', 1, 1.5]) // misaligned date vs Datos

    const wsBadHc = wbBad.addWorksheet('100HC')
    wsBadHc.addRow(['No.', 'Fecha', 'Hora'])
    wsBadHc.addRow([1, '2025-01-01', 25]) // invalid hour 25

    const badBuf = Buffer.from(await wbBad.xlsx.writeBuffer())
    const parsedBad = await parseWorkbookWithExcelJs(badBuf, 'bad.xlsx', 'xlsx')
    expect(parsedBad.memWorkbookPreview?.hourlySummary.skippedDatosRows).toBe(1)
    expect(parsedBad.memWorkbookPreview?.hourlySummary.invalid100HcRows).toBe(1)
    expect(parsedBad.memWorkbookPreview?.hourlySummary.alignmentMismatchCount).toBe(1)
  })

  it('persists critical_hours_100hc in sparse overrides and enforces strict override validation', () => {
    const customHc = getBaseline100HC().map((h, i) => (i === 0 ? { ...h, hora: 18 } : h))
    const memOutcome = runSimulation({
      mode: 'mem_horaria',
      ignoreProjectGating: true,
      proyecto: {
        tipo: 'MEM',
        capex_estimado: 107_712_000,
        moneda: 'MXN',
        incluye_mem: true,
        demanda_kw: 10_000,
        capacidad_mw: 6,
        capacidad_mwh: 18,
        consumo_anual_gwh: null,
        volumen_energia_mwh_anual: null,
        tarifa_actual_cfe: null,
      },
      activeConfig: null,
      configProducts: [],
      activeFinancing: null,
      template: { id: 't', modo: 'default', campos: MEM_TEMPLATE_CAMPOS, formulas: [] },
      monedaCalculo: 'MXN',
      horizonteAnios: 20,
      vistaFinanciamiento: 'bruto',
      overrides: { modo_motor: 'mem_horaria' },
      criticalHours100HC: customHc,
    })
    expect(memOutcome.status).toBe('ok')
    if (memOutcome.status === 'ok' && memOutcome.mode === 'mem_horaria') {
      expect(memOutcome.usa_parametros_base).toBe(false)
      expect(memOutcome.parametros_override_sparse?.critical_hours_100hc?.[0].hora).toBe(18)
    }

    const pollutedNested = JSON.parse(
      '{"modo_motor":"mem_horaria","supuestos_anuales":{"__proto__":{"x":1},"pct_mbp":[],"fijo_mbp":[],"pct_pml":[],"deg_bess":[]}}',
    ) as Record<string, unknown>
    expect(validateOverridesAgainstTemplate(MEM_TEMPLATE_CAMPOS, pollutedNested).valid).toBe(false)

    // Bad ISO date & overlong text & inverted op window & bad arrays
    expect(
      validateOverridesAgainstTemplate(MEM_TEMPLATE_CAMPOS, {
        modo_motor: 'mem_horaria',
        tc_fecha: '2026-11-18xyz',
      }).valid,
    ).toBe(false)
    expect(
      validateOverridesAgainstTemplate(MEM_TEMPLATE_CAMPOS, {
        modo_motor: 'mem_horaria',
        tc_fecha: '2026-02-30',
      }).valid,
    ).toBe(false)
    expect(
      validateOverridesAgainstTemplate(MEM_TEMPLATE_CAMPOS, {
        modo_motor: 'mem_horaria',
        cliente: 'A'.repeat(201),
      }).valid,
    ).toBe(false)
    expect(
      validateOverridesAgainstTemplate(MEM_TEMPLATE_CAMPOS, {
        modo_motor: 'mem_horaria',
        op_ini_carga: 12,
        op_fin_carga: 8,
      }).valid,
    ).toBe(false)
    expect(
      validateOverridesAgainstTemplate(MEM_TEMPLATE_CAMPOS, {
        modo_motor: 'mem_horaria',
        supuestos_anuales: {
          pct_mbp: [0],
          fijo_mbp: [],
          pct_pml: [],
          deg_bess: [],
        },
      }).valid,
    ).toBe(false)
    expect(
      validateOverridesAgainstTemplate(MEM_TEMPLATE_CAMPOS, {
        modo_motor: 'mem_horaria',
        critical_hours_100hc: [{ no: 1, fecha: '2025-01-01', hora: 25 }],
      }).valid,
    ).toBe(false)
  })

  it('allocates config CAPEX cleanly on hybrid FV+BESS and clears default BESS when FV-only products exist', () => {
    const template = { id: 't', modo: 'default' as const, campos: MEM_TEMPLATE_CAMPOS, formulas: [] }

    // 1. Hybrid FV+BESS with inversion_total = 18.7M MXN ($1,000,000 USD at default TC 18.7) and zero product CAPEX
    const hybrid = resolveMemInputsFromProject({
      proyecto: {
        tipo: 'FV+BESS',
        nombre_proyecto: 'Hibrido Test',
        capex_estimado: null,
        moneda: 'MXN',
        incluye_mem: true,
        demanda_kw: 5000,
        capacidad_mw: null,
        capacidad_mwh: null,
        consumo_anual_gwh: null,
        volumen_energia_mwh_anual: null,
        tarifa_actual_cfe: null,
      },
      activeConfig: {
        id: 'cfg1',
        proyecto_id: 'p1',
        nombre: 'Alt 1',
        descripcion: null,
        inversion_total: 18_700_000,
        moneda: 'MXN',
        ahorro_estimado_anual: null,
        ahorro_estimado_mensual: null,
        ahorro_moneda: 'MXN',
        seleccionada: true,
        created_at: '',
        updated_at: '',
      },
      configProducts: [
        {
          id: 'p-fv',
          proyecto_id: 'p1',
          sitio_id: 's1',
          configuracion_id: 'cfg1',
          tipo: 'fv',
          datos: { num_modulos: 1000, potencia_modulos_w: 500 },
          created_at: '',
        },
        {
          id: 'p-bess',
          proyecto_id: 'p1',
          sitio_id: 's1',
          configuracion_id: 'cfg1',
          tipo: 'bess',
          datos: { potencia_kw: 1000, capacidad_kwh: 2000 },
          created_at: '',
        },
      ],
      activeFinancing: null,
      sitios: [],
      template,
    })
    const reconstructedUsd =
      hybrid.baseInputs.fv_potencia_mw * 1000 * hybrid.baseInputs.capex_fv_usd_kwp +
      hybrid.baseInputs.bess_capacidad_mwh * 1000 * hybrid.baseInputs.capex_bess_usd_kwh
    expectClosePct(reconstructedUsd, 1_000_000, 1e-6)

    // 2. FV+BESS project whose selected alternative ONLY contains FV product -> BESS defaults to 0 instead of 6 MW / 18 MWh
    const fvOnlyAlt = resolveMemInputsFromProject({
      proyecto: {
        tipo: 'FV+BESS',
        nombre_proyecto: 'FV Alt',
        capex_estimado: null,
        moneda: 'MXN',
        incluye_mem: false,
        demanda_kw: 2000,
        capacidad_mw: null,
        capacidad_mwh: null,
        consumo_anual_gwh: null,
        volumen_energia_mwh_anual: null,
        tarifa_actual_cfe: null,
      },
      activeConfig: null,
      configProducts: [
        {
          id: 'p-fv2',
          proyecto_id: 'p2',
          sitio_id: 's2',
          configuracion_id: null,
          tipo: 'fv',
          datos: { num_modulos: 1000, potencia_modulos_w: 500, capex: 500_000, capex_moneda: 'USD' },
          created_at: '',
        },
      ],
      activeFinancing: null,
      sitios: [],
      template,
    })
    expect(fvOnlyAlt.baseInputs.fv_potencia_mw).toBeCloseTo(0.5, 6)
    expect(fvOnlyAlt.baseInputs.bess_potencia_mw).toBe(0)
    expect(fvOnlyAlt.baseInputs.bess_capacidad_mwh).toBe(0)
  })

  it('produces exact 24h average BESS SOC profile for Tablero chart & zeroes when Cap=0', () => {
    const y1 = simulateMemYear1(
      DEFAULT_MEM_INPUTS,
      getBaselineMemHourlyDataset(),
      getBaseline100HC(),
    )
    expect(y1.hourly_profile).toHaveLength(24)
    expect(y1.hourly_profile[0].soc_promedio_mwh).toBeCloseTo(2.174404, 3)
    expect(y1.hourly_profile[9].soc_promedio_mwh).toBeCloseTo(17.829558, 3)
    expect(y1.hourly_profile[19].soc_promedio_mwh).toBeCloseTo(12.213212, 3)
    expect(y1.hourly_profile[20].soc_promedio_mwh).toBeCloseTo(6.617587, 3)
    expect(y1.hourly_profile[21].soc_promedio_mwh).toBeCloseTo(2.21851, 3)
    for (const pt of y1.hourly_profile) {
      expect(pt.soc_promedio_mwh).toBeGreaterThanOrEqual(0)
      expect(pt.soc_promedio_mwh).toBeLessThanOrEqual(DEFAULT_MEM_INPUTS.bess_capacidad_mwh + 1e-6)
    }

    const y1Zero = simulateMemYear1(
      { ...DEFAULT_MEM_INPUTS, bess_potencia_mw: 0, bess_capacidad_mwh: 0 },
      getBaselineMemHourlyDataset(),
      getBaseline100HC(),
    )
    expect(y1Zero.hourly_profile.every((p) => p.soc_promedio_mwh === 0)).toBe(true)
  })
})

describe('Deduplicated Upload Handler, Formula Preview & 3-Step MEM Data Wizard', () => {
  it('shares a single client-safe previewFormulaRewrite across formula-engine and excel-mapper', () => {
    expect(previewFormulaRewriteFromEngine).toBe(previewFormulaRewrite)
    const res = previewFormulaRewriteFromEngine(
      '=Input!C11*CAPEX_BESS*TC',
      [
        { cellRef: 'C11', sheetName: 'Input', platformVar: 'bess_capacidad_mwh' },
        { cellRef: 'C33', sheetName: 'Input', platformVar: 'capex_bess_usd_kwh' },
        { cellRef: 'C27', sheetName: 'Input', platformVar: 'tc_mxn_usd' },
      ],
      'Input',
    )
    expect(res.unresolvedRefs).toEqual([])
    expect(res.rewritten).toBe('=bess_capacidad_mwh * capex_bess_usd_kwh * tc_mxn_usd')
  })

  it('validates spreadsheet files client-side and enforces auth/role/preflight in handleSpreadsheetParseUpload', async () => {
    expect(validateSpreadsheetFileClient({ name: 'old.xls', size: 1024 })).toBe(
      LEGACY_XLS_ERROR_MESSAGE,
    )
    expect(validateSpreadsheetFileClient({ name: 'notes.txt', size: 100 })).toContain(
      'Formato no soportado',
    )
    expect(validateSpreadsheetFileClient({ name: 'empty.xlsx', size: 0 })).toContain('vacío')
    expect(
      validateSpreadsheetFileClient({ name: 'huge.xlsx', size: MAX_UPLOAD_BYTES + 1 }),
    ).toContain('10 MB')
    expect(validateSpreadsheetFileClient({ name: 'valid.csv', size: 512 })).toBeNull()

    const mockSupabaseFactory = (userId: string | null, rol: Rol | null) =>
      (async () =>
        ({
          auth: {
            getUser: async () => ({
              data: { user: userId ? { id: userId } : null },
              error: null,
            }),
          },
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: rol ? { rol } : null,
                  error: null,
                }),
              }),
            }),
          }),
        }) as unknown as Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>)

    const baseOpts = {
      allowedRoles: new Set<Rol>(['nodo_admin']),
      defaultFileName: 'archivo.xlsx',
      unauthenticatedMessage: 'No autenticado.',
      unauthorizedMessage: 'No autorizado.',
      parseErrorPrefix: 'Error al leer',
      formatResponse: (r: Awaited<ReturnType<typeof parseWorkbookWithExcelJs>>) => ({
        fileName: r.fileName,
        count: r.candidateInputs.length,
      }),
    }

    // 401 unauthenticated
    const r401 = await handleSpreadsheetParseUpload(
      new Request('http://localhost/api/test', { method: 'POST' }),
      { ...baseOpts, createSupabaseClient: mockSupabaseFactory(null, null) },
    )
    expect(r401.status).toBe(401)

    // 403 wrong role
    const r403 = await handleSpreadsheetParseUpload(
      new Request('http://localhost/api/test', { method: 'POST' }),
      { ...baseOpts, createSupabaseClient: mockSupabaseFactory('u1', 'epc') },
    )
    expect(r403.status).toBe(403)

    // 400 missing file in FormData
    const fdEmpty = new FormData()
    const r400 = await handleSpreadsheetParseUpload(
      new Request('http://localhost/api/test', { method: 'POST', body: fdEmpty }),
      { ...baseOpts, createSupabaseClient: mockSupabaseFactory('u1', 'nodo_admin') },
    )
    expect(r400.status).toBe(400)

    // 422 legacy .xls rejected by preflight
    const fdXls = new FormData()
    fdXls.append(
      'file',
      new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])], 'legacy.xls'),
    )
    const r422 = await handleSpreadsheetParseUpload(
      new Request('http://localhost/api/test', { method: 'POST', body: fdXls }),
      { ...baseOpts, createSupabaseClient: mockSupabaseFactory('u1', 'nodo_admin') },
    )
    expect(r422.status).toBe(422)

    // 200 valid CSV parsed and shaped via formatResponse
    const fdCsv = new FormData()
    fdCsv.append(
      'file',
      new File(['Parametro,Valor\nTarifa CFE,3.5\n'], 'ok.csv', { type: 'text/csv' }),
    )
    const r200 = await handleSpreadsheetParseUpload(
      new Request('http://localhost/api/test', { method: 'POST', body: fdCsv }),
      { ...baseOpts, createSupabaseClient: mockSupabaseFactory('u1', 'nodo_admin') },
    )
    expect(r200.status).toBe(200)
    const json200 = (await r200.json()) as { fileName: string; count: number }
    expect(json200.fileName).toBe('ok.csv')
    expect(json200.count).toBeGreaterThanOrEqual(1)
  })

  it('guides 5-section MEM selection, dynamic alignment checks, and partial apply in mem-import-wizard', () => {
    const base2025 = getBaselineMemHourlyDataset()
    const baseHc = getBaseline100HC()
    const baseAssumptions = createDefaultMemAnnualAssumptions()

    // Shift baseline dates from 2025 -> 2024 to test cross-year alignment & selective toggle
    const fechas2024 = base2025.fechas.map((f) => f.replace(/^2025/, '2024'))
    const solar2024 = Array.from({ length: 8760 }, (_, i) => (i % 24 === 12 ? 0.8 : 0))
    const hc2024 = baseHc.map((h) => ({ ...h, fecha: h.fecha.replace(/^2025/, '2024') }))

    const preview2024 = {
      isMemModel: true,
      detectedSheets: ['Input', 'Supuestos anuales', 'Datos', 'Curva Solar', '100HC'],
      definedNamesMatched: 5,
      extractedInputs: {
        ...DEFAULT_MEM_INPUTS,
        bess_potencia_mw: 4.5,
      },
      extractedInputKeys: ['bess_potencia_mw'] as (keyof MemSimulatorInputs)[],
      extractedAssumptions: {
        ...baseAssumptions,
        pct_mbp: baseAssumptions.pct_mbp.map((v, idx) => (idx >= 1 ? 0.05 : v)),
      },
      hourlySummary: {
        datosRows: 8760,
        curvaSolarRows: 8760,
        curvaSolarNonZeroHours: 365,
        criticalHoursCount: 100,
        duplicateCriticalHoursCount: 0,
        totalConsumoMwh: 50000,
        avgPmlMxnMwh: 750,
        dateStart: fechas2024[0],
        dateEnd: fechas2024[8759],
        skippedDatosRows: 0,
        skippedSolarRows: 0,
        invalid100HcRows: 0,
        alignmentMismatchCount: 0,
      },
      hourlyDataset: {
        fechas: fechas2024,
        horas: Array.from(base2025.horas),
        consumo_mwh: Array.from(base2025.consumo_mwh),
        pml_mxn_mwh: Array.from(base2025.pml_mxn_mwh),
        curva_solar_mw: solar2024,
      },
      criticalHours100HC: hc2024,
    }

    const customCurrentInputs: MemSimulatorInputs = {
      ...DEFAULT_MEM_INPUTS,
      cliente: 'Cliente Preservado',
    }
    const inspection = inspectMemImportPreview(
      preview2024,
      'cliente-2024.xlsx',
      base2025,
      customCurrentInputs,
    )
    expect(inspection.datos.valid).toBe(true)
    expect(inspection.curvaSolar.staticValid).toBe(true)
    expect(inspection.hc100.valid).toBe(true)
    expect(inspection.inputs.valid).toBe(true)
    expect(inspection.inputs.matchedCount).toBe(1)
    expect(inspection.assumptions.valid).toBe(true)

    const defaultSel = getDefaultMemImportSelection(inspection, preview2024, base2025)
    expect(defaultSel).toEqual({
      datos: true,
      curvaSolar: true,
      hc100: true,
      inputs: true,
      assumptions: true,
    })

    // All 5 selected -> aligned and ready
    const evalAll = evaluateMemImportSelection(inspection, preview2024, base2025, defaultSel)
    expect(evalAll.canProceed).toBe(true)
    expect(evalAll.hcMatchedCount).toBe(100)

    // Unchecking Datos while keeping 2024 Curva Solar checked against 2025 active dataset -> catches mismatch
    const evalSolarOnly = evaluateMemImportSelection(inspection, preview2024, base2025, {
      ...defaultSel,
      datos: false,
    })
    expect(evalSolarOnly.canProceed).toBe(false)
    expect(evalSolarOnly.curvaSolarError).toContain('desalineada')

    // Partial selection: only Inputs + Supuestos Anuales (leaves 2025 hourly untouched and preserves Cliente Preservado)
    const partialPayload = buildMemImportApplyPayload(inspection, preview2024, base2025, {
      datos: false,
      curvaSolar: false,
      hc100: false,
      inputs: true,
      assumptions: true,
    })
    expect(partialPayload.hourlyDataset).toBeUndefined()
    expect(partialPayload.criticalHours100HC).toBeUndefined()
    expect(partialPayload.extractedInputs).toEqual({ bess_potencia_mw: 4.5 })
    expect(partialPayload.extractedAssumptions?.pct_mbp[1]).toBe(0.05)
    expect(partialPayload.appliedLabels).toEqual(['Inputs', 'Supuestos Anuales'])

    // Selecting 2024 Datos without Curva Solar when active 2025 dataset had non-zero solar -> warns and resets solar to 0
    const activeWithSolar: MemHourlyDataset = {
      ...base2025,
      curva_solar_mw: Float64Array.from(solar2024),
    }
    const evalResetSolar = evaluateMemImportSelection(inspection, preview2024, activeWithSolar, {
      datos: true,
      curvaSolar: false,
      hc100: true,
      inputs: false,
      assumptions: false,
    })
    expect(evalResetSolar.canProceed).toBe(true)
    expect(evalResetSolar.warnings.some((w) => w.includes('reiniciará la curva solar en 0 MW'))).toBe(true)
    const datosOnlyPayload = buildMemImportApplyPayload(inspection, preview2024, activeWithSolar, {
      datos: true,
      curvaSolar: false,
      hc100: false,
      inputs: false,
      assumptions: false,
    })
    expect(datosOnlyPayload.hourlyDataset?.curva_solar_mw[12]).toBe(0)
  })

  it('excludes read-only bess_duracion_h from extractedInputs and enforces 24 scalar keys on real MEM workbook', async () => {
    if (!fs.existsSync(EXTERNAL_MEM_XLSX_PATH)) return
    const buffer = fs.readFileSync(EXTERNAL_MEM_XLSX_PATH)
    const parsed = await parseWorkbookWithExcelJs(buffer, 'Simulador FV + BESS MEM.xlsx', 'xlsx')
    const mem = parsed.memWorkbookPreview!
    expect('bess_duracion_h' in mem.extractedInputs).toBe(false)
    expect(mem.extractedInputKeys).toBeDefined()
    expect(mem.extractedInputKeys?.length).toBe(24)
    expect(mem.extractedInputKeys).not.toContain('bess_duracion_h')
  })

  it('rewrites mixed/lowercase Excel Defined Names case-insensitively and preserves template dry-run helper', () => {
    const rewriteLower = previewFormulaRewriteFromEngine(
      '=fv_potencia * 1000 * capex_fv * tc',
      [
        { cellRef: 'B16', sheetName: 'Input', platformVar: 'fv_potencia_mw' },
        { cellRef: 'B23', sheetName: 'Input', platformVar: 'capex_fv_usd_kwp' },
        { cellRef: 'B19', sheetName: 'Input', platformVar: 'tc_mxn_usd' },
      ],
      'Evaluación financiera',
    )
    expect(rewriteLower.rewritten).toBe('=fv_potencia_mw * 1000 * capex_fv_usd_kwp * tc_mxn_usd')
    expect(rewriteLower.unresolvedRefs).toEqual([])

    const directMixed = rewriteFormulaCellRefs(
      '=tc * BESS_CAPACIDAD / bess_potencia',
      new Map([
        ['TC', 'tc_mxn_usd'],
        ['BESS_Capacidad', 'bess_capacidad_mwh'],
        ['BESS_Potencia', 'bess_potencia_mw'],
      ]),
    )
    expect(directMixed.rewritten).toBe('=tc_mxn_usd * bess_capacidad_mwh / bess_potencia_mw')

    const dry = runTemplateDryRun({
      modo: 'custom_formulas',
      campos: [],
      formulas: FALLBACK_TEMPLATE_FORMULAS,
    })
    expect(dry.status).toBe('ok')
    if (dry.status === 'ok') {
      expect(dry.ahorro_monetario_y1).toBeGreaterThan(0)
      expect(dry.capex_total).toBe(1_500_000)
    }
  })

  it('handles semicolon CSV, MW/MWp solar headers, non-numeric solar garbage, <250-row solar classification, and rejects 8784-row leap-year truncation', async () => {
    // 1. Leap-year 8,784-row Datos CSV should preserve all 8,784 rows and fail 8,760h inspection instead of silent truncation
    const leapLines = ['Fecha (YYYY-MM-DD);Hora (1-24);Consumo (MWh);PML (MXN/MWh)']
    const start = Date.UTC(2024, 0, 1)
    for (let d = 0; d < 366; d++) {
      const dateStr = new Date(start + d * 86_400_000).toISOString().slice(0, 10)
      for (let h = 1; h <= 24; h++) {
        leapLines.push(`${dateStr};${h};1.25;950.5`)
      }
    }
    const leapParsed = await parseWorkbookWithExcelJs(
      Buffer.from(leapLines.join('\n'), 'utf8'),
      'datos-2024.csv',
      'csv',
    )
    expect(leapParsed.memWorkbookPreview?.hourlySummary.datosRows).toBe(8784)
    const leapInspect = inspectMemImportPreview(
      leapParsed.memWorkbookPreview!,
      'datos-2024.csv',
      getBaselineMemHourlyDataset(),
      DEFAULT_MEM_INPUTS,
    )
    expect(leapInspect.datos.valid).toBe(false)
    expect(leapInspect.datos.error).toContain('8784')

    // 2. Short (<250-row) CSV with Fecha, Hora, Generación (MW/MWp) classifies as curva_solar (not 100hc) and counts 'N/A' string as skippedSolarRows
    const solarLines = ['Fecha (YYYY-MM-DD),Hora (1-24),Generación (MW/MWp)']
    for (let i = 0; i < 24; i++) {
      solarLines.push(`2025-01-01,${i + 1},${i === 12 ? 'N/A' : i >= 10 && i <= 14 ? '0.65' : ''}`)
    }
    const solarParsed = await parseWorkbookWithExcelJs(
      Buffer.from(solarLines.join('\n'), 'utf8'),
      'solar-short.csv',
      'csv',
    )
    expect(solarParsed.memWorkbookPreview?.hourlySummary.criticalHoursCount).toBe(0)
    expect(solarParsed.memWorkbookPreview?.hourlySummary.curvaSolarRows).toBe(23)
    expect(solarParsed.memWorkbookPreview?.hourlySummary.skippedSolarRows).toBe(1)
    expect(solarParsed.memWorkbookPreview?.hourlySummary.curvaSolarNonZeroHours).toBe(4)
  })

  it('rejects oversized uploads (>10MB) early in route helper, enforces Supuestos bounds, and avoids repeated + Solar label suffix', async () => {
    // 1. Early 413 in handleSpreadsheetParseUpload when file.size > MAX_UPLOAD_BYTES
    let arrayBufferCalled = false
    const oversizedReq = {
      async formData() {
        return {
          get(key: string) {
            if (key !== 'file') return null
            return {
              name: 'huge.xlsx',
              size: MAX_UPLOAD_BYTES + 1,
              async arrayBuffer() {
                arrayBufferCalled = true
                return new ArrayBuffer(0)
              },
            }
          },
        }
      },
    } as unknown as Request
    const res413 = await handleSpreadsheetParseUpload(oversizedReq, {
      allowedRoles: new Set<Rol>(['nodo_admin']),
      defaultFileName: 'test.xlsx',
      unauthenticatedMessage: 'Auth required',
      unauthorizedMessage: 'Forbidden',
      parseErrorPrefix: 'Error',
      formatResponse: (r) => r,
      createSupabaseClient: async () =>
        ({
          auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { rol: 'nodo_admin' } }),
              }),
            }),
          }),
        }) as unknown as Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
    })
    expect(res413.status).toBe(413)
    expect(arrayBufferCalled).toBe(false)

    // 2. Supuestos Anuales out-of-bounds rejection in inspectMemImportPreview + non-stacking "+ Solar (...)" label
    const base = getBaselineMemHourlyDataset()
    const badAssump = createDefaultMemAnnualAssumptions()
    badAssump.pct_mbp[5] = 2.5
    const previewBadAssump = {
      isMemModel: true,
      detectedSheets: ['Supuestos anuales', 'Curva Solar'],
      definedNamesMatched: 0,
      extractedInputs: {},
      extractedAssumptions: badAssump,
      cachedExcelKpis: {},
      hourlySummary: {
        datosRows: 0,
        curvaSolarRows: 8760,
        curvaSolarNonZeroHours: 100,
        criticalHoursCount: 0,
        duplicateCriticalHoursCount: 0,
        totalConsumoMwh: 0,
        avgPmlMxnMwh: 0,
        dateStart: base.fechas[0],
        dateEnd: base.fechas[8759],
        skippedDatosRows: 0,
        skippedSolarRows: 0,
        invalid100HcRows: 0,
        alignmentMismatchCount: 0,
      },
      hourlyDataset: {
        fechas: Array.from(base.fechas),
        horas: Array.from(base.horas),
        consumo_mwh: new Array(8760).fill(0),
        pml_mxn_mwh: new Array(8760).fill(0),
        curva_solar_mw: Array.from(base.curva_solar_mw),
      },
    }
    const inspBad = inspectMemImportPreview(previewBadAssump, 'bad.xlsx', base, DEFAULT_MEM_INPUTS)
    expect(inspBad.assumptions.valid).toBe(false)
    expect(inspBad.assumptions.error).toContain('MBP')

    const labeledHourly: MemHourlyDataset = {
      ...base,
      label: 'CENACE Base + Solar (primero.csv)',
    }
    const inspSolar2 = inspectMemImportPreview(
      { ...previewBadAssump, extractedAssumptions: null },
      'segundo.csv',
      labeledHourly,
      DEFAULT_MEM_INPUTS,
    )
    const applied = buildMemImportApplyPayload(
      inspSolar2,
      { ...previewBadAssump, extractedAssumptions: null },
      labeledHourly,
      { datos: false, curvaSolar: true, hc100: false, inputs: false, assumptions: false },
    )
    expect(applied.hourlyDataset?.label).toBe('CENACE Base + Solar (segundo.csv)')
  })
})
