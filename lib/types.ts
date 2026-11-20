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

export type CalculationMode = 'mem_horaria' | 'cfe_tarifario'

export type CalculadoraCampoTipo = 'number' | 'percentage' | 'integer' | 'select' | 'number_array' | 'text' | 'date'
export type CalculadoraCampoGrupo =
  | 'moneda'
  | 'tarifas'
  | 'fv'
  | 'bess'
  | 'macro'
  | 'financiamiento'
  | 'horizontes'
  | 'cliente'
  | 'operacion'
  | 'mercado_tc'
  | 'costos'
  | 'evaluacion_financiera'

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
  definedName?: string | null
}

export interface ExcelOutputMappingSuggestion {
  cellRef: string
  sheetName: string
  label: string
  rawFormula: string
  cachedResult: number | string | null
  suggestedOutputKey: FormulaDefinicion['key'] | null
  suggestedMemOutputKey?: string | null
  confidence: number
  dependencies: string[]
  definedName?: string | null
}

export interface MemWorkbookImportPreview {
  isMemModel: boolean
  detectedSheets: string[]
  definedNamesMatched: number
  extractedInputs: Partial<MemSimulatorInputs>
  extractedInputKeys?: (keyof MemSimulatorInputs)[]
  extractedAssumptions: MemAnnualAssumptions | null
  hourlySummary: {
    datosRows: number
    curvaSolarRows: number
    curvaSolarNonZeroHours: number
    criticalHoursCount: number
    duplicateCriticalHoursCount: number
    totalConsumoMwh: number
    avgPmlMxnMwh: number
    dateStart: string | null
    dateEnd: string | null
    skippedDatosRows?: number
    skippedSolarRows?: number
    invalid100HcRows?: number
    alignmentMismatchCount?: number
  }
  hourlyDataset?: {
    fechas: string[]
    horas: number[]
    consumo_mwh: number[]
    pml_mxn_mwh: number[]
    curva_solar_mw: number[]
    solar_fechas?: string[]
    solar_horas?: number[]
  }
  criticalHours100HC?: MemCriticalHourEntry[]
  cachedExcelKpis?: Record<string, number | string | null>
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
  memWorkbookPreview?: MemWorkbookImportPreview
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

// Strictly the 24 overridable CFE/AST simulation parameters PLUS optional MEM FV+BESS 8,760h+100HC overrides
// stored in simulaciones_ahorro.parametros_override.
export interface SimulacionOverrides {
  // Legacy / CFE scalar keys (v29)
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

