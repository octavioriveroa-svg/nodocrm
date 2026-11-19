export type Rol = 'epc' | 'nodo_analista' | 'nodo_admin' | 'cliente_final' | 'financiero' | 'suministrador' | 'pendiente' | 'finder'
export type RolUsuario = Rol
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
  rfc?: string | null
  industria?: string | null
  ubicacion_estado?: string | null
  website?: string | null
  moneda_preferida?: Moneda | null
  timezone?: string | null
  notif_nuevo_proyecto?: boolean | null
  notif_cambio_estado?: boolean | null
  notif_comentarios?: boolean | null
}
 
export interface Proyecto {
  id: string
  epcista_id: string | null
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
  tarifa_actual_cfe?: string | number | null
  consumo_anual_gwh?: number | null
  codigo_postal?: string | null
  created_at: string
  updated_at: string
  historial_estados?: Record<string, string>
  plan_bloqueado?: boolean
  profiles?: Profile
}

export interface ProductoFvDatos {
  num_modulos: number | string
  potencia_modulos_w: number | string
  marca_modulos?: string
  num_inversores?: number | string
  potencia_inversores_kw?: number | string
  marca_inversores?: string
  generacion_anual_kwh?: number | string
  capex: number | string
  capex_moneda?: Moneda
}

export interface ProductoBessDatos {
  potencia_kw: number | string
  capacidad_kwh: number | string
  marca?: string
  uso: 'load_shifting' | 'ups' | 'load_shifting_ups'
  capex: number | string
  capex_moneda?: Moneda
  inversores_hibridos?: boolean
}
 
export interface ProyectoSitioProducto {
  id: string
  proyecto_id: string
  sitio_id: string
  configuracion_id: string | null
  tipo: 'fv' | 'bess'
  datos: ProductoFvDatos | ProductoBessDatos | Record<string, unknown>
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
  ahorro_estimado_anual?: number | null
  ahorro_estimado_mensual: number | null
  ahorro_moneda: string
  seleccionada: boolean
  created_at: string
  updated_at: string
}

