import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import ExcelJS from 'exceljs'
import type {
  ExcelCandidateInputCell,
  ExcelDefinedName,
  ExcelDetectedFormulaCell,
  ExcelMappingSuggestion,
  ExcelOutputMappingSuggestion,
  ExcelParseResult,
  ExcelSheetMetadata,
  FormulaDefinicion,
  MemAnnualAssumptions,
  MemCriticalHourEntry,
  MemSimulatorInputs,
  MemWorkbookImportPreview,
} from '@/lib/types'
import {
  extractFormulaCellRefs,
  normalizeCellRef,
  previewFormulaRewrite,
} from '@/lib/calculator/formula-engine'
import {
  MEM_INPUT_DEFINED_NAME_MAP,
  MEM_OUTPUT_DEFINED_NAME_MAP,
  MEM_PLATFORM_VARIABLES,
  PLATFORM_OUTPUT_DEFINITIONS,
  PLATFORM_VARIABLES,
} from '@/lib/calculator/variable-dictionary'
import {
  createDefaultMemAnnualAssumptions,
  DEFAULT_MEM_INPUTS,
} from '@/lib/calculator/datasets/mem-baseline'
import {
  MAX_CSV_ROWS,
  MAX_WORKSHEETS,
  MAX_XLSX_POPULATED_CELLS,
} from '@/lib/calculator/zip-preflight'

export class ExcelParseLimitError extends Error {
  readonly status: 422

  constructor(message: string) {
    super(message)
    this.name = 'ExcelParseLimitError'
    this.status = 422
  }
}

