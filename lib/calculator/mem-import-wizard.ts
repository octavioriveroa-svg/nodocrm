import type {
  MemAnnualAssumptions,
  MemCriticalHourEntry,
  MemHourlyDataset,
  MemSimulatorInputs,
  MemWorkbookImportPreview,
} from '@/lib/types'
import {
  normalizeMemDateString,
  validateHourlyDataset,
  validateMemInputs,
} from '@/lib/calculator/mem-hourly-engine'

export type MemImportSectionKey =
  | 'datos'
  | 'curvaSolar'
  | 'hc100'
  | 'inputs'
  | 'assumptions'

export type MemImportSelection = Record<MemImportSectionKey, boolean>

export interface MemImportInspection {
  fileName: string
  detectedSheets: string[]
  datos: {
    detected: boolean
    valid: boolean
    error: string | null
    rowCount: number
    totalConsumoMwh: number
    avgPmlMxnMwh: number
    dateStart: string | null
    dateEnd: string | null
  }
  curvaSolar: {
    detected: boolean
    staticValid: boolean
    staticError: string | null
    rowCount: number
    nonZeroHours: number
    dateStart: string | null
    dateEnd: string | null
  }
  hc100: {
    detected: boolean
    valid: boolean
    error: string | null
    count: number
    duplicateCount: number
    invalidCount: number
  }
  inputs: {
    detected: boolean
    valid: boolean
    error: string | null
    warnings: string[]
    matchedCount: number
    definedNamesMatched: number
    extractedPatch: Partial<MemSimulatorInputs>
    mergedPreviewInputs: MemSimulatorInputs
  }
  assumptions: {
    detected: boolean
    valid: boolean
    error: string | null
    fixedMbpOverrideCount: number
    y2PctMbp: number | null
    y2PctPml: number | null
    y2DegBess: number | null
  }
}

export interface MemImportEvaluation {
  selectedCount: number
  canProceed: boolean
  curvaSolarError: string | null
  curvaSolarCanSelect: boolean
  hcMatchedCount: number
  hcMissingInTargetCount: number
  blockingErrors: string[]
  warnings: string[]
}

export interface MemImportApplyPayload {
  hourlyDataset?: MemHourlyDataset
  criticalHours100HC?: MemCriticalHourEntry[]
  extractedInputs?: Partial<MemSimulatorInputs>
  extractedAssumptions?: MemAnnualAssumptions | null
  appliedLabels: string[]
}

function timelinesMatch(
  fechasA: readonly string[],
  horasA: readonly number[] | Int32Array,
  fechasB: readonly string[],
  horasB: readonly number[] | Int32Array,
): number {
  const minLen = Math.min(fechasA.length, fechasB.length)
  let mismatches = Math.abs(fechasA.length - fechasB.length)
  for (let i = 0; i < minLen; i++) {
    if (fechasA[i] !== fechasB[i] || horasA[i] !== horasB[i]) {
      mismatches++
    }
  }
  return mismatches
}

function getSolarTimeline(preview: MemWorkbookImportPreview): {
  fechas: readonly string[]
  horas: readonly number[]
} {
  const hd = preview.hourlyDataset
  if (!hd) return { fechas: [], horas: [] }
  return {
    fechas: hd.solar_fechas ?? hd.fechas,
    horas: hd.solar_horas ?? hd.horas,
  }
}

function extractPatchFromPreview(
  preview: MemWorkbookImportPreview,
): { patch: Partial<MemSimulatorInputs>; matchedCount: number } {
  const raw = preview.extractedInputs ?? {}
  if (preview.extractedInputKeys && preview.extractedInputKeys.length > 0) {
    const patch: Partial<MemSimulatorInputs> = {}
    for (const k of preview.extractedInputKeys) {
      if (raw[k] !== undefined) {
        ;(patch as Record<string, unknown>)[k] = raw[k]
      }
    }
    return { patch, matchedCount: preview.extractedInputKeys.length }
  }
  if (preview.definedNamesMatched >= 5) {
    const keys = Object.keys(raw)
    return { patch: { ...raw }, matchedCount: keys.length }
  }
  return { patch: {}, matchedCount: 0 }
}

/**
 * Inspects a parsed MEM workbook/time-series preview across all 5 importable sections
 * without side effects so Paso 2 & Paso 3 can validate, filter, and apply selectively.
 */
