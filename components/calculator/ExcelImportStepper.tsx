'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import type {
  CalculadoraCampoDef,
  CalculadoraTemplate,
  ExcelInputMapping,
  ExcelMapeoCampos,
  ExcelOutputMapping,
  ExcelParseResult,
  FormulaDefinicion,
} from '@/lib/types'
import {
  CATEGORY_LABELS,
  getVariablesByCategory,
  PLATFORM_OUTPUT_DEFINITIONS,
} from '@/lib/calculator/variable-dictionary'
import {
  compileAndSortFormulas,
  FormulaError,
  normalizeCellRef,
  previewFormulaRewrite,
} from '@/lib/calculator/formula-engine'
import { runTemplateDryRun } from '@/lib/calculator/engine'
import { runMemSimulation } from '@/lib/calculator/mem-hourly-engine'
import {
  createDefaultMemAnnualAssumptions,
  DEFAULT_MEM_INPUTS,
  getBaseline100HC,
  getBaselineMemHourlyDataset,
} from '@/lib/calculator/datasets/mem-baseline'
import {
  FALLBACK_TEMPLATE_FORMULAS,
  MEM_TEMPLATE_CAMPOS,
} from '@/lib/calculator/template-schema'
import { guardarPlantillaCalculadora } from '@/app/actions/calculatorConfig'
import { fmtCurrency, fmtNum, fmtPct } from '@/lib/format'
import StepIndicator from '@/components/ui/StepIndicator'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SpreadsheetDropzone } from '@/components/calculator/SpreadsheetDropzone'

export interface ExcelImportStepperProps {
  currentCampos: CalculadoraCampoDef[]
  currentFormulas: FormulaDefinicion[]
  currentHorizonteOpciones: number[]
  onApplyToEditor?: (draft: {
    formulas: FormulaDefinicion[]
    excelMeta: {
      archivoNombre: string
      archivoHash: string
      hojaOrigen: string
      mapeo: ExcelMapeoCampos
    }
  }) => void
  onImported: (template: CalculadoraTemplate) => void
}

