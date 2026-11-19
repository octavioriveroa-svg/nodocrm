import type {
  CalculadoraTemplate,
  ConfiguracionTecnica,
  FuenteCalculo,
  Moneda,
  OfertaMem,
  OpcionFinanciamiento,
  PaybackEstado,
  PeriodoMensualSimulacion,
  Proyecto,
  ProyectoSitioProducto,
  SimulacionOverrides,
  SimulationRunOutcome,
  Sitio,
  VistaFinanciamiento,
} from '@/lib/types'
import { parseNum } from '@/lib/format'
import { CFE_TARIFF_RATES_MXN } from '@/lib/tariffs/cfe-calculator'
import {
  type AllowedOverrideKey,
  computeSparseOverrides,
  extractTemplateDefaults,
  FALLBACK_TEMPLATE_FORMULAS,
  type TemplateDefaults,
  validateOverridesAgainstTemplate,
} from '@/lib/calculator/template-schema'
import {
  computeYear1Savings,
  type DefaultMonthlyParams,
  evaluateDefaultMonth,
  toCalcCurrency,
} from '@/lib/calculator/defaults'
import {
  compileAndSortFormulas,
  evaluateCompiledProgram,
  FormulaError,
  type FormulaValue,
  solveIrrRate,
} from '@/lib/calculator/formula-engine'

export const GATED_MISSING_FINANCIAL_MESSAGE =
  'Este proyecto aún no cuenta con cifras cuantitativas de inversión (CAPEX) configuradas. Para ver las proyecciones de ahorro energético, ahorro monetario y periodo de retorno, es necesario capturar las cifras financieras en la solución técnica del proyecto.'

const MONTH_ABBR_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const

const NON_FINANCED_VEHICLES = new Set<string>(['no_sabe', 'mem', 'contado', ''])

/**
 * §3.1 CAPEX Sourcing Priority:
 * 1. Sum of itemized product CAPEX for activeConfig (converting each from datos.capex_moneda ?? activeConfig.moneda ?? 'USD').
 * 2. activeConfig.inversion_total (NEVER falls through to proyecto.capex_estimado when activeConfig exists).
 * 3. proyecto.capex_estimado ONLY when activeConfig is null.
 * Returns null if missing, <= 0, or non-finite (overflow guard).
 */
export function resolveCapexTotal(params: {
  activeConfig: ConfiguracionTecnica | null
  configProducts: readonly ProyectoSitioProducto[]
  proyecto: Pick<Proyecto, 'capex_estimado' | 'moneda'>
  monedaCalculo: Moneda
  fx: number
}): number | null {
  if (!Number.isFinite(params.fx) || params.fx <= 0) return null

  if (params.activeConfig) {
    let itemizedSum = 0
    let hasPositiveItemizedCapex = false
    for (const prod of params.configProducts) {
      const datos = prod.datos as Record<string, unknown> | null
      const rawCapex = parseNum(datos?.capex as string | number | null | undefined)
      if (Number.isFinite(rawCapex) && rawCapex > 0) {
        hasPositiveItemizedCapex = true
        const srcCurrency =
          (datos?.capex_moneda as Moneda | undefined) ??
          (params.activeConfig.moneda as Moneda | undefined) ??
          'USD'
        const converted = toCalcCurrency(rawCapex, srcCurrency, params.monedaCalculo, params.fx)
        if (!Number.isFinite(converted)) return null
        itemizedSum += converted
      }
    }
    if (hasPositiveItemizedCapex) {
      return Number.isFinite(itemizedSum) && itemizedSum > 0 ? itemizedSum : null
    }

    // Priority 2 ONLY — never fall through to proyecto.capex_estimado when activeConfig exists
    const configCapex = params.activeConfig.inversion_total
    if (configCapex != null && Number.isFinite(configCapex) && configCapex > 0) {
      const srcCurrency =
        (params.activeConfig.moneda as Moneda | undefined) ??
        (params.proyecto.moneda as Moneda | undefined) ??
        'MXN'
      const converted = toCalcCurrency(configCapex, srcCurrency, params.monedaCalculo, params.fx)
      return Number.isFinite(converted) && converted > 0 ? converted : null
    }
    return null
  }

  // Priority 3 ONLY when no activeConfig exists
  const projCapex = params.proyecto.capex_estimado
  if (projCapex != null && Number.isFinite(projCapex) && projCapex > 0) {
    const converted = toCalcCurrency(
      projCapex,
      (params.proyecto.moneda as Moneda) ?? 'MXN',
      params.monedaCalculo,
      params.fx,
    )
    return Number.isFinite(converted) && converted > 0 ? converted : null
  }
  return null
}

/**
 * §3.2 Strict Gating Predicate.
 */
export function hasValidFinancialFigures(capexTotalInCalcCurrency: number | null | undefined): boolean {
  return (
    capexTotalInCalcCurrency != null &&
    Number.isFinite(capexTotalInCalcCurrency) &&
    capexTotalInCalcCurrency > 0
  )
}

export function resolveDefaultHorizon(
  tipoProyecto: Proyecto['tipo'],
  templateDefaults: TemplateDefaults,
): number {
  if (tipoProyecto === 'FV' || tipoProyecto === 'FV+BESS') {
    return templateDefaults.horizonte_default_fv
  }
  if (tipoProyecto === 'BESS') {
    return templateDefaults.horizonte_default_bess
  }
  return templateDefaults.horizonte_default_mem
}

