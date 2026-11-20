import type {
  GranularidadProyeccion,
  MemAnnualEvaluationRow,
  MemSensitivityCaseResult,
  MemYear1Results,
  Moneda,
  PeriodoAgregadoSimulacion,
} from '@/lib/types'

/**
 * CWE-1236 formula-injection pattern for string cells:
 * matches leading =, +, -, @ (after optional whitespace/CR/LF) or leading TAB/CR/LF.
 */
const CSV_FORMULA_INJECTION_REGEX = /^[\s\r\n]*[=+\-@]|^[\t\r\n]/

/**
 * Neutralizes a string CSV cell against spreadsheet formula injection (CWE-1236)
 * and applies RFC-4180 quoting.
 * NEVER call this on numeric columns — use formatCsvNumericCell() so negative numbers
 * such as -12500.00 remain raw unquoted numeric values.
 */
export function neutralizeCsvStringCell(value: string): string {
  const safe = CSV_FORMULA_INJECTION_REGEX.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

/**
 * Formats a numeric column as a raw, unquoted number (e.g., -12500.00).
 * Non-finite numbers emit an empty cell.
 */
export function formatCsvNumericCell(value: number, decimals: number = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }
  // Avoid "-0.00" artifacts
  const normalized = Object.is(value, -0) || Math.abs(value) < 1e-12 ? 0 : value
  return normalized.toFixed(decimals)
}

export interface ProjectionCsvOptions {
  moneda: Moneda
  granularidad?: GranularidadProyeccion
  proyectoNombre?: string
  escenarioNombre?: string
}

/**
 * Builds an RFC-4180 UTF-8 BOM CSV string for projection tables with string-only CWE-1236
 * neutralization and raw unquoted numeric cashflow columns.
 */
export function buildProjectionCsv(
  rows: readonly PeriodoAgregadoSimulacion[],
  options: ProjectionCsvOptions,
): string {
  const lines: string[] = []
  const curr = options.moneda

  if (options.proyectoNombre) {
    lines.push(`${neutralizeCsvStringCell('Proyecto')},${neutralizeCsvStringCell(options.proyectoNombre)}`)
  }
  if (options.escenarioNombre) {
    lines.push(`${neutralizeCsvStringCell('Escenario')},${neutralizeCsvStringCell(options.escenarioNombre)}`)
  }
  if (options.granularidad) {
    const labelMap: Record<GranularidadProyeccion, string> = {
      mensual: 'Mensual',
      trimestral: 'Trimestral',
      anual: 'Anual',
    }
    lines.push(`${neutralizeCsvStringCell('Granularidad')},${neutralizeCsvStringCell(labelMap[options.granularidad])}`)
  }
  if (lines.length > 0) {
    lines.push('')
  }

  const headers = [
    'Periodo',
    'Ahorro Energía FV (kWh)',
    'Ahorro Energía BESS (kWh)',
    'Ahorro Energía Total (kWh)',
    `Ahorro Bruto (${curr})`,
    `Costo O&M (${curr})`,
    `Financiamiento (${curr})`,
    `Flujo Neto (${curr})`,
    `Flujo Acumulado (${curr})`,
    `Flujo Descontado Acumulado (${curr})`,
  ]
  lines.push(headers.map(neutralizeCsvStringCell).join(','))

  for (const row of rows) {
    lines.push(
      [
        neutralizeCsvStringCell(row.etiqueta),
        formatCsvNumericCell(row.energia_fv_kwh, 2),
        formatCsvNumericCell(row.energia_bess_kwh, 2),
        formatCsvNumericCell(row.energia_total_kwh, 2),
        formatCsvNumericCell(row.ahorro_bruto, 2),
        formatCsvNumericCell(row.costo_om, 2),
        formatCsvNumericCell(row.cuota_financiamiento, 2),
        formatCsvNumericCell(row.flujo_neto, 2),
        formatCsvNumericCell(row.flujo_acumulado, 2),
        formatCsvNumericCell(row.flujo_descontado_acumulado, 2),
      ].join(','),
    )
  }

  // UTF-8 BOM for Excel Spanish accent compatibility
  return `\uFEFF${lines.join('\r\n')}`
}

