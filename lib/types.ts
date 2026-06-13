export type Rol = 'epc' | 'nodo_analista' | 'nodo_admin' | 'cliente_final' | 'financiero' | 'suministrador' | 'pendiente' | 'finder'
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
  finder_id: string | null
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
  configuracion_id: string | null
  tipo: 'fv' | 'bess'
  datos: Record<string, unknown>
  created_at: string
  sitios?: { nombre: string }
}
 
export interface ConfiguracionTecnica {
  id: string
  proyecto_id: string
  nombre: string
  descripcion: string | null
  inversion_total: number | null
  moneda: string
  seleccionada: boolean
  created_at: string
  updated_at: string
}

export interface OpcionFinanciamiento {
  id: string
  proyecto_id: string
  nombre: string
  vehiculo_inversion: string
  ahorro_estimado_mensual: number | null
  moneda: string
  plazo_meses: number | null
  notas: string | null
  seleccionada: boolean
  created_at: string
  updated_at: string
}

export interface ConfigFinanciamiento {
  id: string
  configuracion_id: string
  opcion_financiamiento_id: string
  created_at: string
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
  finder_id: string | null
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

// ── Plan Management Types ─────────────────────────────────────

export type EstadoPlan = 'pendiente' | 'en_progreso' | 'completado' | 'retrasado'
export type EstadoTarea = 'pendiente' | 'en_progreso' | 'completado'
export type PrioridadTarea = 'baja' | 'media' | 'alta' | 'critica'
export type TipoDependencia = 'FS' | 'SS' | 'FF' | 'SF'
export type EstadoHitoFinanciero = 'pendiente' | 'elegible' | 'aprobado' | 'pagado'

export interface PlanFase {
  id: string
  proyecto_id: string
  nombre: string
  descripcion: string | null
  orden: number
  color: string
  fecha_inicio_estimada: string | null
  fecha_fin_estimada: string | null
  fecha_inicio_real: string | null
  fecha_fin_real: string | null
  porcentaje_completado: number
  estado: EstadoPlan
  created_at: string
  updated_at: string
}

export interface PlanActividad {
  id: string
  fase_id: string
  proyecto_id: string
  nombre: string
  descripcion: string | null
  orden: number
  responsable_id: string | null
  fecha_inicio_estimada: string | null
  fecha_fin_estimada: string | null
  duracion_dias: number | null
  fecha_inicio_real: string | null
  fecha_fin_real: string | null
  dependencia_id: string | null
  tipo_dependencia: TipoDependencia
  porcentaje_completado: number
  estado: EstadoPlan
  created_at: string
  updated_at: string
  responsable?: Profile
}

export interface PlanTarea {
  id: string
  actividad_id: string
  proyecto_id: string
  nombre: string
  descripcion: string | null
  orden: number
  responsable_id: string | null
  prioridad: PrioridadTarea
  fecha_vencimiento: string | null
  estado: EstadoTarea
  created_at: string
  updated_at: string
  responsable?: Profile
  subtareas?: PlanSubtarea[]
}

export interface PlanSubtarea {
  id: string
  tarea_id: string
  nombre: string
  completado: boolean
  orden: number
  created_at: string
}

export interface HitoFinanciero {
  id: string
  proyecto_id: string
  fase_id: string | null
  nombre: string
  descripcion: string | null
  monto: number
  moneda: string
  porcentaje_del_total: number | null
  condicion_desbloqueo: string | null
  fase_gatillo_id: string | null
  estado: EstadoHitoFinanciero
  fecha_estimada: string | null
  fecha_pago_real: string | null
  comprobante_url: string | null
  comprobante_tipo: string | null
  notas: string | null
  orden: number
  created_at: string
  updated_at: string
  fase?: PlanFase
}

export interface PlanPlantilla {
  id: string
  epcista_id: string
  nombre: string
  descripcion: string | null
  tipo_proyecto: string | null
  estructura: PlanPlantillaEstructura
  created_at: string
  updated_at: string
}

export interface PlanPlantillaEstructura {
  fases: {
    nombre: string
    orden: number
    color: string
    actividades: {
      nombre: string
      orden: number
      duracion_dias: number | null
      dependencia_orden?: number
      tareas: {
        nombre: string
        orden: number
        prioridad: PrioridadTarea
        subtareas: { nombre: string; orden: number }[]
      }[]
    }[]
  }[]
  hitos_financieros?: {
    nombre: string
    porcentaje_del_total: number
    fase_orden: number
    condicion_desbloqueo: string
  }[]
}

// ── Comment & Notification Types ──────────────────────────────

export type CommentTargetType = 'fase' | 'actividad' | 'tarea' | 'subtarea' | 'hito' | 'evidencia'

export interface PlanComentario {
  id: string
  proyecto_id: string
  fase_id: string | null
  actividad_id: string | null
  tarea_id: string | null
  subtarea_id: string | null
  hito_id: string | null
  evidencia_id: string | null
  parent_id: string | null
  autor_id: string
  contenido: string
  resuelto: boolean
  resuelto_por: string | null
  created_at: string
  updated_at: string
  autor?: Profile
  respuestas?: PlanComentario[]
}

export type TipoNotificacion = 'comentario' | 'respuesta' | 'resuelto' | 'sistema' | 'evidencia'

export interface Notificacion {
  id: string
  usuario_id: string
  tipo: TipoNotificacion
  titulo: string
  mensaje: string | null
  enlace: string | null
  proyecto_id: string | null
  comentario_id: string | null
  leido: boolean
  created_at: string
}

// ── Evidence Types ───────────────────────────────────────────

export type TipoEvidencia = 'foto' | 'documento' | 'nota'

export interface InstalacionEvidencia {
  id: string
  proyecto_id: string
  fase_id: string | null
  actividad_id: string | null
  tarea_id: string | null
  tipo: TipoEvidencia
  titulo: string
  descripcion: string | null
  url: string | null
  autor_id: string
  created_at: string
  updated_at: string
  autor?: Profile
}

