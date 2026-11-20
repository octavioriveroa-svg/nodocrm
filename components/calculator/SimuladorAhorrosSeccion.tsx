'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  CalendarRange,
  Check,
  Database,
  FileSpreadsheet,
  Loader2,
  Save,
  Settings2,
  Sliders,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'
import type {
  CalculadoraTemplate,
  CalculationMode,
  ConfigFinanciamiento,
  ConfiguracionTecnica,
  GranularidadProyeccion,
  MemAnnualAssumptions,
  MemCriticalHourEntry,
  MemHourlyDataset,
  MemSimulatorInputs,
  Moneda,
  OfertaMem,
  OpcionFinanciamiento,
  Proyecto,
  ProyectoSitioProducto,
  Rol,
  SimulacionAhorro,
  SimulacionOverrides,
  Sitio,
  VistaFinanciamiento,
} from '@/lib/types'
import {
  extractTemplateDefaults,
  FALLBACK_HORIZONTE_OPCIONES,
  FALLBACK_TEMPLATE_CAMPOS,
  type AllowedOverrideKey,
} from '@/lib/calculator/template-schema'
import {
  computeSparseMemOverrides,
  evaluateSimulation,
  hasValidFinancialFigures,
  resolveCapexTotal,
  resolveDefaultHorizon,
  resolveMemInputsFromProject,
  resolveTier2Context,
} from '@/lib/calculator/engine'
import {
  createDefaultMemAnnualAssumptions,
  getBaseline100HC,
  getBaselineMemHourlyDataset,
} from '@/lib/calculator/datasets/mem-baseline'
import {
  runMemSimulation,
  validateMemInputs,
} from '@/lib/calculator/mem-hourly-engine'
import { aggregateSeries } from '@/lib/calculator/aggregate'
import { guardarSimulacion } from '@/app/actions/simulaciones'
import { obtenerPlantillasCalculadora } from '@/app/actions/calculatorConfig'
import { fmtCurrency, fmtNum, fmtPct, fmtUnit } from '@/lib/format'
import StatFigure from '@/components/ui/StatFigure'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SimuladorContextPanel } from '@/components/calculator/SimuladorContextPanel'
import { ProyeccionesChart } from '@/components/calculator/ProyeccionesChart'
import { ProyeccionesTabla } from '@/components/calculator/ProyeccionesTabla'
import { SimulacionesGuardadasPanel } from '@/components/calculator/SimulacionesGuardadasPanel'
import { AdminCalculadoraConfig } from '@/components/calculator/AdminCalculadoraConfig'
import { ParameterControlsSidebar } from '@/components/calculator/ParameterControlsSidebar'
import { MemTableroView } from '@/components/calculator/MemTableroView'
import { MemResultadosView } from '@/components/calculator/MemResultadosView'
import { MemSupuestosAnualesView } from '@/components/calculator/MemSupuestosAnualesView'
import { MemEvaluacionFinancieraView } from '@/components/calculator/MemEvaluacionFinancieraView'
import { MemSensibilidadBessView } from '@/components/calculator/MemSensibilidadBessView'
import { MemDatos100HcView } from '@/components/calculator/MemDatos100HcView'

export interface SimuladorAhorrosSeccionProps {
  proyecto: Proyecto
  sitios: Sitio[]
  productos: ProyectoSitioProducto[]
  configuraciones: ConfiguracionTecnica[]
  opcionesFinanciamiento: OpcionFinanciamiento[]
  configFinanciamiento: ConfigFinanciamiento[]
  ofertasMem?: OfertaMem[]
  activeTemplate: CalculadoraTemplate
  templatesById?: Record<string, CalculadoraTemplate>
  initialSimulaciones: SimulacionAhorro[]
  userRole: Rol
  currentUserId: string
  activeConfigId?: string | null
  onEditSolucionTecnica?: () => void
  readOnlyMode?: boolean
}

type MemWorkspaceTab =
  | 'tablero'
  | 'resultados'
  | 'supuestos'
  | 'evaluacion'
  | 'sensibilidad'
  | 'datos'

const MEM_TABS: readonly { key: MemWorkspaceTab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'tablero', label: 'Tablero', icon: BarChart3 },
  { key: 'resultados', label: 'Resultados', icon: FileSpreadsheet },
  { key: 'supuestos', label: 'Supuestos Anuales', icon: CalendarRange },
  { key: 'evaluacion', label: 'Evaluación Financiera', icon: TrendingUp },
  { key: 'sensibilidad', label: 'Sensibilidad BESS', icon: Sliders },
  { key: 'datos', label: 'Datos y 100 HC', icon: Database },
]

const GRANULARIDAD_OPTIONS: readonly { key: GranularidadProyeccion; label: string }[] = [
  { key: 'mensual', label: 'Mensual' },
  { key: 'trimestral', label: 'Trimestral' },
  { key: 'anual', label: 'Anual' },
]

const NON_FINANCED_VEHICLES = new Set(['no_sabe', 'mem', 'contado', ''])

