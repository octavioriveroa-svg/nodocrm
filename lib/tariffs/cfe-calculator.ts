import type { ConfiguracionTecnica } from '@/lib/types'

/**
 * Official CFE Reference Tariffs (MXN/kWh)
 * Used when a project does not yet have an explicit contractual/technical savings figure.
 */
export const CFE_TARIFF_RATES_MXN: Record<string, number> = {
  GDMTH: 2.85,
  GDMTO: 3.12,
  PDBT: 3.95,
  GDBT: 3.45,
  DIST: 2.15, // Demanda Industrial en Subtransmisión
  DIT: 1.98,  // Demanda Industrial en Transmisión
  '01': 1.05, // Residencial básica
  DAC: 5.80,  // Doméstica de Alto Consumo
}

/**
 * Official SEMARNAT Mexican national electric grid emission factor (kg CO2e / kWh)
 */
export const SEMARNAT_EMISSIONS_FACTOR_KG_CO2_PER_KWH = 0.423

/**
 * Calculates metric tonnes of CO2e avoided from total solar generation (kWh).
 */
export function calculateCo2AvoidedTonnes(totalGeneratedKwh: number): number {
  if (typeof totalGeneratedKwh !== 'number' || !Number.isFinite(totalGeneratedKwh) || totalGeneratedKwh <= 0) {
    return 0
  }
  return Math.round(((totalGeneratedKwh * SEMARNAT_EMISSIONS_FACTOR_KG_CO2_PER_KWH) / 1000) * 1000) / 1000
}

export interface ProjectSavingsInput {
  totalGeneratedKwh: number
  selectedConfig?: Pick<
    ConfiguracionTecnica,
    'ahorro_estimado_anual' | 'ahorro_estimado_mensual' | 'ahorro_moneda'
  > | null
  tarifaCfe?: string | number | null
  exchangeRateUsdMxn?: number // Default: 18.0
}

/**
 * Calculates estimated savings in MXN using:
 * 1. The project's selected technical configuration daily pro-rata savings if defined (normalized from USD to MXN when needed), OR
 * 2. The CFE tariff rate for the actual measured kWh generation (returns 0 when generation is 0 or NaN and no config exists).
 */
export function calculateProjectSavingsMxn({
  totalGeneratedKwh,
  selectedConfig,
  tarifaCfe,
  exchangeRateUsdMxn = 18.0,
}: ProjectSavingsInput): number {
  const genKwh =
    typeof totalGeneratedKwh === 'number' && Number.isFinite(totalGeneratedKwh)
      ? totalGeneratedKwh
      : 0

  if (genKwh <= 0) {
    const isUsd = selectedConfig?.ahorro_moneda === 'USD'
    const rateMultiplier = isUsd ? exchangeRateUsdMxn : 1.0

    const annualSavings = selectedConfig?.ahorro_estimado_anual
    if (typeof annualSavings === 'number' && Number.isFinite(annualSavings) && annualSavings > 0) {
      return Math.round(((annualSavings * rateMultiplier) / 365) * 100) / 100
    }
    const monthlySavings = selectedConfig?.ahorro_estimado_mensual
    if (typeof monthlySavings === 'number' && Number.isFinite(monthlySavings) && monthlySavings > 0) {
      return Math.round(((monthlySavings * rateMultiplier) / 30) * 100) / 100
    }
    return 0
  }

  const rawTarifa = tarifaCfe != null ? String(tarifaCfe).trim() : ''
  const numericRate = rawTarifa ? Number(rawTarifa) : NaN
  const rate =
    Number.isFinite(numericRate) && numericRate > 0
      ? numericRate
      : (CFE_TARIFF_RATES_MXN[rawTarifa.toUpperCase() || 'GDMTH'] ?? CFE_TARIFF_RATES_MXN.GDMTH)
  const result = Math.round(genKwh * rate * 100) / 100
  return Number.isFinite(result) ? result : 0
}

/**
 * Calculates equivalent battery cycles from actual battery discharge telemetry rows
 * and nominal BESS capacity (kWh). Returns 0 if no discharge occurred or input is NaN.
 */
export function calculateBatteryCycles(
  totalBatteryDischargeKwh: number,
  nominalCapacityKwh?: number | null
): number {
  if (
    typeof totalBatteryDischargeKwh !== 'number' ||
    !Number.isFinite(totalBatteryDischargeKwh) ||
    totalBatteryDischargeKwh <= 0
  ) {
    return 0
  }
  const effectiveCapacity =
    typeof nominalCapacityKwh === 'number' &&
    Number.isFinite(nominalCapacityKwh) &&
    nominalCapacityKwh > 0
      ? nominalCapacityKwh
      : 200

  const cycles = Math.round((totalBatteryDischargeKwh / effectiveCapacity) * 10) / 10
  return Number.isFinite(cycles) ? cycles : 0
}

