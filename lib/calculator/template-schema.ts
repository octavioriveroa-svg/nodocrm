import type {
  CalculadoraCampoDef,
  FormulaDefinicion,
  MemSimulatorInputs,
  Moneda,
  SimulacionOverrides,
} from '@/lib/types'
import { DEFAULT_MEM_INPUTS } from '@/lib/calculator/datasets/mem-baseline'

export const FALLBACK_HORIZONTE_OPCIONES: readonly number[] = [1, 3, 5, 10, 15, 20, 25]

export const FALLBACK_TEMPLATE_CAMPOS: CalculadoraCampoDef[] = [
  {
    key: 'moneda_default',
    label: 'Moneda base por defecto',
    unit: 'código',
    type: 'select',
    group: 'moneda',
    defaultValue: 'MXN',
    validationRules: { required: true, options: ['MXN', 'USD'], overrideKey: 'moneda_calculo' },
    editableByUser: true,
    order: 1,
  },
  {
    key: 'tipo_cambio_usd_mxn',
    label: 'Tipo de cambio USD/MXN',
    unit: 'MXN/USD',
    type: 'number',
    group: 'moneda',
    min: 0.01,
    max: 100,
    step: 0.1,
    defaultValue: 17.5,
    validationRules: { required: true, exclusiveMin: 0 },
    editableByUser: true,
    order: 2,
  },
  {
    key: 'tarifa_cfe_default_mxn',
    label: 'Tarifa CFE por defecto',
    unit: 'MXN/kWh',
    type: 'number',
    group: 'tarifas',
    min: 0,
    max: 50,
    step: 0.05,
    defaultValue: 3.2,
    validationRules: { required: true, overrideKey: 'tarifa_cfe_kwh' },
    editableByUser: true,
    order: 3,
  },
  {
    key: 'cargo_demanda_mensual_kw_mxn',
    label: 'Cargo por demanda CFE',
    unit: 'MXN/kW-mes',
    type: 'number',
    group: 'tarifas',
    min: 0,
    max: 5000,
    step: 10,
    defaultValue: 380,
    validationRules: { required: true, overrideKey: 'cargo_demanda_mensual_kw' },
    editableByUser: true,
    order: 4,
  },
  {
    key: 'diferencial_punta_base_mxn',
    label: 'Diferencial punta-base BESS',
    unit: 'MXN/kWh',
    type: 'number',
    group: 'tarifas',
    min: 0,
    max: 20,
    step: 0.05,
    defaultValue: 1.4,
    validationRules: { required: true, overrideKey: 'diferencial_punta_base_kwh' },
    editableByUser: true,
    order: 5,
  },
  {
    key: 'tarifa_mem_default_mxn',
    label: 'Tarifa MEM por defecto',
    unit: 'MXN/kWh',
    type: 'number',
    group: 'tarifas',
    min: 0,
    max: 50,
    step: 0.05,
    defaultValue: 2.45,
    validationRules: { required: true, overrideKey: 'tarifa_mem_kwh' },
    editableByUser: true,
    order: 6,
  },
  {
    key: 'hsp_horas_dia',
    label: 'Horas Solar Pico (HSP)',
    unit: 'kWh/m²/día',
    type: 'number',
    group: 'fv',
    min: 0.1,
    max: 12,
    step: 0.1,
    defaultValue: 5.2,
    validationRules: { required: true, exclusiveMin: 0 },
    editableByUser: true,
    order: 7,
  },
  {
    key: 'performance_ratio_fv',
    label: 'Performance Ratio FV',
    unit: '%',
    type: 'percentage',
    group: 'fv',
    min: 0.01,
    max: 1,
    step: 0.01,
    defaultValue: 0.8,
    validationRules: { required: true, exclusiveMin: 0 },
    editableByUser: true,
    order: 8,
  },
  {
    key: 'autoconsumo_fv_pct',
    label: 'Autoconsumo FV',
    unit: '%',
    type: 'percentage',
    group: 'fv',
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 1.0,
    validationRules: { required: true },
    editableByUser: true,
    order: 9,
  },
  {
    key: 'degradacion_fv_anual',
    label: 'Degradación anual FV',
    unit: '%/año',
    type: 'percentage',
    group: 'fv',
    min: 0,
    max: 0.19999,
    step: 0.001,
    defaultValue: 0.005,
    validationRules: { required: true, exclusiveMax: 0.2 },
    editableByUser: true,
    order: 10,
  },
  {
    key: 'pesos_estacionales_fv',
    label: 'Pesos estacionales FV (12 meses)',
    unit: 'fracción',
    type: 'number_array',
    group: 'fv',
    defaultValue: [0.072, 0.076, 0.09, 0.093, 0.098, 0.091, 0.089, 0.088, 0.08, 0.08, 0.073, 0.07],
    validationRules: { required: true, arrayLength: 12, sumEquals: 1, sumTolerance: 0.001 },
    editableByUser: false,
    order: 11,
  },
  {
    key: 'bess_dod',
    label: 'Profundidad de descarga BESS (DoD)',
    unit: '%',
    type: 'percentage',
    group: 'bess',
    min: 0.01,
    max: 1,
    step: 0.01,
    defaultValue: 0.85,
    validationRules: { required: true, exclusiveMin: 0 },
    editableByUser: true,
    order: 12,
  },
  {
    key: 'bess_eficiencia_rt',
    label: 'Eficiencia round-trip BESS',
    unit: '%',
    type: 'percentage',
    group: 'bess',
    min: 0.01,
    max: 1,
    step: 0.01,
    defaultValue: 0.88,
    validationRules: { required: true, exclusiveMin: 0 },
    editableByUser: true,
    order: 13,
  },
  {
    key: 'bess_ciclos_anio',
    label: 'Ciclos anuales BESS',
    unit: 'ciclos/año',
    type: 'integer',
    group: 'bess',
    min: 0,
    max: 730,
    step: 10,
    defaultValue: 260,
    validationRules: { required: true, integer: true },
    editableByUser: true,
    order: 14,
  },
  {
    key: 'factor_recorte_demanda',
    label: 'Factor recorte de demanda BESS',
    unit: '%',
    type: 'percentage',
    group: 'bess',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.7,
    validationRules: { required: true },
    editableByUser: true,
    order: 15,
  },
  {
    key: 'degradacion_bess_anual',
    label: 'Degradación anual BESS',
    unit: '%/año',
    type: 'percentage',
    group: 'bess',
    min: 0,
    max: 0.24999,
    step: 0.005,
    defaultValue: 0.02,
    validationRules: { required: true, exclusiveMax: 0.25 },
    editableByUser: true,
    order: 16,
  },
  {
    key: 'escalacion_tarifa_anual',
    label: 'Escalación anual de tarifa',
    unit: '%/año',
    type: 'percentage',
    group: 'macro',
    min: -0.1,
    max: 0.5,
    step: 0.005,
    defaultValue: 0.045,
    validationRules: { required: true, allowNegative: true },
    editableByUser: true,
    order: 17,
  },
  {
    key: 'inflacion_anual',
    label: 'Inflación anual O&M',
    unit: '%/año',
    type: 'percentage',
    group: 'macro',
    min: -0.05,
    max: 0.5,
    step: 0.005,
    defaultValue: 0.04,
    validationRules: { required: true, allowNegative: true },
    editableByUser: true,
    order: 18,
  },
  {
    key: 'pct_om_anual',
    label: 'Costo anual O&M (% CAPEX)',
    unit: '%/año',
    type: 'percentage',
    group: 'macro',
    min: 0,
    max: 0.25,
    step: 0.0025,
    defaultValue: 0.01,
    validationRules: { required: true },
    editableByUser: true,
    order: 19,
  },
  {
    key: 'tasa_descuento_anual',
    label: 'Tasa de descuento anual (WACC)',
    unit: '%/año',
    type: 'percentage',
    group: 'macro',
    min: 0,
    max: 0.5,
    step: 0.005,
    defaultValue: 0.1,
    validationRules: { required: true },
    editableByUser: true,
    order: 20,
  },
  {
    key: 'credito_enganche_pct',
    label: 'Enganche de crédito',
    unit: '%',
    type: 'percentage',
    group: 'financiamiento',
    min: 0,
    max: 0.99,
    step: 0.05,
    defaultValue: 0.2,
    validationRules: { required: true, overrideKey: 'enganche_pct' },
    editableByUser: true,
    order: 21,
  },
  {
    key: 'credito_tasa_interes_anual',
    label: 'Tasa de interés anual (Crédito)',
    unit: '%/año',
    type: 'percentage',
    group: 'financiamiento',
    min: 0,
    max: 0.6,
    step: 0.005,
    defaultValue: 0.125,
    validationRules: { required: true, overrideKey: 'tasa_interes_anual' },
    editableByUser: true,
    order: 22,
  },
  {
    key: 'credito_plazo_meses_default',
    label: 'Plazo financiamiento por defecto',
    unit: 'meses',
    type: 'integer',
    group: 'financiamiento',
    min: 1,
    max: 300,
    step: 12,
    defaultValue: 60,
    validationRules: {
      required: true,
      integer: true,
      overrideKey: 'plazo_meses',
      overrideMin: 0,
      overrideMax: 360,
    },
    editableByUser: true,
    order: 23,
  },
  {
    key: 'arrendamiento_tasa_equivalente_anual',
    label: 'Tasa equivalente anual arrendamiento',
    unit: '%/año',
    type: 'percentage',
    group: 'financiamiento',
    min: 0,
    max: 0.6,
    step: 0.005,
    defaultValue: 0.135,
    validationRules: { required: true },
    editableByUser: false,
    order: 24,
  },
  {
    key: 'ensaas_factor_ahorro_pct',
    label: 'Factor ahorro retenido EnSaaS',
    unit: '%',
    type: 'percentage',
    group: 'financiamiento',
    min: 0.01,
    max: 1,
    step: 0.05,
    defaultValue: 0.25,
    validationRules: { required: true, exclusiveMin: 0 },
    editableByUser: true,
    order: 25,
  },
  {
    key: 'horizonte_default_fv',
    label: 'Horizonte por defecto FV',
    unit: 'años',
    type: 'integer',
    group: 'horizontes',
    min: 1,
    max: 30,
    step: 1,
    defaultValue: 25,
    validationRules: { required: true, integer: true },
    editableByUser: false,
    order: 26,
  },
  {
    key: 'horizonte_default_bess',
    label: 'Horizonte por defecto BESS',
    unit: 'años',
    type: 'integer',
    group: 'horizontes',
    min: 1,
    max: 30,
    step: 1,
    defaultValue: 10,
    validationRules: { required: true, integer: true },
    editableByUser: false,
    order: 27,
  },
  {
    key: 'horizonte_default_mem',
    label: 'Horizonte por defecto MEM',
    unit: 'años',
    type: 'integer',
    group: 'horizontes',
    min: 1,
    max: 30,
    step: 1,
    defaultValue: 5,
    validationRules: { required: true, integer: true },
    editableByUser: false,
    order: 28,
  },
]

