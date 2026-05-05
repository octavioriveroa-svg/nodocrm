export type Rol = 'epc' | 'nodo_analista' | 'nodo_admin' | 'cliente_final' | 'financiero' | 'suministrador' | 'pendiente'
export type TipoProyecto = 'BESS' | 'MEM' | 'BESS+MEM' | 'FV' | 'FV+BESS'
export type TipoInstalacion = 'nodo_busca' | 'epcista_instala'
export type EstadoProyecto = 'recibido' | 'en_analisis' | 'propuesta_lista' | 'enviada' | 'negociacion' | 'aprobado' | 'en_construccion' | 'operativo' | 'completado' | 'cliente_interesado'
export type TecnologiaBateria = 'Li-ion' | 'LFP' | 'NMC' | 'Otra'
export type Moneda = 'MXN' | 'USD'
export type ModalidadFinanciamiento = 'credito' | 'arrendamiento' | 'ensaas' | 'mem' | 'no_sabe'
export type TipoArchivo = 'recibo_cfe' | 'propuesta' | 'machote_contrato' | 'adjunto_epcista' | 'propuesta_analista' | 'evidencia_hito' | 'oferta_suministrador' | 'documento_general'

export interface Profile {
  id: string
  nombre: string
  empresa: string
  rol: Rol
  calendario_url: string | null
  cliente_crm_id: string | null
  created_at: string
}

export interface Proyecto {
  id: string
  epcista_id: string
  responsable_nodo_id: string | null
  cliente_id: string | null
  financiero_id: string | null
  tipo: TipoProyecto
  nombre_proyecto: string
  estado: EstadoProyecto
  cliente_final_nombre: string
  cliente_final_empresa: string
  cliente_final_contacto: string
  capacidad_mwh: number | null
  capacidad_mw: number | null
  tecnologia_bateria: TecnologiaBateria | null
  duracion_descarga_hrs: number | null
  punto_interconexion: string | null
  tipo_participacion_mem: string | null
  volumen_energia_mwh_anual: number | null
  capex_estimado: number | null
  moneda: Moneda
  ubicacion_estado: string
  modalidad_financiamiento: ModalidadFinanciamiento[]
  notas_adicionales: string | null
  tipo_instalacion: TipoInstalacion | null
  incluye_mem: boolean
  demanda_kw: number | null
  created_at: string
  updated_at: string
  historial_estados?: Record<string, string>
  profiles?: Profile
}

export interface ProyectoSitioProducto {
  id: string
  proyecto_id: string
  sitio_id: string
  tipo: 'fv' | 'bess'
  datos: Record<string, unknown>
  created_at: string
  sitios?: { nombre: string }
}

export interface Comentario {
  id: string
  proyecto_id: string
  autor_id: string
  contenido: string
  created_at: string
  profiles?: Profile
}

export interface Sitio {
  id: string
  cliente_id: string
  epcista_id: string
  nombre: string
  nombre_recibo: string | null
  ciudad: string | null
  ubicacion_estado: string | null
  rpu: string | null
  demanda_contratada_kw: number | null
  recibo_url: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export interface ProyectoSitio {
  id: string
  proyecto_id: string
  sitio_id: string
  sitios?: Sitio
}

export interface Cliente {
  id: string
  epcista_id: string
  razon_social: string
  rfc: string | null
  industria: string | null
  ubicacion_estado: string | null
  contacto_nombre: string
  contacto_cargo: string | null
  contacto_email: string | null
  contacto_telefono: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export interface Archivo {
  id: string
  proyecto_id: string
  autor_id: string
  nombre: string
  url: string
  tipo: TipoArchivo
  descripcion: string | null
  tags: string[]
  created_at: string
  profiles?: Profile
}

export type EstadoHito = 'pendiente' | 'en_progreso' | 'completado' | 'retrasado'

export interface HitoConstruccion {
  id: string
  proyecto_id: string
  nombre: string
  descripcion: string | null
  fecha_estimada_inicio: string | null
  fecha_estimada_fin: string | null
  fecha_real_inicio: string | null
  fecha_real_fin: string | null
  estado: EstadoHito
  orden: number
  created_at: string
  updated_at: string
}

export type EstadoOferta = 'enviada' | 'en_revision' | 'aceptada' | 'rechazada'

export interface OfertaMem {
  id: string
  proyecto_id: string
  suministrador_id: string
  precio_kwh: number
  vigencia_meses: number
  notas: string | null
  estado: EstadoOferta
  created_at: string
  updated_at: string
  suministrador?: Profile
}
