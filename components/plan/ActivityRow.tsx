/* eslint-disable */
'use client'

import { useState } from 'react'
import type { PlanActividad, PlanTarea, PlanSubtarea, EstadoPlan, Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronRight, Plus, Trash2, Link2, User } from 'lucide-react'
import TaskItem from './TaskItem'

const ESTADO_COLORS: Record<EstadoPlan, string> = {
  pendiente: '#9CA3AF',
  en_progreso: '#F59E0B',
  completado: '#10B981',
  retrasado: '#EF4444',
}

interface Props {
  actividad: PlanActividad
  allActividades: PlanActividad[]
  readOnly?: boolean
  onUpdate: (actividad: PlanActividad) => void
  onDelete: (id: string) => void
}

export default function ActivityRow({ actividad, allActividades, readOnly, onUpdate, onDelete }: Props) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [tareas, setTareas] = useState<PlanTarea[]>([])
  const [loadedTareas, setLoadedTareas] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    nombre: actividad.nombre,
    duracion_dias: actividad.duracion_dias?.toString() || '',
    dependencia_id: actividad.dependencia_id || '',
    fecha_inicio_estimada: actividad.fecha_inicio_estimada || '',
    fecha_fin_estimada: actividad.fecha_fin_estimada || '',
  })

  const depName = actividad.dependencia_id
    ? allActividades.find(a => a.id === actividad.dependencia_id)?.nombre
    : null

  async function expand() {
    setExpanded(!expanded)
    if (!loadedTareas) {
      const { data } = await supabase
        .from('plan_tareas')
        .select('*, plan_subtareas(*)')
        .eq('actividad_id', actividad.id)
        .order('orden')
      if (data) setTareas(data.map((t: any) => ({ ...t, subtareas: t.plan_subtareas || [] })) as PlanTarea[])
      setLoadedTareas(true)
    }
  }

  async function addTask() {
    if (!newTaskName.trim()) return
    const { data } = await supabase.from('plan_tareas').insert({
      actividad_id: actividad.id,
      proyecto_id: actividad.proyecto_id,
      nombre: newTaskName.trim(),
      orden: tareas.length,
    }).select().single()
    if (data) {
      setTareas([...tareas, { ...data, subtareas: [] } as PlanTarea])
      setNewTaskName('')
      setAddingTask(false)
    }
  }

  async function saveEdit() {
    const updates: Partial<PlanActividad> = {
      nombre: editForm.nombre,
      duracion_dias: editForm.duracion_dias ? parseInt(editForm.duracion_dias) : null,
      dependencia_id: editForm.dependencia_id || null,
      fecha_inicio_estimada: editForm.fecha_inicio_estimada || null,
      fecha_fin_estimada: editForm.fecha_fin_estimada || null,
    }
    const { data } = await supabase.from('plan_actividades').update(updates).eq('id', actividad.id).select().single()
    if (data) onUpdate(data as PlanActividad)
    setEditing(false)
  }

  async function deleteActivity() {
    await supabase.from('plan_actividades').delete().eq('id', actividad.id)
    onDelete(actividad.id)
  }

  function updateTarea(updated: PlanTarea) {
    setTareas(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  function deleteTarea(id: string) {
    setTareas(prev => prev.filter(t => t.id !== id))
  }

  const pct = actividad.porcentaje_completado || 0

  return (
    <div className="border border-gray-100 rounded-lg mb-1.5 overflow-hidden bg-white">
      {/* Activity header */}
      <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50/60 transition-colors group">
        <button onClick={expand} className="text-gray-400 hover:text-gray-600 w-4 flex-shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Status dot */}
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ESTADO_COLORS[actividad.estado] }} />

        {/* Name */}
        {editing ? (
          <input
            type="text"
            value={editForm.nombre}
            onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
            className="text-sm font-medium flex-1 border border-gray-200 rounded px-2 py-0.5 focus:border-acento focus:ring-1 focus:ring-acento/30"
            autoFocus
          />
        ) : (
          <span
            className="text-sm font-medium text-gray-800 flex-1 cursor-pointer"
            onDoubleClick={() => !readOnly && setEditing(true)}
          >
            {actividad.nombre}
          </span>
        )}

        {/* Dependency badge */}
        {depName && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
            <Link2 size={9} /> {depName}
          </span>
        )}

        {/* Duration */}
        {actividad.duracion_dias && (
          <span className="text-[10px] font-medium text-gray-400">
            {actividad.duracion_dias}d
          </span>
        )}

        {/* Progress mini-bar */}
        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: ESTADO_COLORS[actividad.estado] }}
          />
        </div>
        <span className="text-[10px] font-bold text-gray-400 w-8 text-right">{Math.round(pct)}%</span>

        {/* Date range */}
        {actividad.fecha_inicio_estimada && (
          <span className="text-[10px] text-gray-400 hidden sm:block">
            {new Date(actividad.fecha_inicio_estimada).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
            {actividad.fecha_fin_estimada && (
              <> — {new Date(actividad.fecha_fin_estimada).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</>
            )}
          </span>
        )}

        {/* Actions */}
        {!readOnly && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button onClick={deleteActivity} className="text-gray-400 hover:text-red-500">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && !readOnly && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Duración (días)</label>
              <input type="number" min="1" value={editForm.duracion_dias}
                onChange={e => setEditForm(f => ({ ...f, duracion_dias: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 mt-0.5" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Depende de</label>
              <select value={editForm.dependencia_id}
                onChange={e => setEditForm(f => ({ ...f, dependencia_id: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 mt-0.5">
                <option value="">Sin dependencia</option>
                {allActividades.filter(a => a.id !== actividad.id).map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Inicio estimado</label>
              <input type="date" value={editForm.fecha_inicio_estimada}
                onChange={e => setEditForm(f => ({ ...f, fecha_inicio_estimada: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 mt-0.5" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Fin estimado</label>
              <input type="date" value={editForm.fecha_fin_estimada}
                onChange={e => setEditForm(f => ({ ...f, fecha_fin_estimada: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 mt-0.5" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
            <button onClick={saveEdit} className="text-xs font-bold bg-principal text-acento px-3 py-1 rounded-md">Guardar</button>
          </div>
        </div>
      )}

      {/* Tasks */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-50">
          <div className="pl-4 mt-2">
            {tareas.map(t => (
              <TaskItem
                key={t.id}
                tarea={t}
                readOnly={readOnly}
                onUpdate={updateTarea}
                onDelete={deleteTarea}
              />
            ))}

            {/* Add task */}
            {!readOnly && (
              addingTask ? (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newTaskName}
                    onChange={e => setNewTaskName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') { setAddingTask(false); setNewTaskName('') } }}
                    placeholder="Nombre de la tarea..."
                    autoFocus
                    className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:border-acento focus:ring-1 focus:ring-acento/30"
                  />
                  <button onClick={addTask} className="text-xs font-bold text-principal">Agregar</button>
                  <button onClick={() => { setAddingTask(false); setNewTaskName('') }} className="text-xs text-gray-400">Cancelar</button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTask(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-principal transition-colors mt-2 py-1"
                >
                  <Plus size={12} /> Agregar tarea
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