export function inspectMemImportPreview(
  preview: MemWorkbookImportPreview,
  fileName: string,
  currentHourly: MemHourlyDataset,
  currentInputs: MemSimulatorInputs,
): MemImportInspection {
  const summary = preview.hourlySummary
  const hd = preview.hourlyDataset

  // 1. Datos 8,760h
  const datosDetected = summary.datosRows > 0 || (summary.skippedDatosRows ?? 0) > 0
  let datosError: string | null = null
  if (datosDetected) {
    if ((summary.skippedDatosRows ?? 0) > 0) {
      datosError = `La hoja Datos contiene ${summary.skippedDatosRows} fila(s) incompleta(s) o inválida(s). Verifica Fecha, Hora (1–24), Consumo y PML.`
    } else if (summary.datosRows !== 8760 || !hd || hd.consumo_mwh.length !== 8760) {
      datosError = `Datos horarios contiene ${summary.datosRows} filas válidas; se requieren exactamente 8,760 horas anuales.`
    } else {
      const check = validateHourlyDataset({
        label: fileName,
        year: currentHourly.year,
        fechas: hd.fechas,
        horas: hd.horas,
        consumo_mwh: hd.consumo_mwh,
        pml_mxn_mwh: hd.pml_mxn_mwh,
        curva_solar_mw: new Float64Array(8760),
      })
      if (!check.valid) {
        datosError = check.errors[0] ?? 'Datos horarios inválidos.'
      }
    }
  }

  // 2. Curva Solar
  const solarDetected = summary.curvaSolarRows > 0 || (summary.skippedSolarRows ?? 0) > 0
  const solarTimeline = getSolarTimeline(preview)
  let solarStaticError: string | null = null
  if (solarDetected) {
    if ((summary.skippedSolarRows ?? 0) > 0) {
      solarStaticError = `La curva solar contiene ${summary.skippedSolarRows} fila(s) con fecha u hora (1–24) inválida.`
    } else if (summary.curvaSolarRows !== 8760 || !hd || hd.curva_solar_mw.length !== 8760) {
      solarStaticError = `Curva Solar contiene ${summary.curvaSolarRows} filas válidas; se requieren exactamente 8,760 horas anuales.`
    } else {
      const check = validateHourlyDataset({
        label: fileName,
        year: currentHourly.year,
        fechas: solarTimeline.fechas,
        horas: solarTimeline.horas,
        consumo_mwh: new Float64Array(8760),
        pml_mxn_mwh: new Float64Array(8760),
        curva_solar_mw: hd.curva_solar_mw,
      })
      if (!check.valid) {
        solarStaticError = check.errors[0] ?? 'Curva Solar inválida.'
      }
    }
  }

  // 3. 100HC
  const hcCount = preview.criticalHours100HC?.length ?? 0
  const hcInvalid = summary.invalid100HcRows ?? 0
  const hcDetected = hcCount > 0 || hcInvalid > 0
  let hcError: string | null = null
  if (hcDetected) {
    if (hcInvalid > 0) {
      hcError = `Las horas críticas (100HC) contienen ${hcInvalid} fila(s) con fecha inválida o hora fuera del rango 1–24.`
    } else if (hcCount === 0) {
      hcError = 'No se encontraron filas válidas en 100HC.'
    }
  }

  // 4. Inputs
  const { patch: extractedPatch, matchedCount } = extractPatchFromPreview(preview)
  const inputsDetected = matchedCount > 0 || preview.definedNamesMatched >= 5
  const mergedPreviewInputs: MemSimulatorInputs = {
    ...currentInputs,
    ...extractedPatch,
  }
  let inputsError: string | null = null
  let inputsWarnings: string[] = []
  if (inputsDetected) {
    const val = validateMemInputs(mergedPreviewInputs)
    const firstErr = Object.values(val.errors)[0]
    if (firstErr) inputsError = firstErr
    inputsWarnings = val.warnings
  }

  // 5. Supuestos Anuales
  const assumptions = preview.extractedAssumptions
  const assumptionsDetected = assumptions !== null
  let assumptionsError: string | null = null
  let fixedMbpOverrideCount = 0
  if (assumptions) {
    const validLengths =
      assumptions.pct_mbp.length === 25 &&
      assumptions.fijo_mbp.length === 25 &&
      assumptions.pct_pml.length === 25 &&
      assumptions.deg_bess.length === 25
    if (!validLengths) {
      assumptionsError = 'La tabla de Supuestos Anuales debe cubrir exactamente 25 años.'
    } else {
      for (let i = 0; i < 25; i++) {
        const mbp = assumptions.pct_mbp[i]
        const pml = assumptions.pct_pml[i]
        const deg = assumptions.deg_bess[i]
        if (!Number.isFinite(mbp) || !Number.isFinite(pml) || !Number.isFinite(deg)) {
          assumptionsError = `Supuestos Anuales contiene valores no numéricos en el año ${i + 1}.`
          break
        }
        if (mbp < -0.5 || mbp > 1) {
          assumptionsError = `La variación % de MBP en el año ${i + 1} (${mbp}) debe estar entre -50% (-0.5) y +100% (1).`
          break
        }
        if (pml < -0.5 || pml > 1) {
          assumptionsError = `La variación % de PML en el año ${i + 1} (${pml}) debe estar entre -50% (-0.5) y +100% (1).`
          break
        }
        if (deg < 0 || deg > 0.5) {
          assumptionsError = `La degradación anual del BESS en el año ${i + 1} (${deg}) debe estar entre 0% (0) y 50% (0.5).`
          break
        }
        const f = assumptions.fijo_mbp[i]
        if (f !== null && f !== undefined) {
          if (!Number.isFinite(f) || f < 0 || f > 100_000_000) {
            assumptionsError = `Valor fijo MBP inválido en el año ${i + 1} (debe estar entre 0 y 100,000,000).`
            break
          }
          if (i >= 1) fixedMbpOverrideCount++
        }
      }
    }
  }

  return {
    fileName,
    detectedSheets: preview.detectedSheets,
    datos: {
      detected: datosDetected,
      valid: datosDetected && datosError === null,
      error: datosError,
      rowCount: summary.datosRows,
      totalConsumoMwh: summary.totalConsumoMwh,
      avgPmlMxnMwh: summary.avgPmlMxnMwh,
      dateStart: hd && summary.datosRows > 0 ? (hd.fechas[0] ?? null) : summary.dateStart,
      dateEnd:
        hd && summary.datosRows > 0
          ? (hd.fechas[hd.fechas.length - 1] ?? null)
          : summary.dateEnd,
    },
    curvaSolar: {
      detected: solarDetected,
      staticValid: solarDetected && solarStaticError === null,
      staticError: solarStaticError,
      rowCount: summary.curvaSolarRows,
      nonZeroHours: summary.curvaSolarNonZeroHours,
      dateStart: solarTimeline.fechas[0] ?? null,
      dateEnd: solarTimeline.fechas[solarTimeline.fechas.length - 1] ?? null,
    },
    hc100: {
      detected: hcDetected,
      valid: hcDetected && hcError === null,
      error: hcError,
      count: hcCount,
      duplicateCount: summary.duplicateCriticalHoursCount,
      invalidCount: hcInvalid,
    },
    inputs: {
      detected: inputsDetected,
      valid: inputsDetected && inputsError === null,
      error: inputsError,
      warnings: inputsWarnings,
      matchedCount,
      definedNamesMatched: preview.definedNamesMatched,
      extractedPatch,
      mergedPreviewInputs,
    },
    assumptions: {
      detected: assumptionsDetected,
      valid: assumptionsDetected && assumptionsError === null,
      error: assumptionsError,
      fixedMbpOverrideCount,
      y2PctMbp: assumptions ? (assumptions.pct_mbp[1] ?? null) : null,
      y2PctPml: assumptions ? (assumptions.pct_pml[1] ?? null) : null,
      y2DegBess: assumptions ? (assumptions.deg_bess[1] ?? null) : null,
    },
  }
}

