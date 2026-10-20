import type { Moneda } from '@/lib/types'
import type { FVForm, BESSForm, Producto } from '@/components/proyectos/wizard/types'
import { formatNumberInput } from '@/lib/format'

export function parseNum(v: unknown): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  if (typeof v === 'string') {
    const clean = v.replace(/,/g, '').trim()
    if (!clean || isNaN(Number(clean))) return 0
    return Number(clean)
  }
  return 0
}

export interface CleanFvDatos {
  num_modulos: number
  potencia_modulos_w: number
  marca_modulos: string
  num_inversores: number
  potencia_inversores_kw: number
  marca_inversores: string
  generacion_anual_kwh: number
  capex: number
  capex_moneda: Moneda
  [key: string]: unknown
}

export interface CleanBessDatos {
  potencia_kw: number
  capacidad_kwh: number
  marca: string
  uso: string
  capex: number
  capex_moneda: Moneda
  inversores_hibridos: boolean
  [key: string]: unknown
}

export function sanitizeFvDatos(fv: Partial<FVForm> | Record<string, unknown>): CleanFvDatos {
  return {
    num_modulos: parseNum(fv.num_modulos),
    potencia_modulos_w: parseNum(fv.potencia_modulos_w),
    marca_modulos: String(fv.marca_modulos ?? '').trim(),
    num_inversores: parseNum(fv.num_inversores),
    potencia_inversores_kw: parseNum(fv.potencia_inversores_kw),
    marca_inversores: String(fv.marca_inversores ?? '').trim(),
    generacion_anual_kwh: parseNum(fv.generacion_anual_kwh),
    capex: parseNum(fv.capex),
    capex_moneda: (fv.capex_moneda as Moneda) || 'MXN',
  }
}

export function sanitizeBessDatos(bess: Partial<BESSForm> | Record<string, unknown>): CleanBessDatos {
  return {
    potencia_kw: parseNum(bess.potencia_kw),
    capacidad_kwh: parseNum(bess.capacidad_kwh),
    marca: String(bess.marca ?? '').trim(),
    uso: String(bess.uso ?? '').trim(),
    capex: parseNum(bess.capex),
    capex_moneda: (bess.capex_moneda as Moneda) || 'MXN',
    inversores_hibridos: Boolean(bess.inversores_hibridos),
  }
}

export function hydrateFvForm(datos: Record<string, unknown> | null | undefined): FVForm {
  if (!datos) {
    return {
      num_modulos: '',
      potencia_modulos_w: '',
      marca_modulos: '',
      num_inversores: '',
      potencia_inversores_kw: '',
      marca_inversores: '',
      generacion_anual_kwh: '',
      capex: '',
      capex_moneda: 'MXN',
    }
  }
  return {
    num_modulos: datos.num_modulos != null ? formatNumberInput(String(datos.num_modulos)) : '',
    potencia_modulos_w: datos.potencia_modulos_w != null ? formatNumberInput(String(datos.potencia_modulos_w)) : '',
    marca_modulos: String(datos.marca_modulos ?? ''),
    num_inversores: datos.num_inversores != null ? formatNumberInput(String(datos.num_inversores)) : '',
    potencia_inversores_kw: datos.potencia_inversores_kw != null ? formatNumberInput(String(datos.potencia_inversores_kw)) : '',
    marca_inversores: String(datos.marca_inversores ?? ''),
    generacion_anual_kwh: datos.generacion_anual_kwh != null ? formatNumberInput(String(datos.generacion_anual_kwh)) : '',
    capex: datos.capex != null ? formatNumberInput(String(datos.capex)) : '',
    capex_moneda: (datos.capex_moneda as Moneda) || 'MXN',
  }
}

export function hydrateBessForm(datos: Record<string, unknown> | null | undefined): BESSForm {
  if (!datos) {
    return {
      potencia_kw: '',
      capacidad_kwh: '',
      marca: '',
      uso: '',
      capex: '',
      capex_moneda: 'MXN',
      inversores_hibridos: false,
    }
  }
  return {
    potencia_kw: datos.potencia_kw != null ? formatNumberInput(String(datos.potencia_kw)) : '',
    capacidad_kwh: datos.capacidad_kwh != null ? formatNumberInput(String(datos.capacidad_kwh)) : '',
    marca: String(datos.marca ?? ''),
    uso: String(datos.uso ?? ''),
    capex: datos.capex != null ? formatNumberInput(String(datos.capex)) : '',
    capex_moneda: (datos.capex_moneda as Moneda) || 'MXN',
    inversores_hibridos: Boolean(datos.inversores_hibridos),
  }
}

export function validarFvForm(
  fvForm: FVForm,
  addingToSitioId: string | null,
  productosMap: Record<string, Producto[]>
): string {
  if (!fvForm.num_modulos || !fvForm.potencia_modulos_w) {
    return 'Ingresa número y potencia de módulos.'
  }
  if (!fvForm.marca_modulos.trim()) {
    return 'Ingresa la marca de los módulos.'
  }

  const siteProducts = addingToSitioId ? (productosMap[addingToSitioId] ?? []) : []
  const hasHybrid = siteProducts.some(
    (p) =>
      p.tipo === 'bess' &&
      (p.bess?.inversores_hibridos ||
        (p as unknown as { datos?: { inversores_hibridos?: boolean } }).datos?.inversores_hibridos)
  )

  if (!hasHybrid) {
    if (!fvForm.num_inversores || !fvForm.potencia_inversores_kw) {
      return 'Ingresa número y potencia de inversores.'
    }
    if (!fvForm.marca_inversores.trim()) {
      return 'Ingresa la marca de los inversores.'
    }
  }

  if (!fvForm.generacion_anual_kwh) {
    return 'Ingresa la generación anual estimada.'
  }
  if (!fvForm.capex) {
    return 'Ingresa el CAPEX del sistema FV.'
  }
  return ''
}

export function validarBessForm(bessForm: BESSForm): string {
  if (!bessForm.potencia_kw) {
    return 'Ingresa la potencia del BESS.'
  }
  if (!bessForm.capacidad_kwh) {
    return 'Ingresa la capacidad del BESS.'
  }
  if (!bessForm.marca.trim()) {
    return 'Ingresa la marca del BESS.'
  }
  if (!bessForm.uso) {
    return 'Selecciona el uso del BESS.'
  }
  if (!bessForm.capex) {
    return 'Ingresa el CAPEX del BESS.'
  }
  return ''
}