export function buildMemEvaluationCsv(
  rows: readonly MemAnnualEvaluationRow[],
  options: { moneda: Moneda; cliente?: string; vista?: 'bruto' | 'neto' },
): string {
  const lines: string[] = []
  const curr = options.moneda
  if (options.cliente) {
    lines.push(`${neutralizeCsvStringCell('Cliente')},${neutralizeCsvStringCell(options.cliente)}`)
  }
  lines.push(`${neutralizeCsvStringCell('Moneda')},${neutralizeCsvStringCell(curr)}`)
  if (options.vista) {
    lines.push(`${neutralizeCsvStringCell('Vista')},${neutralizeCsvStringCell(options.vista === 'neto' ? 'Neto Financiado' : 'Bruto / Contado')}`)
  }
  lines.push('')

  const headers = [
    'Año',
    'Activo',
    'Índice energía (PML)',
    'Índice potencia (MBP)',
    'Índice OPEX',
    'Factor deg. FV',
    'Factor deg. BESS',
    'Factor deg. combinado',
    `Ahorro energía (${curr})`,
    `Ahorro potencia (${curr})`,
    `Total ahorros (${curr})`,
    `CAPEX (${curr})`,
    `OPEX (${curr})`,
    `Servicio de deuda (${curr})`,
    `Flujo neto (${curr})`,
    `Flujo acumulado (${curr})`,
    'Factor descuento',
    `Flujo descontado (${curr})`,
    `Flujo descontado acumulado (${curr})`,
  ]
  lines.push(headers.map(neutralizeCsvStringCell).join(','))

  for (const r of rows) {
    lines.push(
      [
        formatCsvNumericCell(r.anio, 0),
        formatCsvNumericCell(r.activo, 0),
        formatCsvNumericCell(r.idx_energia, 4),
        formatCsvNumericCell(r.idx_potencia, 4),
        formatCsvNumericCell(r.idx_opex, 4),
        formatCsvNumericCell(r.factor_deg_fv, 4),
        formatCsvNumericCell(r.factor_deg_bess, 4),
        formatCsvNumericCell(r.factor_deg_combinado, 4),
        formatCsvNumericCell(r.ahorro_energia, 2),
        formatCsvNumericCell(r.ahorro_potencia, 2),
        formatCsvNumericCell(r.total_ahorros, 2),
        formatCsvNumericCell(r.capex, 2),
        formatCsvNumericCell(r.opex, 2),
        formatCsvNumericCell(r.cuota_financiamiento, 2),
        formatCsvNumericCell(r.flujo_neto, 2),
        formatCsvNumericCell(r.flujo_acumulado, 2),
        formatCsvNumericCell(r.factor_descuento, 6),
        formatCsvNumericCell(r.flujo_descontado, 2),
        formatCsvNumericCell(r.flujo_descontado_acumulado, 2),
      ].join(','),
    )
  }

  return `\uFEFF${lines.join('\r\n')}`
}

export function buildMemSensitivityCsv(
  cases: readonly MemSensitivityCaseResult[],
  currentInputCase: MemSensitivityCaseResult,
  options: { moneda: Moneda; cliente?: string },
): string {
  const curr = options.moneda
  const lines: string[] = []
  if (options.cliente) {
    lines.push(`${neutralizeCsvStringCell('Cliente')},${neutralizeCsvStringCell(options.cliente)}`)
    lines.push('')
  }
  const headers = [
    'Caso',
    'Potencia (MW)',
    'Capacidad (MWh)',
    `Ahorro energía Año 1 (${curr})`,
    `Ahorro potencia Año 1 (${curr})`,
    `Ahorro total Año 1 (${curr})`,
    'Reducción RAP (MW)',
    'Ciclos por año',
    `CAPEX (${curr})`,
    `OPEX Año 1 (${curr})`,
    `VPN (${curr})`,
    'TIR (%)',
    'Recuperación simple (años)',
    'Recuperación descontada (años)',
  ]
  lines.push(headers.map(neutralizeCsvStringCell).join(','))

  const all = [currentInputCase, ...cases]
  for (const c of all) {
    lines.push(
      [
        neutralizeCsvStringCell(String(c.caso)),
        formatCsvNumericCell(c.bess_potencia_mw, 2),
        formatCsvNumericCell(c.bess_capacidad_mwh, 2),
        formatCsvNumericCell(c.ahorro_energia_y1, 2),
        formatCsvNumericCell(c.ahorro_potencia_y1, 2),
        formatCsvNumericCell(c.ahorro_total_y1, 2),
        formatCsvNumericCell(c.rap_reduccion_mw, 3),
        formatCsvNumericCell(c.ciclos_anio, 2),
        formatCsvNumericCell(c.capex, 2),
        formatCsvNumericCell(c.opex_y1, 2),
        formatCsvNumericCell(c.vpn, 2),
        c.tir_pct !== null ? formatCsvNumericCell(c.tir_pct, 2) : 'n/a',
        c.payback_simple_anios !== null ? formatCsvNumericCell(c.payback_simple_anios, 2) : '> horizonte',
        c.payback_descontado_anios !== null ? formatCsvNumericCell(c.payback_descontado_anios, 2) : '> horizonte',
      ].join(','),
    )
  }

  return `\uFEFF${lines.join('\r\n')}`
}

