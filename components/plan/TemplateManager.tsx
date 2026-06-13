/* eslint-disable */
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlanFase, PlanActividad, PlanPlantilla, PlanPlantillaEstructura, Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { Save, FolderDown, Trash2, FileStack, Loader2, X, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  proyectoId: string
  currentUser: Profile
  fases: PlanFase[]
  actividades: PlanActividad[]
  onApplyTemplate: (estructura: PlanPlantillaEstructura) => Promise<void>
}

export default function TemplateManager({ proyectoId, currentUser, fases, actividades, onApplyTemplate }: Props) {
  const supabase = createClient()
  const [templates, setTemplates] = useState<PlanPlantilla[]>([])
  const [loading, setLoading] = useState(true)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const [confirmingApply, setConfirmingApply] = useState<string | null>(null)

  // Save modal form
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')
  const [saveTipo, setSaveTipo] = useState('')

  // ── Load user's templates ──────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('plan_plantillas')
        .select('*')
        .eq('epcista_id', currentUser.id)
        .order('updated_at', { ascending: false })
      if (data) setTemplates(data as PlanPlantilla[])
      setLoading(false)
    }
    load()
  }, [currentUser.id])

  // ── Serialize current plan → PlanPlantillaEstructura ───────
  const serializePlan = useCallback((): PlanPlantillaEstructura => {
    const sortedFases = [...fases].sort((a, b) => a.orden - b.orden)
    return {
      fases: sortedFases.map(fase => {
        const faseActs = actividades
          .filter(a => a.fase_id === fase.id)
          .sort((a, b) => a.orden - b.orden)
        return {
          nombre: fase.nombre,
          orden: fase.orden,
          color: fase.color || 'var(--color-principal)',
          actividades: faseActs.map(act => ({
            nombre: act.nombre,
            orden: act.orden,
            duracion_dias: act.duracion_dias,
            tareas: [], // Tasks aren't loaded at PlanBuilder level — they get serialized from DB
          })),
        }
      }),
    }
  }, [fases, actividades])

  // ── Save as template ───────────────────────────────────────
  async function handleSave() {
    if (!saveName.trim()) return
    setSaving(true)

    // Fetch tasks and subtasks for full serialization
    const { data: tareas } = await supabase
      .from('plan_tareas')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('orden')
    const { data: subtareas } = await supabase
      .from('plan_subtareas')
      .select('*')
      .order('orden')

    // Build full structure with tasks
    const sortedFases = [...fases].sort((a, b) => a.orden - b.orden)
    const estructura: PlanPlantillaEstructura = {
      fases: sortedFases.map(fase => {
        const faseActs = actividades
          .filter(a => a.fase_id === fase.id)
          .sort((a, b) => a.orden - b.orden)
        return {
          nombre: fase.nombre,
          orden: fase.orden,
          color: fase.color || 'var(--color-principal)',
          actividades: faseActs.map(act => {
            const actTareas = (tareas || [])
              .filter((t: any) => t.actividad_id === act.id)
              .sort((a: any, b: any) => a.orden - b.orden)
            return {
              nombre: act.nombre,
              orden: act.orden,
              duracion_dias: act.duracion_dias,
              tareas: actTareas.map((t: any) => {
                const tSubs = (subtareas || [])
                  .filter((s: any) => s.tarea_id === t.id)
                  .sort((a: any, b: any) => a.orden - b.orden)
                return {
                  nombre: t.nombre,
                  orden: t.orden,
                  prioridad: t.prioridad,
                  subtareas: tSubs.map((s: any) => ({
                    nombre: s.nombre,
                    orden: s.orden,
                  })),
                }
              }),
            }
          }),
        }
      }),
    }

    const { data } = await supabase.from('plan_plantillas').insert({
      epcista_id: currentUser.id,
      nombre: saveName.trim(),
      descripcion: saveDesc || null,
      tipo_proyecto: saveTipo || null,
      estructura,
    }).select().single()

    if (data) {
      setTemplates(prev => [data as PlanPlantilla, ...prev])
    }

    setSaveName('')
    setSaveDesc('')
    setSaveTipo('')
    setShowSaveModal(false)
    setSaving(false)
  }

  // ── Apply template to current project ──────────────────────
  async function handleApply(template: PlanPlantilla) {
    setApplying(template.id)
    await onApplyTemplate(template.estructura)
    setApplying(null)
    setConfirmingApply(null)
    setShowLoadModal(false)
  }

  // ── Delete template ────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    await supabase.from('plan_plantillas').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const canSave = fases.length > 0

  return (
    <>
      {/* Trigger buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowSaveModal(true)}
          disabled={!canSave}
          title={canSave ? 'Guardar plan como plantilla' : 'Agrega fases al plan primero'}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-principal bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save size={12} /> Guardar plantilla
        </button>
        <button
          onClick={() => setShowLoadModal(true)}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-principal bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-all"
        >
          <FolderDown size={12} /> Cargar plantilla
        </button>
      </div>

      {/* ── Save Modal ────────────────────────────────────── */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileStack size={16} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-principal leading-none mb-0.5">Guardar como Plantilla</h2>
                  <p className="text-[11px] text-gray-500">
                    {fases.length} fases · {actividades.length} actividades
                  </p>
                </div>
              </div>
              <button onClick={() => setShowSaveModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Nombre de la plantilla *</label>
                <input type="text" value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder='Ej: "Instalación Solar Residencial"'
                  autoFocus
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-acento focus:ring-2 focus:ring-acento/30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Tipo de proyecto</label>
                <input type="text" value={saveTipo}
                  onChange={e => setSaveTipo(e.target.value)}
                  placeholder='Ej: "Residencial", "Comercial", "Industrial"'
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-acento focus:ring-2 focus:ring-acento/30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Descripción</label>
                <textarea value={saveDesc} rows={2}
                  onChange={e => setSaveDesc(e.target.value)}
                  placeholder="Descripción breve..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-acento focus:ring-2 focus:ring-acento/30" />
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSaveModal(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !saveName.trim()}>
                {saving ? 'Guardando...' : 'Guardar Plantilla'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Load Modal ────────────────────────────────────── */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <FolderDown size={16} className="text-purple-600" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-principal leading-none mb-0.5">Mis Plantillas</h2>
                  <p className="text-[11px] text-gray-500">{templates.length} plantillas guardadas</p>
                </div>
              </div>
              <button onClick={() => setShowLoadModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 max-h-[50vh] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileStack size={28} className="text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Sin plantillas</p>
                  <p className="text-xs text-gray-400 mt-1">Guarda tu plan actual como plantilla para reutilizarlo.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(t => {
                    const est = t.estructura as PlanPlantillaEstructura
                    const numFases = est.fases?.length || 0
                    const numActs = est.fases?.reduce((s, f) => s + (f.actividades?.length || 0), 0) || 0
                    const isApplying = applying === t.id
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group bg-white">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 truncate">{t.nombre}</h4>
                          <p className="text-[11px] text-gray-500">
                            {numFases} fases · {numActs} actividades
                            {t.tipo_proyecto && <> · <span className="text-blue-500">{t.tipo_proyecto}</span></>}
                          </p>
                          {t.descripcion && (
                            <p className="text-[10px] text-gray-400 truncate mt-0.5">{t.descripcion}</p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {confirmingApply === t.id ? (
                            <>
                              <button
                                onClick={() => handleApply(t)}
                                disabled={isApplying}
                                className="flex items-center gap-1 text-xs font-bold text-white bg-principal px-3 py-1.5 rounded-md hover:bg-gray-900 transition-colors disabled:opacity-50"
                              >
                                {isApplying ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Confirmar
                              </button>
                              <button
                                onClick={() => setConfirmingApply(null)}
                                disabled={isApplying}
                                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmingApply(t.id)}
                              className="flex items-center gap-1 text-xs font-bold text-white bg-principal px-3 py-1.5 rounded-md hover:bg-gray-900 transition-colors"
                            >
                              <Plus size={12} />
                              Aplicar
                            </button>
                          )}
                          {!confirmingApply && (
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="text-gray-400 hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <Button variant="outline" onClick={() => setShowLoadModal(false)}>Cerrar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
