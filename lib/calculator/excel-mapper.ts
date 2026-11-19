import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import ExcelJS from 'exceljs'
import type {
  ExcelCandidateInputCell,
  ExcelDefinedName,
  ExcelDetectedFormulaCell,
  ExcelInputMapping,
  ExcelMappingSuggestion,
  ExcelOutputMappingSuggestion,
  ExcelParseResult,
  ExcelSheetMetadata,
  FormulaDefinicion,
} from '@/lib/types'
import {
  extractFormulaCellRefs,
  normalizeCellRef,
  rewriteFormulaCellRefs,
  type RewriteFormulaResult,
} from '@/lib/calculator/formula-engine'
import {
  PLATFORM_OUTPUT_DEFINITIONS,
  PLATFORM_VARIABLES,
} from '@/lib/calculator/variable-dictionary'
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
): { suggestedVar: string | null; confidence: number } {
  const norm = stripAccentsLower(label)
  if (!norm) return { suggestedVar: null, confidence: 0 }

  let bestKey: string | null = null
  let bestScore = 0

  for (const variable of PLATFORM_VARIABLES) {
    // Exact key match
    const keyNorm = variable.key.replace(/_/g, ' ')
    if (norm === variable.key || norm === keyNorm) {
      return { suggestedVar: variable.key, confidence: 1.0 }
    }

    for (const alias of variable.excelAliases) {
      const aliasNorm = stripAccentsLower(alias)
      if (!aliasNorm) continue

      let score = 0
      if (norm === aliasNorm) {
        score = 0.96
      } else if (norm.includes(aliasNorm)) {
        // Favor longer, more specific alias matches
        score = 0.72 + Math.min(0.22, aliasNorm.length / Math.max(norm.length, aliasNorm.length) * 0.22)
      } else {
        // Token overlap
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

      // Light numeric sanity boost for percentages vs large numbers
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
        if (variable.key === 'capex_total' && sampleValue >= 1000) {
          score = Math.min(0.99, score + 0.04)
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestKey = variable.key
      }
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
 * Heuristic fuzzy matcher mapping a formula cell label to one of the 7 canonical output keys.
 */
export function suggestOutputFormulaKey(label: string): {
  suggestedOutputKey: FormulaDefinicion['key'] | null
  confidence: number
} {
  const norm = stripAccentsLower(label)
  if (!norm) return { suggestedOutputKey: null, confidence: 0 }

  let bestKey: FormulaDefinicion['key'] | null = null
  let bestScore = 0

  for (const outDef of PLATFORM_OUTPUT_DEFINITIONS) {
    const keyNorm = outDef.key.replace(/_/g, ' ')
    if (norm === outDef.key || norm === keyNorm) {
      return { suggestedOutputKey: outDef.key, confidence: 1.0 }
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
    return { suggestedOutputKey: null, confidence: 0 }
  }

  return {
    suggestedOutputKey: bestKey,
    confidence: Math.round(bestScore * 100) / 100,
  }
}

/**
 * Builds a prototype-safe Map<normalizedCellRef, platformVar> from confirmed/draft ExcelInputMappings
 * and previews the rewritten Excel formula with unresolved cell detection.
 */
export function previewFormulaRewrite(
  rawFormula: string,
  inputMappings: readonly Pick<ExcelInputMapping, 'cellRef' | 'sheetName' | 'platformVar'>[],
  defaultSheet?: string,
): RewriteFormulaResult {
  const cellToVarMap = new Map<string, string>()

  for (const m of inputMappings) {
    if (!m.platformVar || m.platformVar === '__ignore__') continue
    const normRef = normalizeCellRef(m.cellRef)
    const cleanRef = normRef.includes('!') ? normRef.split('!')[1] : normRef
    const qualified = m.sheetName ? `${m.sheetName}!${cleanRef}` : normRef

    cellToVarMap.set(qualified, m.platformVar)
    if (!defaultSheet || !m.sheetName || m.sheetName === defaultSheet) {
      cellToVarMap.set(cleanRef, m.platformVar)
    }
  }

  return rewriteFormulaCellRefs(rawFormula, cellToVarMap, defaultSheet)
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
    const stream = Readable.from(buffer)
    await workbook.csv.read(stream)
  }

  if (workbook.worksheets.length === 0) {
    throw new ExcelParseLimitError('El archivo no contiene ninguna hoja de cálculo legible.')
  }
  if (workbook.worksheets.length > MAX_WORKSHEETS) {
    throw new ExcelParseLimitError(
      `El libro supera el máximo de ${MAX_WORKSHEETS} hojas permitidas (${workbook.worksheets.length}).`,
    )
  }

  // Extract defined names into a Map (prototype-safe)
  const definedNames: ExcelDefinedName[] = []
  const definedNamesMap = new Map<string, string[]>()
  try {
    const model = workbook.definedNames?.model
    if (Array.isArray(model)) {
      for (const entry of model) {
        if (entry && typeof entry.name === 'string' && Array.isArray(entry.ranges)) {
          const ranges = entry.ranges.map((r) => normalizeCellRef(String(r)))
          definedNamesMap.set(entry.name, ranges)
          definedNames.push({ name: entry.name, ranges })
        }
      }
    }
  } catch {
    // Ignore malformed definedNames metadata
  }

  const sheets: ExcelSheetMetadata[] = []
  const formulaCells: ExcelDetectedFormulaCell[] = []
  const candidateMap = new Map<string, ExcelCandidateInputCell>()
  const sheetCellTextMap = new Map<string, Map<string, string>>()
  const sheetCellValueMap = new Map<string, Map<string, { primitive: number | string | null; isFormula: boolean }>>()

  let totalPopulatedCells = 0

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

    const textMap = new Map<string, string>()
    const valMap = new Map<string, { primitive: number | string | null; isFormula: boolean }>()
    sheetCellTextMap.set(ws.name, textMap)
    sheetCellValueMap.set(ws.name, valMap)

    // First pass: capture normalized values & string labels
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        totalPopulatedCells++
        if (extension === 'xlsx' && totalPopulatedCells > MAX_XLSX_POPULATED_CELLS) {
          throw new ExcelParseLimitError(
            `El archivo .xlsx supera el límite máximo de ${MAX_XLSX_POPULATED_CELLS.toLocaleString('es-MX')} celdas con contenido.`,
          )
        }

        const addr = normalizeCellRef(cell.address)
        const normalized = normalizeExcelJsCellValue(cell.value)
        const isFormula = normalized.formula !== null
        valMap.set(addr, { primitive: normalized.primitive, isFormula })
        if (!isFormula && typeof normalized.primitive === 'string') {
          textMap.set(addr, normalized.primitive)
        }
      })
    })

    const findAdjacentLabel = (wsName: string, rowNum: number, colNum: number): string => {
      const labels = sheetCellTextMap.get(wsName)
      if (!labels) return ''
      // Check left cell (col - 1), then two cells left (col - 2), then header above (row - 1), then row 1 header
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

    // Second pass: collect formula cells and labeled constant input candidates
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const addr = normalizeCellRef(cell.address)
        const normalized = normalizeExcelJsCellValue(cell.value)
        const label = findAdjacentLabel(ws.name, rowNumber, colNumber)

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
            label: label || `Fórmula ${addr}`,
            rawFormula: normalized.formula,
            cachedResult: normalized.primitive,
            dependencies: deps,
          })
        } else if (typeof normalized.primitive === 'number' && label) {
          const mapKey = `${ws.name}!${addr}`
          if (!candidateMap.has(mapKey)) {
            candidateMap.set(mapKey, {
              cellRef: addr,
              sheetName: ws.name,
              label,
              sampleValue: normalized.primitive,
              isFormulaDerived: false,
              referencedBy: [],
            })
          }
        }
      })
    })
  }

  // Third pass: ensure EVERY cell referenced by any detected formula is included in candidateInputs
  // (including unlabeled / axis / index cells such as A10 in Scenario S4)
  for (const fCell of formulaCells) {
    for (const dep of fCell.dependencies) {
      // Skip range refs with ':' in this individual-cell pass (keep endpoints if needed)
      if (dep.includes(':')) continue
      const { sheetName, cellRef } = splitSheetAndCell(dep, fCell.sheetName)
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
    const match = suggestPlatformVariable(cand.label, cand.sampleValue)
    return {
      cellRef: cand.cellRef,
      sheetName: cand.sheetName,
      label: cand.label,
      sampleValue: cand.sampleValue,
      suggestedVar: match.suggestedVar,
      confidence: match.confidence,
      isFormulaDerived: cand.isFormulaDerived,
    }
  })

  const suggestedOutputMappings: ExcelOutputMappingSuggestion[] = formulaCells.map((fc) => {
    const match = suggestOutputFormulaKey(fc.label)
    return {
      cellRef: fc.cellRef,
      sheetName: fc.sheetName,
      label: fc.label,
      rawFormula: fc.rawFormula,
      cachedResult: fc.cachedResult,
      suggestedOutputKey: match.suggestedOutputKey,
      confidence: match.confidence,
      dependencies: fc.dependencies,
    }
  })

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
  }
}
