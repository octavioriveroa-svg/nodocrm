import { parseNum, fmtNum } from '@/lib/format'
import type { FVForm, BESSForm } from './types'

export function calcFV(fv: FVForm) {
  const n = parseNum(fv.num_modulos)
  const pw = parseNum(fv.potencia_modulos_w)
  const ni = parseNum(fv.num_inversores)
  const pi = parseNum(fv.potencia_inversores_kw)
  const capex = parseNum(fv.capex)
  return {
    kwpSistema: n > 0 && pw > 0 ? (n * pw) / 1000 : null,
    kwpInversores: ni > 0 && pi > 0 ? ni * pi : null,
    precioWatt: capex > 0 && n > 0 && pw > 0 ? capex / (n * pw) : null,
  }
}

export function calcBESS(bess: BESSForm) {
  const cap = parseNum(bess.capacidad_kwh)
  const capex = parseNum(bess.capex)
  return { precioKwh: capex > 0 && cap > 0 ? capex / cap : null }
}

export function n2(v: number | null, dec = 2): string {
  if (v === null) return '—'
  return fmtNum(v, dec)
}
