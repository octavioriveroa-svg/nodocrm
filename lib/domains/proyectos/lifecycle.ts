import type { EstadoProyecto, ModalidadFinanciamiento, Proyecto } from '@/lib/types'

export const STAGE_ORDER: readonly EstadoProyecto[] & readonly string[] = [
  'recibido',
  'en_analisis',
  'propuesta_lista',
  'enviada',
  'cliente_interesado',
  'negociacion',
  'aprobado',
  'en_construccion',
  'operativo',
  'completado',
] as const

export const TERMINAL_STAGES: readonly EstadoProyecto[] & readonly string[] = [
  'aprobado',
  'en_construccion',
  'operativo',
  'completado',
] as const

export const ESTADO_LABELS: Record<EstadoProyecto, string> & Record<string, string> = {
  recibido: 'Lead',
  en_analisis: 'En análisis',
  propuesta_lista: 'Propuesta lista',
  enviada: 'Propuesta enviada',
  cliente_interesado: 'Cliente interesado',
  negociacion: 'Negociación',
  aprobado: 'Cierre',
  en_construccion: 'En construcción',
  operativo: 'Operativo',
  completado: 'Completado',
}

export const SALES_CYCLE: readonly { key: EstadoProyecto; label: string }[] = [
  { key: 'recibido', label: 'Lead' },
  { key: 'en_analisis', label: 'Análisis' },
  { key: 'propuesta_lista', label: 'Propuesta' },
  { key: 'enviada', label: 'Enviada' },
  { key: 'cliente_interesado', label: 'Interesado' },
  { key: 'negociacion', label: 'Negociación' },
  { key: 'aprobado', label: 'Cierre' },
  { key: 'en_construccion', label: 'Construcción' },
  { key: 'operativo', label: 'Operativo' },
  { key: 'completado', label: 'Completado' },
] as const

export const MODALIDAD_LABELS: Record<ModalidadFinanciamiento, string> = {
  credito: 'Crédito',
  arrendamiento: 'Arrendamiento',
  ensaas: 'EnSaaS',
  mem: 'Mercado Eléctrico Mayorista',
  no_sabe: 'Analista define modalidad',
}

export function isStageApprovalOrBeyond(estado: EstadoProyecto | string): boolean {
  return (TERMINAL_STAGES as readonly string[]).includes(estado)
}

export function validateStageTransition(
  _proyecto: Proyecto,
  targetStage: EstadoProyecto,
  configs: { seleccionada?: boolean }[],
  financingOptions: { seleccionada?: boolean }[]
): { valid: boolean; error?: string } {
  if (isStageApprovalOrBeyond(targetStage)) {
    const hasSelectedConfig = configs.some((c) => c.seleccionada)
    const hasSelectedFin = financingOptions.some((o) => o.seleccionada)
    if (!hasSelectedConfig || !hasSelectedFin) {
      return {
        valid: false,
        error:
          'Se deben seleccionar una configuración técnica ganadora Y una opción de financiamiento ganadora antes de aprobar el proyecto o avanzar en el pipeline.',
      }
    }
  }
  return { valid: true }
}

export function calculateNextHistorialEstados(
  prevHistorial: Record<string, string> | undefined | null,
  targetStage: EstadoProyecto,
  timestamp?: string
): Record<string, string> {
  return {
    ...(prevHistorial ?? {}),
    [targetStage]: timestamp || new Date().toISOString(),
  }
}

export function getStageTransitionPayload(
  targetStage: EstadoProyecto,
  prevHistorial?: Record<string, string> | null
): { estado: EstadoProyecto; historial_estados: Record<string, string>; plan_bloqueado?: boolean } {
  const historial_estados = calculateNextHistorialEstados(prevHistorial, targetStage)
  const payload: {
    estado: EstadoProyecto
    historial_estados: Record<string, string>
    plan_bloqueado?: boolean
  } = {
    estado: targetStage,
    historial_estados,
  }
  if (targetStage === 'en_construccion') {
    payload.plan_bloqueado = true
  }
  return payload
}
