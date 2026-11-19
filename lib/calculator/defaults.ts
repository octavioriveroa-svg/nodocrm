import type { FuenteCalculo, Moneda, TipoProyecto } from '@/lib/types'

/**
 * Converts a monetary amount from srcCurrency into calcCurrency using resolved USD/MXN fx (> 0).
 */
export function toCalcCurrency(
  value: number,
  srcCurrency: Moneda,
  calcCurrency: Moneda,
  fx: number,
): number {
  if (srcCurrency === calcCurrency) return value
  if (srcCurrency === 'USD' && calcCurrency === 'MXN') return value * fx
  if (srcCurrency === 'MXN' && calcCurrency === 'USD') return value / fx
  return value
}

export interface Year1ContextInputs {
  tipoProyecto: TipoProyecto
  incluyeMem: boolean
  kwpFv: number
  generacionFvY1Kwh: number
  autoconsumoFvPct: number
  bessCapacidadKwh: number
  bessPotenciaKw: number
  bessEsUpsPuro: 0 | 1
  bessDod: number
  bessEficienciaRt: number
  bessCiclosAnio: number
  factorRecorteDemanda: number
  demandaContratadaKw: number
  consumoAnualKwh: number
  tarifaCfeKwh: number
  cargoDemandaMensualKw: number
  diferencialPuntaBaseKwh: number
  tarifaMemKwh: number
  ahorroDeclaradoBrutoAnual: number
}

export interface Year1SavingsBreakdown {
  generacion_fv_y1_kwh: number
  energia_fv_y1_kwh: number
  ahorro_fv_y1: number
  energia_bess_y1_kwh: number
  ahorro_arbitraje_y1: number
  ahorro_demanda_y1: number
  ahorro_bess_y1: number
  ahorro_mem_y1: number
  ahorro_fisico_y1_total: number
  fuente_calculo: Exclude<FuenteCalculo, 'formula_personalizada'>
}

/**
 * Rational default Year-1 energy & monetary savings equations (§4.4) for FV, BESS, MEM,
 * and declared-savings fallback.
 */
export function computeYear1Savings(inputs: Year1ContextInputs): Year1SavingsBreakdown {
  const hasFv =
    inputs.tipoProyecto.includes('FV') || inputs.kwpFv > 0 || inputs.generacionFvY1Kwh > 0
  const hasBess =
    inputs.tipoProyecto.includes('BESS') ||
    inputs.bessCapacidadKwh > 0 ||
    inputs.bessPotenciaKw > 0
  const hasMem =
    inputs.tipoProyecto === 'MEM' ||
    inputs.tipoProyecto === 'BESS+MEM' ||
    inputs.incluyeMem === true

  // 1. Solar FV
  const generacionFvY1 = hasFv ? Math.max(0, inputs.generacionFvY1Kwh) : 0
  const energiaFvY1 = generacionFvY1 * inputs.autoconsumoFvPct
  const ahorroFvY1 = energiaFvY1 * inputs.tarifaCfeKwh

  // 2. BESS
  let energiaBessY1 = 0
  let ahorroArbitrajeY1 = 0
  let ahorroDemandaY1 = 0
  let ahorroBessY1 = 0

  if (hasBess && inputs.bessEsUpsPuro === 0) {
    energiaBessY1 =
      inputs.bessCapacidadKwh *
      inputs.bessDod *
      inputs.bessEficienciaRt *
      inputs.bessCiclosAnio
    ahorroArbitrajeY1 = energiaBessY1 * inputs.diferencialPuntaBaseKwh
    const demandaRecortableKw =
      inputs.demandaContratadaKw > 0
        ? Math.min(inputs.bessPotenciaKw, inputs.demandaContratadaKw)
        : inputs.bessPotenciaKw
    ahorroDemandaY1 =
      demandaRecortableKw * inputs.factorRecorteDemanda * inputs.cargoDemandaMensualKw * 12
    ahorroBessY1 = ahorroArbitrajeY1 + ahorroDemandaY1
  }

  // 3. MEM
  const ahorroMemY1 = hasMem
    ? inputs.consumoAnualKwh * Math.max(0, inputs.tarifaCfeKwh - inputs.tarifaMemKwh)
    : 0

  // 4. Declared savings fallback
  const physicalTotal = ahorroFvY1 + ahorroBessY1 + ahorroMemY1
  const fuenteCalculo: Exclude<FuenteCalculo, 'formula_personalizada'> =
    physicalTotal === 0 && inputs.ahorroDeclaradoBrutoAnual > 0
      ? 'ahorro_declarado'
      : 'fisico_tarifario'

  return {
    generacion_fv_y1_kwh: generacionFvY1,
    energia_fv_y1_kwh: energiaFvY1,
    ahorro_fv_y1: ahorroFvY1,
    energia_bess_y1_kwh: energiaBessY1,
    ahorro_arbitraje_y1: ahorroArbitrajeY1,
    ahorro_demanda_y1: ahorroDemandaY1,
    ahorro_bess_y1: ahorroBessY1,
    ahorro_mem_y1: ahorroMemY1,
    ahorro_fisico_y1_total: physicalTotal,
    fuente_calculo: fuenteCalculo,
  }
}

