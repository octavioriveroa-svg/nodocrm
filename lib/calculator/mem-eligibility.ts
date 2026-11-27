import type { CalculationMode, Proyecto, Sitio } from '@/lib/types'

/** Minimum contracted demand (kW) required in Mexico (LIE) for Usuario Calificado MEM access (1 MW = 1,000 kW). */
export const MEM_DEMAND_THRESHOLD_KW = 1000

export interface MemEligibilityResult {
  isEligible: boolean
  defaultMode: CalculationMode
  demandaKw: number
  hasMemFlag: boolean
  isMemProjectType: boolean
  meetsDemandThreshold: boolean
  warningTitle: string | null
  warningMessage: string | null
}

/**
 * Resolves effective contracted demand in kW from linked sites (sum of positive demanda_contratada_kw)
 * with fallback to proyecto.demanda_kw.
 */
export function resolveProjectContractedDemandKw(
  proyecto: Pick<Proyecto, 'demanda_kw'>,
  sitios: readonly Pick<Sitio, 'demanda_contratada_kw'>[] = [],
): number {
  const siteSum = sitios.reduce(
    (sum, s) => sum + (s.demanda_contratada_kw != null && s.demanda_contratada_kw > 0 ? s.demanda_contratada_kw : 0),
    0,
  )
  if (siteSum > 0) return siteSum
  return proyecto.demanda_kw != null && Number.isFinite(proyecto.demanda_kw) && proyecto.demanda_kw > 0
    ? proyecto.demanda_kw
    : 0
}

/**
 * Determines whether a project legally/commercially qualifies for Mercado Eléctrico Mayorista (MEM)
 * and selects the sensible default simulator engine (`mem_horaria` vs `cfe_tarifario`).
 * Always non-blocking: users may still inspect MEM Horario while seeing the regulatory advisory.
 */
export function evaluateMemEligibility(params: {
  proyecto: Pick<Proyecto, 'tipo' | 'incluye_mem' | 'demanda_kw'>
  sitios?: readonly Pick<Sitio, 'demanda_contratada_kw'>[]
  overrideDemandaKw?: number
}): MemEligibilityResult {
  const { proyecto, sitios = [], overrideDemandaKw } = params
  const baseDemandaKw = resolveProjectContractedDemandKw(proyecto, sitios)
  const demandaKw =
    overrideDemandaKw != null && Number.isFinite(overrideDemandaKw) && overrideDemandaKw > 0
      ? overrideDemandaKw
      : baseDemandaKw

  const hasMemFlag = Boolean(proyecto.incluye_mem)
  const isMemProjectType = proyecto.tipo === 'MEM' || proyecto.tipo === 'BESS+MEM'
  const meetsDemandThreshold = demandaKw >= MEM_DEMAND_THRESHOLD_KW
  const isEligible = hasMemFlag || isMemProjectType || meetsDemandThreshold
  const defaultMode: CalculationMode = isEligible ? 'mem_horaria' : 'cfe_tarifario'

  if (isEligible) {
    return {
      isEligible: true,
      defaultMode,
      demandaKw,
      hasMemFlag,
      isMemProjectType,
      meetsDemandThreshold,
      warningTitle: null,
      warningMessage: null,
    }
  }

  const demandText =
    demandaKw > 0
      ? `${Math.round(demandaKw).toLocaleString('es-MX')} kW (${(demandaKw / 1000).toFixed(2)} MW)`
      : 'sin demanda >= 1,000 kW registrada'

  return {
    isEligible: false,
    defaultMode,
    demandaKw,
    hasMemFlag,
    isMemProjectType,
    meetsDemandThreshold,
    warningTitle: 'Proyecto no elegible por defecto para MEM (Ley de la Industria Eléctrica)',
    warningMessage: `Este proyecto (${demandText}) tiene menos de 1 MW de demanda contratada y no tiene activada la opción "Incluye MEM". Legalmente requiere >= 1 MW para participar como Usuario Calificado en el MEM; puedes usar "CFE Tarifario" o continuar en MEM únicamente con fines exploratorios.`,
  }
}

export interface ManualMemEligibilityResult {
  isEligible: boolean
  warningMessage: string | null
}

/**
 * Checks whether a manual (unlinked) MEM simulation satisfies the 1 MW Usuario Calificado threshold.
 */
export function evaluateManualMemEligibility(
  demandaContratadaMw: number,
): ManualMemEligibilityResult {
  const safeMw = Number.isFinite(demandaContratadaMw) ? demandaContratadaMw : 0
  if (safeMw >= 1) {
    return { isEligible: true, warningMessage: null }
  }
  return {
    isEligible: false,
    warningMessage: `La demanda capturada (${safeMw.toFixed(2)} MW) es menor al mínimo legal de 1.00 MW para calificar en el MEM en México. Considera cambiar a "CFE Tarifario" salvo que estés modelando un caso de agregación o exploración.`,
  }
}
