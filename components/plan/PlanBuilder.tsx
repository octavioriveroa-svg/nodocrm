/* eslint-disable */
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlanFase, PlanActividad, HitoFinanciero, Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { recalcPhaseDates, recalcPhaseProgress } from '@/lib/cascade-scheduler'
import PhaseCard from './PhaseCard'
import { Plus, LayoutList, BarChart3, DollarSign, Save, Loader2 } from 'lucide-react'

// ── Colors palette for new phases ─────────────────────────────
const PHASE_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#4F46E5', '#BE185D']

interface Props {
  proyectoId: string
  currentUser: Profile
  readOnly?: boolean
}

type ViewMode = 'tree' | 'gantt' | 'financial'

export default function PlanBuilder({ proyectoId, currentUser, readOnly = false }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [fases, setFases] = useState<PlanFase[]>([])
  const [actividades, setActividades] = useState<PlanActividad[]>([])
  const [hitosFinancieros, setHitosFinancieros] = useState<HitoFinanciero[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [addingPhase, setAddingPhase] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [addingActivity, setAddingActivity] = useState<string | null>(null)
  const [newActivityName, setNewActivityName] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Load data ───────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [
        { data: fasesData },
        { data: actData },
        { data: hitosData },
      ] = await Promise.all([
        supabase.from('plan_fases').select('*').eq('proyecto_id', proyectoId).order('orden'),
        supabase.from('plan_actividades').select('*').eq('proyecto_id', proyectoId).order('orden'),
        supabase.from('hitos_financieros').select('*').eq('proyecto_id', proyectoId).order('orden'),
      ])
      if (fasesData) setFases(fasesData as PlanFase[])
      if (actData) setActividades(actData as PlanActividad[])
      if (hitosData) setHitosFinancieros(hitosData as HitoFinanciero[])
      setLoading(false)
    }
    load()
  }, [proyectoId])

  // ── Phase CRUD ──────────────────────────────────────────────
  async function addPhase() {
    if (!newPhaseName.trim()) return
    const color = PHASE_COLORS[fases.length % PHASE_COLORS.length]
    const { data } = await supabase.from('plan_fases').insert({
      proyecto_id: proyectoId,
      nombre: newPhaseName.trim(),
      orden: fases.length,
      color,
    }).select().single()
    if (data) {
      setFases(prev => [...prev, data as PlanFase])
      setNewPhaseName('')
      setAddingPhase(false)
    }
  }

  function updateFase(updated: PlanFase) {
    setFases(prev => prev.map(f => f.id === updated.id ? updated : f))
  }

  function deleteFase(id: string) {
    setFases(prev => prev.filter(f => f.id !== id))
    setActividades(prev => prev.filter(a => a.fase_id !== id))
  }

  // ── Activity CRUD ───────────────────────────────────────────
  async function addActivity(faseId: string) {
    setAddingActivity(faseId)
    setNewActivityName('')
  }

  async function confirmAddActivity() {
    if (!addingActivity || !newActivityName.trim()) return
    const faseActividades = actividades.filter(a => a.fase_id === addingActivity)
    const { data } = await supabase.from('plan_actividades').insert({
      fase_id: addingActivity,
      proyecto_id: proyectoId,
      nombre: newActivityName.trim(),
      orden: faseActividades.length,
    }).select().single()
    if (data) {
      setActividades(prev => [...prev, data as PlanActividad])
      setNewActivityName('')
      setAddingActivity(null)
    }
  }

  function updateActividad(updated: PlanActividad) {
    setActividades(prev => prev.map(a => a.id === updated.id ? updated : a))
    // Recalculate phase progress & dates
    const faseId = updated.fase_id
    const faseActividades = actividades.map(a => a.id === updated.id ? updated : a).filter(a => a.fase_id === faseId)
    const newProgress = recalcPhaseProgress(faseActividades, faseId)
    const newDates = recalcPhaseDates(faseActividades, faseId)
    supabase.from('plan_fases').update({
      porcentaje_completado: newProgress,
      ...newDates,
    }).eq('id', faseId).then(() => {
      setFases(prev => prev.map(f => f.id === faseId ? { ...f, porcentaje_completado: newProgress, ...newDates } : f))
    })
  }

  function deleteActividad(id: string) {
    setActividades(prev => prev.filter(a => a.id !== id))
  }

  // ── Render ──────────────────────────────────────────────────
  const sortedFases = [...fases].sort((a, b) => a.orden - b.orden)

  // Stats
  const totalActividades = actividades.length
  const completedActividades = actividades.filter(a => a.estado === 'completado').length
  const overallPct = totalActividades > 0 ? Math.round((completedActividades / totalActividades) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-principal">Plan de Proyecto EPC</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {fases.length} fases · {totalActividades} actividades · {overallPct}% completado
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('tree')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === 'tree' ? 'bg-white shadow-sm text-principal' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutList size={13} /> Plan
          </button>
          <button
            onClick={() => setViewMode('gantt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === 'gantt' ? 'bg-white shadow-sm text-principal' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 size={13} /> Gantt
          </button>
          <button
            onClick={() => setViewMode('financial')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === 'financial' ? 'bg-white shadow-sm text-principal' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <DollarSign size={13} /> Financiero
          </button>
        </div>
      </div>

      {/* Overall progress */}
      <div className="mb-6">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${overallPct}%`,
              background: overallPct === 100
                ? '#10B981'
                : 'linear-gradient(90deg, #D7FF2F, #000)',
            }}
          />
        </div>
      </div>

      {/* Tree View */}
      {viewMode === 'tree' && (
        <div>
          {sortedFases.length === 0 && !addingPhase && (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
              <LayoutList size={32} className="text-gray-300 mb-4" />
              <h3 className="text-sm font-bold text-gray-500 mb-2">Sin plan de proyecto</h3>
              <p className="text-xs text-gray-400 mb-4 text-center max-w-xs">
                Comienza creando fases para organizar las actividades de ingeniería, procurement y construcción.
              </p>
              {!readOnly && (
                <button
                  onClick={() => setAddingPhase(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-principal text-acento rounded-lg hover:bg-gray-900 transition-colors"
                >
                  <Plus size={14} /> Crear primera fase
                </button>
              )}
            </div>
          )}

          {sortedFases.map(fase => (
            <PhaseCard
              key={fase.id}
              fase={fase}
              actividades={actividades.filter(a => a.fase_id === fase.id)}
              allActividades={actividades}
              hitosFinancieros={hitosFinancieros}
              readOnly={readOnly}
              onUpdateFase={updateFase}
              onDeleteFase={deleteFase}
              onUpdateActividad={updateActividad}
              onDeleteActividad={deleteActividad}
              onAddActividad={addActivity}
            />
          ))}

          {/* Add activity inline prompt */}
          {addingActivity && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-2xl">
                <h3 className="text-sm font-bold mb-3">Nueva actividad</h3>
                <input
                  type="text"
                  value={newActivityName}
                  onChange={e => setNewActivityName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmAddActivity(); if (e.key === 'Escape') setAddingActivity(null) }}
                  placeholder="Nombre de la actividad..."
                  autoFocus
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:border-acento focus:ring-2 focus:ring-acento/30"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setAddingActivity(null)} className="text-xs text-gray-500 px-3 py-1.5">Cancelar</button>
                  <button onClick={confirmAddActivity} className="text-xs font-bold bg-principal text-acento px-4 py-1.5 rounded-md">Agregar</button>
                </div>
              </div>
            </div>
          )}

          {/* Add phase */}
          {!readOnly && sortedFases.length > 0 && (
            addingPhase ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={newPhaseName}
                  onChange={e => setNewPhaseName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addPhase(); if (e.key === 'Escape') { setAddingPhase(false); setNewPhaseName('') } }}
                  placeholder="Nombre de la fase..."
                  autoFocus
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-acento focus:ring-2 focus:ring-acento/30"
                />
                <button onClick={addPhase} className="text-sm font-bold bg-principal text-acento px-4 py-2 rounded-lg">Crear</button>
                <button onClick={() => { setAddingPhase(false); setNewPhaseName('') }} className="text-sm text-gray-400 px-3 py-2">Cancelar</button>
              </div>
            ) : (
              <button
                onClick={() => setAddingPhase(true)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-principal transition-colors w-full justify-center py-3 border border-dashed border-gray-200 rounded-xl mt-2 hover:border-gray-400"
              >
                <Plus size={14} /> Agregar fase
              </button>
            )
          )}
        </div>
      )}

      {/* Gantt View — placeholder for Phase 3 */}
      {viewMode === 'gantt' && (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          <BarChart3 size={32} className="text-gray-300 mb-4" />
          <h3 className="text-sm font-bold text-gray-500 mb-1">Gantt en construcción</h3>
          <p className="text-xs text-gray-400">El diagrama de Gantt interactivo estará disponible pronto.</p>
        </div>
      )}

      {/* Financial View — placeholder for Phase 4 */}
      {viewMode === 'financial' && (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          <DollarSign size={32} className="text-gray-300 mb-4" />
          <h3 className="text-sm font-bold text-gray-500 mb-1">Hitos financieros en construcción</h3>
          <p className="text-xs text-gray-400">El tracker de desembolsos estará disponible pronto.</p>
        </div>
      )}
    </div>
  )
}