export interface DefaultMonthlyParams {
  capex_total: number
  generacion_fv_y1_kwh: number
  autoconsumo_fv_pct: number
  degradacion_fv_anual: number
  energia_bess_y1_kwh: number
  degradacion_bess_anual: number
  ahorro_fv_y1: number
  ahorro_bess_y1: number
  ahorro_mem_y1: number
  ahorro_declarado_bruto_anual: number
  escalacion_tarifa_anual: number
  pct_om_anual: number
  inflacion_anual: number
  vista_neta: 0 | 1
  vehiculo_inversion: string
  ensaas_factor_ahorro_pct: number
  plazo_meses: number
  principal_financiado: number
  tasa_interes_mensual: number
  pesos_estacionales_fv: readonly number[]
}

export interface MonthlyEvaluationOutputs {
  fv_kwh_mes: number
  bess_kwh_mes: number
  energia_ahorrada_kwh_mes: number
  ahorro_bruto_mes: number
  om_mes: number
  cuota_financiamiento_mes: number
  flujo_neto_mes: number
}

/**
 * Rational default monthly cashflow & energy evaluation (§4.5).
 * Designed to be bit-identical (within 1e-9) to the v29 v1 seeded 7 AST formulas.
 */
export function evaluateDefaultMonth(
  params: DefaultMonthlyParams,
  mesIndice: number,
): MonthlyEvaluationOutputs {
  const anioIndice = Math.floor((mesIndice - 1) / 12)
  const pesoEstacionalMes = params.pesos_estacionales_fv[(mesIndice - 1) % 12] ?? 1 / 12

  const degFvFactor = Math.pow(1 - params.degradacion_fv_anual, anioIndice)
  const degBessFactor = Math.pow(1 - params.degradacion_bess_anual, anioIndice)
  const escFactor = Math.pow(1 + params.escalacion_tarifa_anual, anioIndice)
  const infFactor = Math.pow(1 + params.inflacion_anual, anioIndice)

  const fv_kwh_mes =
    params.generacion_fv_y1_kwh * params.autoconsumo_fv_pct * degFvFactor * pesoEstacionalMes
  const bess_kwh_mes = (params.energia_bess_y1_kwh * degBessFactor) / 12
  const energia_ahorrada_kwh_mes = fv_kwh_mes + bess_kwh_mes

  const physicalY1Sum = params.ahorro_fv_y1 + params.ahorro_bess_y1 + params.ahorro_mem_y1
  const ahorro_bruto_mes =
    physicalY1Sum > 0
      ? (params.ahorro_fv_y1 * degFvFactor * pesoEstacionalMes +
          (params.ahorro_bess_y1 * degBessFactor + params.ahorro_mem_y1) / 12) *
        escFactor
      : (params.ahorro_declarado_bruto_anual / 12) * escFactor

  const om_mes = (params.capex_total * params.pct_om_anual * infFactor) / 12

  let cuota_financiamiento_mes = 0
  if (params.vista_neta === 1) {
    if (params.vehiculo_inversion.toLowerCase() === 'ensaas') {
      cuota_financiamiento_mes = Math.max(
        0,
        ahorro_bruto_mes * (1 - params.ensaas_factor_ahorro_pct) - om_mes,
      )
    } else if (
      mesIndice <= params.plazo_meses &&
      params.plazo_meses > 0 &&
      params.principal_financiado > 0
    ) {
      if (params.tasa_interes_mensual > 0) {
        const pvif = Math.pow(1 + params.tasa_interes_mensual, params.plazo_meses)
        cuota_financiamiento_mes =
          (params.tasa_interes_mensual * params.principal_financiado * pvif) / (pvif - 1)
      } else {
        cuota_financiamiento_mes = params.principal_financiado / params.plazo_meses
      }
    }
  }

  const flujo_neto_mes = ahorro_bruto_mes - om_mes - cuota_financiamiento_mes

  return {
    fv_kwh_mes,
    bess_kwh_mes,
    energia_ahorrada_kwh_mes,
    ahorro_bruto_mes,
    om_mes,
    cuota_financiamiento_mes,
    flujo_neto_mes,
  }
}