export interface SimulationEngineInput {
  proyecto: Pick<
    Proyecto,
    | 'tipo'
    | 'capex_estimado'
    | 'moneda'
    | 'incluye_mem'
    | 'demanda_kw'
    | 'capacidad_mw'
    | 'capacidad_mwh'
    | 'consumo_anual_gwh'
    | 'volumen_energia_mwh_anual'
    | 'tarifa_actual_cfe'
  >
  activeConfig: ConfiguracionTecnica | null
  configProducts: readonly ProyectoSitioProducto[]
  activeFinancing: OpcionFinanciamiento | null
  sitios?: readonly Pick<Sitio, 'demanda_contratada_kw'>[]
  ofertasMem?: readonly Pick<OfertaMem, 'precio_kwh' | 'estado'>[]
  template: Pick<CalculadoraTemplate, 'id' | 'modo' | 'campos' | 'formulas'>
  monedaCalculo?: Moneda
  horizonteAnios?: number
  vistaFinanciamiento?: VistaFinanciamiento
  overrides?: Record<string, unknown>
}

export interface ResolvedTier2Context {
  monedaCalculo: Moneda
  fx: number
  vehiculoInversion: string
  vistaNeta: 0 | 1
  kwpFv: number
  declaredFvGenKwh: number
  bessCapacidadKwh: number
  bessPotenciaKw: number
  bessEsUpsPuro: 0 | 1
  demandaContratadaKw: number
  ahorroDeclaradoBrutoAnual: number
  tier2Defaults: Record<AllowedOverrideKey, number>
}

function resolveProjectTariffMxn(
  rawTarifa: string | number | null | undefined,
  defaultTariffMxn: number,
): number {
  if (typeof rawTarifa === 'number') {
    return Number.isFinite(rawTarifa) && rawTarifa > 0 ? rawTarifa : defaultTariffMxn
  }
  if (typeof rawTarifa === 'string') {
    const trimmed = rawTarifa.trim()
    if (trimmed) {
      const numeric = Number(trimmed)
      if (Number.isFinite(numeric) && numeric > 0) return numeric
      const catalogRate = CFE_TARIFF_RATES_MXN[trimmed.toUpperCase()]
      if (typeof catalogRate === 'number' && catalogRate > 0) return catalogRate
    }
  }
  return defaultTariffMxn
}

/**
 * Resolves Tier 2/3 defaults in the target monedaCalculo (currency-neutral).
 * Shared by evaluateSimulation() and UI panels (e.g., SimuladorContextPanel) so
 * tasa_interes_anual (0.135 arrendamiento / 0.125 credito / 0 contado) and FX-converted
 * tariff defaults are always identical.
 */
