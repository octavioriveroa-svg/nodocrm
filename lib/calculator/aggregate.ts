import type {
  GranularidadProyeccion,
  PeriodoAgregadoSimulacion,
  PeriodoMensualSimulacion,
} from '@/lib/types'

/**
 * Deterministic rollup from monthly simulation series (1..H*12) to Mensual, Trimestral, or Anual.
 * Preserves exact flow sums (energia_*, ahorro_bruto, costo_om, cuota_financiamiento, flujo_neto)
 * and takes end-of-period cumulative cashflows (flujo_acumulado, flujo_descontado_acumulado).
 */
export function aggregateSeries(
  serieMensual: readonly PeriodoMensualSimulacion[],
  granularidad: GranularidadProyeccion,
): PeriodoAgregadoSimulacion[] {
  if (serieMensual.length === 0) return []

  if (granularidad === 'mensual') {
    return serieMensual.map((row) => ({
      periodo: row.mes,
      anio: row.anio,
      trimestre: ((row.trimestre - 1) % 4) + 1,
      mes: row.mes,
      etiqueta: row.etiqueta,
      energia_fv_kwh: row.energia_fv_kwh,
      energia_bess_kwh: row.energia_bess_kwh,
      energia_total_kwh: row.energia_total_kwh,
      ahorro_bruto: row.ahorro_bruto,
      costo_om: row.costo_om,
      cuota_financiamiento: row.cuota_financiamiento,
      flujo_neto: row.flujo_neto,
      flujo_acumulado: row.flujo_acumulado,
      flujo_descontado_acumulado: row.flujo_descontado_acumulado,
    }))
  }

  const groupSize = granularidad === 'trimestral' ? 3 : 12
  const result: PeriodoAgregadoSimulacion[] = []

  for (let start = 0; start < serieMensual.length; start += groupSize) {
    const end = Math.min(start + groupSize, serieMensual.length)
    let energiaFv = 0
    let energiaBess = 0
    let energiaTotal = 0
    let ahorroBruto = 0
    let costoOm = 0
    let cuotaFin = 0
    let flujoNeto = 0

    for (let i = start; i < end; i++) {
      const m = serieMensual[i]
      energiaFv += m.energia_fv_kwh
      energiaBess += m.energia_bess_kwh
      energiaTotal += m.energia_total_kwh
      ahorroBruto += m.ahorro_bruto
      costoOm += m.costo_om
      cuotaFin += m.cuota_financiamiento
      flujoNeto += m.flujo_neto
    }

    const last = serieMensual[end - 1]
    const periodoIndex = Math.floor(start / groupSize) + 1

    if (granularidad === 'trimestral') {
      const quarterInYear = ((periodoIndex - 1) % 4) + 1
      result.push({
        periodo: periodoIndex,
        anio: last.anio,
        trimestre: quarterInYear,
        etiqueta: `T${quarterInYear} Año ${last.anio}`,
        energia_fv_kwh: energiaFv,
        energia_bess_kwh: energiaBess,
        energia_total_kwh: energiaTotal,
        ahorro_bruto: ahorroBruto,
        costo_om: costoOm,
        cuota_financiamiento: cuotaFin,
        flujo_neto: flujoNeto,
        flujo_acumulado: last.flujo_acumulado,
        flujo_descontado_acumulado: last.flujo_descontado_acumulado,
      })
    } else {
      result.push({
        periodo: periodoIndex,
        anio: last.anio,
        etiqueta: `Año ${last.anio}`,
        energia_fv_kwh: energiaFv,
        energia_bess_kwh: energiaBess,
        energia_total_kwh: energiaTotal,
        ahorro_bruto: ahorroBruto,
        costo_om: costoOm,
        cuota_financiamiento: cuotaFin,
        flujo_neto: flujoNeto,
        flujo_acumulado: last.flujo_acumulado,
        flujo_descontado_acumulado: last.flujo_descontado_acumulado,
      })
    }
  }

  return result
}
