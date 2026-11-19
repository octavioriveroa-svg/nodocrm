'use client'

import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
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
  rewriteFormulaCellRefs,
} from '@/lib/calculator/formula-engine'
import { evaluateSimulation } from '@/lib/calculator/engine'
import { FALLBACK_TEMPLATE_FORMULAS } from '@/lib/calculator/template-schema'
import { guardarPlantillaCalculadora } from '@/app/actions/calculatorConfig'
import { fmtCurrency, fmtNum, fmtPct } from '@/lib/format'
import StepIndicator from '@/components/ui/StepIndicator'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

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

const MAX_FILE_BYTES = 10 * 1024 * 1024
const LEGACY_XLS_CLIENT_MSG =
  'El formato binario .xls (Excel 97-2003) no es compatible por seguridad. Guárdalo como Libro de Excel (.xlsx) o .csv e inténtalo de nuevo.'

function previewCellRewriteClient(
  rawFormula: string,
  inputMappings: readonly Pick<ExcelInputMapping, 'cellRef' | 'sheetName' | 'platformVar'>[],
  defaultSheet?: string,
) {
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

export function ExcelImportStepper({
  currentCampos,
  currentFormulas,
  currentHorizonteOpciones,
  onApplyToEditor,
  onImported,
}: ExcelImportStepperProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [dragActive, setDragActive] = useState(false)
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

  const variablesByCategory = useMemo(() => Array.from(getVariablesByCategory().entries()), [])

  async function processFileUpload(file: File) {
    setUploadError(null)
    const lowerName = file.name.toLowerCase()
    if (lowerName.endsWith('.xls')) {
      setUploadError(LEGACY_XLS_CLIENT_MSG)
      return
    }
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.csv')) {
      setUploadError('Formato no soportado. Sube únicamente archivos .xlsx o .csv.')
      return
    }
    if (file.size === 0) {
      setUploadError('El archivo seleccionado está vacío.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError('El archivo supera el tamaño máximo permitido de 10 MB.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/calculator/excel/parse', {
        method: 'POST',
        body: formData,
      })
      const json = (await response.json()) as ExcelParseResult & { error?: string }
      if (!response.ok) {
        setUploadError(json.error || 'Error al analizar el archivo Excel.')
        return
      }

      setParseResult(json)
      setSelectedSheet(json.defaultSheet || json.sheets[0]?.name || '')

      const initInputs: Record<string, string> = {}
      for (const s of json.suggestedInputMappings) {
        initInputs[`${s.sheetName}!${s.cellRef}`] = s.suggestedVar ?? '__ignore__'
      }
      setInputSelections(initInputs)

      const initOutputs: Record<string, FormulaDefinicion['key'] | '__ignore__'> = {}
      const usedOutKeys = new Set<string>()
      for (const o of json.suggestedOutputMappings) {
        if (o.suggestedOutputKey && !usedOutKeys.has(o.suggestedOutputKey)) {
          initOutputs[`${o.sheetName}!${o.cellRef}`] = o.suggestedOutputKey
          usedOutKeys.add(o.suggestedOutputKey)
        } else {
          initOutputs[`${o.sheetName}!${o.cellRef}`] = '__ignore__'
        }
      }
      setOutputSelections(initOutputs)
      setTemplateNombre(`Importación Excel: ${json.fileName}`)
      setTemplateNotas('')
      setSaveError(null)
      setStep(1)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Error de red al subir el archivo.')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void processFileUpload(e.dataTransfer.files[0])
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      void processFileUpload(e.target.files[0])
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

  const formulaPreviews = useMemo(() => {
    return sheetFormulaCells.map((fc) => {
      const mapKey = `${fc.sheetName}!${fc.cellRef}`
      const assignedOutput = outputSelections[mapKey] ?? '__ignore__'
      let rewritten = fc.rawFormula
      let unresolvedRefs: string[] = []
      let parseErr: string | null = null
      try {
        const res = previewCellRewriteClient(fc.rawFormula, activeInputMappings, selectedSheet)
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
  }, [sheetFormulaCells, outputSelections, activeInputMappings, selectedSheet])

  const mappingValidation = useMemo(() => {
    const selectedOutputs = formulaPreviews.filter((p) => p.assignedOutput !== '__ignore__')
    const duplicateOutputs = new Set<string>()
    const seen = new Set<string>()
    for (const item of selectedOutputs) {
      if (seen.has(item.assignedOutput)) duplicateOutputs.add(item.assignedOutput)
      seen.add(item.assignedOutput)
    }

    const unresolvedItems = selectedOutputs.filter(
      (p) => p.unresolvedRefs.length > 0 || p.parseErr !== null,
    )

    const canProceedToStep3 =
      selectedOutputs.length > 0 &&
      duplicateOutputs.size === 0 &&
      unresolvedItems.length === 0

    return {
      selectedOutputs,
      duplicateOutputs: Array.from(duplicateOutputs),
      unresolvedItems,
      canProceedToStep3,
    }
  }, [formulaPreviews])

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
      const dryRun = evaluateSimulation({
        proyecto: {
          tipo: 'FV+BESS',
          capex_estimado: 1_500_000,
          moneda: 'MXN',
          incluye_mem: false,
          demanda_kw: 250,
          capacidad_mw: 0.1,
          capacidad_mwh: 0.2,
          consumo_anual_gwh: null,
          volumen_energia_mwh_anual: null,
          tarifa_actual_cfe: 3.2,
        },
        activeConfig: {
          id: 'preview-cfg',
          proyecto_id: 'preview-proj',
          nombre: 'Preview FV+BESS',
          descripcion: null,
          inversion_total: 1_500_000,
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
            id: 'preview-fv',
            proyecto_id: 'preview-proj',
            sitio_id: 'preview-site',
            configuracion_id: 'preview-cfg',
            tipo: 'fv',
            datos: {
              num_modulos: 160,
              potencia_modulos_w: 500,
              generacion_anual_kwh: 120_000,
              capex: 1_000_000,
              capex_moneda: 'MXN',
            },
            created_at: '',
          },
          {
            id: 'preview-bess',
            proyecto_id: 'preview-proj',
            sitio_id: 'preview-site',
            configuracion_id: 'preview-cfg',
            tipo: 'bess',
            datos: {
              potencia_kw: 100,
              capacidad_kwh: 200,
              uso: 'load_shifting',
              capex: 500_000,
              capex_moneda: 'MXN',
            },
            created_at: '',
          },
        ],
        activeFinancing: null,
        template: {
          id: '',
          modo: 'excel_import',
          campos: currentCampos,
          formulas: mergedFormulas,
        },
        monedaCalculo: 'MXN',
        horizonteAnios: 10,
        vistaFinanciamiento: 'bruto',
        overrides: {},
      })
      return { ok: true as const, dryRun }
    } catch (err) {
      const msg = err instanceof FormulaError ? err.message : String(err)
      return { ok: false as const, error: msg }
    }
  }, [step, mergedFormulas, currentCampos])

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

    const previewSnapshot =
      step3Check?.ok && step3Check.dryRun.status === 'ok'
        ? {
            capex_total: step3Check.dryRun.capex_total,
            ahorro_monetario_y1: step3Check.dryRun.ahorro_monetario_y1,
            payback_simple_anios: step3Check.dryRun.payback_simple_anios,
            van: step3Check.dryRun.van,
            tir_pct: step3Check.dryRun.tir_pct,
          }
        : null

    const res = await guardarPlantillaCalculadora({
      nombre: templateNombre.trim(),
      descripcion: `Importado desde ${parseResult.fileName} (hoja ${selectedSheet})`,
      modo: 'excel_import',
      campos: currentCampos,
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
        <div className="space-y-4">
          {uploadError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          <div
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(false)
            }}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
              dragActive
                ? 'border-acento bg-acento/10 scale-[0.99]'
                : 'border-linea bg-fondo/40 hover:border-principal/40 hover:bg-fondo'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <div className="w-12 h-12 rounded-2xl bg-principal text-acento flex items-center justify-center mb-3 shadow-sm">
              {uploading ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
            </div>
            <p className="text-sm font-bold text-principal">
              {uploading
                ? 'Analizando libro de cálculo y detectando fórmulas...'
                : 'Arrastra tu archivo Excel (.xlsx) o .csv, o haz clic para seleccionarlo'}
            </p>
            <p className="text-xs text-texto-suave mt-1 text-center max-w-lg">
              Tamaño máximo 10 MB. Se extraerán las celdas de entrada, referencias y fórmulas para que confirmes el mapeo antes de activar el modelo. Por seguridad, el formato binario <span className="font-semibold">.xls</span> antiguo no está permitido.
            </p>
          </div>
        </div>
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
