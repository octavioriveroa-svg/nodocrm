'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react'
import type {
  ExcelParseResult,
  MemAnnualAssumptions,
  MemCriticalHourEntry,
  MemCriticalHourEvaluated,
  MemHourlyDataset,
  MemSimulatorInputs,
  MemWorkbookImportPreview,
  MemYear1Results,
  Moneda,
} from '@/lib/types'
import {
  buildMemImportApplyPayload,
  evaluateMemImportSelection,
  getDefaultMemImportSelection,
  inspectMemImportPreview,
  type MemImportSectionKey,
  type MemImportSelection,
} from '@/lib/calculator/mem-import-wizard'
import { createDefaultMemAnnualAssumptions } from '@/lib/calculator/datasets/mem-baseline'
import { runMemSimulation, simulateMemYear1 } from '@/lib/calculator/mem-hourly-engine'
import { fmtCurrency, fmtNum, fmtPct } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import StepIndicator from '@/components/ui/StepIndicator'
import { SpreadsheetDropzone } from '@/components/calculator/SpreadsheetDropzone'

export interface MemDatos100HcViewProps {
  inputs: MemSimulatorInputs
  assumptions?: MemAnnualAssumptions
  moneda?: Moneda
  hourly: MemHourlyDataset
  year1: MemYear1Results
  criticalHours100HC: readonly MemCriticalHourEntry[]
  onUpdateCriticalHours: (next: MemCriticalHourEntry[]) => void
  onApplyImportedWorkbook: (payload: {
    hourlyDataset?: MemHourlyDataset
    criticalHours100HC?: MemCriticalHourEntry[]
    extractedInputs?: Partial<MemSimulatorInputs>
    extractedAssumptions?: MemWorkbookImportPreview['extractedAssumptions']
  }) => void
  onRestoreBaseline: () => void
  disabled?: boolean
}

const WIZARD_STEPS = [
  '1. Subir archivo .xlsx / .csv',
  '2. Revisar y elegir secciones',
  '3. Confirmar e importar',
]