export const FALLBACK_TEMPLATE_FORMULAS: FormulaDefinicion[] = [
  {
    key: 'fv_kwh_mes',
    label: 'Generación FV Mensual (kWh)',
    expression:
      '=generacion_fv_y1_kwh * autoconsumo_fv_pct * POWER(1 - degradacion_fv_anual, anio_indice) * peso_estacional_mes',
    unit: 'kWh',
    enabled: true,
  },
  {
    key: 'bess_kwh_mes',
    label: 'Energía Desplazada BESS (kWh)',
    expression: '=energia_bess_y1_kwh * POWER(1 - degradacion_bess_anual, anio_indice) / 12',
    unit: 'kWh',
    enabled: true,
  },
  {
    key: 'energia_ahorrada_kwh_mes',
    label: 'Ahorro Energético Total (kWh)',
    expression: '=fv_kwh_mes + bess_kwh_mes',
    unit: 'kWh',
    enabled: true,
  },
  {
    key: 'ahorro_bruto_mes',
    label: 'Ahorro Monetario Bruto',
    expression:
      '=IF((ahorro_fv_y1 + ahorro_bess_y1 + ahorro_mem_y1) > 0, (ahorro_fv_y1 * POWER(1 - degradacion_fv_anual, anio_indice) * peso_estacional_mes + (ahorro_bess_y1 * POWER(1 - degradacion_bess_anual, anio_indice) + ahorro_mem_y1) / 12) * POWER(1 + escalacion_tarifa_anual, anio_indice), (ahorro_declarado_bruto_anual / 12) * POWER(1 + escalacion_tarifa_anual, anio_indice))',
    unit: 'currency',
    enabled: true,
  },
  {
    key: 'om_mes',
    label: 'Costo O&M Mensual',
    expression: '=(capex_total * pct_om_anual * POWER(1 + inflacion_anual, anio_indice)) / 12',
    unit: 'currency',
    enabled: true,
  },
  {
    key: 'cuota_financiamiento_mes',
    label: 'Servicio de Deuda / Cuota',
    expression:
      '=IF(vista_neta=1, IF(vehiculo_inversion="ensaas", MAX(0, ahorro_bruto_mes * (1 - ensaas_factor_ahorro_pct) - om_mes), IF(AND(mes_indice<=plazo_meses, plazo_meses>0, principal_financiado>0), IF(tasa_interes_mensual>0, -PMT(tasa_interes_mensual, plazo_meses, principal_financiado), principal_financiado / plazo_meses), 0)), 0)',
    unit: 'currency',
    enabled: true,
  },
  {
    key: 'flujo_neto_mes',
    label: 'Flujo Neto Mensual',
    expression: '=ahorro_bruto_mes - om_mes - cuota_financiamiento_mes',
    unit: 'currency',
    enabled: true,
  },
]