function stripAccentsLower(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s%/_&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalizes non-primitive ExcelJS cell.value objects into primitive string | number | null
 * and extracts formula strings when present.
 */
export function normalizeExcelJsCellValue(value: ExcelJS.CellValue): {
  formula: string | null
  primitive: number | string | null
} {
  if (value === null || value === undefined) {
    return { formula: null, primitive: null }
  }
  if (typeof value === 'number') {
    return { formula: null, primitive: Number.isFinite(value) ? value : null }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return { formula: null, primitive: trimmed === '' ? null : trimmed }
  }
  if (typeof value === 'boolean') {
    return { formula: null, primitive: value ? 1 : 0 }
  }
  if (value instanceof Date) {
    return { formula: null, primitive: value.toISOString().split('T')[0] }
  }

  if (typeof value === 'object') {
    // RichText: { richText: [{ text }] }
    if ('richText' in value && Array.isArray(value.richText)) {
      const joined = value.richText.map((part) => part.text ?? '').join('').trim()
      return { formula: null, primitive: joined || null }
    }
    // Hyperlink: { text, hyperlink }
    if ('hyperlink' in value && 'text' in value) {
      const textVal = value.text
      if (typeof textVal === 'string') {
        return { formula: null, primitive: textVal.trim() || null }
      }
      return { formula: null, primitive: null }
    }
    // Error value: { error: '#DIV/0!' }
    if ('error' in value && typeof value.error === 'string') {
      return { formula: null, primitive: value.error }
    }
    // Formula or SharedFormula: { formula?, sharedFormula?, result? }
    if ('formula' in value || 'sharedFormula' in value) {
      const formulaRaw =
        'formula' in value && typeof value.formula === 'string' && value.formula.trim()
          ? value.formula.trim()
          : null
      const rawRes = 'result' in value ? value.result : null
      let primitive: number | string | null = null
      if (typeof rawRes === 'number' && Number.isFinite(rawRes)) {
        primitive = rawRes
      } else if (typeof rawRes === 'string') {
        primitive = rawRes.trim() || null
      } else if (typeof rawRes === 'boolean') {
        primitive = rawRes ? 1 : 0
      } else if (rawRes instanceof Date) {
        primitive = rawRes.toISOString().split('T')[0]
      } else if (rawRes && typeof rawRes === 'object' && 'error' in rawRes) {
        primitive = String((rawRes as { error: unknown }).error)
      }
      return {
        formula: formulaRaw ? (formulaRaw.startsWith('=') ? formulaRaw : `=${formulaRaw}`) : null,
        primitive,
      }
    }
  }

  return { formula: null, primitive: null }
}

/**
 * Heuristic fuzzy matcher mapping a cell label (Spanish or English) to a canonical platform variable key.
 */
export function suggestPlatformVariable(
  label: string,
  sampleValue?: number | string | null,
  options?: { definedName?: string | null; preferMem?: boolean },
): { suggestedVar: string | null; confidence: number } {
  if (options?.definedName) {
    const byDn = MEM_INPUT_DEFINED_NAME_MAP.get(options.definedName.trim().toLowerCase())
    if (byDn) {
      return { suggestedVar: byDn.key, confidence: 1.0 }
    }
  }

  const norm = stripAccentsLower(label)
  if (!norm) return { suggestedVar: null, confidence: 0 }

  let bestKey: string | null = null
  let bestScore = 0

  const scoreAgainstList = (
    list: readonly { key: string; excelAliases: readonly string[] }[],
    allowMemHeuristics: boolean,
  ) => {
    for (const variable of list) {
      const keyNorm = variable.key.replace(/_/g, ' ')
      if (norm === variable.key || norm === keyNorm) {
        bestKey = variable.key
        bestScore = 1.0
        return
      }

      for (const alias of variable.excelAliases) {
        const aliasNorm = stripAccentsLower(alias)
        if (!aliasNorm) continue

        let score = 0
        if (norm === aliasNorm) {
          score = 0.96
        } else if (norm.includes(aliasNorm)) {
          score = 0.72 + Math.min(0.22, aliasNorm.length / Math.max(norm.length, aliasNorm.length) * 0.22)
        } else {
          const labelTokens = norm.split(' ').filter((t) => t.length >= 2)
          const aliasTokens = aliasNorm.split(' ').filter((t) => t.length >= 2)
          if (labelTokens.length > 0 && aliasTokens.length > 0) {
            let hits = 0
            for (const at of aliasTokens) {
              if (labelTokens.some((lt) => lt === at || (at.length >= 4 && lt.startsWith(at)))) {
                hits++
              }
            }
            const coverage = hits / aliasTokens.length
            if (coverage >= 0.75) {
              score = 0.55 + coverage * 0.2
            }
          }
        }

        if (score > 0 && typeof sampleValue === 'number') {
          if (
            (variable.key.includes('pct') ||
              variable.key.includes('degradacion') ||
              variable.key.includes('escalacion') ||
              variable.key.includes('inflacion') ||
              variable.key.includes('tasa_')) &&
            sampleValue >= -0.2 &&
            sampleValue <= 1.0
          ) {
            score = Math.min(0.99, score + 0.04)
          }
          if (!allowMemHeuristics && variable.key === 'capex_total' && sampleValue >= 1000) {
            score = Math.min(0.99, score + 0.04)
          }
        }

        if (score > bestScore) {
          bestScore = score
          bestKey = variable.key
        }
      }
    }
  }

  if (options?.preferMem) {
    scoreAgainstList(MEM_PLATFORM_VARIABLES, true)
    if (bestScore < 0.72) {
      scoreAgainstList(PLATFORM_VARIABLES, false)
    }
  } else {
    scoreAgainstList(PLATFORM_VARIABLES, false)
    if (bestScore < 0.65) {
      scoreAgainstList(MEM_PLATFORM_VARIABLES, true)
    }
  }

  if (bestScore < 0.55) {
    return { suggestedVar: null, confidence: 0 }
  }

  return {
    suggestedVar: bestKey,
    confidence: Math.round(bestScore * 100) / 100,
  }
}

/**
 * Heuristic fuzzy matcher mapping a formula cell label to one of the 7 canonical output keys
 * (and optional MEM output key / Defined Name).
 */
export function suggestOutputFormulaKey(
  label: string,
  options?: { definedName?: string | null },
): {
  suggestedOutputKey: FormulaDefinicion['key'] | null
  suggestedMemOutputKey: string | null
  confidence: number
} {
  if (options?.definedName) {
    const byDn = MEM_OUTPUT_DEFINED_NAME_MAP.get(options.definedName.trim().toLowerCase())
    if (byDn) {
      return {
        suggestedOutputKey: byDn.legacyFormulaBridge ?? null,
        suggestedMemOutputKey: byDn.key,
        confidence: 1.0,
      }
    }
  }

  const norm = stripAccentsLower(label)
  if (!norm) return { suggestedOutputKey: null, suggestedMemOutputKey: null, confidence: 0 }

  let bestKey: FormulaDefinicion['key'] | null = null
  let bestScore = 0

  for (const outDef of PLATFORM_OUTPUT_DEFINITIONS) {
    const keyNorm = outDef.key.replace(/_/g, ' ')
    if (norm === outDef.key || norm === keyNorm) {
      return { suggestedOutputKey: outDef.key, suggestedMemOutputKey: null, confidence: 1.0 }
    }

    for (const alias of outDef.excelAliases) {
      const aliasNorm = stripAccentsLower(alias)
      let score = 0
      if (norm === aliasNorm) {
        score = 0.95
      } else if (norm.includes(aliasNorm)) {
        score = 0.75 + Math.min(0.18, (aliasNorm.length / Math.max(norm.length, aliasNorm.length)) * 0.18)
      }
      if (score > bestScore) {
        bestScore = score
        bestKey = outDef.key
      }
    }
  }

  if (bestScore < 0.6) {
    return { suggestedOutputKey: null, suggestedMemOutputKey: null, confidence: 0 }
  }

  return {
    suggestedOutputKey: bestKey,
    suggestedMemOutputKey: null,
    confidence: Math.round(bestScore * 100) / 100,
  }
}

// Re-export client-safe previewFormulaRewrite from formula-engine for existing server callers and tests.
export { previewFormulaRewrite }

function normalizeDefinedNameSingleRef(raw: string): { sheetName: string; cellRef: string } | null {
  const cleaned = raw.trim().replace(/\$/g, '')
  const bangIdx = cleaned.lastIndexOf('!')
  if (bangIdx < 0) return null
  let sheet = cleaned.slice(0, bangIdx).trim()
  if (sheet.startsWith("'") && sheet.endsWith("'")) {
    sheet = sheet.slice(1, -1).replace(/''/g, "'")
  }
  const cellPart = cleaned.slice(bangIdx + 1).trim()
  if (!cellPart || cellPart.includes(':')) return null
  return { sheetName: sheet, cellRef: normalizeCellRef(cellPart) }
}

function classifySheetRole(name: string):
  | 'input'
  | 'assumptions'
  | 'datos'
  | 'curva_solar'
  | '100hc'
  | 'analisis'
  | 'resultados'
  | 'evaluacion_financiera'
  | 'tablero'
  | 'sensibilidad'
  | 'prompt_html'
  | 'other' {
  const n = stripAccentsLower(name)
  if (n === 'input' || n === 'inputs') return 'input'
  if (n.includes('supuestos anuales')) return 'assumptions'
  if (n === 'datos' || n === 'datos horarios') return 'datos'
  if (n === 'curva solar' || n === 'curvasolar') return 'curva_solar'
  if (n === '100hc' || n === '100 horas criticas') return '100hc'
  if (n === 'analisis') return 'analisis'
  if (n === 'resultados') return 'resultados'
  if (n.includes('evaluacion financiera')) return 'evaluacion_financiera'
  if (n === 'tablero') return 'tablero'
  if (n.includes('sensibilidad')) return 'sensibilidad'
  if (n.includes('prompt html')) return 'prompt_html'
  return 'other'
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const dt = new Date(Date.UTC(year, month - 1, day))
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  )
}

function parseExcelDatePrimitive(primitive: number | string | null): string | null {
  if (typeof primitive === 'string') {
    const trimmed = primitive.trim()
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(trimmed)
    if (isoMatch) {
      const y = Number(isoMatch[1])
      const m = Number(isoMatch[2])
      const d = Number(isoMatch[3])
      return isValidCalendarDate(y, m, d) ? trimmed.slice(0, 10) : null
    }
    const dmy = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/.exec(trimmed)
    if (dmy) {
      const a = Number(dmy[1])
      const b = Number(dmy[2])
      const y = Number(dmy[3])
      // Prefer DD/MM/YYYY (MX standard); accept MM/DD/YYYY when second component > 12
      if (isValidCalendarDate(y, b, a)) {
        return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
      }
      if (b > 12 && isValidCalendarDate(y, a, b)) {
        return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
      }
      return null
    }
    const parsed = Date.parse(trimmed)
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10)
    }
    return null
  }
  if (typeof primitive === 'number' && Number.isFinite(primitive) && primitive > 20000) {
    // Use floor with tiny epsilon so time-of-day fractions (e.g. 45658.5) keep the same calendar date
    const serialDays = Math.floor(primitive + 1e-6)
    const ms = Date.UTC(1899, 11, 30) + serialDays * 86_400_000
    return new Date(ms).toISOString().slice(0, 10)
  }
  return null
}

function readCellNumeric(cell: ExcelJS.Cell): number | null {
  const norm = normalizeExcelJsCellValue(cell.value)
  if (typeof norm.primitive === 'number' && Number.isFinite(norm.primitive)) {
    return norm.primitive
  }
  if (typeof norm.primitive === 'string' && norm.primitive.trim() !== '') {
    const n = Number(norm.primitive.replace(/,/g, '').trim())
    if (Number.isFinite(n)) return n
  }
  return null
}

function splitSheetAndCell(ref: string, defaultSheet: string): { sheetName: string; cellRef: string } {
  const norm = normalizeCellRef(ref)
  const bangIdx = norm.lastIndexOf('!')
  if (bangIdx >= 0) {
    return {
      sheetName: norm.slice(0, bangIdx),
      cellRef: norm.slice(bangIdx + 1),
    }
  }
  return { sheetName: defaultSheet, cellRef: norm }
}

function findHeaderCol(
  headers: Map<string, number>,
  exactCandidates: readonly string[],
  prefixOrSubstrCandidates: readonly string[],
  excludeCol?: number,
): number | null {
  for (const exact of exactCandidates) {
    const hit = headers.get(exact)
    if (hit !== undefined && hit !== excludeCol) return hit
  }
  for (const [k, idx] of headers) {
    if (idx === excludeCol) continue
    if (prefixOrSubstrCandidates.some((cand) => k.startsWith(cand) || k.includes(cand))) {
      return idx
    }
  }
  return null
}

function matchesSolarUnit(hdr: string, unit: 'w' | 'kw' | 'mw'): boolean {
  return new RegExp(`(^|[^a-z])${unit}([^a-z]|$)`).test(hdr)
}

/**
 * Parses an `.xlsx` or `.csv` Buffer using ExcelJS (strictly preview-only, zero DB writes),
 * enforcing workbook/cell/row caps and extracting:
 * - Sheet metadata & defined names (Map-backed)
 * - Formula cells with AST-parsed dependencies
 * - Both labeled constant candidate inputs AND all cells referenced by any formula (e.g. A10)
 * - Auto-suggested input & output mappings
 */
