import type {
  MemAnnualAssumptions,
  MemAnnualAssumptionsRow,
  MemAnnualEvaluationRow,
  MemCriticalHourEntry,
  MemCriticalHourEvaluated,
  MemFinancialEvaluation,
  MemHourlyDataset,
  MemHourlyProfilePoint,
  MemMonthlyEnergySaving,
  MemSensitivityCaseResult,
  MemSensitivitySuite,
  MemSensitivitySweepConfig,
  MemSimulationOutcome,
  MemSimulatorInputs,
  MemYear1Results,
  Moneda,
  PeriodoMensualSimulacion,
  VistaFinanciamiento,
} from '@/lib/types'
import { solveIrrRate } from '@/lib/calculator/formula-engine'

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

export interface MemFinancingTerms {
  vehiculo_inversion?: string
  enganche_pct?: number
  tasa_interes_anual?: number
  plazo_meses?: number
  ensaas_factor_ahorro_pct?: number
}

export interface EvaluateMemFinancialsOptions {
  moneda?: Moneda
  vistaFinanciamiento?: VistaFinanciamiento
  financing?: MemFinancingTerms
}

/**
 * Normalizes a date representation (YYYY-MM-DD, ISO timestamp, or Excel serial number)
 * to canonical YYYY-MM-DD (UTC) so Datos, Curva Solar, and 100HC keys match reliably.
 */
export function normalizeMemDateString(raw: unknown): string {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10)
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Excel epoch: 1899-12-30 UTC (accounts for Excel 1900 leap-year bug)
    const utcMs = Math.round((raw - 25569) * 86_400 * 1000)
    const d = new Date(utcMs)
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10)
    }
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    }
    const dmyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
    if (dmyMatch) {
      const dd = dmyMatch[1].padStart(2, '0')
      const mm = dmyMatch[2].padStart(2, '0')
      return `${dmyMatch[3]}-${mm}-${dd}`
    }
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric) && numeric > 20000 && numeric < 100000) {
      return normalizeMemDateString(numeric)
    }
  }
  return String(raw ?? '').trim()
}

export function extractMonthFromDateString(fecha: string): number {
  const isoMatch = /^\d{4}-(\d{2})-\d{2}/.exec(fecha)
  if (isoMatch) {
    const m = Number(isoMatch[1])
    if (m >= 1 && m <= 12) return m
  }
  return 1
}

export function computeBessDurationHours(potenciaMw: number, capacidadMwh: number): number {
  if (!Number.isFinite(potenciaMw) || !Number.isFinite(capacidadMwh) || potenciaMw <= 0) {
    return 0
  }
  return capacidadMwh / potenciaMw
}

export function validateMemInputs(inputs: MemSimulatorInputs): {
  errors: Record<string, string>
  warnings: string[]
} {
  const errors: Record<string, string> = {}
  const warnings: string[] = []

  if (!Number.isFinite(inputs.demanda_contratada_mw) || inputs.demanda_contratada_mw <= 0 || inputs.demanda_contratada_mw > 5000) {
    errors.demanda_contratada_mw = 'Demanda contratada debe ser mayor a 0 MW.'
  }
  if (!Number.isFinite(inputs.bess_potencia_mw) || inputs.bess_potencia_mw < 0) {
    errors.bess_potencia_mw = 'Potencia BESS debe ser mayor o igual a 0 MW.'
  }
  if (!Number.isFinite(inputs.bess_capacidad_mwh) || inputs.bess_capacidad_mwh < 0) {
    errors.bess_capacidad_mwh = 'Capacidad BESS debe ser mayor o igual a 0 MWh.'
  }
  if (!Number.isFinite(inputs.bess_eficiencia_pct) || inputs.bess_eficiencia_pct <= 0 || inputs.bess_eficiencia_pct > 1) {
    errors.bess_eficiencia_pct = 'Eficiencia ida y vuelta debe estar en (0%, 100%].'
  } else if (inputs.bess_eficiencia_pct < 0.5) {
    warnings.push('Eficiencia BESS menor al 50% (rango recomendado: 50%–100%).')
  }
  if (!Number.isFinite(inputs.bess_soc_min_pct) || inputs.bess_soc_min_pct < 0 || inputs.bess_soc_min_pct > 0.5) {
    errors.bess_soc_min_pct = 'SOC mínimo BESS debe estar entre 0% y 50%.'
  }

  if (!Number.isInteger(inputs.op_horas_carga) || inputs.op_horas_carga < 0 || inputs.op_horas_carga > 24) {
    errors.op_horas_carga = 'Horas de carga por día debe ser un entero entre 0 y 24.'
  }
  if (!Number.isInteger(inputs.op_ini_carga) || inputs.op_ini_carga < 1 || inputs.op_ini_carga > 24) {
    errors.op_ini_carga = 'Inicio ventana de carga debe ser un entero entre 1 y 24.'
  }
  if (!Number.isInteger(inputs.op_fin_carga) || inputs.op_fin_carga < 1 || inputs.op_fin_carga > 24) {
    errors.op_fin_carga = 'Fin ventana de carga debe ser un entero entre 1 y 24.'
  }
  if (
    Number.isInteger(inputs.op_ini_carga) &&
    Number.isInteger(inputs.op_fin_carga) &&
    inputs.op_ini_carga > inputs.op_fin_carga
  ) {
    errors.op_fin_carga = 'Fin de ventana de carga debe ser mayor o igual al inicio (no cruza medianoche).'
  }
  if (!Number.isInteger(inputs.op_ini_descarga) || inputs.op_ini_descarga < 1 || inputs.op_ini_descarga > 24) {
    errors.op_ini_descarga = 'Inicio ventana de descarga debe ser un entero entre 1 y 24.'
  }
  if (!Number.isInteger(inputs.op_fin_descarga) || inputs.op_fin_descarga < 1 || inputs.op_fin_descarga > 24) {
    errors.op_fin_descarga = 'Fin ventana de descarga debe ser un entero entre 1 y 24.'
  }
  if (
    Number.isInteger(inputs.op_ini_descarga) &&
    Number.isInteger(inputs.op_fin_descarga) &&
    inputs.op_ini_descarga > inputs.op_fin_descarga
  ) {
    errors.op_fin_descarga = 'Fin de ventana de descarga debe ser mayor o igual al inicio (no cruza medianoche).'
  }

  if (!Number.isFinite(inputs.fv_potencia_mw) || inputs.fv_potencia_mw < 0) {
    errors.fv_potencia_mw = 'Potencia FV debe ser mayor o igual a 0 MW.'
  } else if (inputs.fv_potencia_mw > 0.7) {
    warnings.push('Nota MEM: Potencia FV superior a 0.7 MW (700 kW) excede el umbral de generación exenta.')
  }
  if (!Number.isFinite(inputs.fv_degradacion_anual_pct) || inputs.fv_degradacion_anual_pct < 0 || inputs.fv_degradacion_anual_pct > 0.05) {
    errors.fv_degradacion_anual_pct = 'Degradación anual FV debe estar entre 0% y 5%.'
  }

  if (!Number.isFinite(inputs.tc_mxn_usd) || inputs.tc_mxn_usd <= 0) {
    errors.tc_mxn_usd = 'Tipo de cambio debe ser mayor a 0 MXN/USD.'
  }
  if (!Number.isFinite(inputs.mbp_precio_mxn_mw_anio) || inputs.mbp_precio_mxn_mw_anio <= 0) {
    errors.mbp_precio_mxn_mw_anio = 'Precio MBP debe ser mayor a 0 MXN/MW-año.'
  }
  if (!Number.isFinite(inputs.rap_factor) || inputs.rap_factor <= 0) {
    errors.rap_factor = 'Factor de ajuste RAP debe ser mayor a 0.'
  }

  if (!Number.isFinite(inputs.capex_bess_usd_kwh) || inputs.capex_bess_usd_kwh < 0) {
    errors.capex_bess_usd_kwh = 'CAPEX BESS debe ser mayor o igual a 0 USD/kWh.'
  }
  if (!Number.isFinite(inputs.capex_fv_usd_kwp) || inputs.capex_fv_usd_kwp < 0) {
    errors.capex_fv_usd_kwp = 'CAPEX FV debe ser mayor o igual a 0 USD/kWp.'
  }
  if (!Number.isFinite(inputs.opex_bess_mxn_mwh_anio) || inputs.opex_bess_mxn_mwh_anio < 0) {
    errors.opex_bess_mxn_mwh_anio = 'OPEX BESS debe ser mayor o igual a 0 MXN/MWh-año.'
  }
  if (!Number.isFinite(inputs.opex_fv_mxn_mw_anio) || inputs.opex_fv_mxn_mw_anio < 0) {
    errors.opex_fv_mxn_mw_anio = 'OPEX FV debe ser mayor o igual a 0 MXN/MW-año.'
  }

  if (!Number.isInteger(inputs.fin_horizonte_anios) || inputs.fin_horizonte_anios < 1 || inputs.fin_horizonte_anios > 25) {
    errors.fin_horizonte_anios = 'Horizonte de evaluación debe ser un entero entre 1 y 25 años.'
  }
  if (!Number.isFinite(inputs.fin_tasa_descuento_pct) || inputs.fin_tasa_descuento_pct < 0 || inputs.fin_tasa_descuento_pct > 0.5) {
    errors.fin_tasa_descuento_pct = 'Tasa de descuento debe estar entre 0% y 50%.'
  }
  if (!Number.isFinite(inputs.fin_esc_opex_pct) || inputs.fin_esc_opex_pct < -0.5 || inputs.fin_esc_opex_pct > 1.0) {
    errors.fin_esc_opex_pct = 'Escalamiento OPEX debe estar entre -50% y 100%.'
  }

  return { errors, warnings }
}

export function validateHourlyDataset(dataset: MemHourlyDataset): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const len = dataset.consumo_mwh.length

  if (len !== 8760) {
    errors.push(`Se esperan exactamente 8,760 filas horarias (recibidas: ${len}).`)
  }
  if (
    dataset.fechas.length !== len ||
    dataset.horas.length !== len ||
    dataset.pml_mxn_mwh.length !== len ||
    dataset.curva_solar_mw.length !== len
  ) {
    errors.push('Las columnas Fecha, Hora, Consumo, PML y Curva Solar deben tener la misma longitud.')
  }

  const checkLen = Math.min(len, dataset.fechas.length, dataset.horas.length, dataset.pml_mxn_mwh.length, dataset.curva_solar_mw.length)
  if (checkLen >= 24 && checkLen % 24 === 0) {
    const days = checkLen / 24
    let blockErrorFound = false
    for (let d = 0; d < days && !blockErrorFound; d++) {
      const baseDate = dataset.fechas[d * 24]
      if (!baseDate) {
        errors.push(`Fecha vacía en el bloque del día ${d + 1}.`)
        blockErrorFound = true
        break
      }
      for (let h = 0; h < 24; h++) {
        const idx = d * 24 + h
        if (dataset.fechas[idx] !== baseDate || dataset.horas[idx] !== h + 1) {
          errors.push(
            `Bloque horario inválido en fila ${idx + 1}: se esperaba fecha ${baseDate} hora ${h + 1}, recibido ${dataset.fechas[idx]} hora ${dataset.horas[idx]}.`,
          )
          blockErrorFound = true
          break
        }
      }
    }
  } else if (checkLen > 0) {
    errors.push('Las filas horarias deben venir en bloques completos de 24 horas por día.')
  }

  let nonZeroSolar = 0
  for (let i = 0; i < checkLen; i++) {
    const c = dataset.consumo_mwh[i]
    const p = dataset.pml_mxn_mwh[i]
    const s = dataset.curva_solar_mw[i]
    if (!Number.isFinite(c) || c < 0) {
      errors.push(`Consumo inválido en la hora ${i + 1}.`)
      break
    }
    if (!Number.isFinite(p)) {
      errors.push(`PML inválido en la hora ${i + 1}.`)
      break
    }
    if (!Number.isFinite(s)) {
      errors.push(`Curva solar inválida en la hora ${i + 1}.`)
      break
    }
    if (s > 0) nonZeroSolar++
  }

  if (nonZeroSolar === 0 && errors.length === 0) {
    warnings.push('Curva Solar con valores en 0 (la generación FV será 0 MWh hasta cargar una curva solar).')
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function buildAnnualAssumptionsRows(
  inputs: Pick<MemSimulatorInputs, 'mbp_precio_mxn_mw_anio' | 'bess_capacidad_mwh'>,
  assumptions: MemAnnualAssumptions,
  avgPmlMxnMwh: number,
): MemAnnualAssumptionsRow[] {
  const rows: MemAnnualAssumptionsRow[] = new Array(25)

  let prevMbp = inputs.mbp_precio_mxn_mw_anio
  let idxPml = 1
  let fBess = 1
  let prevPmlAvg = avgPmlMxnMwh
  let prevCapRem = inputs.bess_capacidad_mwh

  for (let t = 1; t <= 25; t++) {
    const i = t - 1
    if (t === 1) {
      rows[i] = {
        anio: 1,
        pct_mbp_captura: null,
        fijo_mbp_captura: null,
        precio_mbp_mxn_mw_anio: inputs.mbp_precio_mxn_mw_anio,
        pct_mbp_efectivo: null,
        var_mbp_mxn: null,
        idx_potencia: inputs.mbp_precio_mxn_mw_anio > 0 ? 1 : 0,
        pct_pml_captura: null,
        idx_pml: 1,
        pml_promedio_mxn_mwh: avgPmlMxnMwh,
        var_pml_mxn: null,
        deg_bess_captura: null,
        factor_deg_bess: 1,
        capacidad_remanente_mwh: inputs.bess_capacidad_mwh,
        perdida_mwh: null,
      }
      continue
    }

    const pctMbp = assumptions.pct_mbp[i] ?? 0.04
    const fijoMbp = assumptions.fijo_mbp[i]
    const hasFixed = typeof fijoMbp === 'number' && Number.isFinite(fijoMbp)
    const precioMbp = hasFixed ? fijoMbp : prevMbp * (1 + pctMbp)
    const pctMbpEfectivo = prevMbp !== 0 ? precioMbp / prevMbp - 1 : 0
    const varMbp = precioMbp - prevMbp
    const idxPotencia = inputs.mbp_precio_mxn_mw_anio > 0 ? precioMbp / inputs.mbp_precio_mxn_mw_anio : 0

    const pctPml = assumptions.pct_pml[i] ?? 0.04
    idxPml = idxPml * (1 + pctPml)
    const pmlProm = avgPmlMxnMwh * idxPml
    const varPml = pmlProm - prevPmlAvg

    const degBess = assumptions.deg_bess[i] ?? 0.015
    fBess = fBess * (1 - degBess)
    const capRem = inputs.bess_capacidad_mwh * fBess
    const perdidaMwh = capRem - prevCapRem

    rows[i] = {
      anio: t,
      pct_mbp_captura: pctMbp,
      fijo_mbp_captura: hasFixed ? fijoMbp : null,
      precio_mbp_mxn_mw_anio: precioMbp,
      pct_mbp_efectivo: pctMbpEfectivo,
      var_mbp_mxn: varMbp,
      idx_potencia: idxPotencia,
      pct_pml_captura: pctPml,
      idx_pml: idxPml,
      pml_promedio_mxn_mwh: pmlProm,
      var_pml_mxn: varPml,
      deg_bess_captura: degBess,
      factor_deg_bess: fBess,
      capacidad_remanente_mwh: capRem,
      perdida_mwh: perdidaMwh,
    }

    prevMbp = precioMbp
    prevPmlAvg = pmlProm
    prevCapRem = capRem
  }

  return rows
}

interface PreparedHourlyContext {
  n: number
  horas: Int32Array
  meses: Int32Array
  cons: Float64Array
  pml: Float64Array
  genFv: Float64Array
  neto: Float64Array
  exc: Float64Array
  margen: Float64Array
  horaCarga: Uint8Array
  ventDesc: Uint8Array
  costoBase: Float64Array
  sumCons: number
  sumGenFv: number
  sumFvAuto: number
  sumCostoBase: number
  pmlPromedio: number
  monthlyConsumo: Float64Array
  monthlyGenFv: Float64Array
  monthlyCostoBase: Float64Array
  hourlyConsumoSum: Float64Array
  hourlyGenFvSum: Float64Array
  hourlyCount: Int32Array
  hcRowIndices: Int32Array
  hcMeta: Array<{
    no: number
    fecha: string
    hora: number
    clave: string
    repetida: boolean
    encontrada: boolean
  }>
  duplicateHcCount: number
  missingHcCount: number
  prom100hcBase: number
}

function prepareHourlySimulationContext(
  inputs: Pick<
    MemSimulatorInputs,
    | 'demanda_contratada_mw'
    | 'op_horas_carga'
    | 'op_ini_carga'
    | 'op_fin_carga'
    | 'op_ini_descarga'
    | 'op_fin_descarga'
    | 'fv_potencia_mw'
  >,
  hourly: MemHourlyDataset,
  criticalHours100HC: readonly MemCriticalHourEntry[],
): PreparedHourlyContext {
  const n = hourly.consumo_mwh.length
  const horas = new Int32Array(n)
  const meses = new Int32Array(n)
  const cons = new Float64Array(n)
  const pml = new Float64Array(n)
  const genFv = new Float64Array(n)
  const neto = new Float64Array(n)
  const exc = new Float64Array(n)
  const margen = new Float64Array(n)
  const horaCarga = new Uint8Array(n)
  const ventDesc = new Uint8Array(n)
  const costoBase = new Float64Array(n)

  const monthlyConsumo = new Float64Array(12)
  const monthlyGenFv = new Float64Array(12)
  const monthlyCostoBase = new Float64Array(12)
  const hourlyConsumoSum = new Float64Array(24)
  const hourlyGenFvSum = new Float64Array(24)
  const hourlyCount = new Int32Array(24)

  const dayToIndices = new Map<string, number[]>()
  const keyToFirstIdx = new Map<string, number>()

  let sumCons = 0
  let sumGenFv = 0
  let sumFvAuto = 0
  let sumCostoBase = 0
  let sumPml = 0

  for (let i = 0; i < n; i++) {
    const f = hourly.fechas[i]
    const h = hourly.horas[i]
    const c = hourly.consumo_mwh[i]
    const p = hourly.pml_mxn_mwh[i]
    const s = hourly.curva_solar_mw[i]
    const m = extractMonthFromDateString(f)

    horas[i] = h
    meses[i] = m
    cons[i] = c
    pml[i] = p

    const g = (s > 0 ? s : 0) * inputs.fv_potencia_mw
    const net = c > g ? c - g : 0
    const ex = g > c ? g - c : 0
    const mrg = inputs.demanda_contratada_mw > net ? inputs.demanda_contratada_mw - net : 0
    const cb = c * p

    genFv[i] = g
    neto[i] = net
    exc[i] = ex
    margen[i] = mrg
    costoBase[i] = cb

    if (h >= inputs.op_ini_descarga && h <= inputs.op_fin_descarga) {
      ventDesc[i] = 1
    }

    sumCons += c
    sumGenFv += g
    sumFvAuto += g - ex
    sumCostoBase += cb
    sumPml += p

    const mIdx = m - 1
    if (mIdx >= 0 && mIdx < 12) {
      monthlyConsumo[mIdx] += c
      monthlyGenFv[mIdx] += g
      monthlyCostoBase[mIdx] += cb
    }
    const hIdx = h - 1
    if (hIdx >= 0 && hIdx < 24) {
      hourlyConsumoSum[hIdx] += c
      hourlyGenFvSum[hIdx] += g
      hourlyCount[hIdx]++
    }

    const clave = `${f}#${h}`
    if (!keyToFirstIdx.has(clave)) {
      keyToFirstIdx.set(clave, i)
    }

    let dayArr = dayToIndices.get(f)
    if (!dayArr) {
      dayArr = []
      dayToIndices.set(f, dayArr)
    }
    dayArr.push(i)
  }

  // Daily cheapest Op_HorasCarga hours inside [op_ini_carga, op_fin_carga] using strict <
  if (inputs.op_horas_carga > 0) {
    for (const dayArr of dayToIndices.values()) {
      const windowIndices: number[] = []
      for (let k = 0; k < dayArr.length; k++) {
        const idx = dayArr[k]
        const hr = horas[idx]
        if (hr >= inputs.op_ini_carga && hr <= inputs.op_fin_carga) {
          windowIndices.push(idx)
        }
      }
      for (let a = 0; a < windowIndices.length; a++) {
        const idxA = windowIndices[a]
        const pmlA = pml[idxA]
        let strictlyCheaper = 0
        for (let b = 0; b < windowIndices.length; b++) {
          if (pml[windowIndices[b]] < pmlA) strictlyCheaper++
        }
        if (strictlyCheaper < inputs.op_horas_carga) {
          horaCarga[idxA] = 1
        }
      }
    }
  }

  // 100HC lookup & duplicate flagging
  const hcLen = criticalHours100HC.length
  const claveCounts = new Map<string, number>()
  const normClaves = new Array<string>(hcLen)
  for (let m = 0; m < hcLen; m++) {
    const entry = criticalHours100HC[m]
    const clave = `${normalizeMemDateString(entry.fecha)}#${entry.hora}`
    normClaves[m] = clave
    claveCounts.set(clave, (claveCounts.get(clave) ?? 0) + 1)
  }

  const hcRowIndices = new Int32Array(hcLen)
  const hcMeta: PreparedHourlyContext['hcMeta'] = new Array(hcLen)
  let duplicateHcCount = 0
  let missingHcCount = 0
  let sumHcBase = 0

  for (let m = 0; m < hcLen; m++) {
    const entry = criticalHours100HC[m]
    const fechaNorm = normalizeMemDateString(entry.fecha)
    const clave = normClaves[m]
    const repetida = (claveCounts.get(clave) ?? 0) > 1
    if (repetida) duplicateHcCount++

    const foundIdx = keyToFirstIdx.get(clave)
    const encontrada = foundIdx !== undefined
    if (encontrada) {
      hcRowIndices[m] = foundIdx
      sumHcBase += cons[foundIdx]
    } else {
      hcRowIndices[m] = -1
      missingHcCount++
    }

    hcMeta[m] = {
      no: entry.no ?? m + 1,
      fecha: fechaNorm,
      hora: entry.hora,
      clave,
      repetida,
      encontrada,
    }
  }

  const prom100hcBase = hcLen > 0 ? sumHcBase / hcLen : 0

  return {
    n,
    horas,
    meses,
    cons,
    pml,
    genFv,
    neto,
    exc,
    margen,
    horaCarga,
    ventDesc,
    costoBase,
    sumCons,
    sumGenFv,
    sumFvAuto,
    sumCostoBase,
    pmlPromedio: n > 0 ? sumPml / n : 0,
    monthlyConsumo,
    monthlyGenFv,
    monthlyCostoBase,
    hourlyConsumoSum,
    hourlyGenFvSum,
    hourlyCount,
    hcRowIndices,
    hcMeta,
    duplicateHcCount,
    missingHcCount,
    prom100hcBase,
  }
}

function runPreparedDispatch(
  ctx: PreparedHourlyContext,
  bessPotenciaMw: number,
  bessCapacidadMwh: number,
  bessEficienciaPct: number,
  bessSocMinPct: number,
  rapFactor: number,
  mbpPrecio: number,
  includeDetails: boolean,
): MemYear1Results {
  const { n, horas, meses, pml, neto, exc, margen, horaCarga, ventDesc } = ctx
  const eff = bessEficienciaPct > 0 ? bessEficienciaPct : 0
  const socMinMwh = bessCapacidadMwh * bessSocMinPct

  let socPrev = 0
  let sumCargaFv = 0
  let sumCargaRed = 0
  let sumDesc = 0
  let sumConsumoRed = 0
  let sumCostoProy = 0

  const redProy = new Float64Array(n)
  const monthlyCostoProy = includeDetails ? new Float64Array(12) : null
  const monthlyDescarga = includeDetails ? new Float64Array(12) : null
  const hourlyRedProySum = includeDetails ? new Float64Array(24) : null
  const hourlyCargaSum = includeDetails ? new Float64Array(24) : null
  const hourlyDescSum = includeDetails ? new Float64Array(24) : null
  const hourlySocSum = includeDetails ? new Float64Array(24) : null

  for (let i = 0; i < n; i++) {
    const ex = exc[i]
    const net = neto[i]

    let cargaFv = 0
    if (eff > 0 && ex > 0 && bessPotenciaMw > 0 && bessCapacidadMwh > socPrev) {
      const capRoom = (bessCapacidadMwh - socPrev) / eff
      cargaFv = Math.min(ex, bessPotenciaMw, capRoom)
    }

    let cargaRed = 0
    if (horaCarga[i] === 1 && eff > 0 && bessPotenciaMw > cargaFv) {
      const pRem = bessPotenciaMw - cargaFv
      const eRoom = Math.max((bessCapacidadMwh - socPrev) / eff - cargaFv, 0)
      cargaRed = Math.min(pRem, eRoom, margen[i])
    }

    let desc = 0
    if (ventDesc[i] === 1 && bessPotenciaMw > 0 && socPrev > socMinMwh && net > 0) {
      desc = Math.min(bessPotenciaMw, socPrev - socMinMwh, net)
    }

    const soc = socPrev + (cargaFVPlusRed(cargaFv, cargaRed)) * eff - desc
    const rp = net + cargaRed - desc

    redProy[i] = rp
    sumCargaFv += cargaFv
    sumCargaRed += cargaRed
    sumDesc += desc
    sumConsumoRed += rp
    sumCostoProy += rp * pml[i]
    socPrev = soc

    if (includeDetails) {
      const mIdx = meses[i] - 1
      if (mIdx >= 0 && mIdx < 12) {
        monthlyCostoProy![mIdx] += rp * pml[i]
        monthlyDescarga![mIdx] += desc
      }
      const hIdx = horas[i] - 1
      if (hIdx >= 0 && hIdx < 24) {
        hourlyRedProySum![hIdx] += rp
        hourlyCargaSum![hIdx] += cargaFv + cargaRed
        hourlyDescSum![hIdx] += desc
        hourlySocSum![hIdx] += soc
      }
    }
  }

  // 100HC evaluation
  const hcLen = ctx.hcRowIndices.length
  let sumHcProy = 0
  const criticalRows: MemCriticalHourEvaluated[] = includeDetails ? new Array(hcLen) : []

  for (let m = 0; m < hcLen; m++) {
    const idx = ctx.hcRowIndices[m]
    const demBase = idx >= 0 ? ctx.cons[idx] : 0
    const demProy = idx >= 0 ? redProy[idx] : 0
    if (idx >= 0) {
      sumHcProy += demProy
    }
    if (includeDetails) {
      const meta = ctx.hcMeta[m]
      criticalRows[m] = {
        no: meta.no,
        fecha: meta.fecha,
        hora: meta.hora,
        clave: meta.clave,
        repetida: meta.repetida,
        encontrada: meta.encontrada,
        demanda_base_mw: demBase,
        demanda_proy_mw: demProy,
      }
    }
  }

  const prom100hcProy = hcLen > 0 ? sumHcProy / hcLen : 0
  const rapBase = ctx.prom100hcBase * rapFactor
  const rapProy = prom100hcProy * rapFactor
  const rapReduccion = rapBase - rapProy

  const costoCBase = rapBase * mbpPrecio
  const costoCProy = rapProy * mbpPrecio
  const ahorroCTotal = costoCBase - costoCProy
  const ahorroETotal = ctx.sumCostoBase - sumCostoProy
  const ahorroTotal = ahorroETotal + ahorroCTotal

  const baseCostTotal = ctx.sumCostoBase + costoCBase
  const ciclos = bessCapacidadMwh > 0 ? sumDesc / bessCapacidadMwh : 0

  const monthlySavings: MemMonthlyEnergySaving[] = includeDetails
    ? MONTH_ABBR_ES.map((etiqueta, idx) => {
        const cb = ctx.monthlyCostoBase[idx]
        const cp = monthlyCostoProy![idx]
        return {
          mes: idx + 1,
          etiqueta,
          costo_base_mxn: cb,
          costo_proy_mxn: cp,
          ahorro_energia_mxn: cb - cp,
          consumo_mwh: ctx.monthlyConsumo[idx],
          gen_fv_mwh: ctx.monthlyGenFv[idx],
          descarga_bess_mwh: monthlyDescarga![idx],
        }
      })
    : []

  const hourlyProfile: MemHourlyProfilePoint[] = includeDetails
    ? Array.from({ length: 24 }, (_, idx) => {
        const cnt = ctx.hourlyCount[idx] || 1
        return {
          hora: idx + 1,
          consumo_real_mw: ctx.hourlyConsumoSum[idx] / cnt,
          gen_fv_mw: ctx.hourlyGenFvSum[idx] / cnt,
          consumo_red_proy_mw: hourlyRedProySum![idx] / cnt,
          carga_bess_mw: hourlyCargaSum![idx] / cnt,
          descarga_bess_mw: hourlyDescSum![idx] / cnt,
          soc_promedio_mwh: hourlySocSum![idx] / cnt,
        }
      })
    : []

  return {
    bess_duracion_h: computeBessDurationHours(bessPotenciaMw, bessCapacidadMwh),
    res_consumo_mwh: ctx.sumCons,
    res_gen_fv_mwh: ctx.sumGenFv,
    res_fv_auto_mwh: ctx.sumFvAuto,
    res_fv_a_bess_mwh: sumCargaFv,
    res_fv_perdida_mwh: Math.max(0, ctx.sumGenFv - ctx.sumFvAuto - sumCargaFv),
    res_carga_red_mwh: sumCargaRed,
    res_descarga_mwh: sumDesc,
    res_ciclos: ciclos,
    res_consumo_red_mwh: sumConsumoRed,
    res_costo_e_base_mxn: ctx.sumCostoBase,
    res_costo_e_proy_mxn: sumCostoProy,
    ahorro_e_total_mxn: ahorroETotal,
    pml_promedio_mxn_mwh: ctx.pmlPromedio,
    prom_100hc_base_mw: ctx.prom100hcBase,
    prom_100hc_proy_mw: prom100hcProy,
    res_rap_base_mw: rapBase,
    res_rap_proy_mw: rapProy,
    res_rap_reduccion_mw: rapReduccion,
    res_costo_c_base_mxn: costoCBase,
    res_costo_c_proy_mxn: costoCProy,
    ahorro_c_total_mxn: ahorroCTotal,
    ahorro_total_mxn: ahorroTotal,
    res_pct_energia: ahorroTotal !== 0 ? ahorroETotal / ahorroTotal : 0,
    res_pct_capacidad: ahorroTotal !== 0 ? ahorroCTotal / ahorroTotal : 0,
    res_pct_reduccion: baseCostTotal !== 0 ? ahorroTotal / baseCostTotal : 0,
    monthly_savings: monthlySavings,
    hourly_profile: hourlyProfile,
    critical_hours_rows: criticalRows,
    duplicate_100hc_count: ctx.duplicateHcCount,
    missing_100hc_count: ctx.missingHcCount,
  }
}

function cargaFVPlusRed(cargaFv: number, cargaRed: number): number {
  return cargaFv + cargaRed
}

/**
 * Stage 1 — Pure 8,760-hour simulation + 100HC capacity lookup.
 */
export function simulateMemYear1(
  inputs: MemSimulatorInputs,
  hourly: MemHourlyDataset,
  criticalHours100HC: readonly MemCriticalHourEntry[],
): MemYear1Results {
  const ctx = prepareHourlySimulationContext(inputs, hourly, criticalHours100HC)
  return runPreparedDispatch(
    ctx,
    inputs.bess_potencia_mw,
    inputs.bess_capacidad_mwh,
    inputs.bess_eficiencia_pct,
    inputs.bess_soc_min_pct,
    inputs.rap_factor,
    inputs.mbp_precio_mxn_mw_anio,
    true,
  )
}

function computeAnnualPayback(
  horizonte: number,
  capex: number,
  desembolsoInicial: number,
  flows: readonly number[], // length 26 (index 0..25), index t=1..25
  cumulatives: readonly number[], // length 26
): { years: number | null; state: 'ok' | 'na' | 'fuera_horizonte' } {
  if (capex <= 0) {
    return { years: null, state: 'na' }
  }
  if (desembolsoInicial === 0) {
    // Immediate recovery when there is no initial outlay and Year 1 flow is non-negative
    if (flows[1] >= 0) {
      return { years: 0, state: 'ok' }
    }
  }

  for (let t = 1; t <= horizonte; t++) {
    if (cumulatives[t - 1] < -1e-9 && cumulatives[t] >= -1e-9) {
      // Ensure it stays non-negative through the active horizon (permanent break-even)
      let permanent = true
      for (let k = t; k <= horizonte; k++) {
        if (cumulatives[k] < -1e-9) {
          permanent = false
          break
        }
      }
      if (!permanent) continue
      const flowT = flows[t]
      if (flowT <= 0) continue
      const fraction = Math.min(1, Math.max(0, Math.abs(cumulatives[t - 1]) / flowT))
      return { years: t - 1 + fraction, state: 'ok' }
    }
  }

  return { years: null, state: 'fuera_horizonte' }
}

/**
 * Stage 2 — 25-Year Financial Evaluation (matching Evaluación financiera 0..25)
 * + CRM value-add layers (Bruto vs Neto Financiado, MXN vs USD, Monthly/Quarterly/Annual series, dual ROI).
 */
export function evaluateMemFinancials(
  inputs: MemSimulatorInputs,
  assumptions: MemAnnualAssumptions,
  year1: MemYear1Results,
  options: EvaluateMemFinancialsOptions = {},
): MemFinancialEvaluation {
  const moneda: Moneda = options.moneda ?? 'MXN'
  const vistaFinanciamiento: VistaFinanciamiento = options.vistaFinanciamiento ?? 'bruto'
  const rawVehicle = (options.financing?.vehiculo_inversion ?? 'contado').toLowerCase()
  const nonFinanced = rawVehicle === '' || rawVehicle === 'contado' || rawVehicle === 'no_sabe' || rawVehicle === 'mem'
  const isNetFinanced = vistaFinanciamiento === 'neto' && !nonFinanced
  const vehiculo = isNetFinanced ? rawVehicle : 'contado'

  const fx = inputs.tc_mxn_usd > 0 ? inputs.tc_mxn_usd : 18.7
  const toDisplay = (mxnAmount: number): number => (moneda === 'USD' ? mxnAmount / fx : mxnAmount)

  const capexBessMxn = inputs.bess_capacidad_mwh * 1000 * inputs.capex_bess_usd_kwh * fx
  const capexFvMxn = inputs.fv_potencia_mw * 1000 * inputs.capex_fv_usd_kwp * fx
  const capexTotalMxn = capexBessMxn + capexFvMxn
  const capexTotalUsd = capexTotalMxn / fx
  const capexTotal = toDisplay(capexTotalMxn)

  const opex1Mxn =
    inputs.bess_capacidad_mwh * inputs.opex_bess_mxn_mwh_anio +
    inputs.fv_potencia_mw * inputs.opex_fv_mxn_mw_anio
  const opex1 = toDisplay(opex1Mxn)

  // Financing structure in display currency
  const enganchePct = options.financing?.enganche_pct ?? 0.2
  const tasaInteresAnual =
    options.financing?.tasa_interes_anual ??
    (vehiculo === 'arrendamiento' ? 0.135 : vehiculo === 'credito' ? 0.125 : 0)
  const plazoMeses = Math.max(0, Math.round(options.financing?.plazo_meses ?? 60))
  const ensaasClientShare = options.financing?.ensaas_factor_ahorro_pct ?? 0.25

  let desembolsoInicial = capexTotal
  let principalFinanciado = 0
  if (isNetFinanced) {
    if (vehiculo === 'credito') {
      desembolsoInicial = capexTotal * enganchePct
      principalFinanciado = capexTotal - desembolsoInicial
    } else if (vehiculo === 'arrendamiento') {
      desembolsoInicial = 0
      principalFinanciado = capexTotal
    } else if (vehiculo === 'ensaas') {
      desembolsoInicial = 0
      principalFinanciado = 0
    }
  }

  let monthlyDebtPayment = 0
  if (isNetFinanced && (vehiculo === 'credito' || vehiculo === 'arrendamiento') && plazoMeses > 0 && principalFinanciado > 0) {
    const rM = tasaInteresAnual / 12
    if (rM > 0) {
      const pvif = Math.pow(1 + rM, plazoMeses)
      monthlyDebtPayment = (rM * principalFinanciado * pvif) / (pvif - 1)
    } else {
      monthlyDebtPayment = principalFinanciado / plazoMeses
    }
  }

  const assumptionsRows = buildAnnualAssumptionsRows(inputs, assumptions, year1.pml_promedio_mxn_mwh)

  const denomPeso = year1.res_fv_auto_mwh + year1.res_descarga_mwh
  const pesoFv = denomPeso > 0 ? year1.res_fv_auto_mwh / denomPeso : 0

  const ahorroEBase = toDisplay(year1.ahorro_e_total_mxn)
  const ahorroCBase = toDisplay(year1.ahorro_c_total_mxn)

  const rows: MemAnnualEvaluationRow[] = new Array(26)
  const netFlowsForIrr = new Array<number>(26)
  const cumSimpleArr = new Array<number>(26)
  const discFlowsArr = new Array<number>(26)
  const cumDiscArr = new Array<number>(26)

  // Year 0
  rows[0] = {
    anio: 0,
    activo: 1,
    idx_energia: 1,
    idx_potencia: 1,
    idx_opex: 1,
    factor_deg_fv: 1,
    factor_deg_bess: 1,
    factor_deg_combinado: 1,
    ahorro_energia: 0,
    ahorro_potencia: 0,
    total_ahorros: 0,
    capex: -desembolsoInicial,
    opex: 0,
    cuota_financiamiento: 0,
    flujo_neto: -desembolsoInicial,
    flujo_acumulado: -desembolsoInicial,
    factor_descuento: 1,
    flujo_descontado: -desembolsoInicial,
    flujo_descontado_acumulado: -desembolsoInicial,
  }
  netFlowsForIrr[0] = -desembolsoInicial
  cumSimpleArr[0] = -desembolsoInicial
  discFlowsArr[0] = -desembolsoInicial
  cumDiscArr[0] = -desembolsoInicial

  let flujoNetoTotalPosYears = 0
  let ahorroTotalHorizonte = 0

  for (let t = 1; t <= 25; t++) {
    const aRow = assumptionsRows[t - 1]
    const activo: 0 | 1 = t <= inputs.fin_horizonte_anios ? 1 : 0
    const idxEnergia = aRow.idx_pml
    const idxPotencia = aRow.idx_potencia
    const idxOpex = Math.pow(1 + inputs.fin_esc_opex_pct, t - 1)
    const fFv = Math.pow(1 - inputs.fv_degradacion_anual_pct, t - 1)
    const fBess = aRow.factor_deg_bess
    const fComb = fFv * pesoFv + fBess * (1 - pesoFv)

    const ahorroE = ahorroEBase * idxEnergia * fComb * activo
    const ahorroC = ahorroCBase * idxPotencia * fComb * activo
    const totalAhorros = ahorroE + ahorroC
    const opex = activo === 1 && opex1 !== 0 ? -opex1 * idxOpex : 0

    let cuotaFin = 0
    if (activo === 1 && isNetFinanced) {
      if (vehiculo === 'ensaas') {
        const fee = Math.max(0, totalAhorros * (1 - ensaasClientShare) + opex)
        cuotaFin = fee > 0 ? -fee : 0
      } else if (monthlyDebtPayment > 0) {
        const startMonth = (t - 1) * 12 + 1
        const endMonth = t * 12
        const activeMonthsInYear = Math.max(0, Math.min(endMonth, plazoMeses) - startMonth + 1)
        cuotaFin = activeMonthsInYear > 0 ? -(monthlyDebtPayment * activeMonthsInYear) : 0
      }
    }

    const flujoNeto = totalAhorros + opex + cuotaFin
    const flujoAcum = cumSimpleArr[t - 1] + flujoNeto
    const factorDesc = 1 / Math.pow(1 + inputs.fin_tasa_descuento_pct, t)
    const flujoDesc = flujoNeto * factorDesc
    const flujoDescAcum = cumDiscArr[t - 1] + flujoDesc

    rows[t] = {
      anio: t,
      activo,
      idx_energia: idxEnergia,
      idx_potencia: idxPotencia,
      idx_opex: idxOpex,
      factor_deg_fv: fFv,
      factor_deg_bess: fBess,
      factor_deg_combinado: fComb,
      ahorro_energia: ahorroE,
      ahorro_potencia: ahorroC,
      total_ahorros: totalAhorros,
      capex: 0,
      opex,
      cuota_financiamiento: cuotaFin,
      flujo_neto: flujoNeto,
      flujo_acumulado: flujoAcum,
      factor_descuento: factorDesc,
      flujo_descontado: flujoDesc,
      flujo_descontado_acumulado: flujoDescAcum,
    }

    netFlowsForIrr[t] = flujoNeto
    cumSimpleArr[t] = flujoAcum
    discFlowsArr[t] = flujoDesc
    cumDiscArr[t] = flujoDescAcum

    if (activo === 1) {
      flujoNetoTotalPosYears += flujoNeto
      ahorroTotalHorizonte += totalAhorros
    }
  }

  const vpn = cumDiscArr[25]
  const irr = desembolsoInicial > 0 ? solveIrrRate(netFlowsForIrr, 0.12) : null
  const tirPct = irr !== null && Number.isFinite(irr) ? irr * 100 : null

  const pbSimple = computeAnnualPayback(
    inputs.fin_horizonte_anios,
    capexTotal,
    desembolsoInicial,
    netFlowsForIrr,
    cumSimpleArr,
  )
  const pbDesc = computeAnnualPayback(
    inputs.fin_horizonte_anios,
    capexTotal,
    desembolsoInicial,
    discFlowsArr,
    cumDiscArr,
  )

  const netProfit = flujoNetoTotalPosYears - desembolsoInicial
  const roiPct = capexTotal > 0 ? (netProfit / capexTotal) * 100 : null
  const roiDesembolsoPct =
    isNetFinanced && desembolsoInicial > 0 && desembolsoInicial < capexTotal
      ? (netProfit / desembolsoInicial) * 100
      : null

  // Build monthly rollup series (1..H*12) using Year-1 real hourly monthly seasonality
  // while preserving exact annual flow sums per year.
  const totalMonths = inputs.fin_horizonte_anios * 12
  const serieMensual: PeriodoMensualSimulacion[] = new Array(totalMonths)

  const hasMonthlyDetails = year1.monthly_savings.length === 12
  const monthWeightsE = new Array<number>(12).fill(1 / 12)
  const sumMonthlyE = hasMonthlyDetails
    ? year1.monthly_savings.reduce((s, m) => s + m.ahorro_energia_mxn, 0)
    : 0
  if (hasMonthlyDetails && Math.abs(sumMonthlyE) > 1e-6) {
    for (let m = 0; m < 12; m++) {
      monthWeightsE[m] = year1.monthly_savings[m].ahorro_energia_mxn / sumMonthlyE
    }
  }

  const monthWeightsFvKwh = new Array<number>(12).fill(1 / 12)
  if (hasMonthlyDetails && year1.res_gen_fv_mwh > 1e-6) {
    for (let m = 0; m < 12; m++) {
      monthWeightsFvKwh[m] = year1.monthly_savings[m].gen_fv_mwh / year1.res_gen_fv_mwh
    }
  }

  const monthWeightsBessKwh = new Array<number>(12).fill(1 / 12)
  if (hasMonthlyDetails && year1.res_descarga_mwh > 1e-6) {
    for (let m = 0; m < 12; m++) {
      monthWeightsBessKwh[m] = year1.monthly_savings[m].descarga_bess_mwh / year1.res_descarga_mwh
    }
  }

  let runningCum = -desembolsoInicial
  let runningDiscCum = -desembolsoInicial
  const rDescM = Math.pow(1 + inputs.fin_tasa_descuento_pct, 1 / 12) - 1
  const discBaseM = 1 + rDescM
  let discDenomM = 1

  for (let t = 1; t <= inputs.fin_horizonte_anios; t++) {
    const annRow = rows[t]
    const yFvKwh = year1.res_fv_auto_mwh * 1000 * annRow.factor_deg_fv
    const yBessKwh = year1.res_descarga_mwh * 1000 * annRow.factor_deg_bess

    for (let mIdx = 0; mIdx < 12; mIdx++) {
      const mAbs = (t - 1) * 12 + mIdx + 1
      const trimestre = Math.floor((mAbs - 1) / 3) + 1
      const eFv = yFvKwh * monthWeightsFvKwh[mIdx]
      const eBess = yBessKwh * monthWeightsBessKwh[mIdx]
      const aBruto = annRow.ahorro_energia * monthWeightsE[mIdx] + annRow.ahorro_potencia / 12
      const cOm = Math.abs(annRow.opex) / 12

      let cFin = 0
      if (isNetFinanced) {
        if (vehiculo === 'ensaas') {
          cFin = Math.max(0, aBruto * (1 - ensaasClientShare) - cOm)
        } else if (monthlyDebtPayment > 0 && mAbs <= plazoMeses) {
          cFin = monthlyDebtPayment
        }
      }

      const fNeto = aBruto - cOm - cFin
      runningCum += fNeto
      discDenomM *= discBaseM
      runningDiscCum += fNeto / discDenomM

      serieMensual[mAbs - 1] = {
        mes: mAbs,
        anio: t,
        trimestre,
        etiqueta: `${MONTH_ABBR_ES[mIdx]} Año ${t}`,
        energia_fv_kwh: eFv,
        energia_bess_kwh: eBess,
        energia_total_kwh: eFv + eBess,
        ahorro_bruto: aBruto,
        costo_om: cOm,
        cuota_financiamiento: cFin,
        flujo_neto: fNeto,
        flujo_acumulado: runningCum,
        flujo_descontado_acumulado: runningDiscCum,
      }
    }
  }

  return {
    moneda,
    vista_financiamiento: vistaFinanciamiento,
    vehiculo_inversion: vehiculo,
    capex_bess_mxn: capexBessMxn,
    capex_fv_mxn: capexFvMxn,
    capex_total_mxn: capexTotalMxn,
    capex_total_usd: capexTotalUsd,
    capex_total: capexTotal,
    desembolso_inicial: desembolsoInicial,
    opex_y1_mxn: opex1Mxn,
    opex_y1: opex1,
    peso_fv: pesoFv,
    vpn,
    tir_pct: tirPct,
    payback_simple_anios: pbSimple.years,
    payback_simple_estado: pbSimple.state,
    payback_descontado_anios: pbDesc.years,
    payback_descontado_estado: pbDesc.state,
    roi_pct: roiPct,
    roi_desembolso_pct: roiDesembolsoPct,
    flujo_neto_total: flujoNetoTotalPosYears,
    ahorro_total_horizonte: ahorroTotalHorizonte,
    ahorro_energia_y1: ahorroEBase,
    ahorro_potencia_y1: ahorroCBase,
    ahorro_total_y1: ahorroEBase + ahorroCBase,
    rows,
    assumptions_rows: assumptionsRows,
    serie_mensual: serieMensual,
  }
}

function toSensitivityRow(
  caso: number | 'Input',
  isCurrentInput: boolean,
  potMw: number,
  capMwh: number,
  y1: MemYear1Results,
  fin: MemFinancialEvaluation,
): MemSensitivityCaseResult {
  return {
    caso,
    isCurrentInput,
    bess_potencia_mw: potMw,
    bess_capacidad_mwh: capMwh,
    ahorro_energia_y1: fin.ahorro_energia_y1,
    ahorro_potencia_y1: fin.ahorro_potencia_y1,
    ahorro_total_y1: fin.ahorro_total_y1,
    rap_reduccion_mw: y1.res_rap_reduccion_mw,
    ciclos_anio: y1.res_ciclos,
    capex: fin.capex_total,
    opex_y1: fin.opex_y1,
    vpn: fin.vpn,
    tir_pct: fin.tir_pct,
    payback_simple_anios: fin.payback_simple_anios,
    payback_descontado_anios: fin.payback_descontado_anios,
  }
}

/**
 * Sensibilidad BESS — Sweeps k = 1..num_casos (1..20) keeping FV & all other parameters constant.
 * Precomputes invariant hourly arrays once so 10-20 cases complete in < 15 ms.
 */
export function runMemBessSensitivity(
  inputs: MemSimulatorInputs,
  assumptions: MemAnnualAssumptions,
  hourly: MemHourlyDataset,
  criticalHours100HC: readonly MemCriticalHourEntry[],
  sweepConfig: MemSensitivitySweepConfig,
  options: EvaluateMemFinancialsOptions = {},
): MemSensitivitySuite {
  const t0 = performance.now()
  const numCasos = Math.max(1, Math.min(20, Math.round(sweepConfig.num_casos || 10)))
  const dur = Math.max(0, Number.isFinite(sweepConfig.duracion_fija_h) ? sweepConfig.duracion_fija_h : 3)
  const p0 = Math.max(0, Number.isFinite(sweepConfig.potencia_inicial_mw) ? sweepConfig.potencia_inicial_mw : 0.5)
  const paso = Math.max(0, Number.isFinite(sweepConfig.incremento_mw) ? sweepConfig.incremento_mw : 0.5)

  const ctx = prepareHourlySimulationContext(inputs, hourly, criticalHours100HC)

  // Live current Input case
  const curY1 = runPreparedDispatch(
    ctx,
    inputs.bess_potencia_mw,
    inputs.bess_capacidad_mwh,
    inputs.bess_eficiencia_pct,
    inputs.bess_soc_min_pct,
    inputs.rap_factor,
    inputs.mbp_precio_mxn_mw_anio,
    false,
  )
  const curFin = evaluateMemFinancials(inputs, assumptions, curY1, options)
  const currentInputCase = toSensitivityRow(
    'Input',
    true,
    inputs.bess_potencia_mw,
    inputs.bess_capacidad_mwh,
    curY1,
    curFin,
  )

  const cases: MemSensitivityCaseResult[] = new Array(numCasos)
  let bestVpnCaseIndex = -1
  let bestVpn = -Infinity

  for (let k = 0; k < numCasos; k++) {
    const potMw = p0 + k * paso
    const capMwh = potMw * dur
    const caseInputs: MemSimulatorInputs = {
      ...inputs,
      bess_potencia_mw: potMw,
      bess_capacidad_mwh: capMwh,
    }
    const y1 = runPreparedDispatch(
      ctx,
      potMw,
      capMwh,
      inputs.bess_eficiencia_pct,
      inputs.bess_soc_min_pct,
      inputs.rap_factor,
      inputs.mbp_precio_mxn_mw_anio,
      false,
    )
    const fin = evaluateMemFinancials(caseInputs, assumptions, y1, options)
    const row = toSensitivityRow(k + 1, false, potMw, capMwh, y1, fin)
    cases[k] = row

    if (fin.vpn > bestVpn) {
      bestVpn = fin.vpn
      bestVpnCaseIndex = k
    }
  }

  return {
    config: {
      duracion_fija_h: dur,
      potencia_inicial_mw: p0,
      incremento_mw: paso,
      num_casos: numCasos,
    },
    currentInputCase,
    cases,
    bestVpnCaseIndex,
    elapsedMs: performance.now() - t0,
  }
}

export function runMemSimulation(params: {
  inputs: MemSimulatorInputs
  assumptions: MemAnnualAssumptions
  hourly: MemHourlyDataset
  criticalHours100HC: readonly MemCriticalHourEntry[]
  financialOptions?: EvaluateMemFinancialsOptions
}): MemSimulationOutcome {
  const { errors, warnings } = validateMemInputs(params.inputs)
  if (Object.keys(errors).length > 0) {
    return {
      status: 'invalid_override',
      mode: 'mem_horaria',
      errors,
    }
  }

  const hourlyCheck = validateHourlyDataset(params.hourly)
  if (!hourlyCheck.valid) {
    return {
      status: 'invalid_override',
      mode: 'mem_horaria',
      errors: { _hourly: hourlyCheck.errors[0] },
    }
  }

  const year1 = simulateMemYear1(params.inputs, params.hourly, params.criticalHours100HC)
  if (year1.missing_100hc_count > 0) {
    warnings.push(
      `${year1.missing_100hc_count} hora(s) crítica(s) de 100HC no se encontraron en Datos (se tomaron como 0 MW).`,
    )
  }
  if (year1.duplicate_100hc_count > 0) {
    warnings.push(
      `${year1.duplicate_100hc_count} fila(s) en 100HC tienen clave Fecha+Hora repetida (se promedian tal cual, igual que en Excel).`,
    )
  }

  const financial = evaluateMemFinancials(
    params.inputs,
    params.assumptions,
    year1,
    params.financialOptions,
  )

  return {
    status: 'ok',
    mode: 'mem_horaria',
    inputs: params.inputs,
    assumptions: params.assumptions,
    year1,
    financial,
    validationWarnings: [...warnings, ...hourlyCheck.warnings],
  }
}