export function ExcelImportStepper({
  currentCampos,
  currentFormulas,
  currentHorizonteOpciones,
  onApplyToEditor,
  onImported,
}: ExcelImportStepperProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('')

  // Mappings keyed by `${sheetName}!${cellRef}`
  const [inputSelections, setInputSelections] = useState<Record<string, string>>({})
  const [outputSelections, setOutputSelections] = useState<
    Record<string, FormulaDefinicion['key'] | '__ignore__'>
  >({})

  const [templateNombre, setTemplateNombre] = useState('')
  const [templateNotas, setTemplateNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort()
    }
  }, [])

  const variablesByCategory = useMemo(
    () => Array.from(getVariablesByCategory({ includeMem: true }).entries()),
    [],
  )

  const inputDefinedNameByKey = useMemo(() => {
    const map = new Map<string, string>()
    if (!parseResult) return map
    for (const s of parseResult.suggestedInputMappings) {
      if (s.definedName) {
        map.set(`${s.sheetName}!${s.cellRef}`, s.definedName)
      }
    }
    return map
  }, [parseResult])

  async function processFileUpload(file: File) {
    uploadAbortRef.current?.abort()
    const controller = new AbortController()
    uploadAbortRef.current = controller

    setUploadError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/calculator/excel/parse', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      const json = (await response.json()) as ExcelParseResult & { error?: string }
      if (controller.signal.aborted) return
      if (!response.ok) {
        setUploadError(json.error || 'Error al analizar el archivo Excel.')
        return
      }

      setParseResult(json)
      const preferredSheet =
        json.memWorkbookPreview?.isMemModel
          ? (json.sheets.find((s) => s.name.toLowerCase() === 'input')?.name ??
            json.sheets.find((s) => s.name.toLowerCase().includes('evaluacion'))?.name ??
            json.defaultSheet)
          : json.defaultSheet
      setSelectedSheet(preferredSheet || json.sheets[0]?.name || '')

      const initInputs: Record<string, string> = {}
      const initialInputMappings: ExcelInputMapping[] = []
      const candidateByKey = new Map<string, (typeof json.candidateInputs)[number]>(
        json.candidateInputs.map((c) => [`${c.sheetName}!${c.cellRef}`, c]),
      )
      for (const s of json.suggestedInputMappings) {
        const key = `${s.sheetName}!${s.cellRef}`
        const assigned = s.suggestedVar ?? '__ignore__'
        initInputs[key] = assigned
        if (assigned !== '__ignore__') {
          const cand = candidateByKey.get(key)
          initialInputMappings.push({
            cellRef: s.cellRef,
            sheetName: s.sheetName,
            label: cand?.label ?? s.label,
            platformVar: assigned,
            sampleValue: cand?.sampleValue ?? s.sampleValue,
          })
        }
      }
      setInputSelections(initInputs)

      const isMemModel = Boolean(json.memWorkbookPreview?.isMemModel)
      const initOutputs: Record<string, FormulaDefinicion['key'] | '__ignore__'> = {}
      const usedOutKeys = new Set<string>()
      for (const o of json.suggestedOutputMappings) {
        const key = `${o.sheetName}!${o.cellRef}`
        let canPreselect = Boolean(o.suggestedOutputKey && !usedOutKeys.has(o.suggestedOutputKey))
        if (canPreselect && isMemModel) {
          try {
            const check = previewFormulaRewrite(
              o.rawFormula,
              initialInputMappings,
              o.sheetName,
            )
            if (check.unresolvedRefs.length > 0) {
              canPreselect = false
            }
          } catch {
            canPreselect = false
          }
        }
        if (canPreselect && o.suggestedOutputKey) {
          initOutputs[key] = o.suggestedOutputKey
          usedOutKeys.add(o.suggestedOutputKey)
        } else {
          initOutputs[key] = '__ignore__'
        }
      }
      setOutputSelections(initOutputs)
      setTemplateNombre(`Importación Excel: ${json.fileName}`)
      setTemplateNotas('')
      setSaveError(null)
      setStep(1)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setUploadError(err instanceof Error ? err.message : 'Error de red al subir el archivo.')
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null
        setUploading(false)
      }
    }
  }

  const sheetFormulaCells = useMemo(() => {
    if (!parseResult) return []
    return parseResult.formulaCells.filter((fc) => fc.sheetName === selectedSheet)
  }, [parseResult, selectedSheet])

  const sheetCandidateInputs = useMemo(() => {
    if (!parseResult) return []
    const referencedCrossSheet = new Set<string>()
    for (const fc of sheetFormulaCells) {
      for (const dep of fc.dependencies) {
        if (dep.includes('!')) referencedCrossSheet.add(normalizeCellRef(dep))
      }
    }
    return parseResult.candidateInputs.filter(
      (c) =>
        c.sheetName === selectedSheet ||
        referencedCrossSheet.has(`${c.sheetName}!${c.cellRef}`),
    )
  }, [parseResult, selectedSheet, sheetFormulaCells])

  const activeInputMappings: ExcelInputMapping[] = useMemo(() => {
    if (!parseResult) return []
    const list: ExcelInputMapping[] = []
    for (const c of parseResult.candidateInputs) {
      const k = `${c.sheetName}!${c.cellRef}`
      const platformVar = inputSelections[k]
      if (platformVar && platformVar !== '__ignore__') {
        list.push({
          cellRef: c.cellRef,
          sheetName: c.sheetName,
          label: c.label,
          platformVar,
          sampleValue: c.sampleValue,
        })
      }
    }
    return list
  }, [parseResult, inputSelections])

  const allFormulaPreviews = useMemo(() => {
    if (!parseResult) return []
    return parseResult.formulaCells.map((fc) => {
      const mapKey = `${fc.sheetName}!${fc.cellRef}`
      const assignedOutput = outputSelections[mapKey] ?? '__ignore__'
      let rewritten = fc.rawFormula
      let unresolvedRefs: string[] = []
      let parseErr: string | null = null
      try {
        const res = previewFormulaRewrite(fc.rawFormula, activeInputMappings, fc.sheetName)
        rewritten = res.rewritten
        unresolvedRefs = res.unresolvedRefs
      } catch (err) {
        parseErr = err instanceof Error ? err.message : String(err)
      }
      return {
        fc,
        mapKey,
        assignedOutput,
        rewritten,
        unresolvedRefs,
        parseErr,
      }
    })
  }, [parseResult, outputSelections, activeInputMappings])

  const formulaPreviews = useMemo(() => {
    return allFormulaPreviews.filter((p) => p.fc.sheetName === selectedSheet)
  }, [allFormulaPreviews, selectedSheet])

  const mappingValidation = useMemo(() => {
    const selectedOutputs = allFormulaPreviews.filter((p) => p.assignedOutput !== '__ignore__')
    const duplicateOutputs = new Set<string>()
    const seen = new Set<string>()
    for (const item of selectedOutputs) {
      if (seen.has(item.assignedOutput)) duplicateOutputs.add(item.assignedOutput)
      seen.add(item.assignedOutput)
    }

    const unresolvedItems = selectedOutputs.filter(
      (p) => p.unresolvedRefs.length > 0 || p.parseErr !== null,
    )

    const isMemModel = Boolean(parseResult?.memWorkbookPreview?.isMemModel)
    const mappedInputCount = activeInputMappings.length

    const canProceedToStep3 =
      (selectedOutputs.length > 0 || (isMemModel && mappedInputCount > 0)) &&
      duplicateOutputs.size === 0 &&
      unresolvedItems.length === 0

    return {
      selectedOutputs,
      duplicateOutputs: Array.from(duplicateOutputs),
      unresolvedItems,
      canProceedToStep3,
    }
  }, [allFormulaPreviews, parseResult, activeInputMappings.length])

  const mergedFormulas: FormulaDefinicion[] = useMemo(() => {
    const baseList =
      currentFormulas.length > 0 ? currentFormulas : FALLBACK_TEMPLATE_FORMULAS
    const mappedByKey = new Map<
      FormulaDefinicion['key'],
      { expression: string; sourceCell: string }
    >()
    for (const item of mappingValidation.selectedOutputs) {
      if (item.assignedOutput !== '__ignore__') {
        mappedByKey.set(item.assignedOutput, {
          expression: item.rewritten,
          sourceCell: `${item.fc.sheetName}!${item.fc.cellRef}`,
        })
      }
    }

    return baseList.map((f) => {
      const mapped = mappedByKey.get(f.key)
      if (!mapped) return { ...f }
      return {
        ...f,
        expression: mapped.expression,
        enabled: true,
        source_cell: mapped.sourceCell,
        ast_validated: true,
      }
    })
  }, [currentFormulas, mappingValidation.selectedOutputs])

  const step3Check = useMemo(() => {
    if (step !== 2) return null
    try {
      compileAndSortFormulas(mergedFormulas, {
        allowCellRefs: false,
        validateIdentifiers: true,
      })
      const dryRun = runTemplateDryRun({
        modo: 'excel_import',
        campos: currentCampos,
        formulas: mergedFormulas,
      })
      return { ok: true as const, dryRun }
    } catch (err) {
      const msg = err instanceof FormulaError ? err.message : String(err)
      return { ok: false as const, error: msg }
    }
  }, [step, mergedFormulas, currentCampos])

  const memPreviewRun = useMemo(() => {
    const preview = parseResult?.memWorkbookPreview
    if (step !== 2 || !preview?.isMemModel) return null
    const mergedInputs = {
      ...DEFAULT_MEM_INPUTS,
      ...preview.extractedInputs,
    }
    const assumptions = preview.extractedAssumptions ?? createDefaultMemAnnualAssumptions()
    const baseHourly = getBaselineMemHourlyDataset()
    const parsedHourly = preview.hourlyDataset
    const hourly =
      parsedHourly && parsedHourly.consumo_mwh.length === 8760
        ? {
            label: `${parseResult?.fileName ?? 'Excel MEM'}`,
            year: baseHourly.year,
            fechas: parsedHourly.fechas,
            horas: parsedHourly.horas,
            consumo_mwh: Float64Array.from(parsedHourly.consumo_mwh),
            pml_mxn_mwh: Float64Array.from(parsedHourly.pml_mxn_mwh),
            curva_solar_mw:
              parsedHourly.curva_solar_mw.length === 8760
                ? Float64Array.from(parsedHourly.curva_solar_mw)
                : Float64Array.from(baseHourly.curva_solar_mw),
          }
        : baseHourly
    const hc100 =
      preview.criticalHours100HC && preview.criticalHours100HC.length > 0
        ? preview.criticalHours100HC
        : getBaseline100HC()

    const outcome = runMemSimulation({
      inputs: mergedInputs,
      assumptions,
      hourly,
      criticalHours100HC: hc100,
    })
    return outcome.status === 'ok' ? outcome : null
  }, [step, parseResult])

  function buildCamposForSave(): CalculadoraCampoDef[] {
    const memExtracted = parseResult?.memWorkbookPreview?.extractedInputs
    const memExtractedKeys = new Set<string>(
      parseResult?.memWorkbookPreview?.extractedInputKeys ?? [],
    )
    const shouldApplyKey = (key: string) =>
      memExtractedKeys.size === 0 || memExtractedKeys.has(key)

    const memMap = new Map<string, CalculadoraCampoDef>(
      MEM_TEMPLATE_CAMPOS.map((c) => [c.key, { ...c }]),
    )
    const merged = currentCampos.map((c) => {
      if (memExtracted && shouldApplyKey(c.key) && c.key in memExtracted) {
        const val = (memExtracted as Record<string, unknown>)[c.key]
        if (val !== undefined && val !== null) {
          memMap.delete(c.key)
          return { ...c, defaultValue: val as CalculadoraCampoDef['defaultValue'] }
        }
      }
      memMap.delete(c.key)
      return c
    })
    if (parseResult?.memWorkbookPreview?.isMemModel) {
      for (const extra of memMap.values()) {
        const val =
          memExtracted && shouldApplyKey(extra.key)
            ? (memExtracted as Record<string, unknown>)[extra.key]
            : undefined
        merged.push(
          val !== undefined && val !== null
            ? { ...extra, defaultValue: val as CalculadoraCampoDef['defaultValue'] }
            : extra,
        )
      }
    }
    return merged
  }

  function buildExcelMapeo(): ExcelMapeoCampos {
    const outputMappings: ExcelOutputMapping[] = mappingValidation.selectedOutputs
      .filter((o) => o.assignedOutput !== '__ignore__')
      .map((o) => ({
        cellRef: o.fc.cellRef,
        sheetName: o.fc.sheetName,
        outputKey: o.assignedOutput as FormulaDefinicion['key'],
        rawFormula: o.fc.rawFormula,
        rewrittenExpression: o.rewritten,
      }))

    return {
      inputMappings: activeInputMappings,
      outputMappings,
    }
  }

  async function handleConfirmImport() {
    if (!parseResult) return
    if (!templateNombre.trim()) {
      setSaveError('Ingresa un nombre para la plantilla importada.')
      return
    }
    setSaving(true)
    setSaveError(null)

    const baseSnapshot =
      step3Check?.ok && step3Check.dryRun.status === 'ok'
        ? {
            capex_total: step3Check.dryRun.capex_total,
            ahorro_monetario_y1: step3Check.dryRun.ahorro_monetario_y1,
            payback_simple_anios: step3Check.dryRun.payback_simple_anios,
            van: step3Check.dryRun.van,
            tir_pct: step3Check.dryRun.tir_pct,
          }
        : {}

    const previewSnapshot =
      parseResult.memWorkbookPreview?.isMemModel
        ? {
            ...baseSnapshot,
            isMemModel: true,
            detectedSheets: parseResult.memWorkbookPreview.detectedSheets,
            definedNamesMatched: parseResult.memWorkbookPreview.definedNamesMatched,
            hourlySummary: parseResult.memWorkbookPreview.hourlySummary,
            cachedExcelKpis: parseResult.memWorkbookPreview.cachedExcelKpis ?? null,
            memPreviewKpis: memPreviewRun
              ? {
                  ahorro_total_y1: memPreviewRun.year1.ahorro_total_mxn,
                  capex_total: memPreviewRun.financial.capex_total_mxn,
                  vpn: memPreviewRun.financial.vpn,
                  tir_pct: memPreviewRun.financial.tir_pct,
                  payback_simple_anios: memPreviewRun.financial.payback_simple_anios,
                }
              : null,
          }
        : Object.keys(baseSnapshot).length > 0
          ? baseSnapshot
          : null

    const res = await guardarPlantillaCalculadora({
      nombre: templateNombre.trim(),
      descripcion: `Importado desde ${parseResult.fileName} (hoja ${selectedSheet})`,
      modo: 'excel_import',
      campos: buildCamposForSave(),
      formulas: mergedFormulas,
      horizonte_opciones: currentHorizonteOpciones,
      excel_archivo_nombre: parseResult.fileName,
      excel_archivo_hash: parseResult.fileHash,
      excel_hoja_origen: selectedSheet,
      excel_mapeo_campos: buildExcelMapeo(),
      excel_preview_snapshot: previewSnapshot,
      notas: templateNotas.trim() || null,
    })

    setSaving(false)
    if (res.error || !res.data) {
      setSaveError(
        res.validationErrors?.length
          ? `${res.error} (${res.validationErrors.join(' · ')})`
          : res.error || 'No se pudo importar la plantilla.',
      )
      return
    }

    onImported(res.data)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-linea pb-4">
        <StepIndicator
          steps={['1. Subir archivo Excel', '2. Mapeo de campos', '3. Confirmación e importación']}
          current={step}
        />
        {parseResult && (
          <div className="flex items-center gap-2 text-xs text-texto-suave">
            <FileSpreadsheet size={15} className="text-menta" />
            <span className="font-semibold text-principal">{parseResult.fileName}</span>
            <button
              type="button"
              onClick={() => {
                setParseResult(null)
                setStep(0)
                setUploadError(null)
                setSaveError(null)
              }}
              className="text-red-500 hover:underline ml-1"
            >
              Cambiar archivo
            </button>
          </div>
        )}
      </div>

      {/* STEP 1: Upload Excel / CSV */}
      {step === 0 && (
        <SpreadsheetDropzone
          uploading={uploading}
          error={uploadError}
          title="Arrastra tu archivo Excel (.xlsx) o .csv, o haz clic para seleccionarlo"
          uploadingLabel="Analizando libro de cálculo y detectando fórmulas..."
          description={
            'Tamaño máximo 10 MB. Se extraerán las celdas de entrada, referencias y fórmulas para que confirmes el mapeo antes de activar el modelo. Por seguridad, el formato binario .xls antiguo no está permitido.'
          }
          onFileSelected={(file) => void processFileUpload(file)}
          onValidationError={(msg) => setUploadError(msg)}
        />
      )}

      {/* STEP 2: Map Fields & Formulas */}
      {step === 1 && parseResult && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-fondo/70 border border-linea rounded-xl px-4 py-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs font-bold text-principal">Hoja de cálculo:</label>
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="rounded-lg border border-borde bg-white px-3 py-1.5 text-xs font-semibold text-principal"
              >
                {parseResult.sheets.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.rowCount} filas)
                  </option>
                ))}
              </select>
              <span className="text-xs text-texto-suave">
                {sheetCandidateInputs.length} entradas · {sheetFormulaCells.length} fórmulas detectadas
              </span>
            </div>
            <Badge variant="info">
              <Sparkles size={11} className="mr-1" />
              Sugerencias automáticas aplicadas
            </Badge>
          </div>

          {parseResult.memWorkbookPreview?.isMemModel && (
            <div className="p-4 rounded-2xl bg-menta/10 border border-menta/30 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-principal">
                  Modelo FV + BESS MEM (8,760h + 100HC) detectado automáticamente
                </span>
                <Badge variant="success">
                  {parseResult.memWorkbookPreview.definedNamesMatched} Defined Names
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-principal">
                <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-linea">
                  <span className="text-texto-suave block">Datos horarios</span>
                  <span className="num font-bold">
                    {fmtNum(parseResult.memWorkbookPreview.hourlySummary.datosRows, 0)} h
                  </span>
                </div>
                <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-linea">
                  <span className="text-texto-suave block">Curva Solar</span>
                  <span className="num font-bold">
                    {fmtNum(parseResult.memWorkbookPreview.hourlySummary.curvaSolarRows, 0)} h (
                    {parseResult.memWorkbookPreview.hourlySummary.curvaSolarNonZeroHours} activas)
                  </span>
                </div>
                <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-linea">
                  <span className="text-texto-suave block">100 Horas Críticas</span>
                  <span className="num font-bold">
                    {parseResult.memWorkbookPreview.hourlySummary.criticalHoursCount} filas
                    {parseResult.memWorkbookPreview.hourlySummary.duplicateCriticalHoursCount > 0 &&
                      ` (${parseResult.memWorkbookPreview.hourlySummary.duplicateCriticalHoursCount} repetidas)`}
                  </span>
                </div>
                <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-linea">
                  <span className="text-texto-suave block">PML promedio</span>
                  <span className="num font-bold">
                    {fmtCurrency(
                      parseResult.memWorkbookPreview.hourlySummary.avgPmlMxnMwh,
                      'MXN',
                    )}
                    /MWh
                  </span>
                </div>
              </div>
            </div>
          )}

          {mappingValidation.unresolvedItems.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">Faltan referencias de celda por mapear</p>
                <p className="mt-0.5">
                  Asigna una variable de plataforma a todas las celdas referenciadas por las fórmulas de salida seleccionadas antes de continuar:{' '}
                  <span className="font-bold">
                    {Array.from(
                      new Set(mappingValidation.unresolvedItems.flatMap((u) => u.unresolvedRefs)),
                    ).join(', ')}
                  </span>
                </p>
              </div>
            </div>
          )}

          {mappingValidation.duplicateOutputs.length > 0 && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold flex items-center gap-2">
              <AlertTriangle size={15} />
              Cada salida del simulador puede asignarse a una sola celda de fórmula (duplicadas:{' '}
              {mappingValidation.duplicateOutputs.join(', ')}).
            </div>
          )}

          {/* Table 1: Detected Inputs */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-principal">
              1. Entradas detectadas (Celdas / Referencias → Variable de Plataforma)
            </h5>
            <div className="border border-linea rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-principal text-white">
                      <th className="text-left px-3.5 py-2.5 font-semibold">Celda</th>
                      <th className="text-left px-3.5 py-2.5 font-semibold">Etiqueta / Origen</th>
                      <th className="text-right px-3.5 py-2.5 font-semibold">Valor de muestra</th>
                      <th className="text-left px-3.5 py-2.5 font-semibold">Variable de Plataforma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linea bg-white">
                    {sheetCandidateInputs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-texto-suave">
                          No se detectaron celdas de entrada numéricas ni referencias en esta hoja.
                        </td>
                      </tr>
                    ) : (
                      sheetCandidateInputs.map((cand) => {
                        const mapKey = `${cand.sheetName}!${cand.cellRef}`
                        const selectedVar = inputSelections[mapKey] ?? '__ignore__'
                        const isReferencedUnmapped =
                          selectedVar === '__ignore__' &&
                          mappingValidation.unresolvedItems.some((u) =>
                            u.unresolvedRefs.some(
                              (ref) =>
                                ref === cand.cellRef ||
                                ref === `${cand.sheetName}!${cand.cellRef}`,
                            ),
                          )

                        return (
                          <tr
                            key={mapKey}
                            className={isReferencedUnmapped ? 'bg-amber-50/70' : undefined}
                          >
                            <td className="px-3.5 py-2.5 font-mono font-bold text-principal whitespace-nowrap">
                              {cand.sheetName !== selectedSheet
                                ? `${cand.sheetName}!${cand.cellRef}`
                                : cand.cellRef}
                            </td>
                            <td className="px-3.5 py-2.5 text-principal">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{cand.label}</span>
                                {inputDefinedNameByKey.has(mapKey) && (
                                  <Badge variant="success">
                                    {inputDefinedNameByKey.get(mapKey)} (100%)
                                  </Badge>
                                )}
                                {cand.referencedBy && cand.referencedBy.length > 0 && (
                                  <Badge variant="default">
                                    Usada en {cand.referencedBy.join(', ')}
                                  </Badge>
                                )}
                                {isReferencedUnmapped && (
                                  <Badge variant="warning">Requerida por fórmula</Badge>
                                )}
                              </div>
                            </td>
                            <td className="num px-3.5 py-2.5 text-right text-texto-suave whitespace-nowrap">
                              {typeof cand.sampleValue === 'number'
                                ? fmtNum(cand.sampleValue, 4)
                                : cand.sampleValue ?? '—'}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <select
                                value={selectedVar}
                                onChange={(e) =>
                                  setInputSelections((prev) => ({
                                    ...prev,
                                    [mapKey]: e.target.value,
                                  }))
                                }
                                className={`w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium bg-white ${
                                  isReferencedUnmapped ? 'border-amber-400' : 'border-borde'
                                }`}
                              >
                                <option value="__ignore__">— Ignorar —</option>
                                {variablesByCategory.map(([cat, vars]) => (
                                  <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                                    {vars.map((v) => (
                                      <option key={v.key} value={v.key}>
                                        {v.key} — {v.label} ({v.unit})
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Table 2: Detected Formulas */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-principal">
              2. Fórmulas detectadas (Celda de Excel → Salida del Simulador)
            </h5>
            <div className="border border-linea rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-principal text-white">
                      <th className="text-left px-3.5 py-2.5 font-semibold">Celda</th>
                      <th className="text-left px-3.5 py-2.5 font-semibold">Fórmula original y reescrita</th>
                      <th className="text-left px-3.5 py-2.5 font-semibold">Salida del Simulador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linea bg-white">
                    {formulaPreviews.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-texto-suave">
                          No se detectaron fórmulas en la hoja seleccionada.
                        </td>
                      </tr>
                    ) : (
                      formulaPreviews.map((item) => {
                        const isMapped = item.assignedOutput !== '__ignore__'
                        const hasWarn =
                          isMapped &&
                          (item.unresolvedRefs.length > 0 || item.parseErr !== null)

                        return (
                          <tr
                            key={item.mapKey}
                            className={hasWarn ? 'bg-amber-50/70' : undefined}
                          >
                            <td className="px-3.5 py-2.5 align-top font-mono font-bold text-principal whitespace-nowrap">
                              <div>{item.fc.cellRef}</div>
                              <div className="font-sans text-[11px] font-normal text-texto-suave mt-0.5">
                                {item.fc.label}
                              </div>
                            </td>
                            <td className="px-3.5 py-2.5 align-top space-y-1 max-w-md">
                              <div className="font-mono text-[11px] text-texto-suave break-all">
                                Excel: {item.fc.rawFormula}
                              </div>
                              <div className="font-mono text-[11px] font-semibold text-principal break-all bg-fondo/80 px-2 py-1 rounded">
                                Nodo: {item.rewritten}
                              </div>
                              {isMapped && item.unresolvedRefs.length > 0 && (
                                <p className="text-[11px] font-bold text-amber-800">
                                  Celdas sin mapear: {item.unresolvedRefs.join(', ')}
                                </p>
                              )}
                              {isMapped && item.parseErr && (
                                <p className="text-[11px] font-bold text-red-600">
                                  Error de sintaxis: {item.parseErr}
                                </p>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 align-top">
                              <select
                                value={item.assignedOutput}
                                onChange={(e) =>
                                  setOutputSelections((prev) => ({
                                    ...prev,
                                    [item.mapKey]: e.target.value as
                                      | FormulaDefinicion['key']
                                      | '__ignore__',
                                  }))
                                }
                                className="w-full rounded-lg border border-borde bg-white px-2.5 py-1.5 text-xs font-medium"
                              >
                                <option value="__ignore__">— Ignorar —</option>
                                {PLATFORM_OUTPUT_DEFINITIONS.map((out) => (
                                  <option key={out.key} value={out.key}>
                                    {out.label} ({out.key})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft size={14} />
              Subir otro archivo
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!mappingValidation.canProceedToStep3}
              onClick={() => setStep(2)}
            >
              Revisar y confirmar
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Confirm & Import */}
      {step === 2 && parseResult && (
        <div className="space-y-5">
          {saveError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-2">
              <X size={15} className="shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-principal mb-1">
                Nombre de la nueva versión de plantilla *
              </label>
              <input
                type="text"
                value={templateNombre}
                onChange={(e) => setTemplateNombre(e.target.value)}
                className="w-full rounded-xl border border-borde bg-white px-3.5 py-2 text-sm text-principal"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-principal mb-1">
                Notas de versión (opcional)
              </label>
              <input
                type="text"
                value={templateNotas}
                onChange={(e) => setTemplateNotas(e.target.value)}
                placeholder="Ej. Modelo financiero importado Q4"
                className="w-full rounded-xl border border-borde bg-white px-3.5 py-2 text-sm text-principal"
              />
            </div>
          </div>

          <div className="border border-linea rounded-xl overflow-hidden">
            <div className="bg-principal text-white px-4 py-2.5 text-xs font-bold">
              Fórmulas canónicas resultantes ({mergedFormulas.length})
            </div>
            <div className="divide-y divide-linea bg-white">
              {mergedFormulas.map((f) => (
                <div key={f.key} className="px-4 py-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-principal">
                      {f.label}{' '}
                      <span className="font-mono font-normal text-texto-suave">({f.key})</span>
                    </span>
                    {f.source_cell ? (
                      <Badge variant="neutral">Excel: {f.source_cell}</Badge>
                    ) : (
                      <Badge variant="default">Heredada de plantilla actual</Badge>
                    )}
                  </div>
                  <code className="text-[11px] font-mono text-principal bg-fondo px-2.5 py-1.5 rounded-lg break-all">
                    {f.expression}
                  </code>
                </div>
              ))}
            </div>
          </div>

          {step3Check && !step3Check.ok && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              Error de compilación AST: {step3Check.error}
            </div>
          )}

          {memPreviewRun && (
            <div className="rounded-2xl border border-menta/40 bg-menta/10 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-principal">
                  Paridad simulador horario MEM 8,760h + 100HC (con datos importados)
                </span>
                <Badge variant="success">Motor horario validado</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="bg-white rounded-xl p-3 border border-linea">
                  <span className="block text-[10px] text-texto-suave uppercase font-semibold">
                    CAPEX MEM
                  </span>
                  <span className="num font-bold text-principal">
                    {fmtCurrency(memPreviewRun.financial.capex_total_mxn, 'MXN')}
                  </span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-linea">
                  <span className="block text-[10px] text-texto-suave uppercase font-semibold">
                    Ahorro Año 1
                  </span>
                  <span className="num font-bold text-menta">
                    {fmtCurrency(memPreviewRun.year1.ahorro_total_mxn, 'MXN')}
                  </span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-linea">
                  <span className="block text-[10px] text-texto-suave uppercase font-semibold">
                    VPN ({memPreviewRun.inputs.fin_horizonte_anios}a)
                  </span>
                  <span className="num font-bold text-principal">
                    {fmtCurrency(memPreviewRun.financial.vpn, 'MXN')}
                  </span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-linea">
                  <span className="block text-[10px] text-texto-suave uppercase font-semibold">
                    TIR
                  </span>
                  <span className="num font-bold text-principal">
                    {memPreviewRun.financial.tir_pct !== null
                      ? fmtPct(memPreviewRun.financial.tir_pct, 2)
                      : '—'}
                  </span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-linea">
                  <span className="block text-[10px] text-texto-suave uppercase font-semibold">
                    Payback Simple / Desc.
                  </span>
                  <span className="num font-bold text-principal">
                    {memPreviewRun.financial.payback_simple_anios !== null
                      ? `${fmtNum(memPreviewRun.financial.payback_simple_anios, 2)}a`
                      : '—'}{' '}
                    /{' '}
                    {memPreviewRun.financial.payback_descontado_anios !== null
                      ? `${fmtNum(memPreviewRun.financial.payback_descontado_anios, 2)}a`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {step3Check?.ok && step3Check.dryRun.status === 'ok' && (
            <div className="rounded-2xl border border-borde bg-fondo/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-principal">
                  Prueba en vivo con proyecto sintético FV+BESS (10 años · MXN)
                </span>
                <Badge variant="success">AST válido · Sin ciclos</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="bg-white rounded-xl p-3 border border-linea">
                  <span className="block text-[10px] text-texto-suave uppercase font-semibold">
                    CAPEX prueba
                  </span>
                  <span className="num font-bold text-principal">
                    {fmtCurrency(step3Check.dryRun.capex_total, 'MXN')}
                  </span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-linea">
                  <span className="block text-[10px] text-texto-suave uppercase font-semibold">
                    Ahorro Año 1
                  </span>
                  <span className="num font-bold text-menta">
                    {fmtCurrency(step3Check.dryRun.ahorro_monetario_y1, 'MXN')}
                  </span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-linea">
                  <span className="block text-[10px] text-texto-suave uppercase font-semibold">
                    Payback Simple
                  </span>
                  <span className="num font-bold text-principal">
                    {step3Check.dryRun.payback_simple_anios != null
                      ? `${fmtNum(step3Check.dryRun.payback_simple_anios, 2)} años`
                      : step3Check.dryRun.payback_estado}
                  </span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-linea">
                  <span className="block text-[10px] text-texto-suave uppercase font-semibold">
                    VAN
                  </span>
                  <span className="num font-bold text-principal">
                    {step3Check.dryRun.van != null
                      ? fmtCurrency(step3Check.dryRun.van, 'MXN')
                      : '—'}
                  </span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-linea">
                  <span className="block text-[10px] text-texto-suave uppercase font-semibold">
                    TIR
                  </span>
                  <span className="num font-bold text-principal">
                    {step3Check.dryRun.tir_pct != null
                      ? fmtPct(step3Check.dryRun.tir_pct, 2)
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={saving}>
              <ArrowLeft size={14} />
              Volver al mapeo
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {onApplyToEditor && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || !step3Check?.ok}
                  onClick={() =>
                    onApplyToEditor({
                      formulas: mergedFormulas,
                      excelMeta: {
                        archivoNombre: parseResult.fileName,
                        archivoHash: parseResult.fileHash,
                        hojaOrigen: selectedSheet,
                        mapeo: buildExcelMapeo(),
                      },
                    })
                  }
                >
                  Editar en Tab de Fórmulas
                </Button>
              )}

              <Button
                type="button"
                variant="primary"
                disabled={saving || !step3Check?.ok}
                onClick={handleConfirmImport}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Confirmar e importar cálculos
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExcelImportStepper
