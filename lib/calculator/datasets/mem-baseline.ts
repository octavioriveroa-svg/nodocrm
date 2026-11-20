import baselineJson from '@/lib/calculator/datasets/mem-baseline-2025.json'
import type {
  MemAnnualAssumptions,
  MemCriticalHourEntry,
  MemHourlyDataset,
  MemSensitivitySweepConfig,
  MemSimulatorInputs,
} from '@/lib/types'

interface RawBaselineJson {
  label: string
  year: number
  dates_365: string[]
  consumo_mwh: number[]
  pml_mxn_mwh: number[]
  curva_solar_mw: number[]
  critical_hours_100hc: Array<{ no: number; fecha: string; hora: number }>
}

const raw = baselineJson as RawBaselineJson

export const DEFAULT_MEM_INPUTS: MemSimulatorInputs = {
  cliente: 'Beetman',
  demanda_contratada_mw: 10,
  bess_potencia_mw: 6,
  bess_capacidad_mwh: 18,
  bess_eficiencia_pct: 0.86,
  bess_soc_min_pct: 0.1,
  op_horas_carga: 5,
  op_ini_carga: 2,
  op_fin_carga: 10,
  op_ini_descarga: 20,
  op_fin_descarga: 22,
  fv_potencia_mw: 0,
  fv_degradacion_anual_pct: 0.005,
  tc_mxn_usd: 18.7,
  tc_fecha: '2026-11-18',
  mbp_precio_mxn_mw_anio: 4_690_767.66,
  rap_factor: 1.077,
  capex_bess_usd_kwh: 320,
  capex_fv_usd_kwp: 0,
  opex_bess_mxn_mwh_anio: 32_198.4,
  opex_fv_mxn_mw_anio: 0,
  fin_horizonte_anios: 20,
  fin_tasa_descuento_pct: 0.12,
  fin_esc_opex_pct: 0.035,
}

export const DEFAULT_MEM_SENSITIVITY_CONFIG: MemSensitivitySweepConfig = {
  duracion_fija_h: 3,
  potencia_inicial_mw: 0.5,
  incremento_mw: 0.5,
  num_casos: 10,
}

export function createDefaultMemAnnualAssumptions(): MemAnnualAssumptions {
  const pct_mbp = new Array<number>(25).fill(0.04)
  const fijo_mbp = new Array<number | null>(25).fill(null)
  const pct_pml = new Array<number>(25).fill(0.04)
  const deg_bess = new Array<number>(25).fill(0.015)

  // Year 1 (index 0) is the base anchor
  pct_mbp[0] = 0
  pct_pml[0] = 0
  deg_bess[0] = 0

  return { pct_mbp, fijo_mbp, pct_pml, deg_bess }
}

let cachedHourlyDataset: MemHourlyDataset | null = null

export function getBaselineMemHourlyDataset(): MemHourlyDataset {
  if (cachedHourlyDataset) return cachedHourlyDataset

  const totalHours = raw.consumo_mwh.length
  const fechas = new Array<string>(totalHours)
  const horas = new Int32Array(totalHours)

  for (let d = 0; d < raw.dates_365.length; d++) {
    const dayDate = raw.dates_365[d]
    const baseIdx = d * 24
    for (let h = 0; h < 24; h++) {
      const idx = baseIdx + h
      if (idx < totalHours) {
        fechas[idx] = dayDate
        horas[idx] = h + 1
      }
    }
  }

  cachedHourlyDataset = {
    label: raw.label,
    year: raw.year,
    fechas,
    horas,
    consumo_mwh: Float64Array.from(raw.consumo_mwh),
    pml_mxn_mwh: Float64Array.from(raw.pml_mxn_mwh),
    curva_solar_mw: Float64Array.from(raw.curva_solar_mw),
  }

  return cachedHourlyDataset
}

export function getBaseline100HC(): MemCriticalHourEntry[] {
  return raw.critical_hours_100hc.map((row) => ({
    no: row.no,
    fecha: row.fecha,
    hora: row.hora,
  }))
}