  // Rationalized MEM FV + BESS + 100HC keys (Simulador FV + BESS MEM.xlsx)
  modo_motor?: CalculationMode
  cliente?: string
  demanda_contratada_mw?: number
  bess_potencia_mw?: number
  bess_capacidad_mwh?: number
  bess_eficiencia_pct?: number
  bess_soc_min_pct?: number
  op_horas_carga?: number
  op_ini_carga?: number
  op_fin_carga?: number
  op_ini_descarga?: number
  op_fin_descarga?: number
  fv_potencia_mw?: number
  fv_degradacion_anual_pct?: number
  tc_mxn_usd?: number
  tc_fecha?: string
  mbp_precio_mxn_mw_anio?: number
  rap_factor?: number
  capex_bess_usd_kwh?: number
  capex_fv_usd_kwp?: number
  opex_bess_mxn_mwh_anio?: number
  opex_fv_mxn_mw_anio?: number
  fin_horizonte_anios?: number
  fin_tasa_descuento_pct?: number
  fin_esc_opex_pct?: number
  supuestos_anuales?: MemAnnualAssumptions
  critical_hours_100hc?: MemCriticalHourEntry[]
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

// ── MEM FV + BESS + 100HC Two-Stage Simulator Types ─────────────────────────

export interface MemSimulatorInputs {
  // 1. Cliente
  cliente: string
  demanda_contratada_mw: number
  // 2. Batería (BESS)
  bess_potencia_mw: number
  bess_capacidad_mwh: number
  bess_eficiencia_pct: number     // fraction (0..1), e.g. 0.86
  bess_soc_min_pct: number        // fraction (0..0.5), e.g. 0.10
  // 3. Estrategia de operación
  op_horas_carga: number          // integer 0..24
  op_ini_carga: number            // integer 1..24
  op_fin_carga: number            // integer 1..24
  op_ini_descarga: number         // integer 1..24
  op_fin_descarga: number         // integer 1..24
  // 4. Fotovoltaico (FV)
  fv_potencia_mw: number          // >= 0
  fv_degradacion_anual_pct: number // fraction (0..0.05), e.g. 0.005
  // 5. Mercado y tipo de cambio
  tc_mxn_usd: number              // > 0
  tc_fecha: string                // ISO date YYYY-MM-DD
  mbp_precio_mxn_mw_anio: number  // > 0
  rap_factor: number              // > 0
  // 6. Costos: inversión (USD) y operación (MXN)
  capex_bess_usd_kwh: number      // >= 0
  capex_fv_usd_kwp: number        // >= 0
  opex_bess_mxn_mwh_anio: number  // >= 0
  opex_fv_mxn_mw_anio: number     // >= 0
  // 7. Evaluación financiera
  fin_horizonte_anios: number     // integer 1..25
  fin_tasa_descuento_pct: number  // fraction (0..0.5), e.g. 0.12
  fin_esc_opex_pct: number        // fraction (-0.5..1), e.g. 0.035
}

export interface MemAnnualAssumptions {
  // 25 elements per series (index 0 = Año 1 base, indices 1..24 = Años 2..25)
  pct_mbp: number[]
  fijo_mbp: (number | null)[]
  pct_pml: number[]
  deg_bess: number[]
}

export interface MemAnnualAssumptionsRow {
  anio: number
  pct_mbp_captura: number | null
  fijo_mbp_captura: number | null
  precio_mbp_mxn_mw_anio: number
  pct_mbp_efectivo: number | null
  var_mbp_mxn: number | null
  idx_potencia: number
  pct_pml_captura: number | null
  idx_pml: number
  pml_promedio_mxn_mwh: number
  var_pml_mxn: number | null
  deg_bess_captura: number | null
  factor_deg_bess: number
  capacidad_remanente_mwh: number
  perdida_mwh: number | null
}

export interface MemHourlyDataset {
  label: string
  year: number
  fechas: readonly string[]
  horas: readonly number[] | Int32Array
  consumo_mwh: readonly number[] | Float64Array
  pml_mxn_mwh: readonly number[] | Float64Array
  curva_solar_mw: readonly number[] | Float64Array
}

export interface MemCriticalHourEntry {
  no: number
  fecha: string
  hora: number
}

export interface MemCriticalHourEvaluated {
  no: number
  fecha: string
  hora: number
  clave: string
  repetida: boolean
  encontrada: boolean
  demanda_base_mw: number
  demanda_proy_mw: number
}

export interface MemMonthlyEnergySaving {
  mes: number
  etiqueta: string
  costo_base_mxn: number
  costo_proy_mxn: number
  ahorro_energia_mxn: number
  consumo_mwh: number
  gen_fv_mwh: number
  descarga_bess_mwh: number
}

export interface MemHourlyProfilePoint {
  hora: number
  consumo_real_mw: number
  gen_fv_mw: number
  consumo_red_proy_mw: number
  carga_bess_mw: number
  descarga_bess_mw: number
  soc_promedio_mwh: number
}

export interface MemYear1Results {
  bess_duracion_h: number
  // Balance de energía (MWh/año)
  res_consumo_mwh: number
  res_gen_fv_mwh: number
  res_fv_auto_mwh: number
  res_fv_a_bess_mwh: number
  res_fv_perdida_mwh: number
  res_carga_red_mwh: number
  res_descarga_mwh: number
  res_ciclos: number
  res_consumo_red_mwh: number
  // Energía (MXN/año)
  res_costo_e_base_mxn: number
  res_costo_e_proy_mxn: number
  ahorro_e_total_mxn: number
  pml_promedio_mxn_mwh: number
  // Potencia — 100 Horas Críticas
  prom_100hc_base_mw: number
  prom_100hc_proy_mw: number
  res_rap_base_mw: number
  res_rap_proy_mw: number
  res_rap_reduccion_mw: number
  res_costo_c_base_mxn: number
  res_costo_c_proy_mxn: number
  ahorro_c_total_mxn: number
  // Resumen Año 1
  ahorro_total_mxn: number
  res_pct_energia: number
  res_pct_capacidad: number
  res_pct_reduccion: number
  // Charts & tables
  monthly_savings: MemMonthlyEnergySaving[]
  hourly_profile: MemHourlyProfilePoint[]
  critical_hours_rows: MemCriticalHourEvaluated[]
  duplicate_100hc_count: number
  missing_100hc_count: number
}

export interface MemAnnualEvaluationRow {
  anio: number // 0..25
  activo: 0 | 1
  idx_energia: number
  idx_potencia: number
  idx_opex: number
  factor_deg_fv: number
  factor_deg_bess: number
  factor_deg_combinado: number
  ahorro_energia: number
  ahorro_potencia: number
  total_ahorros: number
  capex: number
  opex: number
  cuota_financiamiento: number
  flujo_neto: number
  flujo_acumulado: number
  factor_descuento: number
  flujo_descontado: number
  flujo_descontado_acumulado: number
}

export interface MemFinancialEvaluation {
  moneda: Moneda
  vista_financiamiento: VistaFinanciamiento
  vehiculo_inversion: string
  capex_bess_mxn: number
  capex_fv_mxn: number
  capex_total_mxn: number
  capex_total_usd: number
  capex_total: number
  desembolso_inicial: number
  opex_y1_mxn: number
  opex_y1: number
  peso_fv: number
  vpn: number
  tir_pct: number | null
  payback_simple_anios: number | null
  payback_simple_estado: 'ok' | 'na' | 'fuera_horizonte'
  payback_descontado_anios: number | null
  payback_descontado_estado: 'ok' | 'na' | 'fuera_horizonte'
  roi_pct: number | null
  roi_desembolso_pct: number | null
  flujo_neto_total: number
  ahorro_total_horizonte: number
  ahorro_energia_y1: number
  ahorro_potencia_y1: number
  ahorro_total_y1: number
  rows: MemAnnualEvaluationRow[] // length 26 (years 0..25)
  assumptions_rows: MemAnnualAssumptionsRow[] // length 25 (years 1..25)
  serie_mensual: PeriodoMensualSimulacion[]
}

export interface MemSensitivitySweepConfig {
  duracion_fija_h: number
  potencia_inicial_mw: number
  incremento_mw: number
  num_casos: number // 1..20
}

export interface MemSensitivityCaseResult {
  caso: number | 'Input'
  isCurrentInput: boolean
  bess_potencia_mw: number
  bess_capacidad_mwh: number
  ahorro_energia_y1: number
  ahorro_potencia_y1: number
  ahorro_total_y1: number
  rap_reduccion_mw: number
  ciclos_anio: number
  capex: number
  opex_y1: number
  vpn: number
  tir_pct: number | null
  payback_simple_anios: number | null
  payback_descontado_anios: number | null
}

export interface MemSensitivitySuite {
  config: MemSensitivitySweepConfig
  currentInputCase: MemSensitivityCaseResult
  cases: MemSensitivityCaseResult[]
  bestVpnCaseIndex: number // index inside cases[] or -1
  elapsedMs: number
}

export interface MemFullSimulationResult {
  status: 'ok'
  mode: 'mem_horaria'
  inputs: MemSimulatorInputs
  assumptions: MemAnnualAssumptions
  year1: MemYear1Results
  financial: MemFinancialEvaluation
  validationWarnings: string[]
}

export interface MemInvalidInputResult {
  status: 'invalid_override'
  mode: 'mem_horaria'
  errors: Record<string, string>
}

export type MemSimulationOutcome = MemFullSimulationResult | MemInvalidInputResult | SimulationGatedResult


