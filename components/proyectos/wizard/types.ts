import type { Moneda, ModalidadFinanciamiento } from '@/lib/types'

export type PortalType = 'admin' | 'epc' | 'finder' | 'analista'

export interface FVForm {
  num_modulos: string
  potencia_modulos_w: string
  marca_modulos: string
  num_inversores: string
  potencia_inversores_kw: string
  marca_inversores: string
  generacion_anual_kwh: string
  capex: string
  capex_moneda: Moneda
}

export interface BESSForm {
  potencia_kw: string
  capacidad_kwh: string
  marca: string
  uso: string
  capex: string
  capex_moneda: Moneda
  inversores_hibridos: boolean
}

export interface Producto {
  tempId: string
  tipo: 'fv' | 'bess'
  fv?: FVForm
  bess?: BESSForm
}

export interface WizardFormData {
  nombre_proyecto: string
  cliente_id: string
  tipo_instalacion: 'nodo_busca' | 'epcista_instala' | ''
  modalidad_financiamiento: ModalidadFinanciamiento[]
  capex_estimado: string
  moneda: Moneda
  notas_adicionales: string
  incluye_mem: boolean
}

export interface CreationConfig {
  tempId: string
  nombre: string
  descripcion: string
  sitiosSeleccionados: string[]
  productosMap: Record<string, Producto[]>
  ahorro_estimado_anual: string
  ahorro_moneda: Moneda
}

export interface CreationFinancingOption {
  tempId: string
  nombre: string
  vehiculo_inversion: string
  ahorro_estimado_anual: string
  ahorro_moneda: Moneda
  plazo_meses: string
  notas: string
  linkedConfigIds: string[]
}

export interface NuevoSitioForm {
  nombre: string
  nombre_recibo: string
  ciudad: string
  ubicacion_estado: string
  rpu: string
  demanda_contratada_kw: string
}

export interface ManualClienteForm {
  nombre: string
  empresa: string
  contacto: string
}

export interface WizardCapabilities {
  portalType: PortalType
  canAssignEpc: boolean
  canAssignResponsableNodo: boolean
  canAssignFinder: boolean
  canUseManualClient: boolean
  canInviteEpc: boolean
  implicitEpc: boolean
  implicitFinder: boolean
  clientQueryFilter: 'by_selected_epc' | 'by_session_epc' | 'by_session_finder'
  redirectPrefix: string
}

export interface ProjectWizardProps {
  portalType: PortalType
  onSuccessRedirect?: (proyectoId: string) => string
  title?: string
}