export function MemDatos100HcView({
  inputs,
  assumptions,
  moneda = 'MXN',
  hourly,
  year1,
  criticalHours100HC,
  onUpdateCriticalHours,
  onApplyImportedWorkbook,
  onRestoreBaseline,
  disabled = false,
}: MemDatos100HcViewProps) {
  const [subTab, setSubTab] = useState<'100hc' | 'datos'>('100hc')
  const [selectedDay, setSelectedDay] = useState<number>(1)

  // Guided 3-step import wizard state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2>(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [parsedPreview, setParsedPreview] = useState<{
    fileName: string
    preview: MemWorkbookImportPreview
  } | null>(null)
  const [sectionSelection, setSectionSelection] = useState<MemImportSelection>({
    datos: false,
    curvaSolar: false,
    hc100: false,
    inputs: false,
    assumptions: false,
  })
  const uploadAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort()
    }
  }, [])

  const hourlyStats = useMemo(() => {
    let maxCons = 0
    let sumCons = 0
    let sumPml = 0
    let solarHours = 0
    const len = hourly.consumo_mwh.length
    for (let i = 0; i < len; i++) {
      const c = hourly.consumo_mwh[i]
      if (c > maxCons) maxCons = c
      sumCons += c
      sumPml += hourly.pml_mxn_mwh[i]
      if (hourly.curva_solar_mw[i] > 0) solarHours++
    }
    return {
      rows: len,
      maxConsMw: maxCons,
      totalConsMwh: sumCons,
      avgPml: len > 0 ? sumPml / len : 0,
      solarNonZeroHours: solarHours,
      dateStart: hourly.fechas[0] ?? '—',
      dateEnd: hourly.fechas[hourly.fechas.length - 1] ?? '—',
    }
  }, [hourly])

  const totalDays = Math.max(1, Math.ceil(hourly.fechas.length / 24))

  const dayRows = useMemo(() => {
    const start = (selectedDay - 1) * 24
    const end = Math.min(start + 24, hourly.fechas.length)
    const out: Array<{
      fecha: string
      hora: number
      consumo_mwh: number
      pml_mxn_mwh: number
      curva_solar_mw: number
    }> = []
    for (let i = start; i < end; i++) {
      out.push({
        fecha: hourly.fechas[i],
        hora: hourly.horas[i],
        consumo_mwh: hourly.consumo_mwh[i],
        pml_mxn_mwh: hourly.pml_mxn_mwh[i],
        curva_solar_mw: hourly.curva_solar_mw[i] ?? 0,
      })
    }
    return out
  }, [hourly, selectedDay])

  const inspection = useMemo(() => {
    if (!parsedPreview) return null
    return inspectMemImportPreview(
      parsedPreview.preview,
      parsedPreview.fileName,
      hourly,
      inputs,
    )
  }, [parsedPreview, hourly, inputs])

  const selectionEvaluation = useMemo(() => {
    if (!parsedPreview || !inspection) return null
    return evaluateMemImportSelection(
      inspection,
      parsedPreview.preview,
      hourly,
      sectionSelection,
    )
  }, [parsedPreview, inspection, hourly, sectionSelection])

  const stagedPayload = useMemo(() => {
    if (!parsedPreview || !inspection || wizardStep !== 2) return null
    return buildMemImportApplyPayload(
      inspection,
      parsedPreview.preview,
      hourly,
      sectionSelection,
    )
  }, [parsedPreview, inspection, wizardStep, hourly, sectionSelection])

  const step3ImpactPreview = useMemo(() => {
    if (!stagedPayload || wizardStep !== 2) return null
    const nextInputs = stagedPayload.extractedInputs
      ? { ...inputs, ...stagedPayload.extractedInputs }
      : inputs
    const nextAssumptions =
      stagedPayload.extractedAssumptions ?? assumptions ?? createDefaultMemAnnualAssumptions()
    const nextHourly = stagedPayload.hourlyDataset ?? hourly
    const nextHc = stagedPayload.criticalHours100HC ?? criticalHours100HC
    const full = runMemSimulation({
      inputs: nextInputs,
      assumptions: nextAssumptions,
      hourly: nextHourly,
      criticalHours100HC: nextHc,
      financialOptions: { moneda },
    })
    if (full.status === 'ok') {
      return {
        year1: full.year1,
        financial: full.financial,
      }
    }
    return {
      year1: simulateMemYear1(nextInputs, nextHourly, nextHc),
      financial: null,
    }
  }, [stagedPayload, wizardStep, inputs, assumptions, moneda, hourly, criticalHours100HC])

  function resetWizardState(keepOpen: boolean) {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    setUploading(false)
    setWizardOpen(keepOpen)
    setWizardStep(0)
    setUploadError(null)
    setParsedPreview(null)
    setSectionSelection({
      datos: false,
      curvaSolar: false,
      hc100: false,
      inputs: false,
      assumptions: false,
    })
  }

  async function handleFileUpload(file: File) {
    uploadAbortRef.current?.abort()
    const controller = new AbortController()
    uploadAbortRef.current = controller

    setUploadError(null)
    setUploadNotice(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/calculator/mem-data/parse', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      const json = (await res.json()) as Pick<
        ExcelParseResult,
        'fileName' | 'fileHash' | 'memWorkbookPreview'
      > & { error?: string }
      if (controller.signal.aborted) return
      if (!res.ok) {
        setUploadError(json.error || 'No se pudo procesar el archivo.')
        return
      }
      const preview = json.memWorkbookPreview
      if (!preview || !preview.isMemModel) {
        setUploadError(
          'No se detectaron columnas MEM reconocibles (Datos, Curva Solar, 100HC o Simulador MEM).',
        )
        return
      }

      const nextInspection = inspectMemImportPreview(preview, json.fileName, hourly, inputs)
      const defaultSel = getDefaultMemImportSelection(nextInspection, preview, hourly)
      setParsedPreview({ fileName: json.fileName, preview })
      setSectionSelection(defaultSel)
      setWizardStep(1)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setUploadError(err instanceof Error ? err.message : 'Error de red al subir el archivo.')
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null
        setUploading(false)
      }
    }
  }

  function toggleSection(key: MemImportSectionKey) {
    setSectionSelection((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleConfirmImport() {
    if (!parsedPreview || !inspection || !selectionEvaluation?.canProceed) return
    const payload = buildMemImportApplyPayload(
      inspection,
      parsedPreview.preview,
      hourly,
      sectionSelection,
    )
    if (payload.appliedLabels.length === 0) return

    onApplyImportedWorkbook({
      hourlyDataset: payload.hourlyDataset,
      criticalHours100HC: payload.criticalHours100HC,
      extractedInputs: payload.extractedInputs,
      extractedAssumptions: payload.extractedAssumptions,
    })
    setUploadNotice(
      `Importado desde ${parsedPreview.fileName}: ${payload.appliedLabels.join(', ')}.`,
    )
    resetWizardState(false)
  }

  function handleUpdateHcEntry(index: number, patch: Partial<MemCriticalHourEntry>) {
    const next = criticalHours100HC.map((row, idx) =>
      idx === index ? { ...row, ...patch } : row,
    )
    onUpdateCriticalHours(next)
  }

  return (
    <div className="space-y-5">
      {/* Header + Import Wizard Trigger */}
      <div className="bg-white border border-borde rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-menta" />
            <h4 className="text-sm font-extrabold text-principal">
              Datos Horarios (8,760 h) y 100 Horas Críticas (CENACE)
            </h4>
          </div>
          <p className="text-xs text-texto-suave">
            Dataset activo: <strong className="text-principal">{hourly.label}</strong> ({hourlyStats.dateStart} → {hourlyStats.dateEnd})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={wizardOpen ? 'secondary' : 'outline'}
            size="sm"
            disabled={disabled}
            onClick={() => {
              if (wizardOpen) {
                resetWizardState(false)
              } else {
                setUploadNotice(null)
                resetWizardState(true)
              }
            }}
          >
            <Upload size={14} />
            {wizardOpen
              ? 'Cerrar asistente de carga'
              : 'Cargar Excel / CSV (MEM / Datos / Solar / 100HC)'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              setUploadError(null)
              setUploadNotice('Dataset base CENACE 2025 y 100HC restaurados.')
              resetWizardState(false)
              onRestoreBaseline()
            }}
          >
            <RotateCcw size={14} />
            Restaurar 2025 base
          </Button>
        </div>
      </div>

      {/* Guided 3-Step Import Wizard */}
      {wizardOpen && !disabled && (
        <div className="bg-white border border-borde rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linea pb-4">
            <StepIndicator steps={WIZARD_STEPS} current={wizardStep} />
            <div className="flex items-center gap-2">
              {parsedPreview && (
                <div className="flex items-center gap-1.5 text-xs text-texto-suave">
                  <FileSpreadsheet size={14} className="text-menta" />
                  <span className="font-semibold text-principal">{parsedPreview.fileName}</span>
                  <button
                    type="button"
                    onClick={() => resetWizardState(true)}
                    className="text-red-600 hover:underline ml-1 font-semibold"
                  >
                    Cambiar archivo
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => resetWizardState(false)}
                className="p-1.5 rounded-lg text-texto-suave hover:text-principal hover:bg-fondo"
                aria-label="Cerrar asistente"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* PASO 1: Subir archivo .xlsx / .csv */}
          {wizardStep === 0 && (
            <SpreadsheetDropzone
              compact
              uploading={uploading}
              error={uploadError}
              title="Arrastra tu archivo .xlsx o .csv, o haz clic para seleccionarlo"
              uploadingLabel="Analizando series horarias, 100HC e Inputs MEM..."
              description="Compatible con libros completos Simulador FV + BESS MEM.xlsx o archivos individuales de Datos (8,760 h), Curva Solar (8,760 h) y 100 Horas Críticas. Máximo 10 MB (.xls binario no permitido)."
              onFileSelected={(file) => void handleFileUpload(file)}
              onValidationError={(msg) => setUploadError(msg)}
            />
          )}

          {/* PASO 2: Revisar series y supuestos detectados y elegir qué secciones aplicar */}
          {wizardStep === 1 && parsedPreview && inspection && selectionEvaluation && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-fondo/70 border border-linea rounded-xl px-3.5 py-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-principal">Hojas detectadas:</span>
                  {inspection.detectedSheets.map((s) => (
                    <Badge key={s} variant="default">
                      {s}
                    </Badge>
                  ))}
                </div>
                <span className="text-texto-suave">
                  Selecciona las secciones que deseas importar al simulador
                </span>
              </div>

              {selectionEvaluation.blockingErrors.length > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    Corrige o desmarca las secciones con error antes de continuar:
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {selectionEvaluation.blockingErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectionEvaluation.warnings.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900 space-y-1">
                  {selectionEvaluation.warnings.map((w, idx) => (
                    <p key={idx} className="flex items-start gap-1.5">
                      <AlertTriangle size={13} className="shrink-0 text-amber-600 mt-0.5" />
                      <span>{w}</span>
                    </p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Datos 8,760h */}
                <label
                  className={`rounded-xl border p-3.5 flex items-start gap-3 transition-colors ${
                    !inspection.datos.detected
                      ? 'border-linea bg-fondo/30 opacity-60 cursor-not-allowed'
                      : sectionSelection.datos
                        ? inspection.datos.valid
                          ? 'border-menta bg-menta/5 cursor-pointer'
                          : 'border-red-300 bg-red-50/40 cursor-pointer'
                        : 'border-borde bg-white hover:bg-fondo/40 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sectionSelection.datos}
                    disabled={!inspection.datos.detected || (!sectionSelection.datos && !inspection.datos.valid)}
                    onChange={() => toggleSection('datos')}
                    className="mt-0.5 h-4 w-4 accent-principal"
                  />
                  <div className="flex-1 min-w-0 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-principal">Datos 8,760h (Consumo + PML)</span>
                      {!inspection.datos.detected ? (
                        <Badge variant="default">No detectado</Badge>
                      ) : inspection.datos.valid ? (
                        <Badge variant="success">8,760 h válidas</Badge>
                      ) : (
                        <Badge variant="warning">Inválido</Badge>
                      )}
                    </div>
                    {inspection.datos.detected && (
                      <p className="text-[11px] text-texto-suave">
                        Filas: <strong className="num text-principal">{fmtNum(inspection.datos.rowCount, 0)}</strong> ·{' '}
                        {inspection.datos.dateStart ?? '—'} → {inspection.datos.dateEnd ?? '—'} ·{' '}
                        Consumo: <strong className="num text-principal">{fmtNum(inspection.datos.totalConsumoMwh, 1)} MWh</strong> ·{' '}
                        PML prom: <strong className="num text-principal">{fmtCurrency(inspection.datos.avgPmlMxnMwh, 'MXN')}/MWh</strong>
                      </p>
                    )}
                    {inspection.datos.error && (
                      <p className="text-[11px] font-semibold text-red-600">{inspection.datos.error}</p>
                    )}
                  </div>
                </label>

                {/* 2. Curva Solar */}
                <label
                  className={`rounded-xl border p-3.5 flex items-start gap-3 transition-colors ${
                    !inspection.curvaSolar.detected
                      ? 'border-linea bg-fondo/30 opacity-60 cursor-not-allowed'
                      : sectionSelection.curvaSolar
                        ? selectionEvaluation.curvaSolarCanSelect
                          ? 'border-menta bg-menta/5 cursor-pointer'
                          : 'border-red-300 bg-red-50/40 cursor-pointer'
                        : 'border-borde bg-white hover:bg-fondo/40 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sectionSelection.curvaSolar}
                    disabled={
                      !inspection.curvaSolar.detected ||
                      (!sectionSelection.curvaSolar && !selectionEvaluation.curvaSolarCanSelect)
                    }
                    onChange={() => toggleSection('curvaSolar')}
                    className="mt-0.5 h-4 w-4 accent-principal"
                  />
                  <div className="flex-1 min-w-0 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-principal">Curva Solar (MW / MWp)</span>
                      {!inspection.curvaSolar.detected ? (
                        <Badge variant="default">No detectado</Badge>
                      ) : selectionEvaluation.curvaSolarCanSelect ? (
                        <Badge variant="success">Alineada</Badge>
                      ) : (
                        <Badge variant="warning">Revisar</Badge>
                      )}
                    </div>
                    {inspection.curvaSolar.detected && (
                      <p className="text-[11px] text-texto-suave">
                        Filas: <strong className="num text-principal">{fmtNum(inspection.curvaSolar.rowCount, 0)}</strong> ·{' '}
                        Horas activas (&gt;0): <strong className="num text-principal">{fmtNum(inspection.curvaSolar.nonZeroHours, 0)} h</strong> ·{' '}
                        {inspection.curvaSolar.dateStart ?? '—'} → {inspection.curvaSolar.dateEnd ?? '—'}
                      </p>
                    )}
                    {selectionEvaluation.curvaSolarError && (
                      <p className="text-[11px] font-semibold text-red-600">
                        {selectionEvaluation.curvaSolarError}
                      </p>
                    )}
                  </div>
                </label>

                {/* 3. 100HC */}
                <label
                  className={`rounded-xl border p-3.5 flex items-start gap-3 transition-colors ${
                    !inspection.hc100.detected
                      ? 'border-linea bg-fondo/30 opacity-60 cursor-not-allowed'
                      : sectionSelection.hc100
                        ? inspection.hc100.valid
                          ? 'border-menta bg-menta/5 cursor-pointer'
                          : 'border-red-300 bg-red-50/40 cursor-pointer'
                        : 'border-borde bg-white hover:bg-fondo/40 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sectionSelection.hc100}
                    disabled={!inspection.hc100.detected || (!sectionSelection.hc100 && !inspection.hc100.valid)}
                    onChange={() => toggleSection('hc100')}
                    className="mt-0.5 h-4 w-4 accent-principal"
                  />
                  <div className="flex-1 min-w-0 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-principal">100 Horas Críticas (100HC)</span>
                      {!inspection.hc100.detected ? (
                        <Badge variant="default">No detectado</Badge>
                      ) : inspection.hc100.valid ? (
                        <Badge variant="success">{inspection.hc100.count} filas</Badge>
                      ) : (
                        <Badge variant="warning">Inválido</Badge>
                      )}
                    </div>
                    {inspection.hc100.detected && (
                      <p className="text-[11px] text-texto-suave">
                        Coincidencia con Datos destino:{' '}
                        <strong className="num text-principal">
                          {selectionEvaluation.hcMatchedCount}/{inspection.hc100.count}
                        </strong>
                        {inspection.hc100.duplicateCount > 0 && (
                          <> · Repetidas: <strong className="num text-amber-700">{inspection.hc100.duplicateCount}</strong></>
                        )}
                      </p>
                    )}
                    {inspection.hc100.error && (
                      <p className="text-[11px] font-semibold text-red-600">{inspection.hc100.error}</p>
                    )}
                  </div>
                </label>

                {/* 4. Inputs */}
                <label
                  className={`rounded-xl border p-3.5 flex items-start gap-3 transition-colors ${
                    !inspection.inputs.detected
                      ? 'border-linea bg-fondo/30 opacity-60 cursor-not-allowed'
                      : sectionSelection.inputs
                        ? inspection.inputs.valid
                          ? 'border-menta bg-menta/5 cursor-pointer'
                          : 'border-red-300 bg-red-50/40 cursor-pointer'
                        : 'border-borde bg-white hover:bg-fondo/40 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sectionSelection.inputs}
                    disabled={!inspection.inputs.detected || (!sectionSelection.inputs && !inspection.inputs.valid)}
                    onChange={() => toggleSection('inputs')}
                    className="mt-0.5 h-4 w-4 accent-principal"
                  />
                  <div className="flex-1 min-w-0 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-principal">Inputs (Parámetros MEM)</span>
                      {!inspection.inputs.detected ? (
                        <Badge variant="default">No detectado</Badge>
                      ) : inspection.inputs.valid ? (
                        <Badge variant="success">
                          {inspection.inputs.definedNamesMatched > 0
                            ? `${inspection.inputs.definedNamesMatched} Defined Names`
                            : `${inspection.inputs.matchedCount} campos`}
                        </Badge>
                      ) : (
                        <Badge variant="warning">Inválido</Badge>
                      )}
                    </div>
                    {inspection.inputs.detected && (
                      <p className="text-[11px] text-texto-suave">
                        {inspection.inputs.mergedPreviewInputs.cliente} · BESS{' '}
                        <strong className="num text-principal">
                          {fmtNum(inspection.inputs.mergedPreviewInputs.bess_potencia_mw, 2)} MW /{' '}
                          {fmtNum(inspection.inputs.mergedPreviewInputs.bess_capacidad_mwh, 1)} MWh
                        </strong>{' '}
                        · FV{' '}
                        <strong className="num text-principal">
                          {fmtNum(inspection.inputs.mergedPreviewInputs.fv_potencia_mw, 2)} MW
                        </strong>{' '}
                        · Horizonte{' '}
                        <strong className="num text-principal">
                          {inspection.inputs.mergedPreviewInputs.fin_horizonte_anios}a
                        </strong>
                      </p>
                    )}
                    {inspection.inputs.error && (
                      <p className="text-[11px] font-semibold text-red-600">{inspection.inputs.error}</p>
                    )}
                  </div>
                </label>

                {/* 5. Supuestos Anuales */}
                <label
                  className={`md:col-span-2 rounded-xl border p-3.5 flex items-start gap-3 transition-colors ${
                    !inspection.assumptions.detected
                      ? 'border-linea bg-fondo/30 opacity-60 cursor-not-allowed'
                      : sectionSelection.assumptions
                        ? inspection.assumptions.valid
                          ? 'border-menta bg-menta/5 cursor-pointer'
                          : 'border-red-300 bg-red-50/40 cursor-pointer'
                        : 'border-borde bg-white hover:bg-fondo/40 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sectionSelection.assumptions}
                    disabled={
                      !inspection.assumptions.detected ||
                      (!sectionSelection.assumptions && !inspection.assumptions.valid)
                    }
                    onChange={() => toggleSection('assumptions')}
                    className="mt-0.5 h-4 w-4 accent-principal"
                  />
                  <div className="flex-1 min-w-0 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-principal">Supuestos Anuales (Años 2–25)</span>
                      {!inspection.assumptions.detected ? (
                        <Badge variant="default">No detectado</Badge>
                      ) : inspection.assumptions.valid ? (
                        <Badge variant="success">25 años detectados</Badge>
                      ) : (
                        <Badge variant="warning">Inválido</Badge>
                      )}
                    </div>
                    {inspection.assumptions.detected && (
                      <p className="text-[11px] text-texto-suave">
                        Año 2 referencia — Esc. MBP:{' '}
                        <strong className="num text-principal">
                          {fmtPct((inspection.assumptions.y2PctMbp ?? 0) * 100, 1)}
                        </strong>{' '}
                        · Esc. PML:{' '}
                        <strong className="num text-principal">
                          {fmtPct((inspection.assumptions.y2PctPml ?? 0) * 100, 1)}
                        </strong>{' '}
                        · Degradación BESS:{' '}
                        <strong className="num text-principal">
                          {fmtPct((inspection.assumptions.y2DegBess ?? 0) * 100, 2)}
                        </strong>
                        {inspection.assumptions.fixedMbpOverrideCount > 0 && (
                          <>
                            {' '}· Valores fijos MBP:{' '}
                            <strong className="num text-principal">
                              {inspection.assumptions.fixedMbpOverrideCount} año(s)
                            </strong>
                          </>
                        )}
                      </p>
                    )}
                    {inspection.assumptions.error && (
                      <p className="text-[11px] font-semibold text-red-600">{inspection.assumptions.error}</p>
                    )}
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-linea">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setParsedPreview(null)
                    setUploadError(null)
                    setWizardStep(0)
                  }}
                >
                  <ArrowLeft size={14} />
                  Subir otro archivo
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!selectionEvaluation.canProceed}
                  onClick={() => setWizardStep(2)}
                >
                  Revisar confirmación
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* PASO 3: Confirmar e importar */}
          {wizardStep === 2 && parsedPreview && inspection && stagedPayload && (
            <div className="space-y-4">
              <div className="rounded-xl bg-menta/10 border border-menta/30 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-principal">
                    Resumen de importación: {parsedPreview.fileName}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {stagedPayload.appliedLabels.map((lbl) => (
                      <Badge key={lbl} variant="success">
                        <Check size={11} className="mr-1" />
                        {lbl}
                      </Badge>
                    ))}
                  </div>
                </div>

                {step3ImpactPreview && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                    <div className="bg-white rounded-lg p-2.5 border border-linea">
                      <span className="block text-[10px] font-bold uppercase text-texto-suave">
                        Ahorro Total Año 1
                      </span>
                      <span className="num font-black text-principal">
                        {step3ImpactPreview.financial
                          ? fmtCurrency(step3ImpactPreview.financial.ahorro_total_y1, moneda)
                          : fmtCurrency(step3ImpactPreview.year1.ahorro_total_mxn, 'MXN')}
                      </span>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-linea">
                      <span className="block text-[10px] font-bold uppercase text-texto-suave">
                        Ahorro Energía (PML)
                      </span>
                      <span className="num font-bold text-menta">
                        {step3ImpactPreview.financial
                          ? fmtCurrency(step3ImpactPreview.financial.ahorro_energia_y1, moneda)
                          : fmtCurrency(step3ImpactPreview.year1.ahorro_e_total_mxn, 'MXN')}
                      </span>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-linea">
                      <span className="block text-[10px] font-bold uppercase text-texto-suave">
                        Ahorro Potencia (100HC)
                      </span>
                      <span className="num font-bold text-principal">
                        {step3ImpactPreview.financial
                          ? fmtCurrency(step3ImpactPreview.financial.ahorro_potencia_y1, moneda)
                          : fmtCurrency(step3ImpactPreview.year1.ahorro_c_total_mxn, 'MXN')}
                      </span>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-linea">
                      <span className="block text-[10px] font-bold uppercase text-texto-suave">
                        Descarga BESS / Gen FV
                      </span>
                      <span className="num font-bold text-principal">
                        {fmtNum(step3ImpactPreview.year1.res_descarga_mwh, 1)} /{' '}
                        {fmtNum(step3ImpactPreview.year1.res_gen_fv_mwh, 1)} MWh
                      </span>
                    </div>
                    {step3ImpactPreview.financial && (
                      <>
                        <div className="bg-white rounded-lg p-2.5 border border-linea">
                          <span className="block text-[10px] font-bold uppercase text-texto-suave">
                            VPN ({moneda})
                          </span>
                          <span className="num font-bold text-principal">
                            {fmtCurrency(step3ImpactPreview.financial.vpn, moneda)}
                          </span>
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-linea">
                          <span className="block text-[10px] font-bold uppercase text-texto-suave">
                            TIR
                          </span>
                          <span className="num font-bold text-principal">
                            {step3ImpactPreview.financial.tir_pct !== null
                              ? fmtPct(step3ImpactPreview.financial.tir_pct, 2)
                              : 'N/A'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {selectionEvaluation && selectionEvaluation.warnings.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900 space-y-1">
                  {selectionEvaluation.warnings.map((w, idx) => (
                    <p key={idx} className="flex items-start gap-1.5">
                      <AlertTriangle size={13} className="shrink-0 text-amber-600 mt-0.5" />
                      <span>{w}</span>
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-linea">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWizardStep(1)}
                >
                  <ArrowLeft size={14} />
                  Volver a secciones
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => resetWizardState(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleConfirmImport}
                  >
                    <Check size={14} />
                    Confirmar e importar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {uploadNotice && (
        <div className="rounded-xl bg-menta/15 border border-menta/40 px-4 py-2.5 text-xs font-semibold text-principal flex items-center gap-2">
          <CheckCircle2 size={14} className="text-menta" />
          <span>{uploadNotice}</span>
        </div>
      )}

      {/* Dataset KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-borde rounded-xl p-3">
          <span className="block text-[10px] font-bold uppercase text-texto-suave">Horas cargadas</span>
          <span className="num text-sm font-extrabold text-principal">{fmtNum(hourlyStats.rows, 0)} h</span>
        </div>
        <div className="bg-white border border-borde rounded-xl p-3">
          <span className="block text-[10px] font-bold uppercase text-texto-suave">Consumo anual</span>
          <span className="num text-sm font-extrabold text-principal">{fmtNum(hourlyStats.totalConsMwh, 2)} MWh</span>
        </div>
        <div className="bg-white border border-borde rounded-xl p-3">
          <span className="block text-[10px] font-bold uppercase text-texto-suave">Demanda pico</span>
          <span className="num text-sm font-extrabold text-principal">{fmtNum(hourlyStats.maxConsMw, 2)} MW</span>
        </div>
        <div className="bg-white border border-borde rounded-xl p-3">
          <span className="block text-[10px] font-bold uppercase text-texto-suave">PML promedio</span>
          <span className="num text-sm font-extrabold text-principal">{fmtCurrency(hourlyStats.avgPml, 'MXN')}/MWh</span>
        </div>
        <div className="bg-white border border-borde rounded-xl p-3">
          <span className="block text-[10px] font-bold uppercase text-texto-suave">Curva Solar activa</span>
          <span className="num text-sm font-extrabold text-principal">{fmtNum(hourlyStats.solarNonZeroHours, 0)} h &gt; 0</span>
        </div>
      </div>

      {/* Sub-navigation: 100HC vs Datos Horarios */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab('100hc')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
            subTab === '100hc'
              ? 'bg-principal text-acento border-principal'
              : 'bg-white text-texto-suave border-borde hover:text-principal'
          }`}
        >
          100 Horas Críticas ({year1.critical_hours_rows.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('datos')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
            subTab === 'datos'
              ? 'bg-principal text-acento border-principal'
              : 'bg-white text-texto-suave border-borde hover:text-principal'
          }`}
        >
          Explorador Datos Horarios (365 días × 24 h)
        </button>
      </div>

      {subTab === '100hc' ? (
        <div className="space-y-3">
          {(year1.duplicate_100hc_count > 0 || year1.missing_100hc_count > 0) && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
              <div>
                {year1.duplicate_100hc_count > 0 && (
                  <p>
                    Hay <strong>{year1.duplicate_100hc_count}</strong> hora(s) crítica(s) con clave Fecha+Hora repetida. Se promedian tal como en Excel.
                  </p>
                )}
                {year1.missing_100hc_count > 0 && (
                  <p>
                    Hay <strong>{year1.missing_100hc_count}</strong> fila(s) cuya Fecha+Hora no coincide con <code className="font-mono">Datos</code>.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* RAP Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-fondo/70 border border-linea rounded-xl p-3 text-xs">
            <div>
              <span className="text-texto-suave block">Prom 100HC Base</span>
              <span className="num font-bold text-principal">{fmtNum(year1.prom_100hc_base_mw, 3)} MW</span>
            </div>
            <div>
              <span className="text-texto-suave block">Prom 100HC Proyecto</span>
              <span className="num font-bold text-principal">{fmtNum(year1.prom_100hc_proy_mw, 3)} MW</span>
            </div>
            <div>
              <span className="text-texto-suave block">Factor RAP aplicado</span>
              <span className="num font-bold text-principal">× {fmtNum(inputs.rap_factor, 4)}</span>
            </div>
            <div>
              <span className="text-texto-suave block">Reducción RAP total</span>
              <span className="num font-extrabold text-menta">{fmtNum(year1.res_rap_reduccion_mw, 3)} MW</span>
            </div>
          </div>

          <div className="bg-white border border-borde rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-principal text-white">
                    <th className="text-left px-3 py-2.5 font-bold">No.</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Fecha</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Hora (1–24)</th>
                    <th className="text-center px-2.5 py-2.5 font-semibold">Repetida</th>
                    <th className="text-center px-2.5 py-2.5 font-semibold">En Datos</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Demanda Base (MW)</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Demanda Red Proy (MW)</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Recorte (MW)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {year1.critical_hours_rows.map((row: MemCriticalHourEvaluated, idx: number) => {
                    const entry = criticalHours100HC[idx]
                    const recorte = row.demanda_base_mw - row.demanda_proy_mw
                    return (
                      <tr
                        key={`${row.no}-${idx}`}
                        className={
                          row.repetida
                            ? 'bg-amber-50/70'
                            : !row.encontrada
                              ? 'bg-red-50/50'
                              : 'hover:bg-fondo/40'
                        }
                      >
                        <td className="num px-3 py-1.5 font-bold text-principal">{row.no}</td>
                        <td className="px-3 py-1.5">
                          <input
                            type="date"
                            disabled={disabled}
                            value={entry?.fecha ?? row.fecha}
                            onChange={(e) => handleUpdateHcEntry(idx, { fecha: e.target.value })}
                            className="rounded border border-borde bg-fondo/40 px-2 py-1 text-xs font-medium text-principal"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            disabled={disabled}
                            value={entry?.hora ?? row.hora}
                            onChange={(e) => {
                              const n = Math.max(1, Math.min(24, Math.round(Number(e.target.value) || 1)))
                              handleUpdateHcEntry(idx, { hora: n })
                            }}
                            aria-label={`Hora crítica #${row.no}`}
                            className="num w-16 rounded border border-borde bg-fondo/40 px-2 py-1 text-xs font-semibold text-principal text-right"
                          >
                            {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          {row.repetida ? (
                            <Badge variant="warning">Sí</Badge>
                          ) : (
                            <span className="text-texto-suave">No</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          {row.encontrada ? (
                            <Badge variant="success">OK</Badge>
                          ) : (
                            <Badge variant="warning">No hallada</Badge>
                          )}
                        </td>
                        <td className="num px-3 py-1.5 text-right font-semibold text-principal">
                          {fmtNum(row.demanda_base_mw, 3)}
                        </td>
                        <td className="num px-3 py-1.5 text-right font-semibold text-principal">
                          {fmtNum(row.demanda_proy_mw, 3)}
                        </td>
                        <td className="num px-3 py-1.5 text-right font-bold text-menta">
                          {fmtNum(recorte, 3)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-borde rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-principal">Día del año:</span>
              <input
                type="number"
                min={1}
                max={totalDays}
                value={selectedDay}
                onChange={(e) =>
                  setSelectedDay(Math.max(1, Math.min(totalDays, Number(e.target.value) || 1)))
                }
                className="num w-20 rounded-lg border border-borde px-2 py-1 font-bold text-principal text-right"
              />
              <span className="text-texto-suave">
                de {totalDays} ({dayRows[0]?.fecha ?? '—'})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedDay <= 1}
                onClick={() => setSelectedDay((d) => Math.max(1, d - 1))}
              >
                Día anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedDay >= totalDays}
                onClick={() => setSelectedDay((d) => Math.min(totalDays, d + 1))}
              >
                Día siguiente
              </Button>
            </div>
          </div>

          <div className="bg-white border border-borde rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-principal text-white">
                    <th className="text-left px-3.5 py-2.5 font-semibold">Fecha</th>
                    <th className="text-right px-3.5 py-2.5 font-semibold">Hora</th>
                    <th className="text-right px-3.5 py-2.5 font-semibold">Consumo (MWh)</th>
                    <th className="text-right px-3.5 py-2.5 font-semibold">PML (MXN/MWh)</th>
                    <th className="text-right px-3.5 py-2.5 font-semibold">Curva Solar (MW/MWp)</th>
                    <th className="text-right px-3.5 py-2.5 font-semibold">Gen. FV escalada (MW)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {dayRows.map((d) => (
                    <tr key={`${d.fecha}-${d.hora}`} className="hover:bg-fondo/40">
                      <td className="px-3.5 py-2 font-medium text-principal">{d.fecha}</td>
                      <td className="num px-3.5 py-2 text-right font-bold">{d.hora}</td>
                      <td className="num px-3.5 py-2 text-right">{fmtNum(d.consumo_mwh, 4)}</td>
                      <td className="num px-3.5 py-2 text-right">{fmtCurrency(d.pml_mxn_mwh, 'MXN')}</td>
                      <td className="num px-3.5 py-2 text-right">{fmtNum(d.curva_solar_mw, 4)}</td>
                      <td className="num px-3.5 py-2 text-right font-semibold text-menta">
                        {fmtNum(d.curva_solar_mw * inputs.fv_potencia_mw, 4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MemDatos100HcView
