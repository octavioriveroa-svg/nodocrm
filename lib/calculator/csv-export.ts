import type { GranularidadProyeccion, Moneda, PeriodoAgregadoSimulacion } from '@/lib/types'

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
