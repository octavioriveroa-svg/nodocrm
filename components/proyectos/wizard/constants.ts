import type { ModalidadFinanciamiento } from '@/lib/types'
import type { FVForm, BESSForm, NuevoSitioForm, ManualClienteForm, WizardFormData } from './types'

export const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
]

export const VEHICULOS_FINANCIAMIENTO: {
  id: ModalidadFinanciamiento
  nombreEs: string
  nombreEn: string
  descEs: string
  descEn: string
}[] = [
  {
    id: 'credito',
    nombreEs: 'Crédito Bancario',
    nombreEn: 'Debt Financing / Bank Loan',
    descEs: 'Financiamiento mediante crédito tradicional o bancario.',
    descEn: 'Funding through traditional bank or credit loan.',
  },
  {
    id: 'arrendamiento',
    nombreEs: 'Arrendamiento Puro / Financiero',
    nombreEn: 'Lease Financing (Operating / Capital)',
    descEs: 'Esquema de arrendamiento con opción a compra o deducción fiscal.',
    descEn: 'Lease structure with purchase option or tax deduction.',
  },
  {
    id: 'ensaas',
    nombreEs: 'EnSaaS / PPA (Energía como Servicio)',
    nombreEn: 'EnSaaS / PPA (Energy as a Service)',
    descEs: 'Venta de energía generada o tarifa por servicio sin desembolso inicial de CAPEX.',
    descEn: 'Pay-per-kWh or service fee model with zero initial CAPEX outlay.',
  },
  {
    id: 'mem',
    nombreEs: 'Mercado Eléctrico Mayorista (MEM)',
    nombreEn: 'Wholesale Electricity Market (MEM)',
    descEs: 'Participación y suministro calificado en el MEM.',
    descEn: 'Qualified supplier participation in the wholesale electricity market.',
  },
  {
    id: 'no_sabe',
    nombreEs: 'Recomendación de Nodo',
    nombreEn: 'Nodo Recommendation',
    descEs: 'Nodo analizará el proyecto y recomendará el vehículo óptimo.',
    descEn: 'Nodo will evaluate the project and recommend the optimal structure.',
  },
]

export const inp = "w-full rounded-lg border border-borde px-4 py-2.5 text-sm bg-white focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all"

export const emptyFv: FVForm = {
  num_modulos: '',
  potencia_modulos_w: '',
  marca_modulos: '',
  num_inversores: '',
  potencia_inversores_kw: '',
  marca_inversores: '',
  generacion_anual_kwh: '',
  capex: '',
  capex_moneda: 'USD',
}

export const emptyBess: BESSForm = {
  potencia_kw: '',
  capacidad_kwh: '',
  marca: '',
  uso: 'load_shifting',
  capex: '',
  capex_moneda: 'USD',
  inversores_hibridos: false,
}

export const emptyNuevoSitio: NuevoSitioForm = {
  nombre: '',
  nombre_recibo: '',
  ciudad: '',
  ubicacion_estado: '',
  rpu: '',
  demanda_contratada_kw: '',
}

export const emptyManualCliente: ManualClienteForm = {
  nombre: '',
  empresa: '',
  contacto: '',
}

export const initialForm: WizardFormData = {
  nombre_proyecto: '',
  cliente_id: '',
  tipo_instalacion: '',
  modalidad_financiamiento: [],
  capex_estimado: '',
  moneda: 'MXN',
  notas_adicionales: '',
  incluye_mem: false,
}
