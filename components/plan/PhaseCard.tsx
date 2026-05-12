/* eslint-disable */
'use client'

import { useState } from 'react'
import type { PlanFase, PlanActividad, EstadoPlan, HitoFinanciero, Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, DollarSign, Calendar } from 'lucide-react'
import ActivityRow from './ActivityRow'
import CommentThread from './CommentThread'

const ESTADO_LABELS: Record<EstadoPlan, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completado: 'Completado',
  retrasado: 'Retrasado',
}

interface Props {
  fase: PlanFase
  actividades: PlanActividad[]
  allActividades: PlanActividad[]
  hitosFinancieros: HitoFinanciero[]
  readOnly?: boolean
  currentUser: Profile
  proyectoId: string
  commentCounts: Record<string, number>
  onUpdateFase: (fase: PlanFase) => void
  onDeleteFase: (id: string) => void
  onUpdateActividad: (actividad: PlanActividad) => void
  onDeleteActividad: (id: string) => void
  onAddActividad: (faseId: string) => void
}

export default function PhaseCard({
  fase, actividades, allActividades, hitosFinancieros,
  readOnly, currentUser, proyectoId, commentCounts,
  onUpdateFase, onDeleteFase, onUpdateActividad, onDeleteActividad, onAddActividad,
}: Props) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    nombre: fase.nombre,
    descripcion: fase.descripcion || '',
    color: fase.color,
    fecha_inicio_estimada: fase.fecha_inicio_estimada || '',
    fecha_fin_estimada: fase.fecha_fin_estimada || '',
  })

  const pct = fase.porcentaje_completado || 0
  const linkedHitos = hitosFinancieros.filter(h => h.fase_id === fase.id)

  async function saveEdit() {
    const { data } = await supabase.from('plan_fases').update({
      nombre: editForm.nombre,
      descripcion: editForm.descripcion || null,
      color: editForm.color,
      fecha_inicio_estimada: editForm.fecha_inicio_estimada || null,
      fecha_fin_estimada: editForm.fecha_fin_estimada || null,
    }).eq('id', fase.id).select().single()
    if (data) onUpdateFase(data as PlanFase)
    setEditing(false)
  }

  async function deleteFase() {
    if (!confirm(`¿Eliminar la fase "${fase.nombre}" y todas sus actividades?`)) return
    await supabase.from('plan_fases').delete().eq('id', fase.id)
    onDeleteFase(fase.id)
  }

  const sorted = [...actividades].sort((a, b) => a.orden - b.orden)

  return (
    <div className="rounded-xl border overflow-hidden shadow-sm mb-4 transition-shadow hover:shadow-md"
      style={{ borderColor: fase.color + '30' }}>

      {/* Phase header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer group"
        style={{ background: `linear-gradient(135deg, ${fase.color}08, ${fase.color}15)` }}
      >
        <button onClick={() => setExpanded(!expanded)} className="flex-shrink-0">
          {expanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
        </button>

        {/* Color dot */}
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fase.color }} />

        {/* Name */}
        <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
          <h3 className="text-sm font-bold text-gray-900 truncate">{fase.nombre}</h3>
          {fase.descripcion && <p className="text-[11px] text-gray-500 truncate">{fase.descripcion}</p>}
        </div>

        {/* Financial badges */}
        {linkedHitos.length > 0 && (
          <div className="flex items-center gap-1">
            <DollarSign size={11} className="text-green-600" />
            <span className="text-[10px] font-bold text-green-700">{linkedHitos.length}</span>
          </div>
        )}

        {/* Date range */}
        {fase.fecha_inicio_estimada && (
          <span className="text-[10px] text-gray-400 hidden sm:flex items-center gap-1">
            <Calendar size={10} />
            {new Date(fase.fecha_inicio_estimada).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
            {fase.fecha_fin_estimada && (
              <> — {new Date(fase.fecha_fin_estimada).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</>
            )}
          </span>
        )}

        {/* Progress */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-20 h-2 bg-gray-200/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                backgroundColor: pct === 100 ? '#10B981' : fase.color,
              }}
            />
          </div>
          <span className="text-xs font-bold text-gray-500 w-10 text-right">{Math.round(pct)}%</span>
        </div>

        {/* Comment thread */}
        <CommentThread
          proyectoId={proyectoId}
          targetType="fase"
          targetId={fase.id}
          currentUser={currentUser}
          commentCount={commentCounts[fase.id] || 0}
        />

        {/* Actions */}
        {!readOnly && (
          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all ml-1">
            <button onClick={e => { e.stopPropagation(); setEditing(!editing) }} className="text-gray-400 hover:text-gray-700">
              <Pencil size={12} />
            </button>
            <button onClick={e => { e.stopPropagation(); deleteFase() }} className="text-gray-400 hover:text-red-500">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && !readOnly && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre de la fase</label>
              <input type="text" value={editForm.nombre}
                onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 mt-0.5 focus:border-acento focus:ring-1 focus:ring-acento/30" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Descripción</label>
              <textarea value={editForm.descripcion} rows={2}
                onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 mt-0.5 focus:border-acento focus:ring-1 focus:ring-acento/30" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Color</label>
              <input type="color" value={editForm.color}
                onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                className="w-full h-8 border border-gray-200 rounded mt-0.5 cursor-pointer" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Inicio estimado</label>
              <input type="date" value={editForm.fecha_inicio_estimada}
                onChange={e => setEditForm(f => ({ ...f, fecha_inicio_estimada: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 mt-0.5" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Fin estimado</label>
              <input type="date" value={editForm.fecha_fin_estimada}
                onChange={e => setEditForm(f => ({ ...f, fecha_fin_estimada: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 mt-0.5" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
            <button onClick={saveEdit} className="text-xs font-bold bg-principal text-acento px-3 py-1.5 rounded-md">Guardar</button>
          </div>
        </div>
      )}

      {/* Activities */}
      {expanded && (
        <div className="px-3 py-2 bg-white/60">
          {sorted.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Sin actividades aún.</p>
          )}

          {sorted.map(act => (
            <ActivityRow
              key={act.id}
              actividad={act}
              allActividades={allActividades}
              readOnly={readOnly}
              currentUser={currentUser}
              proyectoId={proyectoId}
              commentCounts={commentCounts}
              onUpdate={onUpdateActividad}
              onDelete={onDeleteActividad}
            />
          ))}

          {/* Add activity button */}
          {!readOnly && (
            <button
              onClick={() => onAddActividad(fase.id)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-principal transition-colors w-full justify-center py-2 border border-dashed border-gray-200 rounded-lg mt-1 hover:border-gray-400"
            >
              <Plus size={12} /> Agregar actividad
            </button>
          )}
        </div>
      )}
    </div>
  )
}
