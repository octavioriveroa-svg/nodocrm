'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Check,
  FileSpreadsheet,
  FunctionSquare,
  History,
  Loader2,
  RotateCcw,
  Save,
  Sliders,
  X,
} from 'lucide-react'
import type {
  CalculadoraCampoDef,
  CalculadoraCampoGrupo,
  CalculadoraTemplate,
  ExcelMapeoCampos,
  FormulaDefinicion,
  ModoFormulaConfig,
} from '@/lib/types'
import {
  FALLBACK_HORIZONTE_OPCIONES,
  FALLBACK_TEMPLATE_CAMPOS,
  FALLBACK_TEMPLATE_FORMULAS,
  validateCampoValue,
} from '@/lib/calculator/template-schema'
import {
  CATEGORY_LABELS,
  getVariablesByCategory,
  PLATFORM_VARIABLES,
} from '@/lib/calculator/variable-dictionary'
import {
  compileAndSortFormulas,
  FormulaError,
  parseExcelFormula,
} from '@/lib/calculator/formula-engine'
import { evaluateSimulation } from '@/lib/calculator/engine'
import {
  activarPlantillaCalculadora,
  guardarPlantillaCalculadora,
} from '@/app/actions/calculatorConfig'
import {
  fmtCurrency,
  fmtNum,
  fmtPct,
  formatNumberInput,
  formatSignedNumberInput,
  parseNum,
  parseSignedNum,
} from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ExcelImportStepper } from '@/components/calculator/ExcelImportStepper'

export interface AdminCalculadoraConfigProps {
  mode: 'page' | 'modal'
  initialTemplates: CalculadoraTemplate[]
  activeTemplate: CalculadoraTemplate
  migrationPending?: boolean
  onClose?: () => void
  onTemplateActivated?: (template: CalculadoraTemplate) => void
}

type AdminTab = 'campos' | 'formulas' | 'excel' | 'historial'

const CAMPO_GROUPS: readonly { key: CalculadoraCampoGrupo; title: string; subtitle: string }[] = [
  { key: 'moneda', title: 'Moneda y FX', subtitle: 'Divisa predeterminada y tipo de cambio USD/MXN.' },
  { key: 'tarifas', title: 'Tarifas CFE / MEM', subtitle: 'Tarifas base y cargos por demanda en MXN.' },
  { key: 'fv', title: 'Parámetros Técnicos FV y Estacionalidad', subtitle: 'HSP, Performance Ratio, degradación y curva mensual (12 meses = 100%).' },
  { key: 'bess', title: 'Parámetros Técnicos BESS', subtitle: 'DoD, eficiencia round-trip, ciclos y recorte de demanda.' },
  { key: 'macro', title: 'Macroeconomía y O&M', subtitle: 'Escalación tarifaria, inflación, O&M y WACC.' },
  { key: 'financiamiento', title: 'Financiamiento', subtitle: 'Tasas, enganches y plazos predeterminados por vehículo.' },
  { key: 'horizontes', title: 'Horizontes por Tecnología', subtitle: 'Horizonte predeterminado al abrir proyectos FV, BESS o MEM.' },
]

const MONTH_NAMES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const

const HORIZON_GRID = Array.from({ length: 30 }, (_, i) => i + 1)

function formatCampoDisplay(campo: CalculadoraCampoDef, val: number): string {
  if (!Number.isFinite(val)) return ''
  const isPct = campo.type === 'percentage'
  const allowNeg = campo.validationRules?.allowNegative === true
  const scaled = isPct ? Math.round(val * 100 * 1e6) / 1e6 : Math.round(val * 1e6) / 1e6
  const raw = String(scaled)
  return allowNeg ? formatSignedNumberInput(raw) : formatNumberInput(raw)
}