export function resolveTier2Context(params: {
  proyecto: SimulationEngineInput['proyecto']
  activeConfig: ConfiguracionTecnica | null
  configProducts: readonly ProyectoSitioProducto[]
  activeFinancing: OpcionFinanciamiento | null
  sitios?: readonly Pick<Sitio, 'demanda_contratada_kw'>[]
  ofertasMem?: readonly Pick<OfertaMem, 'precio_kwh' | 'estado'>[]
  templateDefaults: TemplateDefaults
  monedaCalculo: Moneda
  vistaFinanciamiento: VistaFinanciamiento
  fx: number
  effectiveHsp?: number
  effectivePr?: number
}): ResolvedTier2Context {
  const {
    proyecto,
    activeConfig,
    configProducts,
    activeFinancing,
    sitios = [],
    ofertasMem = [],
    templateDefaults,
    monedaCalculo,
    vistaFinanciamiento,
    fx,
  } = params

  // FV & BESS aggregation from products
  let kwpFv = 0
  let declaredFvGenKwh = 0
  let bessCapKwh = 0
  let bessPotKw = 0
  let bessCount = 0
  let bessUpsOnlyCount = 0

  for (const prod of configProducts) {
    const datos = (prod.datos ?? {}) as Record<string, unknown>
    if (prod.tipo === 'fv') {
      const numMod = parseNum(datos.num_modulos as string | number | null | undefined)
      const potW = parseNum(datos.potencia_modulos_w as string | number | null | undefined)
      if (numMod > 0 && potW > 0) {
        kwpFv += (numMod * potW) / 1000
      }
      const gen = parseNum(datos.generacion_anual_kwh as string | number | null | undefined)
      if (gen > 0) {
        declaredFvGenKwh += gen
      }
    } else if (prod.tipo === 'bess') {
      bessCount++
      const cap = parseNum(datos.capacidad_kwh as string | number | null | undefined)
      const pot = parseNum(datos.potencia_kw as string | number | null | undefined)
      if (cap > 0) bessCapKwh += cap
      if (pot > 0) bessPotKw += pot
      if (datos.uso === 'ups') {
        bessUpsOnlyCount++
      }
    }
  }

  if (bessCapKwh === 0 && proyecto.capacidad_mwh != null && proyecto.capacidad_mwh > 0) {
    bessCapKwh = proyecto.capacidad_mwh * 1000
  }
  if (bessPotKw === 0 && proyecto.capacidad_mw != null && proyecto.capacidad_mw > 0) {
    bessPotKw = proyecto.capacidad_mw * 1000
  }
  const bessEsUpsPuro: 0 | 1 = bessCount > 0 && bessUpsOnlyCount === bessCount ? 1 : 0

  // Site contracted demand
  let demandaSitios = 0
  for (const s of sitios) {
    if (s.demanda_contratada_kw != null && Number.isFinite(s.demanda_contratada_kw) && s.demanda_contratada_kw > 0) {
      demandaSitios += s.demanda_contratada_kw
    }
  }
  const demandaContratadaKw =
    demandaSitios > 0 ? demandaSitios : proyecto.demanda_kw != null && proyecto.demanda_kw > 0 ? proyecto.demanda_kw : 0

  // Annual consumption
  let consumoAnualKwh = 0
  if (proyecto.consumo_anual_gwh != null && Number.isFinite(proyecto.consumo_anual_gwh) && proyecto.consumo_anual_gwh > 0) {
    consumoAnualKwh = proyecto.consumo_anual_gwh * 1e6
  } else if (
    proyecto.volumen_energia_mwh_anual != null &&
    Number.isFinite(proyecto.volumen_energia_mwh_anual) &&
    proyecto.volumen_energia_mwh_anual > 0
  ) {
    consumoAnualKwh = proyecto.volumen_energia_mwh_anual * 1e3
  }

  // Accepted / selected MEM offer price
  const acceptedOffer =
    ofertasMem.find((o) => o.estado === 'aceptada' && o.precio_kwh > 0) ??
    ofertasMem.find((o) => o.precio_kwh > 0)

  const tarifaCfeMxn = resolveProjectTariffMxn(
    proyecto.tarifa_actual_cfe,
    templateDefaults.tarifa_cfe_default_mxn,
  )

  const tarifaMemMxn =
    acceptedOffer && Number.isFinite(acceptedOffer.precio_kwh) && acceptedOffer.precio_kwh > 0
      ? acceptedOffer.precio_kwh
      : templateDefaults.tarifa_mem_default_mxn

  // Declared gross savings from activeConfig
  let ahorroDeclaradoBrutoAnual = 0
  if (activeConfig) {
    const rawAnnual =
      activeConfig.ahorro_estimado_anual != null && activeConfig.ahorro_estimado_anual > 0
        ? activeConfig.ahorro_estimado_anual
        : activeConfig.ahorro_estimado_mensual != null && activeConfig.ahorro_estimado_mensual > 0
          ? activeConfig.ahorro_estimado_mensual * 12
          : 0
    if (rawAnnual > 0) {
      const srcCurr = ((activeConfig.ahorro_moneda || activeConfig.moneda || 'MXN') as Moneda)
      ahorroDeclaradoBrutoAnual = toCalcCurrency(rawAnnual, srcCurr, monedaCalculo, fx)
    }
  }

  // Financing vehicle resolution
  const rawVehicle = (activeFinancing?.vehiculo_inversion ?? 'contado').toLowerCase()
  const vehiculoInversion = rawVehicle || 'contado'
  const vistaNeta: 0 | 1 =
    vistaFinanciamiento === 'neto' && !NON_FINANCED_VEHICLES.has(vehiculoInversion) ? 1 : 0

  const engancheTier2 =
    vehiculoInversion === 'credito' ? templateDefaults.credito_enganche_pct : 0
  const tasaInteresAnualTier2 =
    vehiculoInversion === 'arrendamiento'
      ? templateDefaults.arrendamiento_tasa_equivalente_anual
      : vehiculoInversion === 'credito'
        ? templateDefaults.credito_tasa_interes_anual
        : 0
  const plazoMesesTier2 =
    activeFinancing?.plazo_meses != null &&
    Number.isFinite(activeFinancing.plazo_meses) &&
    activeFinancing.plazo_meses >= 0
      ? activeFinancing.plazo_meses
      : templateDefaults.credito_plazo_meses_default

  const hsp = params.effectiveHsp ?? templateDefaults.hsp_horas_dia
  const pr = params.effectivePr ?? templateDefaults.performance_ratio_fv
  const genFvTier2 = declaredFvGenKwh > 0 ? declaredFvGenKwh : kwpFv * hsp * 365 * pr

  const tier2Defaults: Record<AllowedOverrideKey, number> = {
    tipo_cambio_usd_mxn: templateDefaults.tipo_cambio_usd_mxn,
    tarifa_cfe_kwh: toCalcCurrency(tarifaCfeMxn, 'MXN', monedaCalculo, fx),
    cargo_demanda_mensual_kw: toCalcCurrency(
      templateDefaults.cargo_demanda_mensual_kw_mxn,
      'MXN',
      monedaCalculo,
      fx,
    ),
    diferencial_punta_base_kwh: toCalcCurrency(
      templateDefaults.diferencial_punta_base_mxn,
      'MXN',
      monedaCalculo,
      fx,
    ),
    tarifa_mem_kwh: toCalcCurrency(tarifaMemMxn, 'MXN', monedaCalculo, fx),
    consumo_anual_kwh: consumoAnualKwh,
    generacion_fv_y1_kwh: genFvTier2,
    autoconsumo_fv_pct: templateDefaults.autoconsumo_fv_pct,
    hsp_horas_dia: templateDefaults.hsp_horas_dia,
    performance_ratio_fv: templateDefaults.performance_ratio_fv,
    degradacion_fv_anual: templateDefaults.degradacion_fv_anual,
    bess_ciclos_anio: templateDefaults.bess_ciclos_anio,
    bess_dod: templateDefaults.bess_dod,
    bess_eficiencia_rt: templateDefaults.bess_eficiencia_rt,
    factor_recorte_demanda: templateDefaults.factor_recorte_demanda,
    degradacion_bess_anual: templateDefaults.degradacion_bess_anual,
    escalacion_tarifa_anual: templateDefaults.escalacion_tarifa_anual,
    inflacion_anual: templateDefaults.inflacion_anual,
    pct_om_anual: templateDefaults.pct_om_anual,
    tasa_descuento_anual: templateDefaults.tasa_descuento_anual,
    enganche_pct: engancheTier2,
    tasa_interes_anual: tasaInteresAnualTier2,
    plazo_meses: plazoMesesTier2,
    ensaas_factor_ahorro_pct: templateDefaults.ensaas_factor_ahorro_pct,
  }

  return {
    monedaCalculo,
    fx,
    vehiculoInversion,
    vistaNeta,
    kwpFv,
    declaredFvGenKwh,
    bessCapacidadKwh: bessCapKwh,
    bessPotenciaKw: bessPotKw,
    bessEsUpsPuro,
    demandaContratadaKw,
    ahorroDeclaradoBrutoAnual,
    tier2Defaults,
  }
}