export function buildMemResultsCsv(year1: MemYear1Results, cliente?: string): string {
  const lines: string[] = []
  if (cliente) {
    lines.push(`${neutralizeCsvStringCell('Cliente')},${neutralizeCsvStringCell(cliente)}`)
    lines.push('')
  }
  lines.push(['Sección', 'Indicador', 'Valor', 'Unidad', 'Nombre Excel'].map(neutralizeCsvStringCell).join(','))
  const rows: Array<[string, string, number, string, string]> = [
    ['Balance energía', 'Consumo real (sin proyecto)', year1.res_consumo_mwh, 'MWh', 'Res_Consumo'],
    ['Balance energía', 'Generación FV', year1.res_gen_fv_mwh, 'MWh', 'Res_GenFV'],
    ['Balance energía', 'FV autoconsumida directamente', year1.res_fv_auto_mwh, 'MWh', 'Res_FVAuto'],
    ['Balance energía', 'Excedente FV cargado a BESS', year1.res_fv_a_bess_mwh, 'MWh', 'Res_FVaBESS'],
    ['Balance energía', 'Excedente FV no aprovechado', year1.res_fv_perdida_mwh, 'MWh', 'Res_FVPerdida'],
    ['Balance energía', 'Carga BESS desde red', year1.res_carga_red_mwh, 'MWh', 'Res_CargaRed'],
    ['Balance energía', 'Descarga BESS', year1.res_descarga_mwh, 'MWh', 'Res_Descarga'],
    ['Balance energía', 'Ciclos equivalentes BESS', year1.res_ciclos, 'ciclos/año', 'Res_Ciclos'],
    ['Balance energía', 'Consumo de red con proyecto', year1.res_consumo_red_mwh, 'MWh', 'Res_ConsumoRed'],
    ['Energía', 'Costo energía sin proyecto', year1.res_costo_e_base_mxn, 'MXN/año', 'Res_CostoE_Base'],
    ['Energía', 'Costo energía con proyecto', year1.res_costo_e_proy_mxn, 'MXN/año', 'Res_CostoE_Proy'],
    ['Energía', 'Ahorro de energía', year1.ahorro_e_total_mxn, 'MXN/año', 'Ahorro_E_Total'],
    ['Potencia 100HC', 'RAP sin FV ni BESS (ajustada)', year1.res_rap_base_mw, 'MW', 'Res_RAP_Base'],
    ['Potencia 100HC', 'RAP con FV + BESS (ajustada)', year1.res_rap_proy_mw, 'MW', 'Res_RAP_Proy'],
    ['Potencia 100HC', 'Reducción de RAP', year1.res_rap_reduccion_mw, 'MW', 'Res_RAP_Reduccion'],
    ['Potencia 100HC', 'Costo potencia sin proyecto', year1.res_costo_c_base_mxn, 'MXN/año', 'Res_CostoC_Base'],
    ['Potencia 100HC', 'Costo potencia con proyecto', year1.res_costo_c_proy_mxn, 'MXN/año', 'Res_CostoC_Proy'],
    ['Potencia 100HC', 'Ahorro de potencia', year1.ahorro_c_total_mxn, 'MXN/año', 'Ahorro_C_Total'],
    ['Resumen Año 1', 'Ahorro total', year1.ahorro_total_mxn, 'MXN/año', 'Ahorro_Total'],
    ['Resumen Año 1', 'Participación energía', year1.res_pct_energia * 100, '%', 'Res_PctEnergia'],
    ['Resumen Año 1', 'Participación potencia', year1.res_pct_capacidad * 100, '%', 'Res_PctCapacidad'],
    ['Resumen Año 1', 'Reducción del costo eléctrico', year1.res_pct_reduccion * 100, '%', 'Res_PctReduccion'],
  ]
  for (const [sec, ind, val, unit, name] of rows) {
    lines.push(
      [
        neutralizeCsvStringCell(sec),
        neutralizeCsvStringCell(ind),
        formatCsvNumericCell(val, 4),
        neutralizeCsvStringCell(unit),
        neutralizeCsvStringCell(name),
      ].join(','),
    )
  }
  return `\uFEFF${lines.join('\r\n')}`
}

/**
 * Shared client-side CSV file download trigger (with UTF-8 BOM from builders).
 */
export function downloadCsvContent(csv: string, fileName: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
