import type {
  CalculadoraCampoDef,
  FormulaDefinicion,
  Moneda,
  SimulacionOverrides,
} from '@/lib/types'

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