export type NivelTension = 'baja' | 'media' | 'subtransmision' | 'transmision'
export type TipoServicio = 'comercial' | 'industrial' | 'domestico'

export interface ResolveCfeTariffOptions {
  tension?: NivelTension | string | null
  tipoServicio?: TipoServicio | string | null
}

/**
 * Resolves the applicable CFE tariff category from contracted demand (kW) or annual volume (MWh).
 * Boundaries per CFE regulations & platform requirements:
 * - DIT: Demanda Industrial en Transmisión (demanda >= 1000 kW en transmisión OR demanda >= 1000 kW & volumen >= 8000 MWh)
 * - DIST: Demanda Industrial en Subtransmisión (demanda >= 1000 kW en subtransmisión OR demanda >= 1000 kW & volumen >= 4000 MWh)
 * - 01: Residencial básica en baja tensión (demanda <= 5 kW & volumen <= 3 MWh, o tipoServicio = 'domestico' con volumen <= 3 MWh)
 * - DAC: Doméstica de Alto Consumo (tipoServicio = 'domestico' con volumen > 3 MWh)
 * - GDMTH: Gran Demanda Media Tensión Horaria (demanda >= 100 kW OR volumen >= 500 MWh)
 * - GDMTO: Gran Demanda Media Tensión Ordinaria (demanda >= 25 kW with volumen >= 100 MWh, or demanda > 25 kW when volumen is null/unspecified)
 * - GDBT: Gran Demanda Baja Tensión (demanda > 25 kW AND volumen < 100 MWh)
 * - PDBT: Pequeña Demanda Baja Tensión (demanda <= 25 kW)
 * - Default fallback when neither metric is positive/valid: GDMTH
 */
export function resolveCfeTariffLabel(
  demandaKw?: number | null,
  volumenMwhAnual?: number | null,
  options?: ResolveCfeTariffOptions | string | null
): string {
  const opts: ResolveCfeTariffOptions =
    typeof options === 'string'
      ? options === 'domestico' || options === 'comercial' || options === 'industrial'
        ? { tipoServicio: options }
        : { tension: options }
      : options || {}

  const hasDemand = typeof demandaKw === 'number' && !Number.isNaN(demandaKw)
  const hasVolume = typeof volumenMwhAnual === 'number' && !Number.isNaN(volumenMwhAnual)

  const d = hasDemand ? demandaKw : null
  const v = hasVolume ? volumenMwhAnual : null

  // 1. Industrial High-Voltage: DIT (Transmisión) & DIST (Subtransmisión)
  if (d !== null && d >= 1000) {
    if (opts.tension === 'transmision' || (v !== null && v >= 8000)) {
      return 'DIT'
    }
    if (opts.tension === 'subtransmision' || (v !== null && v >= 4000)) {
      return 'DIST'
    }
    if (opts.tension === 'media') {
      return 'GDMTH'
    }
  }

  // 2. Residential / Domestic Tariffs: 01 (Básica) & DAC (Alto Consumo)
  if (opts.tipoServicio === 'domestico') {
    if (v !== null && v > 3) {
      return 'DAC'
    }
    return '01'
  }

  // Low demand domestic heuristic (demanda <= 5 kW and volumen <= 3 MWh)
  if (d !== null && d > 0 && d <= 5 && v !== null && v > 0 && v <= 3) {
    return '01'
  }

  // 3. GDMTH: High demand (>= 100 kW) OR high annual volume (>= 500 MWh)
  if ((d !== null && d >= 100) || (v !== null && v >= 500)) {
    return 'GDMTH'
  }

  // 4. Medium demand (> 25 kW and < 100 kW):
  if (d !== null && d > 25) {
    if (v !== null && v < 100) {
      return 'GDBT'
    }
    return 'GDMTO'
  }

  // Boundary condition: exactly 25 kW with >= 100 MWh volume -> GDMTO
  if (d === 25 && v !== null && v >= 100) {
    return 'GDMTO'
  }

  // 5. Small commercial low demand (<= 25 kW): Pequeña Demanda Baja Tensión (PDBT)
  if (d !== null && d > 0 && d <= 25) {
    return 'PDBT'
  }

  // 6. Fallback based solely on volume if demand is unspecified or non-positive
  if (v !== null && v > 0) {
    if (v >= 8000 && opts.tension === 'transmision') return 'DIT'
    if (v >= 4000 && opts.tension === 'subtransmision') return 'DIST'
    if (v >= 500) return 'GDMTH'
    if (v >= 100) return 'GDMTO'
    if (opts.tipoServicio === 'domestico') return v > 3 ? 'DAC' : '01'
    return 'GDBT'
  }

  // 7. Default reference tariff when neither metric is positive/valid
  return 'GDMTH'
}