/**
 * Computes default checked sections for Paso 2: auto-selects every detected, valid,
 * and properly aligned section.
 */
export function getDefaultMemImportSelection(
  inspection: MemImportInspection,
  preview: MemWorkbookImportPreview,
  currentHourly: MemHourlyDataset,
): MemImportSelection {
  const selectDatos = inspection.datos.valid
  const solarTimeline = getSolarTimeline(preview)

  let selectSolar = false
  if (inspection.curvaSolar.staticValid) {
    if (selectDatos) {
      selectSolar = (preview.hourlySummary.alignmentMismatchCount ?? 0) === 0
    } else {
      selectSolar =
        timelinesMatch(
          currentHourly.fechas,
          currentHourly.horas,
          solarTimeline.fechas,
          solarTimeline.horas,
        ) === 0
    }
  }

  return {
    datos: selectDatos,
    curvaSolar: selectSolar,
    hc100: inspection.hc100.valid,
    inputs: inspection.inputs.valid,
    assumptions: inspection.assumptions.valid,
  }
}

/**
 * Evaluates cross-section alignment (Curva Solar vs target Datos, 100HC key coverage)
 * and readiness to advance from Paso 2 -> Paso 3.
 */
export function evaluateMemImportSelection(
  inspection: MemImportInspection,
  preview: MemWorkbookImportPreview,
  currentHourly: MemHourlyDataset,
  selection: MemImportSelection,
): MemImportEvaluation {
  const hd = preview.hourlyDataset
  const useImportedDatos = selection.datos && inspection.datos.valid && hd !== undefined

  const targetFechas = useImportedDatos ? hd.fechas : currentHourly.fechas
  const targetHoras = useImportedDatos ? hd.horas : currentHourly.horas

  // Evaluate Curva Solar alignment against chosen target Datos
  let curvaSolarError = inspection.curvaSolar.staticError
  if (inspection.curvaSolar.detected && curvaSolarError === null) {
    if (useImportedDatos) {
      const mismatches = preview.hourlySummary.alignmentMismatchCount ?? 0
      if (mismatches > 0) {
        curvaSolarError = `Curva Solar tiene ${mismatches} hora(s) desalineada(s) en Fecha/Hora respecto a Datos horarios del archivo.`
      }
    } else {
      const solarTimeline = getSolarTimeline(preview)
      const mismatches = timelinesMatch(
        currentHourly.fechas,
        currentHourly.horas,
        solarTimeline.fechas,
        solarTimeline.horas,
      )
      if (mismatches > 0) {
        curvaSolarError = `Curva Solar (${inspection.fileName}) tiene ${mismatches} hora(s) desalineada(s) en Fecha/Hora respecto a Datos horarios actuales (${currentHourly.label}).`
      }
    }
  }
  const curvaSolarCanSelect = inspection.curvaSolar.staticValid && curvaSolarError === null

  // 100HC key coverage against target Datos
  const targetKeys = new Set<string>()
  for (let i = 0; i < targetFechas.length; i++) {
    targetKeys.add(`${targetFechas[i]}#${targetHoras[i]}`)
  }
  let hcMatchedCount = 0
  let hcMissingInTargetCount = 0
  if (preview.criticalHours100HC) {
    for (const hc of preview.criticalHours100HC) {
      const key = `${normalizeMemDateString(hc.fecha)}#${hc.hora}`
      if (targetKeys.has(key)) {
        hcMatchedCount++
      } else {
        hcMissingInTargetCount++
      }
    }
  }

  const blockingErrors: string[] = []
  if (selection.datos && inspection.datos.error) {
    blockingErrors.push(inspection.datos.error)
  }
  if (selection.curvaSolar && curvaSolarError) {
    blockingErrors.push(curvaSolarError)
  }
  if (selection.hc100 && inspection.hc100.error) {
    blockingErrors.push(inspection.hc100.error)
  }
  if (selection.inputs && inspection.inputs.error) {
    blockingErrors.push(inspection.inputs.error)
  }
  if (selection.assumptions && inspection.assumptions.error) {
    blockingErrors.push(inspection.assumptions.error)
  }

  const warnings: string[] = []
  if (selection.datos && !selection.curvaSolar && useImportedDatos) {
    const mismatchWithCurrent = timelinesMatch(
      hd.fechas,
      hd.horas,
      currentHourly.fechas,
      currentHourly.horas,
    )
    let currentHasSolar = false
    for (let i = 0; i < currentHourly.curva_solar_mw.length; i++) {
      if (currentHourly.curva_solar_mw[i] > 0) {
        currentHasSolar = true
        break
      }
    }
    if (mismatchWithCurrent > 0 && currentHasSolar) {
      warnings.push(
        'Las fechas de Datos importados difieren del dataset actual; al no incluir Curva Solar se reiniciará la curva solar en 0 MW para evitar desalineación.',
      )
    }
  }
  if (selection.hc100 && inspection.hc100.duplicateCount > 0) {
    warnings.push(
      `100HC contiene ${inspection.hc100.duplicateCount} hora(s) con Fecha+Hora repetida (se promedian igual que en Excel).`,
    )
  }
  if (selection.hc100 && hcMissingInTargetCount > 0) {
    warnings.push(
      `${hcMissingInTargetCount} de ${inspection.hc100.count} horas críticas no coinciden con las fechas del dataset Datos destino.`,
    )
  }
  if (selection.inputs) {
    for (const w of inspection.inputs.warnings) {
      warnings.push(w)
    }
  }

  const selectedCount = (Object.keys(selection) as MemImportSectionKey[]).filter(
    (k) => selection[k],
  ).length

  return {
    selectedCount,
    canProceed: selectedCount > 0 && blockingErrors.length === 0,
    curvaSolarError,
    curvaSolarCanSelect,
    hcMatchedCount,
    hcMissingInTargetCount,
    blockingErrors,
    warnings,
  }
}