export interface TemplateDefaults {
  moneda_default: Moneda
  tipo_cambio_usd_mxn: number
  tarifa_cfe_default_mxn: number
  cargo_demanda_mensual_kw_mxn: number
  diferencial_punta_base_mxn: number
  tarifa_mem_default_mxn: number
  hsp_horas_dia: number
  performance_ratio_fv: number
  autoconsumo_fv_pct: number
  degradacion_fv_anual: number
  pesos_estacionales_fv: number[]
  bess_dod: number
  bess_eficiencia_rt: number
  bess_ciclos_anio: number
  factor_recorte_demanda: number
  degradacion_bess_anual: number
  escalacion_tarifa_anual: number
  inflacion_anual: number
  pct_om_anual: number
  tasa_descuento_anual: number
  credito_enganche_pct: number
  credito_tasa_interes_anual: number
  credito_plazo_meses_default: number
  arrendamiento_tasa_equivalente_anual: number
  ensaas_factor_ahorro_pct: number
  horizonte_default_fv: number
  horizonte_default_bess: number
  horizonte_default_mem: number
  [key: string]: number | string | number[]
}

export const FALLBACK_TEMPLATE_DEFAULTS: TemplateDefaults = {
  moneda_default: 'MXN',
  tipo_cambio_usd_mxn: 17.5,
  tarifa_cfe_default_mxn: 3.2,
  cargo_demanda_mensual_kw_mxn: 380,
  diferencial_punta_base_mxn: 1.4,
  tarifa_mem_default_mxn: 2.45,
  hsp_horas_dia: 5.2,
  performance_ratio_fv: 0.8,
  autoconsumo_fv_pct: 1.0,
  degradacion_fv_anual: 0.005,
  pesos_estacionales_fv: [0.072, 0.076, 0.09, 0.093, 0.098, 0.091, 0.089, 0.088, 0.08, 0.08, 0.073, 0.07],
  bess_dod: 0.85,
  bess_eficiencia_rt: 0.88,
  bess_ciclos_anio: 260,
  factor_recorte_demanda: 0.7,
  degradacion_bess_anual: 0.02,
  escalacion_tarifa_anual: 0.045,
  inflacion_anual: 0.04,
  pct_om_anual: 0.01,
  tasa_descuento_anual: 0.1,
  credito_enganche_pct: 0.2,
  credito_tasa_interes_anual: 0.125,
  credito_plazo_meses_default: 60,
  arrendamiento_tasa_equivalente_anual: 0.135,
  ensaas_factor_ahorro_pct: 0.25,
  horizonte_default_fv: 25,
  horizonte_default_bess: 10,
  horizonte_default_mem: 5,
}

/**
 * Exact 24 overridable simulation keys allowed inside simulaciones_ahorro.parametros_override.
 * Excludes top-level DB config columns (moneda_calculo, horizonte_anios, vista_financiamiento, granularidad_default)
 * and editableByUser: false fields.
 */
export const ALLOWED_OVERRIDE_KEYS = [
  'tipo_cambio_usd_mxn',
  'tarifa_cfe_kwh',
  'cargo_demanda_mensual_kw',
  'diferencial_punta_base_kwh',
  'tarifa_mem_kwh',
  'consumo_anual_kwh',
  'generacion_fv_y1_kwh',
  'autoconsumo_fv_pct',
  'hsp_horas_dia',
  'performance_ratio_fv',
  'degradacion_fv_anual',
  'bess_ciclos_anio',
  'bess_dod',
  'bess_eficiencia_rt',
  'factor_recorte_demanda',
  'degradacion_bess_anual',
  'escalacion_tarifa_anual',
  'inflacion_anual',
  'pct_om_anual',
  'tasa_descuento_anual',
  'enganche_pct',
  'tasa_interes_anual',
  'plazo_meses',
  'ensaas_factor_ahorro_pct',
] as const satisfies readonly (keyof SimulacionOverrides)[]

export type AllowedOverrideKey = (typeof ALLOWED_OVERRIDE_KEYS)[number]

const ALLOWED_OVERRIDE_KEY_SET = new Set<string>(ALLOWED_OVERRIDE_KEYS)
const RUNTIME_ENGINEERING_OVERRIDE_KEYS = new Set<string>([
  'consumo_anual_kwh',
  'generacion_fv_y1_kwh',
])
const FORBIDDEN_PROTOTYPE_KEYS = new Set<string>([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
])
const TOP_LEVEL_CONFIG_KEYS = new Set<string>([
  'moneda_calculo',
  'moneda_default',
  'horizonte_anios',
  'vista_financiamiento',
  'granularidad_default',
])

/**
 * Extracts typed defaults from a template's declarative campos array, falling back to v1 seed defaults
 * for any omitted key.
 */
export function extractTemplateDefaults(
  campos: readonly CalculadoraCampoDef[] | null | undefined,
): TemplateDefaults {
  const result: TemplateDefaults = {
    ...FALLBACK_TEMPLATE_DEFAULTS,
    pesos_estacionales_fv: [...FALLBACK_TEMPLATE_DEFAULTS.pesos_estacionales_fv],
  }

  if (!Array.isArray(campos)) return result

  for (const campo of campos) {
    if (!campo || typeof campo.key !== 'string' || FORBIDDEN_PROTOTYPE_KEYS.has(campo.key)) {
      continue
    }
    const val = campo.defaultValue
    if (Array.isArray(val)) {
      if (val.every((item) => typeof item === 'number' && Number.isFinite(item))) {
        result[campo.key] = [...val]
      }
    } else if (typeof val === 'number') {
      if (Number.isFinite(val)) {
        result[campo.key] = val
      }
    } else if (typeof val === 'string') {
      result[campo.key] = val
    }
  }

  return result
}

