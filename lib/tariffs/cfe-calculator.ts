import type { ConfiguracionTecnica } from '@/lib/types'

/**
 * Official CFE Commercial/Industrial Reference Tariffs (MXN/kWh)
 * Used only when a project does not yet have an explicit contractual/technical savings figure.
 */
export const CFE_TARIFF_RATES_MXN: Record<string, number> = {
  GDMTH: 2.85,
  GDMTO: 3.12,
  PDBT: 3.95,
  GDBT: 3.45,
}

export interface ProjectSavingsInput {
  totalGeneratedKwh: number
  selectedConfig?: Pick<
    ConfiguracionTecnica,
    'ahorro_estimado_anual' | 'ahorro_estimado_mensual' | 'ahorro_moneda'
  > | null
  tarifaCfe?: string | null
}

/**
 * Calculates estimated savings in MXN using:
 * 1. The project's selected technical configuration daily pro-rata savings if defined, OR
 * 2. The CFE tariff rate for the actual measured kWh generation (returns 0 when generation is 0 or NaN).
 */
export function calculateProjectSavingsMxn({
  totalGeneratedKwh,
  selectedConfig,
  tarifaCfe,
}: ProjectSavingsInput): number {
  const genKwh =
    typeof totalGeneratedKwh === 'number' && Number.isFinite(totalGeneratedKwh)
      ? totalGeneratedKwh
      : 0

  if (genKwh <= 0) {
    const annualSavings = selectedConfig?.ahorro_estimado_anual
    if (typeof annualSavings === 'number' && Number.isFinite(annualSavings) && annualSavings > 0) {
      return Math.round((annualSavings / 365) * 100) / 100
    }
    const monthlySavings = selectedConfig?.ahorro_estimado_mensual
    if (typeof monthlySavings === 'number' && Number.isFinite(monthlySavings) && monthlySavings > 0) {
      return Math.round((monthlySavings / 30) * 100) / 100
    }
    return 0
  }

  const rate = CFE_TARIFF_RATES_MXN[tarifaCfe || 'GDMTH'] ?? CFE_TARIFF_RATES_MXN.GDMTH
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

/**
 * Resolves the applicable CFE tariff category from contracted demand (kW) or annual volume (MWh).
 * Boundaries per CFE regulations & platform requirements:
 * - GDMTH: Gran Demanda Media Tensión Horaria (demanda >= 100 kW OR volumen >= 500 MWh)
 * - GDMTO: Gran Demanda Media Tensión Ordinaria (demanda >= 25 kW with volumen >= 100 MWh, or demanda > 25 kW when volumen is null/unspecified)
 * - GDBT: Gran Demanda Baja Tensión (demanda > 25 kW AND volumen < 100 MWh)
 * - PDBT: Pequeña Demanda Baja Tensión (demanda <= 25 kW)
 * - Default fallback when neither metric is positive/valid: GDMTH
 */
export function resolveCfeTariffLabel(
  demandaKw?: number | null,
  volumenMwhAnual?: number | null
): string {
  const hasDemand = typeof demandaKw === 'number' && !Number.isNaN(demandaKw)
  const hasVolume = typeof volumenMwhAnual === 'number' && !Number.isNaN(volumenMwhAnual)

  const d = hasDemand ? demandaKw : null
  const v = hasVolume ? volumenMwhAnual : null

  // 1. GDMTH: High demand (>= 100 kW) OR high annual volume (>= 500 MWh)
  if ((d !== null && d >= 100) || (v !== null && v >= 500)) {
    return 'GDMTH'
  }

  // 2. Medium demand (> 25 kW and < 100 kW):
  // GDBT if annual volume is low (< 100 MWh); GDMTO if volume is >= 100 MWh or unspecified
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

  // 3. Small commercial low demand (<= 25 kW): Pequeña Demanda Baja Tensión (PDBT)
  if (d !== null && d > 0 && d <= 25) {
    return 'PDBT'
  }

  // 4. Fallback based solely on volume if demand is unspecified or non-positive
  if (v !== null && v > 0) {
    if (v >= 100) return 'GDMTO'
    return 'GDBT'
  }

  // 5. Default reference tariff when neither metric is positive/valid
  return 'GDMTH'
}