/**
 * Builds the exact partial/full payload passed to onApplyImportedWorkbook from Paso 3.
 */
export function buildMemImportApplyPayload(
  inspection: MemImportInspection,
  preview: MemWorkbookImportPreview,
  currentHourly: MemHourlyDataset,
  selection: MemImportSelection,
): MemImportApplyPayload {
  const hd = preview.hourlyDataset
  const appliedLabels: string[] = []
  let hourlyDataset: MemHourlyDataset | undefined

  if (selection.datos && hd && inspection.datos.valid) {
    const parsedYear = Number(hd.fechas[0]?.slice(0, 4))
    const keepCurrentSolar =
      !selection.curvaSolar &&
      timelinesMatch(hd.fechas, hd.horas, currentHourly.fechas, currentHourly.horas) === 0

    hourlyDataset = {
      label: inspection.fileName,
      year:
        Number.isInteger(parsedYear) && parsedYear >= 2000
          ? parsedYear
          : currentHourly.year,
      fechas: hd.fechas,
      horas: hd.horas,
      consumo_mwh: Float64Array.from(hd.consumo_mwh),
      pml_mxn_mwh: Float64Array.from(hd.pml_mxn_mwh),
      curva_solar_mw:
        selection.curvaSolar && hd.curva_solar_mw.length === 8760
          ? Float64Array.from(hd.curva_solar_mw)
          : keepCurrentSolar
            ? currentHourly.curva_solar_mw
            : new Float64Array(8760),
    }
    appliedLabels.push('Datos 8,760h')
    if (selection.curvaSolar && hd.curva_solar_mw.length === 8760) {
      appliedLabels.push('Curva Solar')
    }
  } else if (selection.curvaSolar && hd && inspection.curvaSolar.staticValid) {
    const baseLabel = currentHourly.label.replace(/(?:\s*\+\s*Solar\s*\([^)]*\))+\s*$/i, '')
    hourlyDataset = {
      ...currentHourly,
      label: `${baseLabel} + Solar (${inspection.fileName})`,
      curva_solar_mw: Float64Array.from(hd.curva_solar_mw),
    }
    appliedLabels.push('Curva Solar 8,760h')
  }

  let criticalHours100HC: MemCriticalHourEntry[] | undefined
  if (selection.hc100 && preview.criticalHours100HC && inspection.hc100.valid) {
    criticalHours100HC = preview.criticalHours100HC
    appliedLabels.push(`100HC (${criticalHours100HC.length} h)`)
  }

  let extractedInputs: Partial<MemSimulatorInputs> | undefined
  if (selection.inputs && inspection.inputs.valid) {
    extractedInputs = inspection.inputs.extractedPatch
    appliedLabels.push('Inputs')
  }

  let extractedAssumptions: MemAnnualAssumptions | null | undefined
  if (selection.assumptions && preview.extractedAssumptions && inspection.assumptions.valid) {
    extractedAssumptions = preview.extractedAssumptions
    appliedLabels.push('Supuestos Anuales')
  }

  return {
    hourlyDataset,
    criticalHours100HC,
    extractedInputs,
    extractedAssumptions,
    appliedLabels,
  }
}