export function SimuladorAhorrosSeccion({
  proyecto,
  sitios,
  productos,
  configuraciones,
  opcionesFinanciamiento,
  configFinanciamiento,
  ofertasMem = [],
  activeTemplate: initialActiveTemplate,
  templatesById: initialTemplatesById = {},
  initialSimulaciones,
  userRole,
  currentUserId,
  activeConfigId,
  onEditSolucionTecnica,
  readOnlyMode = false,
}: SimuladorAhorrosSeccionProps) {
  const [currentActiveTemplate, setCurrentActiveTemplate] =
    useState<CalculadoraTemplate>(initialActiveTemplate)
  const [templatesMap, setTemplatesMap] = useState<Record<string, CalculadoraTemplate>>(() => ({
    ...initialTemplatesById,
    [initialActiveTemplate.id]: initialActiveTemplate,
  }))
  const [historicalTemplateId, setHistoricalTemplateId] = useState<string | null>(null)

  const [simulaciones, setSimulaciones] = useState<SimulacionAhorro[]>(initialSimulaciones)
  const [activeSimulacionId, setActiveSimulacionId] = useState<string | null>(null)

  useEffect(() => {
    setSimulaciones(initialSimulaciones)
  }, [initialSimulaciones])

  useEffect(() => {
    setCurrentActiveTemplate(initialActiveTemplate)
    setTemplatesMap((prev) => ({
      ...prev,
      ...initialTemplatesById,
      [initialActiveTemplate.id]: initialActiveTemplate,
    }))
  }, [initialActiveTemplate, initialTemplatesById])

  const defaultConfigId =
    activeConfigId !== undefined
      ? activeConfigId
      : configuraciones.find((c) => c.seleccionada)?.id ?? configuraciones[0]?.id ?? null

  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(defaultConfigId)

  useEffect(() => {
    if (activeConfigId !== undefined) {
      setSelectedConfigId(activeConfigId)
    }
  }, [activeConfigId])

  const activeConfig = useMemo(
    () => configuraciones.find((c) => c.id === selectedConfigId) ?? null,
    [configuraciones, selectedConfigId],
  )

  const configProducts = useMemo(() => {
    if (!activeConfig) return productos
    return productos.filter(
      (p) => p.configuracion_id === activeConfig.id || p.configuracion_id === null,
    )
  }, [activeConfig, productos])

  const compatibleFinancingOptions = useMemo(() => {
    if (!activeConfig || configFinanciamiento.length === 0) return opcionesFinanciamiento
    const linkedIds = new Set(
      configFinanciamiento
        .filter((link) => link.configuracion_id === activeConfig.id)
        .map((link) => link.opcion_financiamiento_id),
    )
    if (linkedIds.size === 0) return opcionesFinanciamiento
    const filtered = opcionesFinanciamiento.filter((o) => linkedIds.has(o.id))
    return filtered.length > 0 ? filtered : opcionesFinanciamiento
  }, [activeConfig, configFinanciamiento, opcionesFinanciamiento])

  const [selectedFinancingId, setSelectedFinancingId] = useState<string | null>(() => {
    return (
      compatibleFinancingOptions.find((o) => o.seleccionada)?.id ??
      compatibleFinancingOptions[0]?.id ??
      null
    )
  })

  useEffect(() => {
    if (compatibleFinancingOptions.length === 0) {
      setSelectedFinancingId(null)
      return
    }
    if (!compatibleFinancingOptions.some((o) => o.id === selectedFinancingId)) {
      const nextOpt =
        compatibleFinancingOptions.find((o) => o.seleccionada) ?? compatibleFinancingOptions[0]
      setSelectedFinancingId(nextOpt?.id ?? null)
    }
  }, [compatibleFinancingOptions, selectedFinancingId])

  const activeFinancing = useMemo(
    () => compatibleFinancingOptions.find((o) => o.id === selectedFinancingId) ?? null,
    [compatibleFinancingOptions, selectedFinancingId],
  )

  const evalTemplate =
    (historicalTemplateId ? templatesMap[historicalTemplateId] : undefined) ??
    currentActiveTemplate

  const templateDefaults = useMemo(
    () => extractTemplateDefaults(evalTemplate.campos),
    [evalTemplate.campos],
  )

  // Unified calculation mode (defaults to rationalized MEM 8760h+100HC simulator)
  const [calcMode, setCalcMode] = useState<CalculationMode>('mem_horaria')
  const [memTab, setMemTab] = useState<MemWorkspaceTab>('tablero')

  const [monedaCalculo, setMonedaCalculo] = useState<Moneda>(
    () => (proyecto.moneda as Moneda) || templateDefaults.moneda_default || 'MXN',
  )
  const [vistaFinanciamiento, setVistaFinanciamiento] = useState<VistaFinanciamiento>('bruto')
  const [horizonteAnios, setHorizonteAnios] = useState<number>(() =>
    resolveDefaultHorizon(proyecto.tipo, templateDefaults),
  )
  const [granularidad, setGranularidad] = useState<GranularidadProyeccion>('anual')
  const [overrides, setOverrides] = useState<Record<string, unknown>>({})
  const [contextResetKey, setContextResetKey] = useState(0)

  // MEM Horario State
  const projectMemBaseline = useMemo(
    () =>
      resolveMemInputsFromProject({
        proyecto,
        activeConfig,
        configProducts,
        activeFinancing,
        sitios,
        template: evalTemplate,
      }),
    [proyecto, activeConfig, configProducts, activeFinancing, sitios, evalTemplate],
  )

  const [memInputState, setMemInputState] = useState<{
    draft: MemSimulatorInputs
    valid: MemSimulatorInputs
  }>(() => ({
    draft: projectMemBaseline.baseInputs,
    valid: projectMemBaseline.baseInputs,
  }))
  const memInputs = memInputState.draft
  const validMemInputs = memInputState.valid
  const [memAssumptions, setMemAssumptions] = useState<MemAnnualAssumptions>(() =>
    createDefaultMemAnnualAssumptions(),
  )
  const [memHourly, setMemHourly] = useState<MemHourlyDataset>(() =>
    getBaselineMemHourlyDataset(),
  )
  const [mem100HC, setMem100HC] = useState<MemCriticalHourEntry[]>(() => getBaseline100HC())
  const lastSyncedMemBaseRef = useRef<MemSimulatorInputs>(projectMemBaseline.baseInputs)

  useEffect(() => {
    const prevBase = lastSyncedMemBaseRef.current
    const nextBase = projectMemBaseline.baseInputs
    if (prevBase === nextBase) return
    lastSyncedMemBaseRef.current = nextBase
    if (activeSimulacionId !== null) return
    setMemInputState((curr) => {
      const matchesPrevBase = (Object.keys(prevBase) as Array<keyof MemSimulatorInputs>).every(
        (k) => curr.draft[k] === prevBase[k],
      )
      if (!matchesPrevBase) return curr
      const nextIsValid = Object.keys(validateMemInputs(nextBase).errors).length === 0
      return {
        draft: nextBase,
        valid: nextIsValid ? nextBase : curr.valid,
      }
    })
  }, [projectMemBaseline.baseInputs, activeSimulacionId])

  function applyNextMemInputs(updater: (prev: MemSimulatorInputs) => MemSimulatorInputs) {
    setMemInputState((curr) => {
      const next = updater(curr.draft)
      const nextIsValid = Object.keys(validateMemInputs(next).errors).length === 0
      return {
        draft: next,
        valid: nextIsValid ? next : curr.valid,
      }
    })
  }

  function clearTransientInvalidOverrides() {
    setOverrides((prev) => {
      let changed = false
      const next: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(prev)) {
        if (typeof v === 'number' && !Number.isFinite(v)) {
          changed = true
          continue
        }
        next[k] = v
      }
      return changed ? next : prev
    })
    setContextResetKey((k) => k + 1)
  }

  const horizonOptions = useMemo(() => {
    const baseOpts =
      evalTemplate.horizonte_opciones?.length > 0
        ? evalTemplate.horizonte_opciones
        : [...FALLBACK_HORIZONTE_OPCIONES]
    const set = new Set<number>(baseOpts)
    set.add(horizonteAnios)
    return Array.from(set).sort((a, b) => a - b)
  }, [evalTemplate.horizonte_opciones, horizonteAnios])

  // CFE Legacy gating check
  const projectCapexInBaselineFx = useMemo(
    () =>
      resolveCapexTotal({
        activeConfig,
        configProducts,
        proyecto,
        monedaCalculo,
        fx: templateDefaults.tipo_cambio_usd_mxn,
      }),
    [activeConfig, configProducts, proyecto, monedaCalculo, templateDefaults.tipo_cambio_usd_mxn],
  )
  const isCfeGated = !hasValidFinancialFigures(projectCapexInBaselineFx)

  // Live MEM validation + simulation
  const memInputCheck = useMemo(() => validateMemInputs(memInputs), [memInputs])

  const memOutcome = useMemo(() => {
    if (calcMode !== 'mem_horaria') return null
    return runMemSimulation({
      inputs: validMemInputs,
      assumptions: memAssumptions,
      hourly: memHourly,
      criticalHours100HC: mem100HC,
      financialOptions: {
        moneda: monedaCalculo,
        vistaFinanciamiento,
        financing: projectMemBaseline.financingTerms,
      },
    })
  }, [
    calcMode,
    validMemInputs,
    memAssumptions,
    memHourly,
    mem100HC,
    monedaCalculo,
    vistaFinanciamiento,
    projectMemBaseline.financingTerms,
  ])

  const activeMemResult =
    memOutcome && memOutcome.status === 'ok' ? memOutcome : null

  const memSolarZeroEnergy = useMemo(() => {
    let sum = 0
    for (let i = 0; i < memHourly.curva_solar_mw.length; i++) {
      sum += memHourly.curva_solar_mw[i]
      if (sum > 0) return false
    }
    return true
  }, [memHourly.curva_solar_mw])

  const memSparseOverrides = useMemo(
    () =>
      computeSparseMemOverrides(
        memInputs,
        projectMemBaseline.baseInputs,
        memAssumptions,
        mem100HC,
      ),
    [memInputs, projectMemBaseline.baseInputs, memAssumptions, mem100HC],
  )
  const memUsesBaseParams = useMemo(() => {
    const hasCustomInput = Object.keys(memSparseOverrides).some((k) => k !== 'modo_motor')
    return !hasCustomInput
  }, [memSparseOverrides])

  // Legacy CFE live evaluation
  const outcome = useMemo(() => {
    if (calcMode !== 'cfe_tarifario' || isCfeGated) return null
    return evaluateSimulation({
      proyecto,
      activeConfig,
      configProducts,
      activeFinancing,
      sitios,
      ofertasMem,
      template: evalTemplate,
      monedaCalculo,
      horizonteAnios,
      vistaFinanciamiento,
      overrides,
    })
  }, [
    calcMode,
    isCfeGated,
    proyecto,
    activeConfig,
    configProducts,
    activeFinancing,
    sitios,
    ofertasMem,
    evalTemplate,
    monedaCalculo,
    horizonteAnios,
    vistaFinanciamiento,
    overrides,
  ])

  const effectiveFx = useMemo(() => {
    const ovFx = overrides.tipo_cambio_usd_mxn
    if (typeof ovFx === 'number' && Number.isFinite(ovFx) && ovFx > 0) return ovFx
    return templateDefaults.tipo_cambio_usd_mxn
  }, [overrides.tipo_cambio_usd_mxn, templateDefaults.tipo_cambio_usd_mxn])

  const tier2Context = useMemo(
    () =>
      resolveTier2Context({
        proyecto,
        activeConfig,
        configProducts,
        activeFinancing,
        sitios,
        ofertasMem,
        templateDefaults,
        monedaCalculo,
        vistaFinanciamiento,
        fx: effectiveFx,
        effectiveHsp:
          typeof overrides.hsp_horas_dia === 'number' && Number.isFinite(overrides.hsp_horas_dia)
            ? overrides.hsp_horas_dia
            : undefined,
        effectivePr:
          typeof overrides.performance_ratio_fv === 'number' &&
          Number.isFinite(overrides.performance_ratio_fv)
            ? overrides.performance_ratio_fv
            : undefined,
      }),
    [
      proyecto,
      activeConfig,
      configProducts,
      activeFinancing,
      sitios,
      ofertasMem,
      templateDefaults,
      monedaCalculo,
      vistaFinanciamiento,
      effectiveFx,
      overrides.hsp_horas_dia,
      overrides.performance_ratio_fv,
    ],
  )

  const aggregatedRows = useMemo(() => {
    if (!outcome || outcome.status !== 'ok') return []
    return aggregateSeries(outcome.serie_mensual, granularidad)
  }, [outcome, granularidad])

  // Save Scenario Modal state
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')
  const [savingSim, setSavingSim] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Admin Config Modal state
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [adminAllTemplates, setAdminAllTemplates] = useState<CalculadoraTemplate[]>(() =>
    Object.values(templatesMap).sort((a, b) => b.version - a.version),
  )

  function showSavedBanner(msg: string) {
    setSavedMsg(msg)
    setErrorMsg('')
    setTimeout(() => {
      setSavedMsg((cur) => (cur === msg ? '' : cur))
    }, 3000)
  }

  function handleChangeOverride(key: AllowedOverrideKey, value: number | undefined) {
    setActiveSimulacionId(null)
    setOverrides((prev) => {
      const next = { ...prev }
      if (value === undefined) {
        delete next[key]
      } else {
        next[key] = value
      }
      return next
    })
  }

  function handleResetAllOverrides() {
    setActiveSimulacionId(null)
    setHistoricalTemplateId(null)
    setOverrides({})
    setContextResetKey((k) => k + 1)
  }

  function handleResetMemInputs() {
    setActiveSimulacionId(null)
    setHistoricalTemplateId(null)
    setMemInputState({
      draft: projectMemBaseline.baseInputs,
      valid: projectMemBaseline.baseInputs,
    })
  }

  function handleLoadSimulation(sim: SimulacionAhorro) {
    if (sim.configuracion_id && configuraciones.some((c) => c.id === sim.configuracion_id)) {
      setSelectedConfigId(sim.configuracion_id)
    }
    if (
      sim.opcion_financiamiento_id &&
      opcionesFinanciamiento.some((o) => o.id === sim.opcion_financiamiento_id)
    ) {
      setSelectedFinancingId(sim.opcion_financiamiento_id)
    }
    if (sim.template && !templatesMap[sim.template.id]) {
      setTemplatesMap((prev) => ({ ...prev, [sim.template!.id]: sim.template! }))
    }
    if (
      sim.template_id !== currentActiveTemplate.id &&
      (sim.template || templatesMap[sim.template_id])
    ) {
      setHistoricalTemplateId(sim.template_id)
    } else {
      setHistoricalTemplateId(null)
    }

    setMonedaCalculo(sim.moneda_calculo)
    setVistaFinanciamiento(sim.vista_financiamiento)
    setGranularidad(sim.granularidad_default || 'anual')

    const targetConfig =
      sim.configuracion_id && configuraciones.some((c) => c.id === sim.configuracion_id)
        ? (configuraciones.find((c) => c.id === sim.configuracion_id) ?? activeConfig)
        : activeConfig
    const targetConfigProducts = targetConfig
      ? productos.filter(
          (p) => p.configuracion_id === targetConfig.id || p.configuracion_id === null,
        )
      : productos
    const targetFinancing =
      sim.opcion_financiamiento_id &&
      opcionesFinanciamiento.some((o) => o.id === sim.opcion_financiamiento_id)
        ? (opcionesFinanciamiento.find((o) => o.id === sim.opcion_financiamiento_id) ??
          activeFinancing)
        : activeFinancing
    const targetTemplate =
      sim.template ??
      (sim.template_id ? templatesMap[sim.template_id] : undefined) ??
      currentActiveTemplate

    const ov = sim.parametros_override ?? {}
    if (ov.modo_motor === 'mem_horaria') {
      setCalcMode('mem_horaria')
      const base = resolveMemInputsFromProject({
        proyecto,
        activeConfig: targetConfig,
        configProducts: targetConfigProducts,
        activeFinancing: targetFinancing,
        sitios,
        template: targetTemplate,
      }).baseInputs
      const nextMem: MemSimulatorInputs = {
        ...base,
        ...(typeof ov.cliente === 'string' ? { cliente: ov.cliente } : {}),
        ...(typeof ov.demanda_contratada_mw === 'number'
          ? { demanda_contratada_mw: ov.demanda_contratada_mw }
          : {}),
        ...(typeof ov.bess_potencia_mw === 'number'
          ? { bess_potencia_mw: ov.bess_potencia_mw }
          : {}),
        ...(typeof ov.bess_capacidad_mwh === 'number'
          ? { bess_capacidad_mwh: ov.bess_capacidad_mwh }
          : {}),
        ...(typeof ov.bess_eficiencia_pct === 'number'
          ? { bess_eficiencia_pct: ov.bess_eficiencia_pct }
          : {}),
        ...(typeof ov.bess_soc_min_pct === 'number'
          ? { bess_soc_min_pct: ov.bess_soc_min_pct }
          : {}),
        ...(typeof ov.op_horas_carga === 'number' ? { op_horas_carga: ov.op_horas_carga } : {}),
        ...(typeof ov.op_ini_carga === 'number' ? { op_ini_carga: ov.op_ini_carga } : {}),
        ...(typeof ov.op_fin_carga === 'number' ? { op_fin_carga: ov.op_fin_carga } : {}),
        ...(typeof ov.op_ini_descarga === 'number'
          ? { op_ini_descarga: ov.op_ini_descarga }
          : {}),
        ...(typeof ov.op_fin_descarga === 'number'
          ? { op_fin_descarga: ov.op_fin_descarga }
          : {}),
        ...(typeof ov.fv_potencia_mw === 'number' ? { fv_potencia_mw: ov.fv_potencia_mw } : {}),
        ...(typeof ov.fv_degradacion_anual_pct === 'number'
          ? { fv_degradacion_anual_pct: ov.fv_degradacion_anual_pct }
          : {}),
        ...(typeof ov.tc_mxn_usd === 'number' ? { tc_mxn_usd: ov.tc_mxn_usd } : {}),
        ...(typeof ov.tc_fecha === 'string' ? { tc_fecha: ov.tc_fecha } : {}),
        ...(typeof ov.mbp_precio_mxn_mw_anio === 'number'
          ? { mbp_precio_mxn_mw_anio: ov.mbp_precio_mxn_mw_anio }
          : {}),
        ...(typeof ov.rap_factor === 'number' ? { rap_factor: ov.rap_factor } : {}),
        ...(typeof ov.capex_bess_usd_kwh === 'number'
          ? { capex_bess_usd_kwh: ov.capex_bess_usd_kwh }
          : {}),
        ...(typeof ov.capex_fv_usd_kwp === 'number'
          ? { capex_fv_usd_kwp: ov.capex_fv_usd_kwp }
          : {}),
        ...(typeof ov.opex_bess_mxn_mwh_anio === 'number'
          ? { opex_bess_mxn_mwh_anio: ov.opex_bess_mxn_mwh_anio }
          : {}),
        ...(typeof ov.opex_fv_mxn_mw_anio === 'number'
          ? { opex_fv_mxn_mw_anio: ov.opex_fv_mxn_mw_anio }
          : {}),
        ...(typeof ov.fin_tasa_descuento_pct === 'number'
          ? { fin_tasa_descuento_pct: ov.fin_tasa_descuento_pct }
          : {}),
        ...(typeof ov.fin_esc_opex_pct === 'number'
          ? { fin_esc_opex_pct: ov.fin_esc_opex_pct }
          : {}),
        fin_horizonte_anios: sim.horizonte_anios,
      }
      setMemInputState((curr) => {
        const nextIsValid = Object.keys(validateMemInputs(nextMem).errors).length === 0
        return {
          draft: nextMem,
          valid: nextIsValid ? nextMem : curr.valid,
        }
      })
      setMemAssumptions(ov.supuestos_anuales ?? createDefaultMemAnnualAssumptions())
      setMem100HC(
        ov.critical_hours_100hc && ov.critical_hours_100hc.length > 0
          ? ov.critical_hours_100hc
          : getBaseline100HC(),
      )
      setActiveSimulacionId(sim.id)
      showSavedBanner(`Escenario MEM "${sim.nombre}" cargado.`)
      return
    }

    if (isCfeGated) return
    setCalcMode('cfe_tarifario')
    setHorizonteAnios(sim.horizonte_anios)
    setOverrides({ ...ov })
    setContextResetKey((k) => k + 1)
    setActiveSimulacionId(sim.id)
    showSavedBanner(`Escenario "${sim.nombre}" cargado.`)
  }

  function handleDuplicateSimulation(sim: SimulacionAhorro) {
    handleLoadSimulation(sim)
    setActiveSimulacionId(null)
    setSaveName(`${sim.nombre} (Copia)`)
    setSaveDesc(sim.descripcion ?? '')
    setShowSaveModal(true)
  }

  async function handleSaveSimulation(e: React.FormEvent) {
    e.preventDefault()
    if (readOnlyMode) return
    const trimmed = saveName.trim()
    if (!trimmed) {
      setErrorMsg('Ingresa un nombre para la simulación.')
      return
    }

    if (calcMode === 'mem_horaria') {
      if (memOutcome?.status !== 'ok' || memOutcome.financial.capex_total <= 0) {
        setErrorMsg('Verifica que los parámetros MEM sean válidos y CAPEX > 0 antes de guardar.')
        return
      }
      const baselineHc = getBaseline100HC()
      const hcChanged =
        mem100HC.length !== baselineHc.length ||
        mem100HC.some(
          (row, i) =>
            row.fecha !== baselineHc[i]?.fecha || row.hora !== baselineHc[i]?.hora,
        )

      const payloadOverrides: SimulacionOverrides = {
        ...memSparseOverrides,
        modo_motor: 'mem_horaria',
        ...(hcChanged ? { critical_hours_100hc: mem100HC } : {}),
      }

      setSavingSim(true)
      setErrorMsg('')
      const res = await guardarSimulacion({
        proyecto_id: proyecto.id,
        configuracion_id: activeConfig?.id ?? null,
        opcion_financiamiento_id: activeFinancing?.id ?? null,
        nombre: trimmed,
        descripcion: saveDesc.trim() || null,
        moneda_calculo: monedaCalculo,
        horizonte_anios: memInputs.fin_horizonte_anios,
        vista_financiamiento: vistaFinanciamiento,
        granularidad_default: granularidad,
        parametros_override: payloadOverrides,
      })
      setSavingSim(false)

      if (res.error || !res.data) {
        setErrorMsg(res.error || 'No se pudo guardar la simulación.')
        return
      }

      setSimulaciones((prev) => [res.data!, ...prev])
      setActiveSimulacionId(res.data.id)
      setHistoricalTemplateId(null)
      setShowSaveModal(false)
      setSaveName('')
      setSaveDesc('')
      showSavedBanner('Simulación MEM guardada correctamente.')
      return
    }

    if (isCfeGated || outcome?.status !== 'ok') return

    setSavingSim(true)
    setErrorMsg('')
    const res = await guardarSimulacion({
      proyecto_id: proyecto.id,
      configuracion_id: activeConfig?.id ?? null,
      opcion_financiamiento_id: activeFinancing?.id ?? null,
      nombre: trimmed,
      descripcion: saveDesc.trim() || null,
      moneda_calculo: monedaCalculo,
      horizonte_anios: horizonteAnios,
      vista_financiamiento: vistaFinanciamiento,
      granularidad_default: granularidad,
      parametros_override: outcome.parametros_override_sparse as SimulacionOverrides,
    })
    setSavingSim(false)

    if (res.error || !res.data) {
      setErrorMsg(res.error || 'No se pudo guardar la simulación.')
      return
    }

    setSimulaciones((prev) => [res.data!, ...prev])
    setActiveSimulacionId(res.data.id)
    setHistoricalTemplateId(null)
    setShowSaveModal(false)
    setSaveName('')
    setSaveDesc('')
    showSavedBanner('Simulación guardada correctamente.')
  }

  async function handleOpenAdminModal() {
    setShowAdminModal(true)
    const res = await obtenerPlantillasCalculadora()
    if (res.data && res.data.length > 0) {
      setAdminAllTemplates(res.data)
      const mapUpdate: Record<string, CalculadoraTemplate> = {}
      for (const t of res.data) mapUpdate[t.id] = t
      setTemplatesMap((prev) => ({ ...prev, ...mapUpdate }))
    }
  }

  const canCaptureCapex =
    !readOnlyMode &&
    (userRole === 'nodo_admin' ||
      userRole === 'nodo_analista' ||
      (userRole === 'epc' && proyecto.epcista_id === currentUserId))

  const hasApplicableFinancing =
    activeFinancing !== null &&
    !NON_FINANCED_VEHICLES.has((activeFinancing.vehiculo_inversion || '').toLowerCase())

  const isOk = outcome?.status === 'ok'
  const isInvalidOverride = outcome?.status === 'invalid_override'

  const canSaveActiveMode =
    calcMode === 'mem_horaria'
      ? Object.keys(memInputCheck.errors).length === 0 &&
        memOutcome?.status === 'ok' &&
        memOutcome.financial.capex_total > 0
      : !isCfeGated && isOk

  const nextHorizonTarget = useMemo(() => {
    if (!isOk || outcome.payback_extendido_anios == null) return 30
    const needed = Math.ceil(outcome.payback_extendido_anios)
    const candidate = horizonOptions.find((h) => h >= needed)
    return candidate ?? Math.min(30, Math.max(needed, horizonteAnios + 5))
  }, [isOk, outcome, horizonOptions, horizonteAnios])

  const declaredVariancePct = useMemo(() => {
    if (!isOk || outcome.fuente_calculo !== 'fisico_tarifario') return null
    if (tier2Context.ahorroDeclaradoBrutoAnual <= 0 || outcome.ahorro_monetario_y1 <= 0) return null
    return (
      ((outcome.ahorro_monetario_y1 - tier2Context.ahorroDeclaradoBrutoAnual) /
        tier2Context.ahorroDeclaradoBrutoAnual) *
      100
    )
  }, [isOk, outcome, tier2Context.ahorroDeclaradoBrutoAnual])

  return (
    <section className="glass-card p-6 mt-6 space-y-6">
      {/* Section Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-linea pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-principal text-acento flex items-center justify-center shrink-0">
            <Calculator size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-principal">
                Simulador de Ahorros FV + BESS
              </h3>
              {calcMode === 'mem_horaria' ? (
                <Badge variant={memUsesBaseParams ? 'info' : 'neutral'}>
                  {memUsesBaseParams ? 'Parámetros base' : 'Escenario ajustado'}
                </Badge>
              ) : (
                !isCfeGated &&
                isOk && (
                  <Badge variant={outcome.usa_parametros_base ? 'info' : 'neutral'}>
                    {outcome.usa_parametros_base
                      ? 'Parámetros base Nodo'
                      : 'Parámetros personalizados'}
                  </Badge>
                )
              )}
              {historicalTemplateId && (
                <Badge variant="warning">
                  Plantilla histórica v{evalTemplate.version}
                  <button
                    type="button"
                    onClick={() => setHistoricalTemplateId(null)}
                    className="ml-1.5 underline font-bold"
                  >
                    Usar activa (v{currentActiveTemplate.version})
                  </button>
                </Badge>
              )}
            </div>
            <p className="text-xs text-texto-suave mt-0.5">
              {calcMode === 'mem_horaria'
                ? 'Simulación horaria 8,760 h (PML) + 100 Horas Críticas (CENACE) + Evaluación a 25 años para '
                : 'Proyección tarifaria CFE/AST y retorno financiero para '}
              <strong className="text-principal">{proyecto.nombre_proyecto}</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {/* Calculation Mode Toggle */}
          <div className="inline-flex rounded-xl border border-borde bg-fondo/60 p-0.5">
            <button
              type="button"
              onClick={() => {
                setCalcMode('mem_horaria')
                setActiveSimulacionId(null)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                calcMode === 'mem_horaria'
                  ? 'bg-principal text-acento'
                  : 'text-texto-suave hover:text-principal'
              }`}
            >
              MEM Horario (8,760h + 100HC)
            </button>
            <button
              type="button"
              onClick={() => {
                setCalcMode('cfe_tarifario')
                setActiveSimulacionId(null)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                calcMode === 'cfe_tarifario'
                  ? 'bg-principal text-acento'
                  : 'text-texto-suave hover:text-principal'
              }`}
            >
              CFE Tarifario
            </button>
          </div>

          {userRole === 'nodo_admin' && (
            <Button type="button" variant="outline" size="sm" onClick={handleOpenAdminModal}>
              <Settings2 size={14} />
              Configurar plantilla y Excel
            </Button>
          )}
          {!readOnlyMode && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!canSaveActiveMode}
              onClick={() => {
                const yr = calcMode === 'mem_horaria' ? memInputs.fin_horizonte_anios : horizonteAnios
                setSaveName(`Escenario ${yr} años (${monedaCalculo})`)
                setSaveDesc('')
                setErrorMsg('')
                setShowSaveModal(true)
              }}
            >
              <Save size={14} />
              Guardar simulación
            </Button>
          )}
        </div>
      </div>

      {savedMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-acento text-principal text-xs font-bold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Check size={14} />
            {savedMsg}
          </span>
          <button type="button" onClick={() => setSavedMsg('')} aria-label="Cerrar aviso">
            <X size={14} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} aria-label="Cerrar error">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Alternative & Financing Selectors when multiple options exist */}
      {(configuraciones.length > 1 || compatibleFinancingOptions.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-fondo/40 border border-linea rounded-xl px-3.5 py-2.5 print:hidden">
          {configuraciones.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-texto-suave">Alternativa técnica:</span>
              {configuraciones.map((cfg) => (
                <button
                  key={cfg.id}
                  type="button"
                  onClick={() => {
                    const wasLoadedSim = activeSimulacionId !== null
                    setSelectedConfigId(cfg.id)
                    setActiveSimulacionId(null)
                    clearTransientInvalidOverrides()
                    if (wasLoadedSim || memUsesBaseParams) {
                      const nextProducts = productos.filter(
                        (p) => p.configuracion_id === cfg.id || p.configuracion_id === null,
                      )
                      const nextBase = resolveMemInputsFromProject({
                        proyecto,
                        activeConfig: cfg,
                        configProducts: nextProducts,
                        activeFinancing,
                        sitios,
                        template: evalTemplate,
                      }).baseInputs
                      lastSyncedMemBaseRef.current = nextBase
                      setMemInputState((curr) => {
                        const nextIsValid =
                          Object.keys(validateMemInputs(nextBase).errors).length === 0
                        return {
                          draft: nextBase,
                          valid: nextIsValid ? nextBase : curr.valid,
                        }
                      })
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    cfg.id === selectedConfigId
                      ? 'bg-principal text-acento border-principal'
                      : 'bg-white text-texto-suave border-borde hover:text-principal'
                  }`}
                >
                  {cfg.nombre}
                  {cfg.seleccionada ? ' ✓' : ''}
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}

          {compatibleFinancingOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-texto-suave">Vehículo financiamiento:</span>
              <select
                value={selectedFinancingId ?? ''}
                onChange={(e) => {
                  setSelectedFinancingId(e.target.value || null)
                  setActiveSimulacionId(null)
                  clearTransientInvalidOverrides()
                }}
                className="rounded-lg border border-borde bg-white px-2.5 py-1 text-xs font-semibold text-principal"
              >
                {compatibleFinancingOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre} ({o.vehiculo_inversion}
                    {o.plazo_meses ? ` · ${o.plazo_meses}m` : ''})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── MODE 1: RATIONALIZED MEM HOURLY SIMULATOR (8,760h + 100HC) ────────── */}
      {calcMode === 'mem_horaria' && (
        <div className="flex flex-col xl:flex-row gap-5 items-start">
          {/* Left Sticky Sidebar: 23 Blue Inputs */}
          <div className="w-full xl:w-[340px] shrink-0 xl:sticky xl:top-4 print:hidden">
            <ParameterControlsSidebar
              inputs={memInputs}
              errors={memInputCheck.errors}
              warnings={activeMemResult?.validationWarnings ?? memInputCheck.warnings}
              moneda={monedaCalculo}
              vistaFinanciamiento={vistaFinanciamiento}
              hasApplicableFinancing={hasApplicableFinancing}
              activeFinancing={activeFinancing}
              onChangeInput={(key, val) => {
                setActiveSimulacionId(null)
                applyNextMemInputs((prev) => ({ ...prev, [key]: val }))
              }}
              onChangeMoneda={(m) => {
                setActiveSimulacionId(null)
                setMonedaCalculo(m)
              }}
              onChangeVista={(v) => {
                setActiveSimulacionId(null)
                setVistaFinanciamiento(v)
              }}
              onResetDefaults={handleResetMemInputs}
              disabled={readOnlyMode}
            />
          </div>

          {/* Right Main 6-Tab Workspace */}
          <div className="min-w-0 flex-1 space-y-5 w-full">
            <div className="flex flex-wrap gap-1.5 border-b border-linea pb-3 print:hidden">
              {MEM_TABS.map((t) => {
                const Icon = t.icon
                const active = memTab === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setMemTab(t.key)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      active
                        ? 'bg-principal text-acento border-principal shadow-sm'
                        : 'bg-white text-texto-suave border-borde hover:text-principal hover:bg-fondo/60'
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                )
              })}
            </div>

            {Object.keys(memInputCheck.errors).length > 0 && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={15} />
                  Corrige los parámetros marcados para actualizar la simulación:
                </p>
                <ul className="list-disc pl-5">
                  {Object.values(memInputCheck.errors).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeMemResult && (
              <>
                {memTab === 'tablero' && (
                  <MemTableroView
                    inputs={activeMemResult.inputs}
                    year1={activeMemResult.year1}
                    financial={activeMemResult.financial}
                    datasetLabel={memHourly.label}
                    solarZeroEnergy={memSolarZeroEnergy}
                    moneda={monedaCalculo}
                    vistaFinanciamiento={vistaFinanciamiento}
                  />
                )}

                {memTab === 'resultados' && (
                  <MemResultadosView
                    inputs={activeMemResult.inputs}
                    year1={activeMemResult.year1}
                    moneda={monedaCalculo}
                  />
                )}

                {memTab === 'supuestos' && (
                  <MemSupuestosAnualesView
                    assumptions={memAssumptions}
                    assumptionsRows={activeMemResult.financial.assumptions_rows}
                    onChangeAssumptions={(next) => {
                      setActiveSimulacionId(null)
                      setMemAssumptions(next)
                    }}
                    onResetDefaults={() => {
                      setActiveSimulacionId(null)
                      setMemAssumptions(createDefaultMemAnnualAssumptions())
                    }}
                    disabled={readOnlyMode}
                  />
                )}

                {memTab === 'evaluacion' && (
                  <MemEvaluacionFinancieraView
                    inputs={activeMemResult.inputs}
                    financial={activeMemResult.financial}
                    moneda={monedaCalculo}
                    vistaFinanciamiento={vistaFinanciamiento}
                  />
                )}

                {memTab === 'sensibilidad' && (
                  <MemSensibilidadBessView
                    inputs={activeMemResult.inputs}
                    assumptions={memAssumptions}
                    hourly={memHourly}
                    criticalHours100HC={mem100HC}
                    moneda={monedaCalculo}
                    vistaFinanciamiento={vistaFinanciamiento}
                    financingTerms={projectMemBaseline.financingTerms}
                    onApplyBessSize={(potMw, capMwh) => {
                      setActiveSimulacionId(null)
                      applyNextMemInputs((prev) => ({
                        ...prev,
                        bess_potencia_mw: potMw,
                        bess_capacidad_mwh: capMwh,
                      }))
                      showSavedBanner(
                        `Tamaño BESS aplicado a Inputs: ${fmtNum(potMw, 2)} MW / ${fmtNum(capMwh, 2)} MWh.`,
                      )
                    }}
                  />
                )}

                {memTab === 'datos' && (
                  <MemDatos100HcView
                    inputs={activeMemResult.inputs}
                    assumptions={memAssumptions}
                    moneda={monedaCalculo}
                    hourly={memHourly}
                    year1={activeMemResult.year1}
                    criticalHours100HC={mem100HC}
                    onUpdateCriticalHours={(nextHc) => {
                      setActiveSimulacionId(null)
                      setMem100HC(nextHc)
                    }}
                    onApplyImportedWorkbook={({
                      hourlyDataset,
                      criticalHours100HC,
                      extractedInputs,
                      extractedAssumptions,
                    }) => {
                      setActiveSimulacionId(null)
                      if (hourlyDataset) setMemHourly(hourlyDataset)
                      if (criticalHours100HC) setMem100HC(criticalHours100HC)
                      if (extractedInputs) {
                        applyNextMemInputs((prev) => ({ ...prev, ...extractedInputs }))
                      }
                      if (extractedAssumptions) {
                        setMemAssumptions(extractedAssumptions)
                      }
                    }}
                    onRestoreBaseline={() => {
                      setActiveSimulacionId(null)
                      setMemHourly(getBaselineMemHourlyDataset())
                      setMem100HC(getBaseline100HC())
                    }}
                    disabled={readOnlyMode}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODE 2: CFE TARIFF FALLBACK ENGINE ──────────────────────────────── */}
      {calcMode === 'cfe_tarifario' &&
        (isCfeGated ? (
          <div className="glass-panel border-dashed rounded-2xl p-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row items-start gap-4">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <h4 className="text-sm font-black text-amber-900">
                    Faltan cifras financieras para el modo CFE Tarifario
                  </h4>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Este proyecto aún no cuenta con cifras cuantitativas de inversión (CAPEX) configuradas. Puedes usar el modo{' '}
                    <strong>MEM Horario</strong> o capturar la inversión en la solución técnica.
                  </p>
                </div>

                {canCaptureCapex && onEditSolucionTecnica ? (
                  <Button type="button" variant="primary" size="sm" onClick={onEditSolucionTecnica}>
                    Capturar inversión y solución técnica
                  </Button>
                ) : (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/80 border border-amber-200 text-xs font-semibold text-amber-900">
                    Solicita a tu asesor Nodo o EPCista registrar los montos de inversión para habilitar este modo.
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Simulator Controls Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-fondo/70 border border-linea rounded-2xl p-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                  Vista de Financiamiento
                </label>
                <div className="flex rounded-lg border border-borde bg-white p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setVistaFinanciamiento('bruto')
                      setActiveSimulacionId(null)
                    }}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-colors ${
                      vistaFinanciamiento === 'bruto'
                        ? 'bg-principal text-acento'
                        : 'text-texto-suave hover:text-principal'
                    }`}
                  >
                    Bruto / Contado
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVistaFinanciamiento('neto')
                      setActiveSimulacionId(null)
                    }}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-colors ${
                      vistaFinanciamiento === 'neto'
                        ? 'bg-principal text-acento'
                        : 'text-texto-suave hover:text-principal'
                    }`}
                  >
                    Neto Financiado
                  </button>
                </div>
                {vistaFinanciamiento === 'neto' && !hasApplicableFinancing && (
                  <p className="text-[10px] text-texto-suave">
                    Sin vehículo financiado aplicable (evaluando contado).
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                  Moneda de Cálculo
                </label>
                <div className="flex rounded-lg border border-borde bg-white p-0.5 gap-0.5">
                  {(['MXN', 'USD'] as const).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => {
                        setMonedaCalculo(curr)
                        setActiveSimulacionId(null)
                        clearTransientInvalidOverrides()
                      }}
                      className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-colors ${
                        monedaCalculo === curr
                          ? 'bg-principal text-acento'
                          : 'text-texto-suave hover:text-principal'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-texto-suave">
                  Tipo de cambio:{' '}
                  <span className="num font-bold text-principal">{fmtNum(effectiveFx, 2)}</span> MXN/USD
                </p>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                  Horizonte de Proyección (Años)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {horizonOptions.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setHorizonteAnios(yr)
                        setActiveSimulacionId(null)
                      }}
                      className={`num px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                        horizonteAnios === yr
                          ? 'bg-principal text-acento border-principal'
                          : 'bg-white text-texto-suave border-borde hover:text-principal'
                      }`}
                    >
                      {yr} años
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {isInvalidOverride && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={15} />
                  Revisa los parámetros personalizados antes de guardar o proyectar:
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {Object.values(outcome.errors).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {isOk && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="min-w-0 bg-white border border-borde rounded-2xl p-4 shadow-sm flex flex-col justify-between break-words">
                    <StatFigure
                      label="Payback Estimado"
                      tone="plain"
                      size="md"
                      value={
                        outcome.payback_estado === 'inmediato'
                          ? 'Inmediato'
                          : outcome.payback_estado === 'en_horizonte' &&
                              outcome.payback_simple_anios != null
                            ? `${fmtNum(outcome.payback_simple_anios, 2)} años`
                            : outcome.payback_estado === 'fuera_horizonte'
                              ? 'Fuera de horizonte'
                              : 'No recuperable'
                      }
                    />
                    <div className="mt-2 space-y-1.5">
                      <p className="num text-[11px] text-texto-suave">
                        {outcome.payback_estado === 'inmediato'
                          ? 'Sin desembolso inicial'
                          : outcome.payback_estado === 'en_horizonte' &&
                              outcome.payback_simple_meses != null
                            ? `${fmtNum(outcome.payback_simple_meses, 1)} meses${
                                outcome.payback_descontado_meses != null
                                  ? ` · Desc: ${fmtNum(outcome.payback_descontado_meses / 12, 2)} años`
                                  : ''
                              }`
                            : outcome.payback_estado === 'fuera_horizonte' &&
                                outcome.payback_extendido_anios != null
                              ? `~${fmtNum(outcome.payback_extendido_anios, 1)} años est. (> ${horizonteAnios}a)`
                              : 'No recupera inversión en 30 años'}
                      </p>
                      {outcome.payback_estado === 'fuera_horizonte' && (
                        <button
                          type="button"
                          onClick={() => setHorizonteAnios(nextHorizonTarget)}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-acento text-principal hover:bg-acento-hover transition-colors"
                        >
                          Ampliar a {nextHorizonTarget} años
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 bg-white border border-borde rounded-2xl p-4 shadow-sm flex flex-col justify-between break-words">
                    <StatFigure
                      label="Ahorro Energía (Año 1)"
                      tone="menta"
                      size="md"
                      value={fmtUnit(outcome.ahorro_energia_y1_kwh, 'kWh', 0)}
                    />
                    <p className="num text-[11px] text-texto-suave mt-2">
                      Acumulado {horizonteAnios}a: {fmtUnit(outcome.ahorro_energia_total_kwh, 'kWh', 0)}
                    </p>
                  </div>

                  <div className="min-w-0 bg-principal text-white border border-principal rounded-2xl p-4 shadow-sm flex flex-col justify-between break-words">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-acento shrink-0" aria-hidden />
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                          Ahorro Monetario (Año 1)
                        </span>
                      </div>
                      <div className="num font-black leading-tight mt-1 text-2xl text-acento break-words">
                        {fmtCurrency(outcome.ahorro_monetario_y1, monedaCalculo)}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="num text-[11px] text-white/80">
                        CAPEX: {fmtCurrency(outcome.capex_total, monedaCalculo)}
                      </p>
                      {declaredVariancePct !== null && (
                        <p className="num text-[10px] text-acento font-semibold">
                          Diferencia vs. declarado: {declaredVariancePct >= 0 ? '+' : ''}
                          {fmtPct(declaredVariancePct, 1)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 bg-white border border-borde rounded-2xl p-4 shadow-sm flex flex-col justify-between break-words">
                    <StatFigure
                      label={`Ahorro Acumulado (${horizonteAnios} años)`}
                      tone="menta"
                      size="md"
                      value={fmtCurrency(outcome.ahorro_monetario_total, monedaCalculo)}
                    />
                    <p className="num text-[11px] text-texto-suave mt-2">
                      Flujo neto total: {fmtCurrency(outcome.flujo_neto_total, monedaCalculo)}
                    </p>
                  </div>

                  <div className="min-w-0 sm:col-span-2 lg:col-span-2 bg-white border border-borde rounded-2xl p-4 shadow-sm flex flex-col justify-between break-words">
                    <StatFigure
                      label="VAN (WACC)"
                      tone="plain"
                      size="md"
                      value={outcome.van != null ? fmtCurrency(outcome.van, monedaCalculo) : '—'}
                    />
                    <div className="num text-[11px] text-texto-suave mt-2 space-y-0.5">
                      <p>
                        TIR: <strong className="text-principal">{outcome.tir_pct != null ? fmtPct(outcome.tir_pct, 2) : '—'}</strong>
                        {' · '}
                        ROI s/CAPEX: <strong className="text-principal">{outcome.roi_pct != null ? fmtPct(outcome.roi_pct, 1) : '—'}</strong>
                      </p>
                      {vistaFinanciamiento === 'neto' && outcome.roi_desembolso_pct != null && (
                        <p className="text-menta font-bold">
                          Cash-on-Cash: {fmtPct(outcome.roi_desembolso_pct, 1)}
                        </p>
                      )}
                      {vistaFinanciamiento === 'neto' && outcome.desembolso_inicial === 0 && (
                        <p className="text-exito font-bold">Sin desembolso inicial</p>
                      )}
                    </div>
                  </div>
                </div>

                {outcome.fuente_calculo === 'ahorro_declarado' && (
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-texto-suave bg-fondo px-3 py-1 rounded-lg border border-linea">
                    <Sparkles size={12} className="text-menta" />
                    Calculado con ahorro anual declarado en la propuesta técnica.
                  </div>
                )}
              </div>
            )}

            <SimuladorContextPanel
              campos={evalTemplate.campos.length > 0 ? evalTemplate.campos : FALLBACK_TEMPLATE_CAMPOS}
              monedaCalculo={monedaCalculo}
              tier2Defaults={tier2Context.tier2Defaults}
              overrides={overrides}
              fieldErrors={isInvalidOverride ? outcome.errors : {}}
              usaParametrosBase={isOk ? outcome.usa_parametros_base : false}
              resetKey={`${contextResetKey}:${selectedConfigId ?? ''}`}
              onChangeOverride={handleChangeOverride}
              onResetAll={handleResetAllOverrides}
            />

            {isOk && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {GRANULARIDAD_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setGranularidad(opt.key)}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                          granularidad === opt.key
                            ? 'bg-principal text-acento border-principal'
                            : 'bg-white text-texto-suave border-borde hover:bg-fondo'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-texto-suave">
                    Plantilla v<span className="num font-bold text-principal">{evalTemplate.version}</span>
                  </span>
                </div>

                <ProyeccionesChart
                  rows={aggregatedRows}
                  granularidad={granularidad}
                  moneda={monedaCalculo}
                  paybackSimpleMeses={outcome.payback_simple_meses}
                />

                <ProyeccionesTabla
                  rows={aggregatedRows}
                  granularidad={granularidad}
                  moneda={monedaCalculo}
                  proyectoNombre={proyecto.nombre_proyecto}
                  escenarioNombre={
                    simulaciones.find((s) => s.id === activeSimulacionId)?.nombre ??
                    (outcome.usa_parametros_base ? 'Base Nodo' : 'Personalizado')
                  }
                />
              </div>
            )}
          </>
        ))}

      {/* Saved Scenarios Panel */}
      <SimulacionesGuardadasPanel
        simulaciones={simulaciones}
        activeSimulacionId={activeSimulacionId}
        isGated={calcMode === 'cfe_tarifario' && isCfeGated}
        currentUserId={currentUserId}
        userRole={userRole}
        proyectoEpcistaId={proyecto.epcista_id}
        readOnlyMode={readOnlyMode}
        onLoad={handleLoadSimulation}
        onDuplicate={handleDuplicateSimulation}
        onRenamed={(updated) =>
          setSimulaciones((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        }
        onRecalculated={(updated) => {
          setSimulaciones((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
          if (activeSimulacionId === updated.id) {
            handleLoadSimulation(updated)
          }
        }}
        onDeleted={(id) => {
          setSimulaciones((prev) => prev.filter((s) => s.id !== id))
          if (activeSimulacionId === id) setActiveSimulacionId(null)
        }}
      />

      {/* Save Scenario Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleSaveSimulation}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-linea bg-fondo/50">
              <div>
                <h4 className="text-base font-black text-principal">Guardar Simulación</h4>
                <p className="text-xs text-texto-suave">
                  {calcMode === 'mem_horaria' ? memInputs.fin_horizonte_anios : horizonteAnios} años ·{' '}
                  {monedaCalculo} · {vistaFinanciamiento === 'neto' ? 'Vista Neta' : 'Vista Bruta'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                disabled={savingSim}
                className="p-1.5 rounded-lg text-texto-suave hover:text-principal hover:bg-fondo"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-principal mb-1">
                  Nombre del escenario *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder='Ej. "Escenario Base 25 años"'
                  className="w-full rounded-xl border border-borde px-3.5 py-2 text-sm text-principal bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-principal mb-1">
                  Notas o descripción (opcional)
                </label>
                <textarea
                  rows={2}
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  placeholder="Supuestos clave de este escenario..."
                  className="w-full rounded-xl border border-borde px-3.5 py-2 text-sm text-principal bg-white resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-linea bg-fondo/50 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={savingSim}
                onClick={() => setShowSaveModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={savingSim || !saveName.trim()}>
                {savingSim ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Guardar escenario
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Nodo Admin Template & Formula Configuration Modal */}
      {showAdminModal && userRole === 'nodo_admin' && (
        <AdminCalculadoraConfig
          mode="modal"
          initialTemplates={adminAllTemplates}
          activeTemplate={currentActiveTemplate}
          onClose={() => setShowAdminModal(false)}
          onTemplateActivated={(newTpl) => {
            setCurrentActiveTemplate(newTpl)
            setHistoricalTemplateId(null)
            setTemplatesMap((prev) => ({ ...prev, [newTpl.id]: newTpl }))
            setAdminAllTemplates((prev) => {
              const updated = prev.map((t) => ({ ...t, is_active: t.id === newTpl.id }))
              return updated.some((t) => t.id === newTpl.id)
                ? updated
                : [newTpl, ...updated].sort((a, b) => b.version - a.version)
            })
            showSavedBanner(`Plantilla v${newTpl.version} activada en el simulador.`)
          }}
        />
      )}
    </section>
  )
}

export default SimuladorAhorrosSeccion