/**
 * Permanent break-even scanner (§4.7):
 * Finds the earliest month m (1..N) where cum[m-1] < 0 AND cum[k] >= 0 for ALL k in [m..N].
 * Returns 0 for immediate recovery (initialOutlay === 0 && flows[0] > 0 && min(cum[1..N]) >= 0).
 * Returns null if no permanent break-even occurs within flows.length.
 */
export function findPermanentBreakEvenMonth(
  initialOutlay: number,
  flows: readonly number[],
): number | null {
  const n = flows.length
  if (n === 0) return null

  const EPS = 1e-9
  const cum = new Float64Array(n + 1)
  cum[0] = -initialOutlay
  for (let i = 0; i < n; i++) {
    cum[i + 1] = cum[i] + flows[i]
  }

  const suffixMin = new Float64Array(n + 1)
  suffixMin[n] = cum[n]
  for (let i = n - 1; i >= 0; i--) {
    suffixMin[i] = cum[i] < suffixMin[i + 1] ? cum[i] : suffixMin[i + 1]
  }

  // Case 2: Immediate (no initial outlay, positive month 1, never dips below 0)
  if (initialOutlay === 0 && flows[0] > 0 && suffixMin[1] >= -EPS) {
    return 0
  }

  for (let m = 1; m <= n; m++) {
    if (cum[m - 1] < -EPS && suffixMin[m] >= -EPS) {
      const flowM = flows[m - 1]
      if (flowM <= 0) continue
      const fraction = Math.min(1, Math.max(0, Math.abs(cum[m - 1]) / flowM))
      return m - 1 + fraction
    }
  }

  return null
}

/**
 * Unified < 1 ms pure-TS simulation engine (§3, §4, §5.2).
 * Evaluates gating first, then override validation, then 1..H*12 monthly series
 * (using typed defaults.ts for modo='default' or cached AST program for custom/excel templates),
 * permanent break-even payback (plus 30y extended probe), VAN, TIR, and dual ROI.
 */