export function AdminCalculadoraConfig({
  mode,
  initialTemplates,
  activeTemplate: initialActive,
  migrationPending = false,
  onClose,
  onTemplateActivated,
}: AdminCalculadoraConfigProps) {
  const [templates, setTemplates] = useState<CalculadoraTemplate[]>(initialTemplates)
  const [activeTemplate, setActiveTemplate] = useState<CalculadoraTemplate>(initialActive)
  const [tab, setTab] = useState<AdminTab>('campos')

  // Editable draft state
  const [draftNombre, setDraftNombre] = useState(
    initialActive.nombre || 'Plantilla Calculadora Nodo',
  )
  const [draftNotas, setDraftNotas] = useState(initialActive.notas ?? '')
  const [draftCampos, setDraftCampos] = useState<CalculadoraCampoDef[]>(() =>
    (initialActive.campos?.length ? initialActive.campos : FALLBACK_TEMPLATE_CAMPOS).map((c) => ({
      ...c,
      defaultValue: Array.isArray(c.defaultValue) ? [...c.defaultValue] : c.defaultValue,
    })),
  )
  const [campoDraftTexts, setCampoDraftTexts] = useState<Record<string, string>>({})
  const [draftHorizontes, setDraftHorizontes] = useState<number[]>(() =>
    initialActive.horizonte_opciones?.length
      ? [...initialActive.horizonte_opciones]
      : [...FALLBACK_HORIZONTE_OPCIONES],
  )
  const [draftFormulas, setDraftFormulas] = useState<FormulaDefinicion[]>(() =>
    (initialActive.formulas?.length ? initialActive.formulas : FALLBACK_TEMPLATE_FORMULAS).map(
      (f) => ({ ...f }),
    ),
  )
  const [pendingExcelMeta, setPendingExcelMeta] = useState<{
    archivoNombre: string
    archivoHash: string
    hojaOrigen: string
    mapeo: ExcelMapeoCampos
  } | null>(null)

  const [focusedFormulaKey, setFocusedFormulaKey] = useState<FormulaDefinicion['key']>('ahorro_bruto_mes')
  const formulaInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const [varFilter, setVarFilter] = useState('')

  const [saving, setSaving] = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const variablesByCategory = useMemo(() => Array.from(getVariablesByCategory().entries()), [])

  function showNotice(type: 'ok' | 'err', text: string) {
    setBanner({ type, text })
    if (type === 'ok') {
      setTimeout(() => {
        setBanner((cur) => (cur?.text === text ? null : cur))
      }, 3500)
    }
  }

  function syncDraftFromTemplate(tpl: CalculadoraTemplate) {
    setActiveTemplate(tpl)
    setDraftNombre(tpl.nombre)
    setDraftNotas(tpl.notas ?? '')
    setDraftCampos(
      (tpl.campos?.length ? tpl.campos : FALLBACK_TEMPLATE_CAMPOS).map((c) => ({
        ...c,
        defaultValue: Array.isArray(c.defaultValue) ? [...c.defaultValue] : c.defaultValue,
      })),
    )
    setCampoDraftTexts({})
    setDraftHorizontes(
      tpl.horizonte_opciones?.length
        ? [...tpl.horizonte_opciones]
        : [...FALLBACK_HORIZONTE_OPCIONES],
    )
    setDraftFormulas(
      (tpl.formulas?.length ? tpl.formulas : FALLBACK_TEMPLATE_FORMULAS).map((f) => ({ ...f })),
    )
    setPendingExcelMeta(null)
  }

  function handleTemplateSavedOrActivated(newTpl: CalculadoraTemplate, noticeText: string) {
    setTemplates((prev) => {
      const updated = prev.map((t) => ({ ...t, is_active: t.id === newTpl.id }))
      const exists = updated.some((t) => t.id === newTpl.id)
      if (exists) return updated
      return [newTpl, ...updated].sort((a, b) => b.version - a.version)
    })
    syncDraftFromTemplate(newTpl)
    onTemplateActivated?.(newTpl)
    showNotice('ok', noticeText)
  }

  // Validate all campos declaratively
  const campoErrors = useMemo(() => {
    const errs: Record<string, string> = {}
    for (const c of draftCampos) {
      const err = validateCampoValue(c, c.defaultValue, { useOverrideBounds: false })
      if (err) errs[c.key] = err
    }
    return errs
  }, [draftCampos])

  // Compile & validate all formulas live
  const formulaCheck = useMemo(() => {
    const perFormulaErrors: Record<string, string> = {}
    for (const f of draftFormulas) {
      if (!f.enabled) continue
      try {
        parseExcelFormula(f.expression)
      } catch (err) {
        perFormulaErrors[f.key] = err instanceof Error ? err.message : String(err)
      }
    }

    try {
      const compiled = compileAndSortFormulas(draftFormulas, {
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
          id: 'admin-preview',
          proyecto_id: 'admin-preview',
          nombre: 'Preview',
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
            id: 'admin-fv',
            proyecto_id: 'admin-preview',
            sitio_id: 'admin-site',
            configuracion_id: 'admin-preview',
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
            id: 'admin-bess',
            proyecto_id: 'admin-preview',
            sitio_id: 'admin-site',
            configuracion_id: 'admin-preview',
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
          modo: 'custom_formulas',
          campos: draftCampos,
          formulas: draftFormulas,
        },
        monedaCalculo: 'MXN',
        horizonteAnios: 10,
        vistaFinanciamiento: 'bruto',
        overrides: {},
      })

      return {
        valid: Object.keys(perFormulaErrors).length === 0,
        globalError: null as string | null,
        perFormulaErrors,
        order: compiled.ordered.map((o) => o.key),
        dryRun,
      }
    } catch (err) {
      const msg = err instanceof FormulaError ? err.message : String(err)
      return {
        valid: false,
        globalError: msg,
        perFormulaErrors,
        order: [] as string[],
        dryRun: null,
      }
    }
  }, [draftFormulas, draftCampos])

  function updateCampoNumeric(campo: CalculadoraCampoDef, rawInput: string) {
    const allowNeg = campo.validationRules?.allowNegative === true
    const formatted = allowNeg
      ? formatSignedNumberInput(rawInput)
      : formatNumberInput(rawInput)

    setCampoDraftTexts((prev) => ({ ...prev, [campo.key]: formatted }))

    if (
      formatted === '' ||
      formatted === '-' ||
      formatted === '.' ||
      formatted === '-.'
    ) {
      setDraftCampos((prev) =>
        prev.map((c) => (c.key === campo.key ? { ...c, defaultValue: Number.NaN } : c)),
      )
      return
    }

    const parsed = allowNeg ? parseSignedNum(formatted) : parseNum(formatted)
    const isPct = campo.type === 'percentage'
    const isInt = campo.type === 'integer' || campo.validationRules?.integer === true
    const normalized = isPct
      ? Math.round((parsed / 100) * 1e8) / 1e8
      : isInt
        ? Math.round(parsed)
        : parsed

    setDraftCampos((prev) =>
      prev.map((c) => (c.key === campo.key ? { ...c, defaultValue: normalized } : c)),
    )
  }

  function updateSeasonalWeight(monthIndex: number, rawInput: string) {
    const formatted = formatNumberInput(rawInput)
    const draftKey = `pesos_estacionales_fv_${monthIndex}`
    setCampoDraftTexts((prev) => ({ ...prev, [draftKey]: formatted }))

    const parsed = formatted === '' || formatted === '.' ? Number.NaN : parseNum(formatted)
    const fraction = Number.isFinite(parsed) ? Math.round((parsed / 100) * 1e6) / 1e6 : Number.NaN

    setDraftCampos((prev) =>
      prev.map((c) => {
        if (c.key !== 'pesos_estacionales_fv' || !Array.isArray(c.defaultValue)) return c
        const nextArr = [...c.defaultValue]
        nextArr[monthIndex] = fraction
        return { ...c, defaultValue: nextArr }
      }),
    )
  }

  function toggleHorizonteOption(yr: number) {
    setDraftHorizontes((prev) => {
      if (prev.includes(yr)) {
        if (prev.length <= 1) return prev // keep at least 1 option
        return prev.filter((x) => x !== yr)
      }
      return [...prev, yr].sort((a, b) => a - b)
    })
  }

  function insertVariableIntoFormula(varKey: string) {
    const key = focusedFormulaKey
    const el = formulaInputRefs.current[key]
    setDraftFormulas((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f
        if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
          const start = el.selectionStart
          const end = el.selectionEnd
          const nextExpr =
            f.expression.slice(0, start) + varKey + f.expression.slice(end)
          return { ...f, expression: nextExpr }
        }
        return { ...f, expression: `${f.expression} ${varKey}` }
      }),
    )
  }

  function restoreDefaultFormulas() {
    setDraftFormulas(FALLBACK_TEMPLATE_FORMULAS.map((f) => ({ ...f })))
    setPendingExcelMeta(null)
    showNotice('ok', 'Fórmulas restauradas al modelo racional por defecto (guarda para crear nueva versión).')
  }

  async function handleSaveNewVersion(targetModo: ModoFormulaConfig) {
    if (!draftNombre.trim()) {
      showNotice('err', 'El nombre de la plantilla es obligatorio.')
      return
    }
    if (Object.keys(campoErrors).length > 0) {
      showNotice('err', Object.values(campoErrors)[0])
      return
    }
    if (!formulaCheck.valid) {
      showNotice('err', formulaCheck.globalError || 'Corrige los errores de fórmulas antes de guardar.')
      return
    }

    setSaving(true)
    setBanner(null)
    const res = await guardarPlantillaCalculadora({
      nombre: draftNombre.trim(),
      descripcion: activeTemplate.descripcion ?? null,
      modo: targetModo,
      campos: draftCampos,
      formulas: draftFormulas,
      horizonte_opciones: draftHorizontes,
      excel_archivo_nombre: pendingExcelMeta?.archivoNombre ?? activeTemplate.excel_archivo_nombre,
      excel_archivo_hash: pendingExcelMeta?.archivoHash ?? activeTemplate.excel_archivo_hash,
      excel_hoja_origen: pendingExcelMeta?.hojaOrigen ?? activeTemplate.excel_hoja_origen,
      excel_mapeo_campos: pendingExcelMeta?.mapeo ?? activeTemplate.excel_mapeo_campos,
      notas: draftNotas.trim() || null,
    })
    setSaving(false)

    if (res.error || !res.data) {
      showNotice(
        'err',
        res.validationErrors?.length
          ? `${res.error} (${res.validationErrors.join(' · ')})`
          : res.error || 'No se pudo guardar la plantilla.',
      )
      return
    }

    handleTemplateSavedOrActivated(
      res.data,
      `Versión v${res.data.version} guardada y activada correctamente.`,
    )
  }

  async function handleActivateRollback(templateId: string) {
    setActivatingId(templateId)
    const res = await activarPlantillaCalculadora(templateId)
    setActivatingId(null)
    if (res.error || !res.data) {
      showNotice('err', res.error || 'No se pudo activar la versión.')
      return
    }
    handleTemplateSavedOrActivated(
      res.data,
      `Versión v${res.data.version} activada como plantilla vigente.`,
    )
  }

  const formulasEqualDefault = useMemo(() => {
    if (draftFormulas.length !== FALLBACK_TEMPLATE_FORMULAS.length) return false
    return draftFormulas.every((f, idx) => {
      const def = FALLBACK_TEMPLATE_FORMULAS[idx]
      return f.key === def.key && f.expression.trim() === def.expression.trim() && f.enabled === def.enabled
    })
  }, [draftFormulas])

  const filteredVarGroups = useMemo(() => {
    const q = varFilter.trim().toLowerCase()
    if (!q) return variablesByCategory
    return variablesByCategory
      .map(([cat, list]) => [
        cat,
        list.filter(
          (v) => v.key.toLowerCase().includes(q) || v.label.toLowerCase().includes(q),
        ),
      ] as const)
      .filter(([, list]) => list.length > 0)
  }, [variablesByCategory, varFilter])

  const workspaceBody = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-linea pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-principal text-acento flex items-center justify-center shrink-0">
            <Calculator size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-principal">
                Configuración de Calculadora y Fórmulas
              </h2>
              <Badge variant="success">Activa: v{activeTemplate.version}</Badge>
              <Badge variant="info">
                {activeTemplate.modo === 'default'
                  ? 'Modelo racional'
                  : activeTemplate.modo === 'excel_import'
                    ? 'Importado de Excel'
                    : 'Fórmulas personalizadas'}
              </Badge>
            </div>
            <p className="text-xs text-texto-suave mt-0.5">
              Las plantillas son versionadas e inmutables: cada cambio crea una nueva versión activa y preserva el historial de simulaciones pasadas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'page' ? (
            <Link
              href="/admin/configuracion"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-borde bg-white text-principal hover:border-principal"
            >
              <ArrowLeft size={13} />
              Volver a Configuración
            </Link>
          ) : (
            onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl border border-borde bg-white text-texto-suave hover:text-principal"
                aria-label="Cerrar configuración"
              >
                <X size={18} />
              </button>
            )
          )}
        </div>
      </div>

      {migrationPending && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold">Base de datos pendiente de migración v29</p>
            <p className="mt-0.5">
              Mostrando la plantilla racional por defecto en memoria. Ejecuta <code className="font-mono">supabase/v29_savings_calculator.sql</code> para habilitar la persistencia de versiones en PostgreSQL.
            </p>
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between ${
            banner.type === 'ok'
              ? 'bg-acento text-principal'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Cerrar aviso">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 4-Tab Bar */}
      <div className="flex flex-wrap gap-1.5 border-b border-linea pb-3">
        {(
          [
            { id: 'campos', label: 'Parámetros Base Declarativos', icon: Sliders },
            { id: 'formulas', label: 'Editor de Fórmulas Excel', icon: FunctionSquare },
            { id: 'excel', label: 'Importar desde Excel', icon: FileSpreadsheet },
            { id: 'historial', label: `Historial de Versiones (${templates.length})`, icon: History },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
              tab === id
                ? 'bg-principal text-acento border-principal shadow-sm'
                : 'bg-white text-texto-suave border-borde hover:text-principal'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* TAB A: Declarative Base Parameters */}
      {tab === 'campos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-fondo/60 border border-linea rounded-2xl p-4">
            <div>
              <label className="block text-xs font-bold text-principal mb-1">
                Nombre de la plantilla *
              </label>
              <input
                type="text"
                value={draftNombre}
                onChange={(e) => setDraftNombre(e.target.value)}
                className="w-full rounded-xl border border-borde bg-white px-3.5 py-2 text-sm text-principal"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-principal mb-1">
                Notas de versión
              </label>
              <input
                type="text"
                value={draftNotas}
                onChange={(e) => setDraftNotas(e.target.value)}
                placeholder="Ej. Actualización tipo de cambio y tarifas CFE"
                className="w-full rounded-xl border border-borde bg-white px-3.5 py-2 text-sm text-principal"
              />
            </div>
          </div>

          {CAMPO_GROUPS.map((grp) => {
            const groupCampos = draftCampos
              .filter((c) => c.group === grp.key)
              .sort((a, b) => a.order - b.order)
            if (groupCampos.length === 0) return null

            return (
              <div key={grp.key} className="bg-white border border-borde rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-principal">{grp.title}</h4>
                  <p className="text-xs text-texto-suave">{grp.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupCampos.map((campo) => {
                    if (campo.type === 'number_array' && Array.isArray(campo.defaultValue)) {
                      const arr = campo.defaultValue
                      const sum = arr.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0)
                      const sumValid = Math.abs(sum - 1) <= 0.001
                      const arrErr = campoErrors[campo.key]

                      return (
                        <div
                          key={campo.key}
                          className="sm:col-span-2 lg:col-span-3 rounded-xl border border-linea bg-fondo/40 p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-principal">
                                {campo.label}
                              </span>
                              <p className="text-[11px] text-texto-suave">
                                Distribución mensual solar (%) — debe sumar exactamente 100.0%
                              </p>
                            </div>
                            <Badge variant={sumValid ? 'success' : 'warning'}>
                              Suma: <span className="num ml-1">{fmtPct(sum * 100, 1)}</span>
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                            {MONTH_NAMES_SHORT.map((mName, idx) => {
                              const dKey = `pesos_estacionales_fv_${idx}`
                              const val = arr[idx] ?? 0
                              const text =
                                dKey in campoDraftTexts
                                  ? campoDraftTexts[dKey]
                                  : Number.isFinite(val)
                                    ? String(Math.round(val * 100 * 1e4) / 1e4)
                                    : ''
                              return (
                                <div key={mName} className="space-y-1">
                                  <label className="block text-[11px] font-semibold text-texto-suave">
                                    {mName} (%)
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={text}
                                    onChange={(e) => updateSeasonalWeight(idx, e.target.value)}
                                    onBlur={() =>
                                      setCampoDraftTexts((prev) => {
                                        if (!(dKey in prev)) return prev
                                        const next = { ...prev }
                                        delete next[dKey]
                                        return next
                                      })
                                    }
                                    className="num w-full rounded-lg border border-borde bg-white px-2.5 py-1.5 text-xs font-semibold text-principal"
                                  />
                                </div>
                              )
                            })}
                          </div>
                          {arrErr && (
                            <p className="text-xs font-semibold text-red-600">{arrErr}</p>
                          )}
                        </div>
                      )
                    }

                    const err = campoErrors[campo.key]

                    if (campo.type === 'select') {
                      const opts = campo.validationRules?.options ?? ['MXN', 'USD']
                      return (
                        <div key={campo.key} className="space-y-1.5">
                          <label className="block text-xs font-semibold text-principal">
                            {campo.label}
                          </label>
                          <select
                            value={String(campo.defaultValue)}
                            onChange={(e) =>
                              setDraftCampos((prev) =>
                                prev.map((c) =>
                                  c.key === campo.key ? { ...c, defaultValue: e.target.value } : c,
                                ),
                              )
                            }
                            className="w-full rounded-xl border border-borde bg-white px-3 py-2 text-sm font-semibold text-principal"
                          >
                            {opts.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          {err && <p className="text-[11px] font-semibold text-red-600">{err}</p>}
                        </div>
                      )
                    }

                    const numVal = typeof campo.defaultValue === 'number' ? campo.defaultValue : 0
                    const displayStr =
                      campo.key in campoDraftTexts
                        ? campoDraftTexts[campo.key]
                        : formatCampoDisplay(campo, numVal)

                    return (
                      <div key={campo.key} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-semibold text-principal">
                            {campo.label}
                          </label>
                          {!campo.editableByUser && (
                            <span className="text-[10px] font-semibold text-texto-suave bg-fondo px-1.5 py-0.5 rounded">
                              Solo Admin
                            </span>
                          )}
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={displayStr}
                            onChange={(e) => updateCampoNumeric(campo, e.target.value)}
                            onBlur={() => {
                              if (typeof campo.defaultValue === 'number' && !Number.isFinite(campo.defaultValue)) {
                                return
                              }
                              setCampoDraftTexts((prev) => {
                                if (!(campo.key in prev)) return prev
                                const next = { ...prev }
                                delete next[campo.key]
                                return next
                              })
                            }}
                            className={`num w-full rounded-xl border bg-white px-3 py-2 pr-20 text-sm font-semibold text-principal ${
                              err ? 'border-red-400' : 'border-borde'
                            }`}
                          />
                          <span className="absolute right-3 text-[11px] text-texto-suave pointer-events-none">
                            {campo.unit}
                          </span>
                        </div>
                        {err && <p className="text-[11px] font-semibold text-red-600">{err}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Selectable Horizonte Options */}
          <div className="bg-white border border-borde rounded-2xl p-5 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-principal">
                Opciones de Horizonte Disponibles en el Simulador (1–30 años)
              </h4>
              <p className="text-xs text-texto-suave">
                Selecciona los horizontes que podrán elegir los usuarios en el selector del simulador.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {HORIZON_GRID.map((yr) => {
                const selected = draftHorizontes.includes(yr)
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => toggleHorizonteOption(yr)}
                    className={`num px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      selected
                        ? 'bg-principal text-acento border-principal'
                        : 'bg-white text-texto-suave border-borde hover:border-principal/40'
                    }`}
                  >
                    {yr}a
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              disabled={saving || Object.keys(campoErrors).length > 0 || !formulaCheck.valid}
              onClick={() =>
                handleSaveNewVersion(
                  pendingExcelMeta ? 'excel_import' : activeTemplate.modo,
                )
              }
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar parámetros como nueva versión
            </Button>
          </div>
        </div>
      )}

      {/* TAB B: Excel Formula Editor */}
      {tab === 'formulas' && (
        <div className="space-y-5">
          <div className="rounded-xl bg-fondo/80 border border-linea p-4 text-xs space-y-1.5">
            <p className="font-bold text-principal">
              Sintaxis Excel compatible (Inglés y Español)
            </p>
            <p className="text-texto-suave">
              Funciones permitidas: <code className="font-mono text-principal">IF / SI</code>,{' '}
              <code className="font-mono text-principal">IFERROR / SI.ERROR</code>,{' '}
              <code className="font-mono text-principal">POWER / POTENCIA</code>,{' '}
              <code className="font-mono text-principal">PMT / PAGO</code>,{' '}
              <code className="font-mono text-principal">SUM / SUMA</code>,{' '}
              <code className="font-mono text-principal">MIN</code>,{' '}
              <code className="font-mono text-principal">MAX</code>,{' '}
              <code className="font-mono text-principal">AND / Y</code>,{' '}
              <code className="font-mono text-principal">OR / O</code>,{' '}
              <code className="font-mono text-principal">ROUND / REDONDEAR</code>,{' '}
              <code className="font-mono text-principal">SQRT / RAIZ</code>,{' '}
              <code className="font-mono text-principal">LN</code>,{' '}
              <code className="font-mono text-principal">EXP</code>. Acepta separadores{' '}
              <code className="font-mono">,</code> o <code className="font-mono">;</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* Formula Inputs */}
            <div className="lg:col-span-2 space-y-3">
              {draftFormulas.map((f) => {
                const fErr = formulaCheck.perFormulaErrors[f.key]
                const isFocused = focusedFormulaKey === f.key

                return (
                  <div
                    key={f.key}
                    className={`rounded-2xl border p-4 transition-colors ${
                      fErr
                        ? 'border-red-400 bg-red-50/30'
                        : isFocused
                          ? 'border-principal bg-white shadow-sm'
                          : 'border-borde bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="text-xs font-bold text-principal">{f.label}</span>
                        <span className="ml-2 font-mono text-[11px] text-texto-suave">
                          {f.key} ({f.unit})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {f.source_cell && (
                          <Badge variant="neutral">Excel: {f.source_cell}</Badge>
                        )}
                        {fErr ? (
                          <Badge variant="warning">Error sintaxis</Badge>
                        ) : (
                          <Badge variant="success">AST OK</Badge>
                        )}
                      </div>
                    </div>

                    <textarea
                      ref={(el) => {
                        formulaInputRefs.current[f.key] = el
                      }}
                      rows={2}
                      value={f.expression}
                      onFocus={() => setFocusedFormulaKey(f.key)}
                      onChange={(e) => {
                        const val = e.target.value
                        setDraftFormulas((prev) =>
                          prev.map((item) =>
                            item.key === f.key ? { ...item, expression: val } : item,
                          ),
                        )
                      }}
                      className="w-full rounded-xl border border-borde bg-fondo/40 px-3 py-2 font-mono text-xs text-principal"
                    />

                    {fErr && (
                      <p className="text-[11px] font-semibold text-red-600 mt-1">{fErr}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Variable Dictionary Chips + Live AST Status */}
            <div className="space-y-4">
              <div className="bg-white border border-borde rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-principal">
                    Variables de Plataforma
                  </h5>
                  <span className="text-[10px] text-texto-suave">
                    Clic para insertar en {focusedFormulaKey}
                  </span>
                </div>
                <input
                  type="text"
                  value={varFilter}
                  onChange={(e) => setVarFilter(e.target.value)}
                  placeholder="Filtrar variable..."
                  className="w-full rounded-lg border border-borde px-3 py-1.5 text-xs text-principal bg-fondo/40"
                />
                <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                  {filteredVarGroups.map(([cat, vars]) => (
                    <div key={cat} className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-texto-suave">
                        {CATEGORY_LABELS[cat]}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {vars.map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            title={`${v.label} (${v.unit})`}
                            onClick={() => insertVariableIntoFormula(v.key)}
                            className="px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-fondo hover:bg-acento hover:text-principal text-principal border border-linea transition-colors"
                          >
                            {v.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredVarGroups.length === 0 && (
                    <p className="text-xs text-texto-suave text-center py-4">
                      Sin coincidencias ({PLATFORM_VARIABLES.length} variables).
                    </p>
                  )}
                </div>
              </div>

              {/* AST Topological Validation & Dry-Run */}
              <div className="bg-white border border-borde rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-principal">Validación AST y Ciclos</span>
                  {formulaCheck.valid ? (
                    <Badge variant="success">Válida</Badge>
                  ) : (
                    <Badge variant="warning">Inválida</Badge>
                  )}
                </div>

                {formulaCheck.globalError ? (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold">
                    {formulaCheck.globalError}
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-[11px] text-texto-suave">Orden topológico:</span>
                      <p className="font-mono text-[11px] text-principal mt-0.5 break-words">
                        {formulaCheck.order.join(' → ')}
                      </p>
                    </div>

                    {formulaCheck.dryRun && formulaCheck.dryRun.status === 'ok' && (
                      <div className="border-t border-linea pt-2.5 space-y-1.5">
                        <span className="text-[11px] font-bold text-texto-suave uppercase">
                          Prueba sintética FV+BESS (10a · MXN)
                        </span>
                        <div className="flex justify-between">
                          <span className="text-texto-suave">Ahorro Año 1:</span>
                          <span className="num font-bold text-menta">
                            {fmtCurrency(formulaCheck.dryRun.ahorro_monetario_y1, 'MXN')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-texto-suave">Payback Simple:</span>
                          <span className="num font-bold text-principal">
                            {formulaCheck.dryRun.payback_simple_anios != null
                              ? `${fmtNum(formulaCheck.dryRun.payback_simple_anios, 2)} años`
                              : formulaCheck.dryRun.payback_estado}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-texto-suave">VAN / TIR:</span>
                          <span className="num font-bold text-principal">
                            {formulaCheck.dryRun.van != null
                              ? fmtCurrency(formulaCheck.dryRun.van, 'MXN')
                              : '—'}{' '}
                            ·{' '}
                            {formulaCheck.dryRun.tir_pct != null
                              ? fmtPct(formulaCheck.dryRun.tir_pct, 2)
                              : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button type="button" variant="outline" onClick={restoreDefaultFormulas}>
              <RotateCcw size={14} />
              Restaurar fórmulas por defecto
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={saving || !formulaCheck.valid || Object.keys(campoErrors).length > 0}
              onClick={() =>
                handleSaveNewVersion(
                  pendingExcelMeta
                    ? 'excel_import'
                    : formulasEqualDefault
                      ? 'default'
                      : 'custom_formulas',
                )
              }
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar fórmulas como nueva versión
            </Button>
          </div>
        </div>
      )}

      {/* TAB C: Excel Import */}
      {tab === 'excel' && (
        <ExcelImportStepper
          currentCampos={draftCampos}
          currentFormulas={draftFormulas}
          currentHorizonteOpciones={draftHorizontes}
          onApplyToEditor={({ formulas, excelMeta }) => {
            setDraftFormulas(formulas)
            setPendingExcelMeta(excelMeta)
            setTab('formulas')
            showNotice('ok', 'Fórmulas reescritas cargadas en el editor. Revisa y guarda para activar.')
          }}
          onImported={(newTpl) => {
            handleTemplateSavedOrActivated(
              newTpl,
              `Modelo de Excel importado y activado como versión v${newTpl.version}.`,
            )
            setTab('historial')
          }}
        />
      )}

      {/* TAB D: Immutable Version History */}
      {tab === 'historial' && (
        <div className="border border-linea rounded-2xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-principal text-white">
                  <th className="text-left px-4 py-3 font-semibold">Versión</th>
                  <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold">Modo</th>
                  <th className="text-left px-4 py-3 font-semibold">Origen Excel</th>
                  <th className="text-left px-4 py-3 font-semibold">Creada</th>
                  <th className="text-right px-4 py-3 font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {templates.map((t) => (
                  <tr key={t.id} className={t.is_active ? 'bg-acento/15' : 'bg-white'}>
                    <td className="num px-4 py-3 font-bold text-principal whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>v{t.version}</span>
                        {t.is_active && <Badge variant="success">Activa</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-principal">
                      <p className="font-semibold">{t.nombre}</p>
                      {t.notas && <p className="text-[11px] text-texto-suave">{t.notas}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={t.modo === 'default' ? 'info' : 'neutral'}>
                        {t.modo === 'default'
                          ? 'Default'
                          : t.modo === 'excel_import'
                            ? 'Excel Import'
                            : 'Custom Formulas'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-texto-suave">
                      {t.excel_archivo_nombre ? (
                        <div>
                          <p className="font-semibold text-principal">{t.excel_archivo_nombre}</p>
                          {t.excel_archivo_hash && (
                            <p className="font-mono text-[10px]">
                              sha256:{t.excel_archivo_hash.slice(0, 12)}…
                            </p>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-texto-suave whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {t.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-exito">
                          <Check size={13} /> Vigente
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={activatingId === t.id || migrationPending}
                          onClick={() => handleActivateRollback(t.id)}
                        >
                          {activatingId === t.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            'Activar versión'
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )

  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl p-6">
          {workspaceBody}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="glass-card p-6">{workspaceBody}</div>
    </div>
  )
}

export default AdminCalculadoraConfig
