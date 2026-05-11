/* eslint-disable */
'use client'

import { useState } from 'react'
import type { PlanTarea, PlanSubtarea, EstadoTarea, PrioridadTarea } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronRight, Circle, Clock, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react'
import SubtaskChecklist from './SubtaskChecklist'

const PRIORIDAD_COLORS: Record<PrioridadTarea, { bg: string; text: string; label: string }> = {
  baja: { bg: '#f0f9ff', text: '#3b82f6', label: 'Baja' },
  media: { bg: '#fffbeb', text: '#f59e0b', label: 'Media' },
  alta: { bg: '#fef2f2', text: '#ef4444', label: 'Alta' },
  critica: { bg: '#fef2f2', text: '#dc2626', label: 'Crítica' },
}

const ESTADO_ICONS: Record<EstadoTarea, React.ReactNode> = {
  pendiente: <Circle size={14} className="text-gray-300" />,
  en_progreso: <Clock size={14} className="text-amber-500" />,
  completado: <CheckCircle2 size={14} className="text-green-500" />,
}

const ESTADO_NEXT: Record<EstadoTarea, EstadoTarea> = {
  pendiente: 'en_progreso',
  en_progreso: 'completado',
  completado: 'pendiente',
}

interface Props {
  tarea: PlanTarea
  readOnly?: boolean
  onUpdate: (tarea: PlanTarea) => void
  onDelete: (id: string) => void
}

export default function TaskItem({ tarea, readOnly, onUpdate, onDelete }: Props) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [subtareas, setSubtareas] = useState<PlanSubtarea[]>(tarea.subtareas || [])
  const [loadedSubtareas, setLoadedSubtareas] = useState(false)

  const pri = PRIORIDAD_COLORS[tarea.prioridad]

  async function toggleEstado() {
    if (readOnly) return
    const next = ESTADO_NEXT[tarea.estado]
    await supabase.from('plan_tareas').update({ estado: next }).eq('id', tarea.id)
    onUpdate({ ...tarea, estado: next })
  }

  async function expand() {
    setExpanded(!expanded)
    if (!loadedSubtareas) {
      const { data } = await supabase
        .from('plan_subtareas')
        .select('*')
        .eq('tarea_id', tarea.id)
        .order('orden')
      if (data) setSubtareas(data as PlanSubtarea[])
      setLoadedSubtareas(true)
    }
  }

  async function handleDelete() {
    await supabase.from('plan_tareas').delete().eq('id', tarea.id)
    onDelete(tarea.id)
  }

  return (
    <div className="group">
      <div className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50/80 transition-colors">
        {/* Expand toggle */}
        <button onClick={expand} className="text-gray-400 hover:text-gray-600 w-4">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Status toggle */}
        <button onClick={toggleEstado} className="flex-shrink-0" title={`Estado: ${tarea.estado}`}>
          {ESTADO_ICONS[tarea.estado]}
        </button>

        {/* Name */}
        <span className={`text-sm flex-1 ${tarea.estado === 'completado' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {tarea.nombre}
        </span>

        {/* Priority badge */}
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: pri.bg, color: pri.text }}
        >
          {pri.label}
        </span>

        {/* Due date */}
        {tarea.fecha_vencimiento && (
          <span className="text-[10px] font-medium text-gray-400">
            {new Date(tarea.fecha_vencimiento).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
          </span>
        )}

        {/* Delete */}
        {!readOnly && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Subtasks */}
      {expanded && (
        <SubtaskChecklist
          subtareas={subtareas}
          tareaId={tarea.id}
          readOnly={readOnly}
          onChange={setSubtareas}
        />
      )}
    </div>
  )
}