export function evaluateSimulation(input: SimulationEngineInput): SimulationRunOutcome {
  const templateDefaults = extractTemplateDefaults(input.template.campos)

  // Validate top-level config separately
  const monedaCalculo: Moneda =
    input.monedaCalculo ?? (input.proyecto.moneda as Moneda) ?? templateDefaults.moneda_default
  const horizonteAnios =
    input.horizonteAnios ?? resolveDefaultHorizon(input.proyecto.tipo, templateDefaults)
  const vistaFinanciamiento: VistaFinanciamiento = input.vistaFinanciamiento ?? 'bruto'

  // 1. Project-level financial gating (uses valid template baseline FX — never tripped by invalid user FX input)
  const baselineFx = templateDefaults.tipo_cambio_usd_mxn
  const baselineProjectCapex = resolveCapexTotal({
    activeConfig: input.activeConfig,
    configProducts: input.configProducts,
    proyecto: input.proyecto,
    monedaCalculo,
    fx: baselineFx,
  })

  if (!hasValidFinancialFigures(baselineProjectCapex)) {
    return {
      status: 'gated',
      reason: 'missing_financial_figures',
      message: GATED_MISSING_FINANCIAL_MESSAGE,
    }
  }

  // 2. Top-level config + strict-allowlist override validation
  const topLevelErrors: Record<string, string> = {}
  if (monedaCalculo !== 'MXN' && monedaCalculo !== 'USD') {
    topLevelErrors.moneda_calculo = 'Moneda de cálculo inválida (debe ser MXN o USD).'
  }
  if (!Number.isInteger(horizonteAnios) || horizonteAnios < 1 || horizonteAnios > 30) {
    topLevelErrors.horizonte_anios = 'El horizonte debe ser un número entero entre 1 y 30 años.'
  }
  if (vistaFinanciamiento !== 'bruto' && vistaFinanciamiento !== 'neto') {
    topLevelErrors.vista_financiamiento = 'Vista de financiamiento inválida (bruto o neto).'
  }

  const overrideCheck = validateOverridesAgainstTemplate(
    input.template.campos,
    input.overrides ?? {},
  )

  if (!overrideCheck.valid || Object.keys(topLevelErrors).length > 0) {
    return {
      status: 'invalid_override',
      errors: { ...topLevelErrors, ...overrideCheck.errors },
    }
  }

  const sanitized: SimulacionOverrides = overrideCheck.sanitized
  const fx = sanitized.tipo_cambio_usd_mxn ?? templateDefaults.tipo_cambio_usd_mxn

  // Resolve CAPEX in target currency with active FX (overflow guard)
  const capexTotal = resolveCapexTotal({
    activeConfig: input.activeConfig,
    configProducts: input.configProducts,
    proyecto: input.proyecto,
    monedaCalculo,
    fx,
  })

  if (!hasValidFinancialFigures(capexTotal) || capexTotal === null) {
    return {
      status: 'gated',
      reason: 'missing_financial_figures',
      message: GATED_MISSING_FINANCIAL_MESSAGE,
    }
  }

  // 3. 3-Tier Context Resolution (currency-neutral Tier 2 defaults)
  const effectiveHsp = sanitized.hsp_horas_dia ?? templateDefaults.hsp_horas_dia
  const effectivePr = sanitized.performance_ratio_fv ?? templateDefaults.performance_ratio_fv

  const tier2 = resolveTier2Context({
    proyecto: input.proyecto,
    activeConfig: input.activeConfig,
    configProducts: input.configProducts,
    activeFinancing: input.activeFinancing,
    sitios: input.sitios,
    ofertasMem: input.ofertasMem,
    templateDefaults,
    monedaCalculo,
    vistaFinanciamiento,
    fx,
    effectiveHsp,
    effectivePr,
  })

  // Compute currency-neutral sparse overrides over the 24 allowed keys
  const sparseOverrides = computeSparseOverrides(sanitized, tier2.tier2Defaults)
  const usaParametrosBase = Object.keys(sparseOverrides).length === 0

  // Resolve final effective parameter values (Tier 1 Override |> Tier 2 Project |> Tier 3 Template)
  const tarifaCfeKwh = sanitized.tarifa_cfe_kwh ?? tier2.tier2Defaults.tarifa_cfe_kwh
  const cargoDemandaMensualKw =
    sanitized.cargo_demanda_mensual_kw ?? tier2.tier2Defaults.cargo_demanda_mensual_kw
  const diferencialPuntaBaseKwh =
    sanitized.diferencial_punta_base_kwh ?? tier2.tier2Defaults.diferencial_punta_base_kwh
  const tarifaMemKwh = sanitized.tarifa_mem_kwh ?? tier2.tier2Defaults.tarifa_mem_kwh
  const consumoAnualKwh = sanitized.consumo_anual_kwh ?? tier2.tier2Defaults.consumo_anual_kwh
  const generacionFvY1Kwh =
    sanitized.generacion_fv_y1_kwh ?? tier2.tier2Defaults.generacion_fv_y1_kwh
  const autoconsumoFvPct = sanitized.autoconsumo_fv_pct ?? tier2.tier2Defaults.autoconsumo_fv_pct
  const degradacionFvAnual =
    sanitized.degradacion_fv_anual ?? tier2.tier2Defaults.degradacion_fv_anual
  const bessCiclosAnio = sanitized.bess_ciclos_anio ?? tier2.tier2Defaults.bess_ciclos_anio
  const bessDod = sanitized.bess_dod ?? tier2.tier2Defaults.bess_dod
  const bessEficienciaRt = sanitized.bess_eficiencia_rt ?? tier2.tier2Defaults.bess_eficiencia_rt
  const factorRecorteDemanda =
    sanitized.factor_recorte_demanda ?? tier2.tier2Defaults.factor_recorte_demanda
  const degradacionBessAnual =
    sanitized.degradacion_bess_anual ?? tier2.tier2Defaults.degradacion_bess_anual
  const escalacionTarifaAnual =
    sanitized.escalacion_tarifa_anual ?? tier2.tier2Defaults.escalacion_tarifa_anual
  const inflacionAnual = sanitized.inflacion_anual ?? tier2.tier2Defaults.inflacion_anual
  const pctOmAnual = sanitized.pct_om_anual ?? tier2.tier2Defaults.pct_om_anual
  const tasaDescuentoAnual =
    sanitized.tasa_descuento_anual ?? tier2.tier2Defaults.tasa_descuento_anual
  const enganchePct = sanitized.enganche_pct ?? tier2.tier2Defaults.enganche_pct
  const tasaInteresAnual = sanitized.tasa_interes_anual ?? tier2.tier2Defaults.tasa_interes_anual
  const plazoMeses = sanitized.plazo_meses ?? tier2.tier2Defaults.plazo_meses
  const ensaasFactorAhorroPct =
    sanitized.ensaas_factor_ahorro_pct ?? tier2.tier2Defaults.ensaas_factor_ahorro_pct

  // Initial outlay & financed principal (§4.5)
  let desembolsoInicial = capexTotal
  let principalFinanciado = 0
  if (tier2.vistaNeta === 1) {
    if (tier2.vehiculoInversion === 'credito') {
      desembolsoInicial = capexTotal * enganchePct
      principalFinanciado = capexTotal - desembolsoInicial
    } else if (tier2.vehiculoInversion === 'arrendamiento') {
      desembolsoInicial = 0
      principalFinanciado = capexTotal
    } else if (tier2.vehiculoInversion === 'ensaas') {
      desembolsoInicial = 0
      principalFinanciado = 0
    }
  }
  const tasaInteresMensual = tasaInteresAnual / 12

  // 4. Year-1 physical/tariff breakdown
  const y1 = computeYear1Savings({
    tipoProyecto: input.proyecto.tipo,
    incluyeMem: input.proyecto.incluye_mem,
    kwpFv: tier2.kwpFv,
    generacionFvY1Kwh,
    autoconsumoFvPct,
    bessCapacidadKwh: tier2.bessCapacidadKwh,
    bessPotenciaKw: tier2.bessPotenciaKw,
    bessEsUpsPuro: tier2.bessEsUpsPuro,
    bessDod,
    bessEficienciaRt,
    bessCiclosAnio,
    factorRecorteDemanda,
    demandaContratadaKw: tier2.demandaContratadaKw,
    consumoAnualKwh,
    tarifaCfeKwh,
    cargoDemandaMensualKw,
    diferencialPuntaBaseKwh,
    tarifaMemKwh,
    ahorroDeclaradoBrutoAnual: tier2.ahorroDeclaradoBrutoAnual,
  })

  const useAstMode = input.template.modo !== 'default'
  const fuenteCalculo: FuenteCalculo = useAstMode ? 'formula_personalizada' : y1.fuente_calculo

  const monthlyDefaultsParams: DefaultMonthlyParams = {
    capex_total: capexTotal,
    generacion_fv_y1_kwh: y1.generacion_fv_y1_kwh,
    autoconsumo_fv_pct: autoconsumoFvPct,
    degradacion_fv_anual: degradacionFvAnual,
    energia_bess_y1_kwh: y1.energia_bess_y1_kwh,
    degradacion_bess_anual: degradacionBessAnual,
    ahorro_fv_y1: y1.ahorro_fv_y1,
    ahorro_bess_y1: y1.ahorro_bess_y1,
    ahorro_mem_y1: y1.ahorro_mem_y1,
    ahorro_declarado_bruto_anual: tier2.ahorroDeclaradoBrutoAnual,
    escalacion_tarifa_anual: escalacionTarifaAnual,
    pct_om_anual: pctOmAnual,
    inflacion_anual: inflacionAnual,
    vista_neta: tier2.vistaNeta,
    vehiculo_inversion: tier2.vehiculoInversion,
    ensaas_factor_ahorro_pct: ensaasFactorAhorroPct,
    plazo_meses: plazoMeses,
    principal_financiado: principalFinanciado,
    tasa_interes_mensual: tasaInteresMensual,
    pesos_estacionales_fv: templateDefaults.pesos_estacionales_fv,
  }

  // Build reusable AST program & Map scope once if running in custom_formulas / excel_import mode
  const formulasToRun =
    input.template.formulas && input.template.formulas.length > 0
      ? input.template.formulas
      : FALLBACK_TEMPLATE_FORMULAS

  const compiledProgram = useAstMode
    ? compileAndSortFormulas(formulasToRun, { templateId: input.template.id })
    : null

  const buildAstScope = (): Map<string, FormulaValue> => {
    const scope = new Map<string, FormulaValue>()
    scope.set('capex_total', capexTotal)
    scope.set('moneda_default', templateDefaults.moneda_default)
    scope.set('moneda_calculo', monedaCalculo)
    scope.set('tipo_cambio_usd_mxn', fx)
    scope.set('kwp_fv', tier2.kwpFv)
    scope.set('generacion_fv_y1_kwh', y1.generacion_fv_y1_kwh)
    scope.set('autoconsumo_fv_pct', autoconsumoFvPct)
    scope.set('hsp_horas_dia', effectiveHsp)
    scope.set('performance_ratio_fv', effectivePr)
    scope.set('degradacion_fv_anual', degradacionFvAnual)
    scope.set('pesos_estacionales_fv', [...templateDefaults.pesos_estacionales_fv])
    scope.set('peso_estacional_mes', 1 / 12)
    scope.set('bess_capacidad_kwh', tier2.bessCapacidadKwh)
    scope.set('bess_potencia_kw', tier2.bessPotenciaKw)
    scope.set('bess_es_ups_puro', tier2.bessEsUpsPuro)
    scope.set('bess_dod', bessDod)
    scope.set('bess_eficiencia_rt', bessEficienciaRt)
    scope.set('bess_ciclos_anio', bessCiclosAnio)
    scope.set('factor_recorte_demanda', factorRecorteDemanda)
    scope.set('degradacion_bess_anual', degradacionBessAnual)
    scope.set('demanda_contratada_kw', tier2.demandaContratadaKw)
    scope.set('energia_bess_y1_kwh', y1.energia_bess_y1_kwh)
    scope.set('consumo_anual_kwh', consumoAnualKwh)
    scope.set('tarifa_cfe_default_mxn', templateDefaults.tarifa_cfe_default_mxn)
    scope.set('tarifa_cfe_kwh', tarifaCfeKwh)
    scope.set('cargo_demanda_mensual_kw_mxn', templateDefaults.cargo_demanda_mensual_kw_mxn)
    scope.set('cargo_demanda_mensual_kw', cargoDemandaMensualKw)
    scope.set('diferencial_punta_base_mxn', templateDefaults.diferencial_punta_base_mxn)
    scope.set('diferencial_punta_base_kwh', diferencialPuntaBaseKwh)
    scope.set('tarifa_mem_default_mxn', templateDefaults.tarifa_mem_default_mxn)
    scope.set('tarifa_mem_kwh', tarifaMemKwh)
    scope.set('ahorro_fv_y1', y1.ahorro_fv_y1)
    scope.set('ahorro_bess_y1', y1.ahorro_bess_y1)
    scope.set('ahorro_mem_y1', y1.ahorro_mem_y1)
    scope.set('ahorro_declarado_bruto_anual', tier2.ahorroDeclaradoBrutoAnual)
    scope.set('escalacion_tarifa_anual', escalacionTarifaAnual)
    scope.set('inflacion_anual', inflacionAnual)
    scope.set('pct_om_anual', pctOmAnual)
    scope.set('tasa_descuento_anual', tasaDescuentoAnual)
    scope.set('vehiculo_inversion', tier2.vehiculoInversion)
    scope.set('vista_neta', tier2.vistaNeta)
    scope.set('credito_enganche_pct', templateDefaults.credito_enganche_pct)
    scope.set('enganche_pct', enganchePct)
    scope.set('credito_tasa_interes_anual', templateDefaults.credito_tasa_interes_anual)
    scope.set('arrendamiento_tasa_equivalente_anual', templateDefaults.arrendamiento_tasa_equivalente_anual)
    scope.set('tasa_interes_anual', tasaInteresAnual)
    scope.set('tasa_interes_mensual', tasaInteresMensual)
    scope.set('ensaas_factor_ahorro_pct', ensaasFactorAhorroPct)
    scope.set('credito_plazo_meses_default', templateDefaults.credito_plazo_meses_default)
    scope.set('plazo_meses', plazoMeses)
    scope.set('principal_financiado', principalFinanciado)
    scope.set('horizonte_default_fv', templateDefaults.horizonte_default_fv)
    scope.set('horizonte_default_bess', templateDefaults.horizonte_default_bess)
    scope.set('horizonte_default_mem', templateDefaults.horizonte_default_mem)
    scope.set('horizonte_anios', horizonteAnios)
    scope.set('mes_indice', 1)
    scope.set('anio_indice', 0)
    return scope
  }

  const astScope = compiledProgram ? buildAstScope() : null
  const seasonalWeights = templateDefaults.pesos_estacionales_fv

  const evalMonth = (m: number) => {
    if (compiledProgram && astScope) {
      const anioIdx = Math.floor((m - 1) / 12)
      astScope.set('mes_indice', m)
      astScope.set('anio_indice', anioIdx)
      astScope.set('peso_estacional_mes', seasonalWeights[(m - 1) % 12] ?? 1 / 12)
      evaluateCompiledProgram(compiledProgram, astScope)
      return {
        fv_kwh_mes: Number(astScope.get('fv_kwh_mes') ?? 0),
        bess_kwh_mes: Number(astScope.get('bess_kwh_mes') ?? 0),
        energia_ahorrada_kwh_mes: Number(astScope.get('energia_ahorrada_kwh_mes') ?? 0),
        ahorro_bruto_mes: Number(astScope.get('ahorro_bruto_mes') ?? 0),
        om_mes: Number(astScope.get('om_mes') ?? 0),
        cuota_financiamiento_mes: Number(astScope.get('cuota_financiamiento_mes') ?? 0),
        flujo_neto_mes: Number(astScope.get('flujo_neto_mes') ?? 0),
      }
    }
    return evaluateDefaultMonth(monthlyDefaultsParams, m)
  }

  // 5. Monthly time-series loop (1 .. H * 12)
  const totalMonths = horizonteAnios * 12
  const rDescM = Math.pow(1 + tasaDescuentoAnual, 1 / 12) - 1
  const discountBase = 1 + rDescM

  const serieMensual: PeriodoMensualSimulacion[] = new Array(totalMonths)
  const monthlyNetFlows = new Array<number>(totalMonths)
  const monthlyDiscountedFlows = new Array<number>(totalMonths)

  let flujoAcumulado = -desembolsoInicial
  let flujoDescontadoAcumulado = -desembolsoInicial
  let discountDenom = 1

  let ahorroEnergiaY1 = 0
  let ahorroEnergiaTotal = 0
  let ahorroMonetarioY1 = 0
  let ahorroMonetarioTotal = 0
  let flujoNetoTotal = 0

  try {
    for (let m = 1; m <= totalMonths; m++) {
      const out = evalMonth(m)
      const anio = Math.floor((m - 1) / 12) + 1
      const mesEnAnio = (m - 1) % 12
      const trimestre = Math.floor((m - 1) / 3) + 1

      discountDenom *= discountBase
      const discountedNet = out.flujo_neto_mes / discountDenom

      flujoAcumulado += out.flujo_neto_mes
      flujoDescontadoAcumulado += discountedNet

      monthlyNetFlows[m - 1] = out.flujo_neto_mes
      monthlyDiscountedFlows[m - 1] = discountedNet

      if (m <= 12) {
        ahorroEnergiaY1 += out.energia_ahorrada_kwh_mes
        ahorroMonetarioY1 += out.ahorro_bruto_mes
      }
      ahorroEnergiaTotal += out.energia_ahorrada_kwh_mes
      ahorroMonetarioTotal += out.ahorro_bruto_mes
      flujoNetoTotal += out.flujo_neto_mes

      serieMensual[m - 1] = {
        mes: m,
        anio,
        trimestre,
        etiqueta: `${MONTH_ABBR_ES[mesEnAnio]} Año ${anio}`,
        energia_fv_kwh: out.fv_kwh_mes,
        energia_bess_kwh: out.bess_kwh_mes,
        energia_total_kwh: out.energia_ahorrada_kwh_mes,
        ahorro_bruto: out.ahorro_bruto_mes,
        costo_om: out.om_mes,
        cuota_financiamiento: out.cuota_financiamiento_mes,
        flujo_neto: out.flujo_neto_mes,
        flujo_acumulado: flujoAcumulado,
        flujo_descontado_acumulado: flujoDescontadoAcumulado,
      }
    }
  } catch (err) {
    if (err instanceof FormulaError) {
      return {
        status: 'invalid_override',
        errors: { _formula: err.message },
      }
    }
    throw err
  }

  // 6. Permanent Break-Even Payback + 30-Year Extended Probe
  const simpleBreakEven = findPermanentBreakEvenMonth(desembolsoInicial, monthlyNetFlows)
  const discountedBreakEven = findPermanentBreakEvenMonth(desembolsoInicial, monthlyDiscountedFlows)

  let paybackEstado: PaybackEstado
  let paybackSimpleMeses: number | null = null
  let paybackSimpleAnios: number | null = null
  let paybackDescontadoMeses: number | null = discountedBreakEven
  let paybackExtendidoAnios: number | null = null

  if (simpleBreakEven === 0) {
    paybackEstado = 'inmediato'
    paybackSimpleMeses = 0
    paybackSimpleAnios = 0
    paybackDescontadoMeses = discountedBreakEven === 0 ? 0 : discountedBreakEven
  } else if (simpleBreakEven !== null) {
    paybackEstado = 'en_horizonte'
    paybackSimpleMeses = simpleBreakEven
    paybackSimpleAnios = simpleBreakEven / 12
  } else {
    // Extended probe up to 30 years (360 months) to distinguish fuera_horizonte vs no_recuperable
    if (horizonteAnios < 30) {
      const extendedFlows = new Array<number>(360)
      for (let i = 0; i < totalMonths; i++) {
        extendedFlows[i] = monthlyNetFlows[i]
      }
      if (astScope) {
        astScope.set('horizonte_anios', 30)
      }
      for (let m = totalMonths + 1; m <= 360; m++) {
        extendedFlows[m - 1] = evalMonth(m).flujo_neto_mes
      }
      const extBreakEven = findPermanentBreakEvenMonth(desembolsoInicial, extendedFlows)
      if (extBreakEven !== null) {
        paybackEstado = 'fuera_horizonte'
        paybackExtendidoAnios = extBreakEven / 12
      } else {
        paybackEstado = 'no_recuperable'
      }
    } else {
      paybackEstado = 'no_recuperable'
    }
  }

  // 7. VAN, TIR (annualized from monthly IRR), Dual ROI
  const van = serieMensual.length > 0 ? serieMensual[serieMensual.length - 1].flujo_descontado_acumulado : -desembolsoInicial

  let tirPct: number | null = null
  if (desembolsoInicial > 0) {
    const irrFlows = new Array<number>(totalMonths + 1)
    irrFlows[0] = -desembolsoInicial
    for (let i = 0; i < totalMonths; i++) {
      irrFlows[i + 1] = monthlyNetFlows[i]
    }
    const monthlyIrr = solveIrrRate(irrFlows, 0.02)
    if (monthlyIrr !== null && monthlyIrr > -1) {
      const annualIrr = Math.pow(1 + monthlyIrr, 12) - 1
      if (Number.isFinite(annualIrr)) {
        tirPct = annualIrr * 100
      }
    }
  }

  const netProfit = flujoNetoTotal - desembolsoInicial
  const roiPct = (netProfit / capexTotal) * 100
  const roiDesembolsoPct =
    vistaFinanciamiento === 'neto' && desembolsoInicial > 0 && desembolsoInicial < capexTotal
      ? (netProfit / desembolsoInicial) * 100
      : null

  return {
    status: 'ok',
    fuente_calculo: fuenteCalculo,
    capex_total: capexTotal,
    desembolso_inicial: desembolsoInicial,
    usa_parametros_base: usaParametrosBase,
    parametros_override_sparse: sparseOverrides,
    payback_simple_meses: paybackSimpleMeses,
    payback_simple_anios: paybackSimpleAnios,
    payback_descontado_meses: paybackDescontadoMeses,
    payback_extendido_anios: paybackExtendidoAnios,
    payback_estado: paybackEstado,
    ahorro_energia_y1_kwh: ahorroEnergiaY1,
    ahorro_energia_total_kwh: ahorroEnergiaTotal,
    ahorro_monetario_y1: ahorroMonetarioY1,
    ahorro_monetario_total: ahorroMonetarioTotal,
    flujo_neto_total: flujoNetoTotal,
    roi_pct: Number.isFinite(roiPct) ? roiPct : null,
    roi_desembolso_pct: roiDesembolsoPct != null && Number.isFinite(roiDesembolsoPct) ? roiDesembolsoPct : null,
    tir_pct: tirPct,
    van: Number.isFinite(van) ? van : null,
    serie_mensual: serieMensual,
  }
}