export interface OpcionFinanciamiento {
  id: string
  proyecto_id: string
  nombre: string
  vehiculo_inversion: string
  ahorro_estimado_anual?: number | null
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

// ── Savings Calculator & Simulator Types (R1-R4) ─────────────

export type GranularidadProyeccion = 'mensual' | 'trimestral' | 'anual'
export type VistaFinanciamiento = 'bruto' | 'neto'
export type PaybackEstado = 'inmediato' | 'en_horizonte' | 'fuera_horizonte' | 'no_recuperable'
export type ModoFormulaConfig = 'default' | 'custom_formulas' | 'excel_import'
export type FuenteCalculo = 'fisico_tarifario' | 'ahorro_declarado' | 'formula_personalizada'

export type CalculadoraCampoTipo = 'number' | 'percentage' | 'integer' | 'select' | 'number_array'
export type CalculadoraCampoGrupo =
  | 'moneda'
  | 'tarifas'
  | 'fv'
  | 'bess'
  | 'macro'
  | 'financiamiento'
  | 'horizontes'

export interface CalculadoraCampoValidationRules {
  required?: boolean
  allowNegative?: boolean
  integer?: boolean
  exclusiveMin?: number
  exclusiveMax?: number
  overrideMin?: number
  overrideMax?: number
  options?: string[]
  arrayLength?: number
  sumEquals?: number
  sumTolerance?: number
  overrideKey?: string
}

export interface CalculadoraCampoDef {
  key: string
  label: string
  unit: string
  type: CalculadoraCampoTipo
  group: CalculadoraCampoGrupo
  min?: number
  max?: number
  step?: number
  defaultValue: number | string | number[]
  validationRules?: CalculadoraCampoValidationRules
  editableByUser: boolean
  order: number
}

export interface FormulaDefinicion {
  key:
    | 'fv_kwh_mes'
    | 'bess_kwh_mes'
    | 'energia_ahorrada_kwh_mes'
    | 'ahorro_bruto_mes'
    | 'om_mes'
    | 'cuota_financiamiento_mes'
    | 'flujo_neto_mes'
  label: string
  expression: string
  unit: 'kWh' | 'currency'
  enabled: boolean
  source_cell?: string
  ast_validated?: boolean
}

export type CalculadoraFormulaDef = FormulaDefinicion

export interface ExcelInputMapping {
  cellRef: string
  sheetName: string
  label: string
  platformVar: string
  sampleValue?: number | string | null
}

export interface ExcelOutputMapping {
  cellRef: string
  sheetName: string
  outputKey: FormulaDefinicion['key']
  rawFormula: string
  rewrittenExpression: string
}

export interface ExcelMapeoCampos {
  inputMappings: ExcelInputMapping[]
  outputMappings: ExcelOutputMapping[]
}

export interface ExcelSheetMetadata {
  name: string
  rowCount: number
  colCount: number
}

export interface ExcelDefinedName {
  name: string
  ranges: string[]
}

export interface ExcelCandidateInputCell {
  cellRef: string
  sheetName: string
  label: string
  sampleValue: number | string | null
  isFormulaDerived: boolean
  referencedBy?: string[]
}

export interface ExcelDetectedFormulaCell {
  cellRef: string
  sheetName: string
  label: string
  rawFormula: string
  cachedResult: number | string | null
  dependencies: string[]
}

export interface ExcelMappingSuggestion {
  cellRef: string
  sheetName: string
  label: string
  sampleValue: number | string | null
  suggestedVar: string | null
  confidence: number
  isFormulaDerived?: boolean
}

export interface ExcelOutputMappingSuggestion {
  cellRef: string
  sheetName: string
  label: string
  rawFormula: string
  cachedResult: number | string | null
  suggestedOutputKey: FormulaDefinicion['key'] | null
  confidence: number
  dependencies: string[]
}

export interface ExcelParseResult {
  fileName: string
  fileHash: string
  defaultSheet: string
  sheets: ExcelSheetMetadata[]
  definedNames: ExcelDefinedName[]
  candidateInputs: ExcelCandidateInputCell[]
  formulaCells: ExcelDetectedFormulaCell[]
  suggestedInputMappings: ExcelMappingSuggestion[]
  suggestedOutputMappings: ExcelOutputMappingSuggestion[]
}

export interface CalculadoraTemplate {
  id: string
  version: number
  nombre: string
  descripcion: string | null
  modo: ModoFormulaConfig
  is_active: boolean
  campos: CalculadoraCampoDef[]
  formulas: FormulaDefinicion[]
  horizonte_opciones: number[]
  excel_archivo_nombre: string | null
  excel_archivo_hash: string | null
  excel_hoja_origen: string | null
  excel_mapeo_campos: ExcelMapeoCampos | null
  excel_preview_snapshot: Record<string, unknown> | null
  validation_status: 'valid' | 'invalid'
  validation_errors: string[]
  notas: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Strictly the 24 overridable simulation parameters stored in simulaciones_ahorro.parametros_override
// (22 editableByUser:true campos excluding top-level moneda_default -> moneda_calculo, plus 2 runtime engineering inputs).
// Top-level columns (moneda_calculo, horizonte_anios, vista_financiamiento) live on SimulacionRunRequest / DB columns.
export interface SimulacionOverrides {
  tipo_cambio_usd_mxn?: number
  tarifa_cfe_kwh?: number
  cargo_demanda_mensual_kw?: number
  diferencial_punta_base_kwh?: number
  tarifa_mem_kwh?: number
  consumo_anual_kwh?: number
  generacion_fv_y1_kwh?: number
  autoconsumo_fv_pct?: number
  hsp_horas_dia?: number
  performance_ratio_fv?: number
  degradacion_fv_anual?: number
  bess_ciclos_anio?: number
  bess_dod?: number
  bess_eficiencia_rt?: number
  factor_recorte_demanda?: number
  degradacion_bess_anual?: number
  escalacion_tarifa_anual?: number
  inflacion_anual?: number
  pct_om_anual?: number
  tasa_descuento_anual?: number
  enganche_pct?: number
  tasa_interes_anual?: number
  plazo_meses?: number
  ensaas_factor_ahorro_pct?: number
}

export interface SimulacionRunRequest {
  proyecto_id: string
  configuracion_id?: string | null
  opcion_financiamiento_id?: string | null
  moneda_calculo: Moneda
  horizonte_anios: number
  vista_financiamiento: VistaFinanciamiento
  granularidad_default?: GranularidadProyeccion
  parametros_override: SimulacionOverrides
}

// Persisted row in public.simulaciones_ahorro (slim: no serie_mensual JSONB stored in DB)
export interface SimulacionAhorro {
  id: string
  proyecto_id: string
  configuracion_id: string | null
  opcion_financiamiento_id: string | null
  nombre: string
  descripcion: string | null
  usa_parametros_base: boolean
  template_id: string
  template_version: number
  parametros_override: SimulacionOverrides
  moneda_calculo: Moneda
  tipo_cambio_usado: number
  horizonte_anios: number
  granularidad_default: GranularidadProyeccion
  vista_financiamiento: VistaFinanciamiento
  fuente_calculo: FuenteCalculo
  capex_snapshot: number
  desembolso_inicial: number
  payback_simple_meses: number | null
  payback_simple_anios: number | null
  payback_descontado_meses: number | null
  payback_estado: PaybackEstado
  ahorro_energia_y1_kwh: number
  ahorro_energia_total_kwh: number
  ahorro_monetario_y1: number
  ahorro_monetario_total: number
  flujo_neto_total: number
  roi_pct: number | null
  tir_pct: number | null
  van: number | null
  is_stale: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  creador?: Pick<Profile, 'id' | 'nombre' | 'rol'>
  template?: CalculadoraTemplate
}

// In-memory TypeScript engine output types (computed on the fly in < 1 ms, never stored in PostgreSQL)
export interface PeriodoMensualSimulacion {
  mes: number            // 1 .. H*12
  anio: number           // 1 .. H
  trimestre: number      // 1 .. H*4
  etiqueta: string       // e.g., "Mes 1", "Ene Año 1"
  energia_fv_kwh: number
  energia_bess_kwh: number
  energia_total_kwh: number
  ahorro_bruto: number
  costo_om: number
  cuota_financiamiento: number
  flujo_neto: number
  flujo_acumulado: number
  flujo_descontado_acumulado: number
}

export interface PeriodoAgregadoSimulacion {
  periodo: number
  anio: number
  trimestre?: number
  mes?: number
  etiqueta: string
  energia_fv_kwh: number
  energia_bess_kwh: number
  energia_total_kwh: number
  ahorro_bruto: number
  costo_om: number
  cuota_financiamiento: number
  flujo_neto: number
  flujo_acumulado: number
  flujo_descontado_acumulado: number
}

export interface SimulationEvaluationResult {
  status: 'ok'
  fuente_calculo: FuenteCalculo
  capex_total: number
  desembolso_inicial: number
  usa_parametros_base: boolean
  parametros_override_sparse: SimulacionOverrides
  payback_simple_meses: number | null
  payback_simple_anios: number | null
  payback_descontado_meses: number | null
  payback_extendido_anios: number | null
  payback_estado: PaybackEstado
  ahorro_energia_y1_kwh: number
  ahorro_energia_total_kwh: number
  ahorro_monetario_y1: number
  ahorro_monetario_total: number
  flujo_neto_total: number
  roi_pct: number | null
  roi_desembolso_pct: number | null
  tir_pct: number | null
  van: number | null
  serie_mensual: PeriodoMensualSimulacion[]
}

export interface SimulationGatedResult {
  status: 'gated'
  reason: 'missing_financial_figures'
  message: string
}

export interface SimulationInvalidOverrideResult {
  status: 'invalid_override'
  errors: Record<string, string>
}

export type SimulationRunOutcome =
  | SimulationEvaluationResult
  | SimulationGatedResult
  | SimulationInvalidOverrideResult

