 
'use client'

import { useState } from 'react'
import type { PlanSubtarea } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, GripVertical } from 'lucide-react'

interface Props {
  subtareas: PlanSubtarea[]
  tareaId: string
  readOnly?: boolean
  onChange: (subtareas: PlanSubtarea[]) => void
}

export default function SubtaskChecklist({ subtareas, tareaId, readOnly, onChange }: Props) {
  const supabase = createClient()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const sorted = [...subtareas].sort((a, b) => a.orden - b.orden)
  const completed = sorted.filter(s => s.completado).length
  const pct = sorted.length > 0 ? Math.round((completed / sorted.length) * 100) : 0

  async function toggleSubtask(id: string, completado: boolean) {
    await supabase.from('plan_subtareas').update({ completado }).eq('id', id)
    onChange(subtareas.map(s => s.id === id ? { ...s, completado } : s))
  }

  async function addSubtask() {
    if (!newName.trim()) return
    const { data } = await supabase.from('plan_subtareas').insert({
      tarea_id: tareaId,
      nombre: newName.trim(),
      orden: sorted.length,
    }).select().single()
    if (data) {
      onChange([...subtareas, data as PlanSubtarea])
      setNewName('')
    }
  }

  async function deleteSubtask(id: string) {
    await supabase.from('plan_subtareas').delete().eq('id', id)
    onChange(subtareas.filter(s => s.id !== id))
  }

  return (
    <div className="ml-6 mt-2">
      {sorted.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10B981' : '#D7FF2F' }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-400">{pct}%</span>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {sorted.map(s => (
          <div key={s.id} className="flex items-center gap-2 group py-0.5">
            {!readOnly && (
              <GripVertical size={10} className="text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab" />
            )}
            <label className="flex items-center gap-2 flex-1 cursor-pointer">
              <input
                type="checkbox"
                checked={s.completado}
                onChange={e => !readOnly && toggleSubtask(s.id, e.target.checked)}
                disabled={readOnly}
                className="w-3.5 h-3.5 rounded border-gray-300 text-principal focus:ring-acento/30"
              />
              <span className={`text-xs ${s.completado ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {s.nombre}
              </span>
            </label>
            {!readOnly && (
              <button
                onClick={() => deleteSubtask(s.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        adding ? (
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSubtask(); if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
              placeholder="Nueva subtarea..."
              autoFocus
              className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 focus:border-acento focus:ring-1 focus:ring-acento/30"
            />
            <button onClick={addSubtask} className="text-xs font-bold text-principal hover:text-acento transition-colors">
              Agregar
            </button>
            <button onClick={() => { setAdding(false); setNewName('') }} className="text-xs text-gray-400 hover:text-gray-600">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-principal transition-colors mt-1"
          >
            <Plus size={11} /> Agregar subtarea
          </button>
        )
      )}
    </div>
  )
}