/**
 * Returns a Map from canonical SimulacionOverrides key to its declarative CalculadoraCampoDef
 * (strictly excluding editableByUser: false fields and top-level moneda_calculo).
 */
export function getOverridableCampoMap(
  campos: readonly CalculadoraCampoDef[] | null | undefined,
): Map<AllowedOverrideKey, CalculadoraCampoDef> {
  const map = new Map<AllowedOverrideKey, CalculadoraCampoDef>()
  const list = Array.isArray(campos) && campos.length > 0 ? campos : FALLBACK_TEMPLATE_CAMPOS

  for (const campo of list) {
    if (!campo || !campo.editableByUser) continue
    const overrideKey = campo.validationRules?.overrideKey ?? campo.key
    if (TOP_LEVEL_CONFIG_KEYS.has(overrideKey)) continue
    if (ALLOWED_OVERRIDE_KEY_SET.has(overrideKey)) {
      map.set(overrideKey as AllowedOverrideKey, campo)
    }
  }

  return map
}

function isValidIsoDateString(val: string): boolean {
  const trimmed = val.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!m) return false
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const dt = new Date(Date.UTC(year, month - 1, day))
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  )
}

/**
 * Validates a value against a declarative CalculadoraCampoDef (either baseline or override bounds).
 */
export function validateCampoValue(
  campo: CalculadoraCampoDef,
  value: unknown,
  options: { useOverrideBounds?: boolean } = {},
): string | null {
  const rules = campo.validationRules
  const label = campo.label || campo.key

  if (value === null || value === undefined || value === '') {
    return `${label}: valor requerido.`
  }

  if (campo.type === 'text' || campo.type === 'date') {
    if (typeof value !== 'string') {
      return `${label}: debe ser texto válido.`
    }
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return `${label}: valor requerido.`
    }
    if (campo.type === 'text' && trimmed.length > 200) {
      return `${label}: máximo 200 caracteres.`
    }
    if (campo.type === 'date' && !isValidIsoDateString(trimmed)) {
      return `${label}: debe ser una fecha ISO válida (YYYY-MM-DD).`
    }
    return null
  }

  if (campo.type === 'select') {
    if (typeof value !== 'string') {
      return `${label}: debe ser texto válido.`
    }
    if (rules?.options && rules.options.length > 0 && !rules.options.includes(value)) {
      return `${label}: debe ser uno de (${rules.options.join(', ')}).`
    }
    return null
  }

  if (campo.type === 'number_array') {
    if (!Array.isArray(value) || value.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
      return `${label}: debe ser un arreglo de números finitos.`
    }
    if (rules?.arrayLength !== undefined && value.length !== rules.arrayLength) {
      return `${label}: debe contener exactamente ${rules.arrayLength} elementos.`
    }
    if (value.some((n) => n < 0)) {
      return `${label}: los elementos no pueden ser negativos.`
    }
    if (rules?.sumEquals !== undefined) {
      const tol = rules.sumTolerance ?? 0.001
      const sum = value.reduce((acc, n) => acc + n, 0)
      if (Math.abs(sum - rules.sumEquals) > tol) {
        return `${label}: la suma (${sum.toFixed(4)}) debe ser igual a ${rules.sumEquals} (±${tol}).`
      }
    }
    return null
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${label}: debe ser un número finito.`
  }

  const effMin = options.useOverrideBounds ? (rules?.overrideMin ?? campo.min) : campo.min
  const effMax = options.useOverrideBounds ? (rules?.overrideMax ?? campo.max) : campo.max

  if (rules?.allowNegative !== true && effMin === undefined && value < 0) {
    return `${label}: no puede ser negativo.`
  }
  if (rules?.allowNegative === false && value < 0) {
    return `${label}: no puede ser negativo.`
  }
  if ((rules?.integer || campo.type === 'integer') && !Number.isInteger(value)) {
    return `${label}: debe ser un número entero.`
  }
  if (effMin !== undefined && value < effMin) {
    return `${label}: debe ser mayor o igual a ${effMin}.`
  }
  if (effMax !== undefined && value > effMax) {
    return `${label}: debe ser menor o igual a ${effMax}.`
  }
  if (rules?.exclusiveMin !== undefined && value <= rules.exclusiveMin) {
    return `${label}: debe ser estrictamente mayor a ${rules.exclusiveMin}.`
  }
  if (rules?.exclusiveMax !== undefined && value >= rules.exclusiveMax) {
    return `${label}: debe ser estrictamente menor a ${rules.exclusiveMax}.`
  }

  return null
}

export interface OverrideValidationResult {
  valid: boolean
  errors: Record<string, string>
  sanitized: SimulacionOverrides
}

/**
 * Enforces the strict 24-key SimulacionOverrides allowlist against the active template's campos.
 * Rejects prototype keys, unknown keys, raw baseline aliases, top-level DB config keys, and editableByUser: false fields.
 */
export function validateOverridesAgainstTemplate(
  campos: readonly CalculadoraCampoDef[] | null | undefined,
  overrides: Record<string, unknown>,
): OverrideValidationResult {
  const errors: Record<string, string> = {}
  const sanitized: SimulacionOverrides = {}

  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return {
      valid: false,
      errors: { _root: 'parametros_override debe ser un objeto JSON válido.' },
      sanitized: {},
    }
  }

  const list = Array.isArray(campos) && campos.length > 0 ? campos : FALLBACK_TEMPLATE_CAMPOS
  const overridableMap = getOverridableCampoMap(list)
  const nonEditableKeys = new Set<string>(
    list.filter((c) => !c.editableByUser).map((c) => c.key),
  )

  const memOverrideKeySet = new Set<string>(MEM_OVERRIDE_KEYS)
  const memCampoMap = new Map<string, CalculadoraCampoDef>(
    MEM_TEMPLATE_CAMPOS.map((c) => [c.key, c]),
  )
  for (const c of list) {
    if (memOverrideKeySet.has(c.key)) {
      memCampoMap.set(c.key, c)
    }
  }
  const isMemOverrideMode =
    Object.getOwnPropertyDescriptor(overrides, 'modo_motor')?.value === 'mem_horaria'

  // Check explicit own keys including prototype-colliding keys if present via JSON.parse
  const ownKeys = Object.getOwnPropertyNames(overrides)
  for (const key of ownKeys) {
    if (FORBIDDEN_PROTOTYPE_KEYS.has(key)) {
      Object.defineProperty(errors, key, {
        value: `Clave prohibida en parámetros: ${key}.`,
        enumerable: true,
        writable: true,
        configurable: true,
      })
      continue
    }

    const rawVal = Object.getOwnPropertyDescriptor(overrides, key)?.value
    if (rawVal === undefined) {
      continue
    }

    if (TOP_LEVEL_CONFIG_KEYS.has(key)) {
      errors[key] =
        `El campo "${key}" pertenece a la configuración principal de la simulación y no a parametros_override.`
      continue
    }

    if (nonEditableKeys.has(key)) {
      errors[key] = `El parámetro "${key}" no es editable por el usuario.`
      continue
    }

    if (isMemOverrideMode && memOverrideKeySet.has(key)) {
      if (key === 'modo_motor') {
        if (rawVal === 'mem_horaria' || rawVal === 'cfe_tarifario') {
          sanitized.modo_motor = rawVal
        } else {
          errors[key] = 'modo_motor inválido.'
        }
        continue
      }
      if (key === 'supuestos_anuales') {
        if (!rawVal || typeof rawVal !== 'object' || Array.isArray(rawVal)) {
          errors[key] = 'supuestos_anuales debe ser un objeto con 4 vectores de 25 años.'
          continue
        }
        const rawObj = rawVal as Record<string, unknown>
        const nestedOwnKeys = Object.getOwnPropertyNames(rawObj)
        if (nestedOwnKeys.some((nk) => FORBIDDEN_PROTOTYPE_KEYS.has(nk))) {
          errors[key] = 'supuestos_anuales contiene claves prohibidas.'
          continue
        }
        const pctMbp = Object.getOwnPropertyDescriptor(rawObj, 'pct_mbp')?.value
        const fijoMbp = Object.getOwnPropertyDescriptor(rawObj, 'fijo_mbp')?.value
        const pctPml = Object.getOwnPropertyDescriptor(rawObj, 'pct_pml')?.value
        const degBess = Object.getOwnPropertyDescriptor(rawObj, 'deg_bess')?.value
        const validPctMbp =
          Array.isArray(pctMbp) &&
          pctMbp.length === 25 &&
          pctMbp.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -0.5 && n <= 1)
        const validFijoMbp =
          Array.isArray(fijoMbp) &&
          fijoMbp.length === 25 &&
          fijoMbp.every(
            (n) =>
              n === null ||
              (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100_000_000),
          )
        const validPctPml =
          Array.isArray(pctPml) &&
          pctPml.length === 25 &&
          pctPml.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -0.5 && n <= 1)
        const validDegBess =
          Array.isArray(degBess) &&
          degBess.length === 25 &&
          degBess.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 0.5)
        if (validPctMbp && validFijoMbp && validPctPml && validDegBess) {
          sanitized.supuestos_anuales = {
            pct_mbp: [...pctMbp],
            fijo_mbp: [...fijoMbp],
            pct_pml: [...pctPml],
            deg_bess: [...degBess],
          }
        } else {
          errors[key] =
            'supuestos_anuales debe contener arreglos finitos de exactamente 25 años dentro de rango.'
        }
        continue
      }
      if (key === 'critical_hours_100hc') {
        if (!Array.isArray(rawVal) || rawVal.length === 0 || rawVal.length > 120) {
          errors[key] = 'critical_hours_100hc debe contener entre 1 y 120 horas críticas válidas.'
          continue
        }
        const cleanedHc: Array<{ no: number; fecha: string; hora: number }> = []
        let hcErr: string | null = null
        for (let idx = 0; idx < rawVal.length; idx++) {
          const item = rawVal[idx]
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            hcErr = `critical_hours_100hc[${idx}] debe ser un objeto { no, fecha, hora }.`
            break
          }
          const itemObj = item as Record<string, unknown>
          if (Object.getOwnPropertyNames(itemObj).some((ik) => FORBIDDEN_PROTOTYPE_KEYS.has(ik))) {
            hcErr = 'critical_hours_100hc contiene claves prohibidas.'
            break
          }
          const rawFecha = Object.getOwnPropertyDescriptor(itemObj, 'fecha')?.value
          const rawHora = Object.getOwnPropertyDescriptor(itemObj, 'hora')?.value
          const rawNo = Object.getOwnPropertyDescriptor(itemObj, 'no')?.value
          if (typeof rawFecha !== 'string' || !isValidIsoDateString(rawFecha)) {
            hcErr = `critical_hours_100hc[${idx}].fecha debe ser YYYY-MM-DD válida.`
            break
          }
          if (
            typeof rawHora !== 'number' ||
            !Number.isInteger(rawHora) ||
            rawHora < 1 ||
            rawHora > 24
          ) {
            hcErr = `critical_hours_100hc[${idx}].hora debe ser un entero entre 1 y 24.`
            break
          }
          const parsedNo =
            rawNo === undefined
              ? idx + 1
              : typeof rawNo === 'number' && Number.isInteger(rawNo) && rawNo >= 1 && rawNo <= 120
                ? rawNo
                : null
          if (parsedNo === null) {
            hcErr = `critical_hours_100hc[${idx}].no debe ser un entero entre 1 y 120.`
            break
          }
          cleanedHc.push({ no: parsedNo, fecha: rawFecha.trim(), hora: rawHora })
        }
        if (hcErr) {
          errors[key] = hcErr
        } else {
          sanitized.critical_hours_100hc = cleanedHc
        }
        continue
      }
      const memCampo = memCampoMap.get(key)
      if (!memCampo || !memCampo.editableByUser) {
        errors[key] = `El parámetro MEM "${key}" no es editable.`
        continue
      }
      const err = validateCampoValue(memCampo, rawVal, { useOverrideBounds: true })
      if (err) {
        errors[key] = err
      } else {
        ;(sanitized as Record<string, unknown>)[key] =
          typeof rawVal === 'string' ? rawVal.trim() : rawVal
      }
      continue
    }

    if (!ALLOWED_OVERRIDE_KEY_SET.has(key)) {
      errors[key] = `Parámetro desconocido o no permitido: "${key}".`
      continue
    }

    if (RUNTIME_ENGINEERING_OVERRIDE_KEYS.has(key)) {
      if (typeof rawVal !== 'number' || !Number.isFinite(rawVal) || rawVal < 0) {
        errors[key] = `${key}: debe ser un número finito mayor o igual a 0.`
      } else {
        sanitized[key as 'consumo_anual_kwh' | 'generacion_fv_y1_kwh'] = rawVal
      }
      continue
    }

    const campo = overridableMap.get(key as AllowedOverrideKey)
    if (!campo) {
      errors[key] = `El parámetro "${key}" no es editable en la plantilla activa.`
      continue
    }

    const err = validateCampoValue(campo, rawVal, { useOverrideBounds: true })
    if (err) {
      errors[key] = err
    } else {
      ;(sanitized as Record<string, number>)[key] = rawVal as number
    }
  }

  if (isMemOverrideMode) {
    if (sanitized.op_ini_carga !== undefined || sanitized.op_fin_carga !== undefined) {
      const effIni =
        sanitized.op_ini_carga ?? Number(memCampoMap.get('op_ini_carga')?.defaultValue ?? 2)
      const effFin =
        sanitized.op_fin_carga ?? Number(memCampoMap.get('op_fin_carga')?.defaultValue ?? 10)
      if (!errors.op_ini_carga && !errors.op_fin_carga && effIni > effFin) {
        errors.op_fin_carga =
          'Fin de ventana de carga debe ser mayor o igual al inicio (no cruza medianoche).'
      }
    }
    if (sanitized.op_ini_descarga !== undefined || sanitized.op_fin_descarga !== undefined) {
      const effIni =
        sanitized.op_ini_descarga ?? Number(memCampoMap.get('op_ini_descarga')?.defaultValue ?? 20)
      const effFin =
        sanitized.op_fin_descarga ?? Number(memCampoMap.get('op_fin_descarga')?.defaultValue ?? 22)
      if (!errors.op_ini_descarga && !errors.op_fin_descarga && effIni > effFin) {
        errors.op_fin_descarga =
          'Fin de ventana de descarga debe ser mayor o igual al inicio (no cruza medianoche).'
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  }
}

/**
 * Computes currency-neutral sparse overrides over the 24 SimulacionOverrides keys.
 * Callers must convert Tier 2 currency-denominated tariff defaults into moneda_calculo before calling.
 * Returns {} when all overrides match tier2DefaultsInTargetCurrency within tolerance (1e-9).
 */
export function computeSparseOverrides(
  effectiveOverrides: Partial<Record<AllowedOverrideKey, number | undefined>> | SimulacionOverrides,
  tier2DefaultsInTargetCurrency: Partial<Record<AllowedOverrideKey, number | undefined>>,
  tolerance: number = 1e-9,
): SimulacionOverrides {
  const sparse: SimulacionOverrides = {}

  for (const key of ALLOWED_OVERRIDE_KEYS) {
    const val = effectiveOverrides[key]
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      continue
    }
    const baseline = tier2DefaultsInTargetCurrency[key]
    if (typeof baseline !== 'number' || !Number.isFinite(baseline)) {
      ;(sparse as Record<string, number>)[key] = val
      continue
    }
    if (Math.abs(val - baseline) > tolerance) {
      ;(sparse as Record<string, number>)[key] = val
    }
  }

  return sparse
}

/**
 * Canonical 24 Input fields from Simulador FV + BESS MEM.xlsx (23 editable blue cells + BESS_Duracion).
 */
export const MEM_TEMPLATE_CAMPOS: CalculadoraCampoDef[] = [
  // 1. Cliente
  {
    key: 'cliente',
    label: 'Cliente',
    unit: 'texto',
    type: 'text',
    group: 'cliente',
    defaultValue: DEFAULT_MEM_INPUTS.cliente,
    validationRules: { required: true },
    editableByUser: true,
    order: 101,
  },
  {
    key: 'demanda_contratada_mw',
    label: 'Demanda contratada',
    unit: 'MW',
    type: 'number',
    group: 'cliente',
    min: 0.001,
    max: 5000,
    step: 0.5,
    defaultValue: DEFAULT_MEM_INPUTS.demanda_contratada_mw,
    validationRules: { required: true, exclusiveMin: 0 },
    editableByUser: true,
    order: 102,
  },
  // 2. Batería (BESS)
  {
    key: 'bess_potencia_mw',
    label: 'Potencia BESS',
    unit: 'MW',
    type: 'number',
    group: 'bess',
    min: 0,
    max: 500,
    step: 0.5,
    defaultValue: DEFAULT_MEM_INPUTS.bess_potencia_mw,
    validationRules: { required: true },
    editableByUser: true,
    order: 103,
  },
  {
    key: 'bess_duracion_h',
    label: 'Duración a potencia nominal',
    unit: 'h',
    type: 'number',
    group: 'bess',
    min: 0,
    max: 24,
    step: 0.5,
    defaultValue: 3.0,
    validationRules: { required: false },
    editableByUser: false,
    order: 104,
  },
  {
    key: 'bess_capacidad_mwh',
    label: 'Capacidad de almacenamiento (energía)',
    unit: 'MWh',
    type: 'number',
    group: 'bess',
    min: 0,
    max: 2000,
    step: 0.5,
    defaultValue: DEFAULT_MEM_INPUTS.bess_capacidad_mwh,
    validationRules: { required: true },
    editableByUser: true,
    order: 105,
  },
  {
    key: 'bess_eficiencia_pct',
    label: 'Eficiencia ida y vuelta',
    unit: '%',
    type: 'percentage',
    group: 'bess',
    min: 0.01,
    max: 1,
    step: 0.01,
    defaultValue: DEFAULT_MEM_INPUTS.bess_eficiencia_pct,
    validationRules: { required: true, exclusiveMin: 0 },
    editableByUser: true,
    order: 106,
  },
  {
    key: 'bess_soc_min_pct',
    label: 'Estado de carga mínimo (SOC)',
    unit: '%',
    type: 'percentage',
    group: 'bess',
    min: 0,
    max: 0.5,
    step: 0.01,
    defaultValue: DEFAULT_MEM_INPUTS.bess_soc_min_pct,
    validationRules: { required: true },
    editableByUser: true,
    order: 107,
  },
  // 3. Estrategia de operación
  {
    key: 'op_horas_carga',
    label: 'Horas de carga por día (las más baratas)',
    unit: 'h',
    type: 'integer',
    group: 'operacion',
    min: 0,
    max: 24,
    step: 1,
    defaultValue: DEFAULT_MEM_INPUTS.op_horas_carga,
    validationRules: { required: true, integer: true },
    editableByUser: true,
    order: 108,
  },
  {
    key: 'op_ini_carga',
    label: 'Inicio ventana de carga',
    unit: 'hora',
    type: 'integer',
    group: 'operacion',
    min: 1,
    max: 24,
    step: 1,
    defaultValue: DEFAULT_MEM_INPUTS.op_ini_carga,
    validationRules: { required: true, integer: true },
    editableByUser: true,
    order: 109,
  },
  {
    key: 'op_fin_carga',
    label: 'Fin ventana de carga',
    unit: 'hora',
    type: 'integer',
    group: 'operacion',
    min: 1,
    max: 24,
    step: 1,
    defaultValue: DEFAULT_MEM_INPUTS.op_fin_carga,
    validationRules: { required: true, integer: true },
    editableByUser: true,
    order: 110,
  },
  {
    key: 'op_ini_descarga',
    label: 'Inicio ventana de descarga',
    unit: 'hora',
    type: 'integer',
    group: 'operacion',
    min: 1,
    max: 24,
    step: 1,
    defaultValue: DEFAULT_MEM_INPUTS.op_ini_descarga,
    validationRules: { required: true, integer: true },
    editableByUser: true,
    order: 111,
  },
  {
    key: 'op_fin_descarga',
    label: 'Fin ventana de descarga',
    unit: 'hora',
    type: 'integer',
    group: 'operacion',
    min: 1,
    max: 24,
    step: 1,
    defaultValue: DEFAULT_MEM_INPUTS.op_fin_descarga,
    validationRules: { required: true, integer: true },
    editableByUser: true,
    order: 112,
  },
  // 4. Fotovoltaico (FV)
  {
    key: 'fv_potencia_mw',
    label: 'Potencia FV',
    unit: 'MW',
    type: 'number',
    group: 'fv',
    min: 0,
    max: 500,
    step: 0.05,
    defaultValue: DEFAULT_MEM_INPUTS.fv_potencia_mw,
    validationRules: { required: true },
    editableByUser: true,
    order: 113,
  },
  {
    key: 'fv_degradacion_anual_pct',
    label: 'Degradación anual FV',
    unit: '%/año',
    type: 'percentage',
    group: 'fv',
    min: 0,
    max: 0.05,
    step: 0.001,
    defaultValue: DEFAULT_MEM_INPUTS.fv_degradacion_anual_pct,
    validationRules: { required: true },
    editableByUser: true,
    order: 114,
  },
  // 5. Mercado y tipo de cambio
  {
    key: 'tc_mxn_usd',
    label: 'Tipo de cambio pactado (inversión)',
    unit: 'MXN/USD',
    type: 'number',
    group: 'mercado_tc',
    min: 0.01,
    max: 100,
    step: 0.1,
    defaultValue: DEFAULT_MEM_INPUTS.tc_mxn_usd,
    validationRules: { required: true, exclusiveMin: 0 },
    editableByUser: true,
    order: 115,
  },
  {
    key: 'tc_fecha',
    label: 'Fecha del tipo de cambio pactado',
    unit: 'fecha',
    type: 'date',
    group: 'mercado_tc',
    defaultValue: DEFAULT_MEM_INPUTS.tc_fecha,
    validationRules: { required: true },
    editableByUser: true,
    order: 116,
  },
  {
    key: 'mbp_precio_mxn_mw_anio',
    label: 'Precio MBP publicado (año 100HC)',
    unit: 'MXN/MW-año',
    type: 'number',
    group: 'mercado_tc',
    min: 1,
    max: 100_000_000,
    step: 10_000,
    defaultValue: DEFAULT_MEM_INPUTS.mbp_precio_mxn_mw_anio,
    validationRules: { required: true, exclusiveMin: 0 },
    editableByUser: true,
    order: 117,
  },
  {
    key: 'rap_factor',
    label: 'Factor de ajuste RAP',
    unit: 'factor',
    type: 'number',
    group: 'mercado_tc',
    min: 0.001,
    max: 10,
    step: 0.001,
    defaultValue: DEFAULT_MEM_INPUTS.rap_factor,
    validationRules: { required: true, exclusiveMin: 0 },
    editableByUser: true,
    order: 118,
  },
  // 6. Costos: inversión (USD) y operación (MXN)
  {
    key: 'capex_bess_usd_kwh',
    label: 'CAPEX BESS',
    unit: 'USD/kWh',
    type: 'number',
    group: 'costos',
    min: 0,
    max: 10_000,
    step: 5,
    defaultValue: DEFAULT_MEM_INPUTS.capex_bess_usd_kwh,
    validationRules: { required: true },
    editableByUser: true,
    order: 119,
  },
  {
    key: 'capex_fv_usd_kwp',
    label: 'CAPEX FV',
    unit: 'USD/kWp',
    type: 'number',
    group: 'costos',
    min: 0,
    max: 10_000,
    step: 10,
    defaultValue: DEFAULT_MEM_INPUTS.capex_fv_usd_kwp,
    validationRules: { required: true },
    editableByUser: true,
    order: 120,
  },
  {
    key: 'opex_bess_mxn_mwh_anio',
    label: 'OPEX BESS',
    unit: 'MXN/MWh-año',
    type: 'number',
    group: 'costos',
    min: 0,
    max: 5_000_000,
    step: 500,
    defaultValue: DEFAULT_MEM_INPUTS.opex_bess_mxn_mwh_anio,
    validationRules: { required: true },
    editableByUser: true,
    order: 121,
  },
  {
    key: 'opex_fv_mxn_mw_anio',
    label: 'OPEX FV',
    unit: 'MXN/MW-año',
    type: 'number',
    group: 'costos',
    min: 0,
    max: 5_000_000,
    step: 500,
    defaultValue: DEFAULT_MEM_INPUTS.opex_fv_mxn_mw_anio,
    validationRules: { required: true },
    editableByUser: true,
    order: 122,
  },
  // 7. Evaluación financiera
  {
    key: 'fin_horizonte_anios',
    label: 'Horizonte de evaluación (máx. 25)',
    unit: 'años',
    type: 'integer',
    group: 'evaluacion_financiera',
    min: 1,
    max: 25,
    step: 1,
    defaultValue: DEFAULT_MEM_INPUTS.fin_horizonte_anios,
    validationRules: { required: true, integer: true },
    editableByUser: true,
    order: 123,
  },
  {
    key: 'fin_tasa_descuento_pct',
    label: 'Tasa de descuento (MXN, nominal)',
    unit: '%',
    type: 'percentage',
    group: 'evaluacion_financiera',
    min: 0,
    max: 0.5,
    step: 0.005,
    defaultValue: DEFAULT_MEM_INPUTS.fin_tasa_descuento_pct,
    validationRules: { required: true },
    editableByUser: true,
    order: 124,
  },
  {
    key: 'fin_esc_opex_pct',
    label: 'Escalamiento anual OPEX (MXN)',
    unit: '%/año',
    type: 'percentage',
    group: 'evaluacion_financiera',
    min: -0.5,
    max: 1.0,
    step: 0.005,
    defaultValue: DEFAULT_MEM_INPUTS.fin_esc_opex_pct,
    validationRules: { required: true, allowNegative: true },
    editableByUser: true,
    order: 125,
  },
]

export const MEM_OVERRIDE_KEYS = [
  'modo_motor',
  'cliente',
  'demanda_contratada_mw',
  'bess_potencia_mw',
  'bess_capacidad_mwh',
  'bess_eficiencia_pct',
  'bess_soc_min_pct',
  'op_horas_carga',
  'op_ini_carga',
  'op_fin_carga',
  'op_ini_descarga',
  'op_fin_descarga',
  'fv_potencia_mw',
  'fv_degradacion_anual_pct',
  'tc_mxn_usd',
  'tc_fecha',
  'mbp_precio_mxn_mw_anio',
  'rap_factor',
  'capex_bess_usd_kwh',
  'capex_fv_usd_kwp',
  'opex_bess_mxn_mwh_anio',
  'opex_fv_mxn_mw_anio',
  'fin_horizonte_anios',
  'fin_tasa_descuento_pct',
  'fin_esc_opex_pct',
  'supuestos_anuales',
  'critical_hours_100hc',
] as const

export function extractMemInputsFromCampos(
  campos: readonly CalculadoraCampoDef[] | null | undefined,
): MemSimulatorInputs {
  const result: MemSimulatorInputs = { ...DEFAULT_MEM_INPUTS }
  if (!Array.isArray(campos)) return result

  const byKey = new Map<string, CalculadoraCampoDef>()
  for (const c of campos) {
    if (c && typeof c.key === 'string') byKey.set(c.key, c)
  }

  const num = (key: string, fallback: number): number => {
    const v = byKey.get(key)?.defaultValue
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback
  }
  const str = (key: string, fallback: string): string => {
    const v = byKey.get(key)?.defaultValue
    return typeof v === 'string' && v.trim() !== '' ? v : fallback
  }

  // Also map tipo_cambio_usd_mxn if present when tc_mxn_usd is absent
  const tcFallback = num('tipo_cambio_usd_mxn', DEFAULT_MEM_INPUTS.tc_mxn_usd)

  result.cliente = str('cliente', DEFAULT_MEM_INPUTS.cliente)
  result.demanda_contratada_mw = num('demanda_contratada_mw', DEFAULT_MEM_INPUTS.demanda_contratada_mw)
  result.bess_potencia_mw = num('bess_potencia_mw', DEFAULT_MEM_INPUTS.bess_potencia_mw)
  result.bess_capacidad_mwh = num('bess_capacidad_mwh', DEFAULT_MEM_INPUTS.bess_capacidad_mwh)
  result.bess_eficiencia_pct = num('bess_eficiencia_pct', DEFAULT_MEM_INPUTS.bess_eficiencia_pct)
  result.bess_soc_min_pct = num('bess_soc_min_pct', DEFAULT_MEM_INPUTS.bess_soc_min_pct)
  result.op_horas_carga = Math.round(num('op_horas_carga', DEFAULT_MEM_INPUTS.op_horas_carga))
  result.op_ini_carga = Math.round(num('op_ini_carga', DEFAULT_MEM_INPUTS.op_ini_carga))
  result.op_fin_carga = Math.round(num('op_fin_carga', DEFAULT_MEM_INPUTS.op_fin_carga))
  result.op_ini_descarga = Math.round(num('op_ini_descarga', DEFAULT_MEM_INPUTS.op_ini_descarga))
  result.op_fin_descarga = Math.round(num('op_fin_descarga', DEFAULT_MEM_INPUTS.op_fin_descarga))
  result.fv_potencia_mw = num('fv_potencia_mw', DEFAULT_MEM_INPUTS.fv_potencia_mw)
  result.fv_degradacion_anual_pct = num('fv_degradacion_anual_pct', num('degradacion_fv_anual', DEFAULT_MEM_INPUTS.fv_degradacion_anual_pct))
  result.tc_mxn_usd = num('tc_mxn_usd', tcFallback)
  result.tc_fecha = str('tc_fecha', DEFAULT_MEM_INPUTS.tc_fecha)
  result.mbp_precio_mxn_mw_anio = num('mbp_precio_mxn_mw_anio', DEFAULT_MEM_INPUTS.mbp_precio_mxn_mw_anio)
  result.rap_factor = num('rap_factor', DEFAULT_MEM_INPUTS.rap_factor)
  result.capex_bess_usd_kwh = num('capex_bess_usd_kwh', DEFAULT_MEM_INPUTS.capex_bess_usd_kwh)
  result.capex_fv_usd_kwp = num('capex_fv_usd_kwp', DEFAULT_MEM_INPUTS.capex_fv_usd_kwp)
  result.opex_bess_mxn_mwh_anio = num('opex_bess_mxn_mwh_anio', DEFAULT_MEM_INPUTS.opex_bess_mxn_mwh_anio)
  result.opex_fv_mxn_mw_anio = num('opex_fv_mxn_mw_anio', DEFAULT_MEM_INPUTS.opex_fv_mxn_mw_anio)
  result.fin_horizonte_anios = Math.round(num('fin_horizonte_anios', DEFAULT_MEM_INPUTS.fin_horizonte_anios))
  result.fin_tasa_descuento_pct = num('fin_tasa_descuento_pct', DEFAULT_MEM_INPUTS.fin_tasa_descuento_pct)
  result.fin_esc_opex_pct = num('fin_esc_opex_pct', DEFAULT_MEM_INPUTS.fin_esc_opex_pct)

  return result
}