export async function parseWorkbookWithExcelJs(
  buffer: Buffer,
  fileName: string,
  extension: 'xlsx' | 'csv',
): Promise<ExcelParseResult> {
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex')
  const workbook = new ExcelJS.Workbook()

  if (extension === 'xlsx') {
    // ExcelJS expects Node Buffer or ArrayBuffer
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
  } else {
    const headText = buffer.subarray(0, 4096).toString('utf8')
    const firstNonEmptyLine =
      headText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 0) ?? ''
    const delimiter =
      firstNonEmptyLine.includes(';') && !firstNonEmptyLine.includes(',')
        ? ';'
        : undefined
    const stream = Readable.from(buffer)
    await workbook.csv.read(
      stream,
      delimiter ? { parserOptions: { delimiter } } : undefined,
    )
  }

  if (workbook.worksheets.length === 0) {
    throw new ExcelParseLimitError('El archivo no contiene ninguna hoja de cálculo legible.')
  }
  if (workbook.worksheets.length > MAX_WORKSHEETS) {
    throw new ExcelParseLimitError(
      `El libro supera el máximo de ${MAX_WORKSHEETS} hojas permitidas (${workbook.worksheets.length}).`,
    )
  }

  // Extract defined names (prototype-safe)
  const definedNames: ExcelDefinedName[] = []
  const cellRefToDefinedName = new Map<string, string>()
  let memDefinedNameHits = 0
  try {
    const model = workbook.definedNames?.model
    if (Array.isArray(model)) {
      for (const entry of model) {
        if (entry && typeof entry.name === 'string' && Array.isArray(entry.ranges)) {
          if (entry.name.startsWith('_xlnm.')) continue
          const ranges = entry.ranges.map((r) => normalizeCellRef(String(r)))
          definedNames.push({ name: entry.name, ranges })
          if (
            MEM_INPUT_DEFINED_NAME_MAP.has(entry.name.toLowerCase()) ||
            MEM_OUTPUT_DEFINED_NAME_MAP.has(entry.name.toLowerCase())
          ) {
            memDefinedNameHits++
          }
          if (ranges.length === 1) {
            const parsed = normalizeDefinedNameSingleRef(String(entry.ranges[0]))
            if (parsed) {
              cellRefToDefinedName.set(`${parsed.sheetName}!${parsed.cellRef}`, entry.name)
            }
          }
        }
      }
    }
  } catch {
    // Ignore malformed definedNames metadata
  }

  const sheetRoles = new Map<string, ReturnType<typeof classifySheetRole>>()
  let memRoleCount = 0
  for (const ws of workbook.worksheets) {
    const role = classifySheetRole(ws.name)
    sheetRoles.set(ws.name, role)
    if (role !== 'other') memRoleCount++
  }

  // Also inspect single-sheet CSV/XLSX sheet names & header signatures for standalone time-series uploads
  let standaloneSeriesRole: 'datos' | 'curva_solar' | '100hc' | null = null
  if (workbook.worksheets.length === 1) {
    const ws0 = workbook.worksheets[0]
    const ws0Role = sheetRoles.get(ws0.name)
    if (ws0Role === 'datos' || ws0Role === 'curva_solar' || ws0Role === '100hc') {
      standaloneSeriesRole = ws0Role
    } else if (ws0Role === 'other') {
      const hdrTokens: string[] = []
      for (let c = 1; c <= Math.min(12, ws0.columnCount); c++) {
        const prim = normalizeExcelJsCellValue(ws0.getCell(1, c).value).primitive
        if (typeof prim === 'string') hdrTokens.push(stripAccentsLower(prim))
      }
      const hdrJoined = hdrTokens.join(' ')
      const hasSolarUnit = hdrTokens.some(
        (t) =>
          matchesSolarUnit(t, 'mw') ||
          matchesSolarUnit(t, 'kw') ||
          matchesSolarUnit(t, 'w'),
      )
      const hasFechaHora =
        hdrTokens.some((t) => t.startsWith('fecha') || t.includes('fecha') || t === 'date') &&
        hdrTokens.some((t) => t.startsWith('hora') || t.includes('hora') || t === 'hour')
      if (
        hdrJoined.includes('pml') &&
        (hdrJoined.includes('consumo') || hdrJoined.includes('demanda'))
      ) {
        standaloneSeriesRole = 'datos'
      } else if (
        hdrJoined.includes('curva') ||
        hdrJoined.includes('solar') ||
        hdrJoined.includes('irradiancia') ||
        ((hdrJoined.includes('generacion') || hasSolarUnit) &&
          (ws0.rowCount > 250 || hasFechaHora))
      ) {
        standaloneSeriesRole = 'curva_solar'
      } else if (
        (hasFechaHora && ws0.rowCount <= 250) ||
        hdrJoined.includes('100hc') ||
        hdrJoined.includes('horas criticas')
      ) {
        standaloneSeriesRole = '100hc'
      }
    }
  }

  const isMemWorkbook =
    memRoleCount >= 2 || memDefinedNameHits >= 5 || standaloneSeriesRole !== null

  const sheets: ExcelSheetMetadata[] = []
  const formulaCells: ExcelDetectedFormulaCell[] = []
  const candidateMap = new Map<string, ExcelCandidateInputCell>()
  const sheetCellTextMap = new Map<string, Map<string, string>>()
  const sheetCellValueMap = new Map<
    string,
    Map<string, { primitive: number | string | null; isFormula: boolean }>
  >()

  let totalPopulatedCells = 0

  // Mem preview accumulators
  const extractedInputs: Partial<MemSimulatorInputs> = {}
  let extractedAssumptions: MemAnnualAssumptions | null = null
  const datosFechas: string[] = []
  const datosHoras: number[] = []
  const datosConsumo: number[] = []
  const datosPml: number[] = []
  let skippedDatosRows = 0
  const solarFechas: string[] = []
  const solarHoras: number[] = []
  const solarMw: number[] = []
  let solarNonZeroCount = 0
  let skippedSolarRows = 0
  const criticalHours100HC: MemCriticalHourEntry[] = []
  let invalid100HcRows = 0
  const cachedExcelKpis: Record<string, number | string | null> = {}

  for (const ws of workbook.worksheets) {
    if (extension === 'csv' && ws.rowCount > MAX_CSV_ROWS) {
      throw new ExcelParseLimitError(
        `El archivo .csv excede el límite máximo de ${MAX_CSV_ROWS.toLocaleString('es-MX')} filas.`,
      )
    }

    sheets.push({
      name: ws.name,
      rowCount: ws.rowCount,
      colCount: ws.columnCount,
    })

    const role = standaloneSeriesRole && ws === workbook.worksheets[0]
      ? standaloneSeriesRole
      : (sheetRoles.get(ws.name) ?? 'other')

    const isBulkSheet =
      role === 'datos' ||
      role === 'curva_solar' ||
      role === 'analisis' ||
      role === 'prompt_html' ||
      role === 'sensibilidad' ||
      role === 'tablero'

    const textMap = new Map<string, string>()
    const valMap = new Map<string, { primitive: number | string | null; isFormula: boolean }>()
    if (!isBulkSheet) {
      sheetCellTextMap.set(ws.name, textMap)
      sheetCellValueMap.set(ws.name, valMap)
    }

    // Pass 1: count EVERY populated cell across ALL sheets toward MAX_XLSX_POPULATED_CELLS;
    // collect cell maps on non-bulk sheets (and row <= 2 on analisis).
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        totalPopulatedCells++
        if (extension === 'xlsx' && totalPopulatedCells > MAX_XLSX_POPULATED_CELLS) {
          throw new ExcelParseLimitError(
            `El archivo .xlsx supera el límite máximo de ${MAX_XLSX_POPULATED_CELLS.toLocaleString('es-MX')} celdas con contenido.`,
          )
        }

        if (!isBulkSheet || (role === 'analisis' && rowNumber <= 2)) {
          const addr = normalizeCellRef(cell.address)
          const normalized = normalizeExcelJsCellValue(cell.value)
          const isFormula = normalized.formula !== null
          valMap.set(addr, { primitive: normalized.primitive, isFormula })
          if (!isFormula && typeof normalized.primitive === 'string') {
            textMap.set(addr, normalized.primitive)
          }
        }
      })
    })

    // Structured extraction for MEM sheets
    if (role === 'datos') {
      const headers = new Map<string, number>()
      for (let c = 1; c <= Math.min(10, ws.columnCount); c++) {
        const h = normalizeExcelJsCellValue(ws.getCell(1, c).value).primitive
        if (typeof h === 'string') headers.set(stripAccentsLower(h), c)
      }
      const colFecha = findHeaderCol(headers, ['fecha'], ['fecha', 'date']) ?? 1
      const colHora = findHeaderCol(headers, ['hora'], ['hora', 'hour'], colFecha) ?? (colFecha === 2 ? 1 : 2)
      let colConsumo = 3
      let colPml = 4
      for (const [k, idx] of headers) {
        if (k.includes('consumo') || k.includes('demanda')) colConsumo = idx
        if (k.includes('pml')) colPml = idx
      }

      const maxRow = Math.min(ws.rowCount, 9000)
      for (let r = 2; r <= maxRow; r++) {
        if (datosConsumo.length >= 9000) break
        const rawFecha = normalizeExcelJsCellValue(ws.getCell(r, colFecha).value).primitive
        const fecha = parseExcelDatePrimitive(rawFecha)
        const hora = readCellNumeric(ws.getCell(r, colHora))
        const consumo = readCellNumeric(ws.getCell(r, colConsumo))
        const pml = readCellNumeric(ws.getCell(r, colPml))
        const horaRounded = hora !== null ? Math.round(hora) : null
        if (
          fecha &&
          horaRounded !== null &&
          horaRounded >= 1 &&
          horaRounded <= 24 &&
          consumo !== null &&
          pml !== null
        ) {
          datosFechas.push(fecha)
          datosHoras.push(horaRounded)
          datosConsumo.push(Math.max(0, consumo))
          datosPml.push(pml)
        } else if (
          rawFecha !== null ||
          hora !== null ||
          consumo !== null ||
          pml !== null
        ) {
          skippedDatosRows++
        }
      }
    } else if (role === 'curva_solar') {
      const headers = new Map<string, number>()
      for (let c = 1; c <= Math.min(10, ws.columnCount); c++) {
        const h = normalizeExcelJsCellValue(ws.getCell(1, c).value).primitive
        if (typeof h === 'string') headers.set(stripAccentsLower(h), c)
      }
      const colFecha = findHeaderCol(headers, ['fecha'], ['fecha', 'date']) ?? 1
      const colHora = findHeaderCol(headers, ['hora'], ['hora', 'hour'], colFecha) ?? (colFecha === 2 ? 1 : 2)
      let colW: number | null = null
      let colKw: number | null = null
      let colMw: number | null = null
      for (const [k, idx] of headers) {
        if (matchesSolarUnit(k, 'mw')) colMw = idx
        else if (matchesSolarUnit(k, 'kw')) colKw = idx
        else if (matchesSolarUnit(k, 'w')) colW = idx
      }
      if (colW === null && colKw === null && colMw === null) {
        if (ws.columnCount <= 3) {
          colMw = 3
        } else {
          colW = 3
          colKw = 4
          colMw = 5
        }
      }

      const readSolarCol = (colIdx: number | null): { num: number | null; badString: boolean } => {
        if (colIdx === null) return { num: null, badString: false }
        const cell = ws.getCell(rCurvaRow, colIdx)
        const num = readCellNumeric(cell)
        if (num !== null) return { num, badString: false }
        const norm = normalizeExcelJsCellValue(cell.value)
        return {
          num: null,
          badString: typeof norm.primitive === 'string' && norm.primitive.trim().length > 0,
        }
      }

      const maxRow = Math.min(ws.rowCount, 9000)
      let rCurvaRow = 2
      for (; rCurvaRow <= maxRow; rCurvaRow++) {
        if (solarMw.length >= 9000) break
        const rawFecha = normalizeExcelJsCellValue(ws.getCell(rCurvaRow, colFecha).value).primitive
        const fecha = parseExcelDatePrimitive(rawFecha)
        const hora = readCellNumeric(ws.getCell(rCurvaRow, colHora))
        const horaRounded = hora !== null ? Math.round(hora) : null

        const mwRes = readSolarCol(colMw)
        const kwRes = mwRes.num === null ? readSolarCol(colKw) : { num: null, badString: false }
        const wRes =
          mwRes.num === null && kwRes.num === null
            ? readSolarCol(colW)
            : { num: null, badString: false }

        let valMw: number | null = mwRes.num
        if (valMw === null && kwRes.num !== null) {
          valMw = kwRes.num / 1000
        }
        if (valMw === null && wRes.num !== null) {
          valMw = wRes.num / 1_000_000
        }
        const hasBadSolarText = valMw === null && (mwRes.badString || kwRes.badString || wRes.badString)

        if (!fecha && hora === null && valMw === null && !hasBadSolarText) continue
        if (!fecha || horaRounded === null || horaRounded < 1 || horaRounded > 24 || hasBadSolarText) {
          skippedSolarRows++
          continue
        }

        const safeMw = valMw !== null && Number.isFinite(valMw) && valMw > 0 ? valMw : 0
        if (safeMw > 0) solarNonZeroCount++
        solarFechas.push(fecha)
        solarHoras.push(horaRounded)
        solarMw.push(safeMw)
      }
    } else if (role === '100hc') {
      const headers = new Map<string, number>()
      for (let c = 1; c <= Math.min(10, ws.columnCount); c++) {
        const h = normalizeExcelJsCellValue(ws.getCell(1, c).value).primitive
        if (typeof h === 'string') headers.set(stripAccentsLower(h), c)
      }
      const colFecha =
        findHeaderCol(headers, ['fecha'], ['fecha', 'date']) ?? (ws.columnCount >= 3 ? 2 : 1)
      const colHora =
        findHeaderCol(headers, ['hora'], ['hora', 'hour'], colFecha) ??
        (ws.columnCount >= 3 ? (colFecha === 3 ? 2 : 3) : colFecha === 2 ? 1 : 2)
      for (let r = 2; r <= Math.min(ws.rowCount, 200); r++) {
        if (criticalHours100HC.length >= 100) break
        const rawFecha = normalizeExcelJsCellValue(ws.getCell(r, colFecha).value).primitive
        const fecha = parseExcelDatePrimitive(rawFecha)
        const hora = readCellNumeric(ws.getCell(r, colHora))
        const horaRounded = hora !== null ? Math.round(hora) : null
        if (fecha && horaRounded !== null && horaRounded >= 1 && horaRounded <= 24) {
          criticalHours100HC.push({
            no: criticalHours100HC.length + 1,
            fecha,
            hora: horaRounded,
          })
        } else if (rawFecha !== null || hora !== null) {
          invalid100HcRows++
        }
      }
    } else if (role === 'assumptions') {
      const assumptions = createDefaultMemAnnualAssumptions()
      const yearColMap = new Map<number, number>()
      for (let r = 1; r <= Math.min(6, ws.rowCount); r++) {
        for (let c = 1; c <= Math.min(35, ws.columnCount); c++) {
          const num = readCellNumeric(ws.getCell(r, c))
          if (num !== null && Number.isInteger(num) && num >= 1 && num <= 25) {
            yearColMap.set(num, c)
          }
        }
        if (yearColMap.size >= 10) break
      }

      if (yearColMap.size >= 10) {
        let section: 'mbp' | 'pml' | 'bess' | null = null
        let pctMbpRow: number | null = null
        let fijoMbpRow: number | null = null
        let pctPmlRow: number | null = null
        let degBessRow: number | null = null

        for (let r = 1; r <= Math.min(30, ws.rowCount); r++) {
          const labelA = normalizeExcelJsCellValue(ws.getCell(r, 1).value).primitive
          const labelB = normalizeExcelJsCellValue(ws.getCell(r, 2).value).primitive
          const text = stripAccentsLower(
            [labelA, labelB].filter((x) => typeof x === 'string').join(' '),
          )
          if (!text) continue
          if (text.includes('precio de potencia') || text.includes('mbp')) section = 'mbp'
          else if (text.includes('precio de energia') || text.includes('pml')) section = 'pml'
          else if (text.includes('degradacion bess')) section = 'bess'

          if (text.includes('valor fijo') && section === 'mbp') {
            fijoMbpRow = r
          } else if (text.includes('captura')) {
            if (section === 'mbp' && pctMbpRow === null) pctMbpRow = r
            else if (section === 'pml' && pctPmlRow === null) pctPmlRow = r
            else if (section === 'bess' && degBessRow === null) degBessRow = r
          }
        }

        for (let y = 1; y <= 25; y++) {
          const col = yearColMap.get(y)
          if (!col) continue
          const idx = y - 1
          if (pctMbpRow !== null && y >= 2) {
            const v = readCellNumeric(ws.getCell(pctMbpRow, col))
            if (v !== null) assumptions.pct_mbp[idx] = v
          }
          if (fijoMbpRow !== null) {
            const v = readCellNumeric(ws.getCell(fijoMbpRow, col))
            assumptions.fijo_mbp[idx] = v
          }
          if (pctPmlRow !== null && y >= 2) {
            const v = readCellNumeric(ws.getCell(pctPmlRow, col))
            if (v !== null) assumptions.pct_pml[idx] = v
          }
          if (degBessRow !== null && y >= 2) {
            const v = readCellNumeric(ws.getCell(degBessRow, col))
            if (v !== null) assumptions.deg_bess[idx] = v
          }
        }
        extractedAssumptions = assumptions
      }
    }

    if (isBulkSheet) continue

    const findAdjacentLabel = (wsName: string, rowNum: number, colNum: number): string => {
      const labels = sheetCellTextMap.get(wsName)
      if (!labels) return ''
      const candidates: Array<[number, number]> = [
        [rowNum, colNum - 1],
        [rowNum, colNum - 2],
        [rowNum - 1, colNum],
        [1, colNum],
      ]
      for (const [r, c] of candidates) {
        if (r < 1 || c < 1) continue
        const ref = normalizeCellRef(ws.getCell(r, c).address)
        const txt = labels.get(ref)
        if (txt) return txt
      }
      return ''
    }

    // Pass 2: collect formula cells and candidate inputs on non-bulk sheets
    // (skip rows > 2 on 100HC so we don't emit 100 identical row formulas)
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (role === '100hc' && rowNumber > 2) return

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const addr = normalizeCellRef(cell.address)
        const mapKey = `${ws.name}!${addr}`
        const definedName = cellRefToDefinedName.get(mapKey) ?? null
        const normalized = normalizeExcelJsCellValue(cell.value)
        const label = findAdjacentLabel(ws.name, rowNumber, colNumber)

        // Capture MEM inputs & cached KPIs if Defined Name matches
        if (definedName) {
          const dnLower = definedName.toLowerCase()
          const memInputDef = MEM_INPUT_DEFINED_NAME_MAP.get(dnLower)
          if (memInputDef && memInputDef.overridable && normalized.primitive !== null) {
            if (memInputDef.key === 'cliente') {
              extractedInputs.cliente = String(normalized.primitive)
            } else if (memInputDef.key === 'tc_fecha') {
              const iso = parseExcelDatePrimitive(normalized.primitive)
              if (iso) extractedInputs.tc_fecha = iso
            } else if (typeof normalized.primitive === 'number') {
              ;(extractedInputs as Record<string, unknown>)[memInputDef.key] = normalized.primitive
            }
          }
          const memOutDef = MEM_OUTPUT_DEFINED_NAME_MAP.get(dnLower)
          if (memOutDef) {
            cachedExcelKpis[memOutDef.excelDefinedName] = normalized.primitive
          }
        }

        if (normalized.formula) {
          let deps: string[] = []
          try {
            deps = extractFormulaCellRefs(normalized.formula)
          } catch {
            deps = []
          }
          formulaCells.push({
            cellRef: addr,
            sheetName: ws.name,
            label: label || definedName || `Fórmula ${addr}`,
            rawFormula: normalized.formula,
            cachedResult: normalized.primitive,
            dependencies: deps,
          })
        } else {
          const isNamedMemInput =
            definedName !== null && MEM_INPUT_DEFINED_NAME_MAP.has(definedName.toLowerCase())
          if ((typeof normalized.primitive === 'number' && label) || isNamedMemInput) {
            if (!candidateMap.has(mapKey)) {
              candidateMap.set(mapKey, {
                cellRef: addr,
                sheetName: ws.name,
                label: label || definedName || addr,
                sampleValue: normalized.primitive,
                isFormulaDerived: false,
                referencedBy: [],
              })
            }
          }
        }
      })
    })
  }

  // Fallback label scan on Input sheet for MEM inputs even if Defined Names are absent
  if (isMemWorkbook) {
    const inputSheet = workbook.worksheets.find((ws) => sheetRoles.get(ws.name) === 'input')
    if (inputSheet) {
      for (const memVar of MEM_PLATFORM_VARIABLES) {
        if (!memVar.overridable) continue
        if ((extractedInputs as Record<string, unknown>)[memVar.key] !== undefined) continue
        // Look up by candidateInputs on Input sheet
        for (const cand of candidateMap.values()) {
          if (cand.sheetName !== inputSheet.name) continue
          const match = suggestPlatformVariable(cand.label, cand.sampleValue, { preferMem: true })
          if (match.suggestedVar === memVar.key && match.confidence >= 0.85 && cand.sampleValue !== null) {
            if (memVar.key === 'cliente') {
              extractedInputs.cliente = String(cand.sampleValue)
            } else if (memVar.key === 'tc_fecha') {
              const iso = parseExcelDatePrimitive(cand.sampleValue)
              if (iso) extractedInputs.tc_fecha = iso
            } else if (typeof cand.sampleValue === 'number') {
              ;(extractedInputs as Record<string, unknown>)[memVar.key] = cand.sampleValue
            }
            break
          }
        }
      }
    }
  }

  // Third pass: ensure EVERY cell referenced by any detected formula is included in candidateInputs
  // (skipped for cross-sheet references pointing into bulk 8760h sheets)
  for (const fCell of formulaCells) {
    for (const dep of fCell.dependencies) {
      if (dep.includes(':')) continue
      const { sheetName, cellRef } = splitSheetAndCell(dep, fCell.sheetName)
      const targetRole = sheetRoles.get(sheetName)
      if (
        targetRole === 'datos' ||
        targetRole === 'curva_solar' ||
        targetRole === 'analisis'
      ) {
        continue
      }
      const mapKey = `${sheetName}!${cellRef}`
      const existing = candidateMap.get(mapKey)
      if (existing) {
        if (!existing.referencedBy) existing.referencedBy = []
        if (!existing.referencedBy.includes(fCell.cellRef)) {
          existing.referencedBy.push(fCell.cellRef)
        }
      } else {
        const valEntry = sheetCellValueMap.get(sheetName)?.get(cellRef)
        const textLabel = sheetCellTextMap.get(sheetName)?.get(cellRef)
        if (!valEntry && !textLabel && isMemWorkbook) continue
        candidateMap.set(mapKey, {
          cellRef,
          sheetName,
          label: textLabel || `Celda referenciada por ${fCell.cellRef}`,
          sampleValue: valEntry?.primitive ?? null,
          isFormulaDerived: valEntry?.isFormula ?? false,
          referencedBy: [fCell.cellRef],
        })
      }
    }
  }

  const candidateInputs = Array.from(candidateMap.values())

  // Build auto-suggested mappings
  const suggestedInputMappings: ExcelMappingSuggestion[] = candidateInputs.map((cand) => {
    const mapKey = `${cand.sheetName}!${cand.cellRef}`
    const definedName = cellRefToDefinedName.get(mapKey) ?? null
    const match = suggestPlatformVariable(cand.label, cand.sampleValue, {
      definedName,
      preferMem: isMemWorkbook,
    })
    return {
      cellRef: cand.cellRef,
      sheetName: cand.sheetName,
      label: cand.label,
      sampleValue: cand.sampleValue,
      suggestedVar: match.suggestedVar,
      confidence: match.confidence,
      isFormulaDerived: cand.isFormulaDerived,
      definedName,
    }
  })

  const suggestedOutputMappings: ExcelOutputMappingSuggestion[] = formulaCells.map((fc) => {
    const mapKey = `${fc.sheetName}!${fc.cellRef}`
    const definedName = cellRefToDefinedName.get(mapKey) ?? null
    const match = suggestOutputFormulaKey(fc.label, { definedName })
    return {
      cellRef: fc.cellRef,
      sheetName: fc.sheetName,
      label: fc.label,
      rawFormula: fc.rawFormula,
      cachedResult: fc.cachedResult,
      suggestedOutputKey: match.suggestedOutputKey,
      suggestedMemOutputKey: match.suggestedMemOutputKey,
      confidence: match.confidence,
      dependencies: fc.dependencies,
      definedName,
    }
  })

  let memWorkbookPreview: MemWorkbookImportPreview | undefined
  if (isMemWorkbook) {
    const duplicateKeys = new Set<string>()
    const seenKeys = new Set<string>()
    for (const h of criticalHours100HC) {
      const k = `${h.fecha}|${h.hora}`
      if (seenKeys.has(k)) duplicateKeys.add(k)
      seenKeys.add(k)
    }
    const duplicateCount = criticalHours100HC.filter((h) =>
      duplicateKeys.has(`${h.fecha}|${h.hora}`),
    ).length

    const totalConsumo = datosConsumo.reduce((acc, v) => acc + v, 0)
    const avgPml =
      datosPml.length > 0 ? datosPml.reduce((acc, v) => acc + v, 0) / datosPml.length : 0

    const resolvedFechas = datosFechas.length > 0 ? datosFechas : solarFechas
    const resolvedHoras = datosHoras.length > 0 ? datosHoras : solarHoras

    let alignmentMismatchCount = 0
    if (datosFechas.length > 0 && solarFechas.length > 0) {
      const minLen = Math.min(datosFechas.length, solarFechas.length)
      alignmentMismatchCount += Math.abs(datosFechas.length - solarFechas.length)
      for (let i = 0; i < minLen; i++) {
        if (datosFechas[i] !== solarFechas[i] || datosHoras[i] !== solarHoras[i]) {
          alignmentMismatchCount++
        }
      }
    }

    const extractedInputKeys = Object.keys(extractedInputs) as (keyof MemSimulatorInputs)[]
    const hasDistinctSolarTimeline =
      solarFechas.length > 0 &&
      (datosFechas.length !== solarFechas.length || alignmentMismatchCount > 0)

    memWorkbookPreview = {
      isMemModel: true,
      detectedSheets: sheets.map((s) => s.name),
      definedNamesMatched: memDefinedNameHits,
      extractedInputs: {
        ...DEFAULT_MEM_INPUTS,
        ...extractedInputs,
      },
      extractedInputKeys,
      extractedAssumptions,
      hourlySummary: {
        datosRows: datosConsumo.length,
        curvaSolarRows: solarMw.length,
        curvaSolarNonZeroHours: solarNonZeroCount,
        criticalHoursCount: criticalHours100HC.length,
        duplicateCriticalHoursCount: duplicateCount,
        totalConsumoMwh: totalConsumo,
        avgPmlMxnMwh: avgPml,
        dateStart: resolvedFechas[0] ?? null,
        dateEnd: resolvedFechas[resolvedFechas.length - 1] ?? null,
        skippedDatosRows,
        skippedSolarRows,
        invalid100HcRows,
        alignmentMismatchCount,
      },
      hourlyDataset:
        datosConsumo.length > 0 || solarMw.length > 0
          ? {
              fechas: resolvedFechas,
              horas: resolvedHoras,
              consumo_mwh: datosConsumo,
              pml_mxn_mwh: datosPml,
              curva_solar_mw: solarMw,
              ...(hasDistinctSolarTimeline
                ? { solar_fechas: solarFechas, solar_horas: solarHoras }
                : {}),
            }
          : undefined,
      criticalHours100HC: criticalHours100HC.length > 0 ? criticalHours100HC : undefined,
      cachedExcelKpis: Object.keys(cachedExcelKpis).length > 0 ? cachedExcelKpis : undefined,
    }
  }

  return {
    fileName,
    fileHash,
    defaultSheet: sheets[0].name,
    sheets,
    definedNames,
    candidateInputs,
    formulaCells,
    suggestedInputMappings,
    suggestedOutputMappings,
    memWorkbookPreview,
  }
}
