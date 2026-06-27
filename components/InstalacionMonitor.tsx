'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  ChevronDown, ChevronRight, Camera, FileText, StickyNote, 
  Trash2, Eye, User, Sparkles,
  BarChart2, List, Grid, Maximize2, X
} from 'lucide-react'
import type { 
  Profile, PlanFase, PlanActividad, PlanTarea, 
  InstalacionEvidencia 
} from '@/lib/types'
import EvidenciaModal from './EvidenciaModal'
import CommentThread from './plan/CommentThread'

interface InstalacionMonitorProps {
  proyectoId: string
  currentUser: Profile
  readOnly?: boolean
}

interface GroupedEvidencias {
  fases: Record<string, InstalacionEvidencia[]>
  actividades: Record<string, InstalacionEvidencia[]>
  tareas: Record<string, InstalacionEvidencia[]>
}

export default function InstalacionMonitor({
  proyectoId,
  currentUser,
  readOnly = false
}: InstalacionMonitorProps) {
  const supabase = createClient()
  
  // States
  const [fases, setFases] = useState<PlanFase[]>([])
  const [actividades, setActividades] = useState<PlanActividad[]>([])
  const [tareas, setTareas] = useState<PlanTarea[]>([])
  const [evidencias, setEvidencias] = useState<InstalacionEvidencia[]>([])
  
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'plan' | 'galeria'>('plan')
  const [expandedFases, setExpandedFases] = useState<Record<string, boolean>>({})
  const [expandedActividades, setExpandedActividades] = useState<Record<string, boolean>>({})
  
  // Upload modal state
  const [uploadTarget, setUploadTarget] = useState<{
    type: 'fase' | 'actividad' | 'tarea'
    id: string
    name: string
  } | null>(null)

  // Lightbox state
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null)

  // Helper to format dates
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  // Load project data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch phases
      const { data: phasesData } = await supabase
        .from('plan_fases')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('orden', { ascending: true })

      // 2. Fetch activities
      const { data: activitiesData } = await supabase
        .from('plan_actividades')
        .select('*, profiles(nombre)')
        .eq('proyecto_id', proyectoId)
        .order('orden', { ascending: true })

      // 3. Fetch tasks
      const { data: tasksData } = await supabase
        .from('plan_tareas')
        .select('*, profiles(nombre)')
        .eq('proyecto_id', proyectoId)
        .order('orden', { ascending: true })

      // 4. Fetch evidences
      const { data: evidencesData } = await supabase
        .from('instalacion_evidencias')
        .select('*, autor:profiles(nombre, rol, empresa)')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false })

      if (phasesData) setFases(phasesData)
      if (activitiesData) setActividades(activitiesData)
      if (tasksData) setTareas(tasksData)
      if (evidencesData) setEvidencias(evidencesData as InstalacionEvidencia[])

      // Auto-expand first phase
      if (phasesData && phasesData.length > 0) {
        setExpandedFases(prev => ({ ...prev, [phasesData[0].id]: true }))
      }
    } catch (err) {
      console.error('Error fetching installation monitor data:', err)
    } finally {
      setLoading(false)
    }
  }, [proyectoId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Group evidences by entity IDs
  const groupedEvidencias: GroupedEvidencias = {
    fases: {},
    actividades: {},
    tareas: {}
  }

  evidencias.forEach(ev => {
    if (ev.fase_id) {
      if (!groupedEvidencias.fases[ev.fase_id]) groupedEvidencias.fases[ev.fase_id] = []
      groupedEvidencias.fases[ev.fase_id].push(ev)
    } else if (ev.actividad_id) {
      if (!groupedEvidencias.actividades[ev.actividad_id]) groupedEvidencias.actividades[ev.actividad_id] = []
      groupedEvidencias.actividades[ev.actividad_id].push(ev)
    } else if (ev.tarea_id) {
      if (!groupedEvidencias.tareas[ev.tarea_id]) groupedEvidencias.tareas[ev.tarea_id] = []
      groupedEvidencias.tareas[ev.tarea_id].push(ev)
    }
  })

  // Calculate overall progress
  const overallProgress = fases.length > 0 
    ? Math.round(fases.reduce((acc, f) => acc + (Number(f.porcentaje_completado) || 0), 0) / fases.length)
    : 0

  const handleUploadSuccess = (newEv: InstalacionEvidencia) => {
    setEvidencias(prev => [newEv, ...prev])
    
    // Create notifications for other project stakeholders
    createEvidenceUploadNotification(newEv)
  }

  // Create notifications when evidence is uploaded
  const createEvidenceUploadNotification = (ev: InstalacionEvidencia) => {
    const rolePrefixMap: Record<string, string> = {
      epc: '/epc', nodo_admin: '/admin', nodo_analista: '/analista',
      financiero: '/financiero', cliente_final: '/cliente',
    }
    const prefix = rolePrefixMap[currentUser.rol] || '/epc'
    const enlace = `${prefix}/proyectos/${proyectoId}/instalaciones`
    const autorName = currentUser.nombre || 'Usuario'

    supabase
      .from('proyectos')
      .select('epcista_id, cliente_id, financiero_id')
      .eq('id', proyectoId)
      .single()
      .then(({ data: proyecto }) => {
        if (!proyecto) return
        const recipientIds = new Set<string>()

        // Notify stakeholders
        if (proyecto.epcista_id) recipientIds.add(proyecto.epcista_id)
        if (proyecto.cliente_id) recipientIds.add(proyecto.cliente_id)
        if (proyecto.financiero_id) recipientIds.add(proyecto.financiero_id)

        // Don't notify the author
        recipientIds.delete(currentUser.id)

        if (recipientIds.size === 0) return

        const notifications = Array.from(recipientIds).map(uid => ({
          usuario_id: uid,
          tipo: 'evidencia',
          titulo: `${autorName} subió nueva evidencia`,
          mensaje: `Se ha cargado avance: "${ev.titulo}" en el monitor de instalación.`,
          enlace,
          proyecto_id: proyectoId,
        }))

        supabase.from('notificaciones').insert(notifications).then(() => {})
      })
  }

  // Delete evidence
  const handleDeleteEvidence = async (evId: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta evidencia? Se borrarán sus comentarios asociados.')) return
    
    try {
      const targetEv = evidencias.find(x => x.id === evId)
      if (!targetEv) return

      // Delete from storage if it has an url
      if (targetEv.url) {
        // extract the path after the bucket name
        // typically url is: .../storage/v1/object/public/evidencias-instalacion/proyectoId/faseId/file...
        const urlParts = targetEv.url.split('/public/')
        if (urlParts.length === 2) {
          const pathParts = urlParts[1].split('/')
          const bucketName = pathParts[0]
          const filePath = pathParts.slice(1).join('/')
          
          await supabase.storage.from(bucketName).remove([filePath])
        }
      }

      // Delete database row
      const { error: dbError } = await supabase
        .from('instalacion_evidencias')
        .delete()
        .eq('id', evId)

      if (dbError) throw dbError

      // Update state
      setEvidencias(prev => prev.filter(x => x.id !== evId))
    } catch (err) {
      console.error('Error deleting evidence:', err)
      alert('Error al eliminar evidencia')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-acento border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-500">Cargando monitor de instalación...</p>
        </div>
      </div>
    )
  }

  // Sub-component: Gallery Grid
  const EvidenceGallery = ({ items }: { items: InstalacionEvidencia[] }) => {
    if (!items || items.length === 0) return null

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 py-3">
        {items.map(ev => (
          <div 
            key={ev.id} 
            className="flex flex-col border border-gray-150 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow group relative"
          >
            {/* Media Content */}
            <div className="relative aspect-[4/3] bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden">
              {ev.tipo === 'foto' && ev.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={ev.url} 
                    alt={ev.titulo}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <button 
                    onClick={() => setActivePhotoUrl(ev.url)}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Maximize2 size={14} />
                  </button>
                </>
              ) : ev.tipo === 'documento' && ev.url ? (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <FileText size={48} className="text-acento" />
                  <a 
                    href={ev.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-acento hover:underline flex items-center gap-1.5"
                  >
                    <Eye size={12} /> Ver documento
                  </a>
                </div>
              ) : (
                <div className="p-4 w-full h-full flex flex-col justify-between bg-amber-50/30 text-amber-900">
                  <StickyNote size={32} className="text-amber-500" />
                  <p className="text-xs italic line-clamp-4 leading-relaxed font-medium">
                    &quot;{ev.descripcion}&quot;
                  </p>
                  <div />
                </div>
              )}

              {/* Delete button (owner or admin) */}
              {!readOnly && (currentUser.id === ev.autor_id || currentUser.rol === 'nodo_admin') && (
                <button
                  onClick={() => handleDeleteEvidence(ev.id)}
                  className="absolute top-2 left-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Eliminar evidencia"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Metadata & Title */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-sm text-principal line-clamp-1 mb-1" title={ev.titulo}>
                  {ev.titulo}
                </h4>
                {ev.tipo !== 'nota' && ev.descripcion && (
                  <p className="text-xs text-gray-600 line-clamp-2 mb-3 leading-relaxed">
                    {ev.descripcion}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between mt-auto">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <User size={12} />
                  <span className="truncate max-w-[80px]" title={ev.autor?.nombre ?? 'Usuario'}>
                    {ev.autor?.nombre ?? 'Usuario'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-medium">
                    {formatDate(ev.created_at)}
                  </span>
                  
                  {/* Inline Comments Thread for Evidence */}
                  <CommentThread
                    proyectoId={proyectoId}
                    targetType="evidencia"
                    targetId={ev.id}
                    currentUser={currentUser}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Dashboard summary card */}
      <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-black text-principal flex items-center gap-2">
            <Sparkles className="text-acento" size={20} /> Avance General de la Obra
          </h2>
          <p className="text-xs text-gray-500 max-w-md leading-relaxed">
            Este monitor permite subir y revisar evidencia fotográfica y notas técnicas para cada fase del plan de proyecto aprobado.
          </p>
        </div>

        {/* Progress Display */}
        <div className="flex items-center gap-4 min-w-[200px] shrink-0">
          <div className="flex-1">
            <div className="flex justify-between items-center text-xs font-bold text-principal mb-1">
              <span>Instalación</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
              <div 
                className="bg-green-600 h-full transition-all duration-500 rounded-full" 
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 shrink-0">
            <BarChart2 size={24} />
          </div>
        </div>
      </div>

      {/* 2. Controls and toggle */}
      <div className="flex items-center justify-between border-b border-gray-150 pb-2">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('plan')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
              viewMode === 'plan' 
                ? 'bg-white text-principal shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <List size={14} /> Estructura del Plan
          </button>
          <button
            onClick={() => setViewMode('galeria')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
              viewMode === 'galeria' 
                ? 'bg-white text-principal shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Grid size={14} /> Galería de Evidencia
          </button>
        </div>
        
        <div className="text-xs text-gray-400 font-semibold">
          {evidencias.length} evidencias cargadas
        </div>
      </div>

      {/* 3. Main views */}
      {viewMode === 'galeria' ? (
        evidencias.length > 0 ? (
          <EvidenceGallery items={evidencias} />
        ) : (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-400 bg-white">
            <Camera size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-bold text-sm text-principal">Sin evidencias cargadas</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              Aún no hay fotos, documentos ni notas técnicas subidas. Ve a la estructura del plan para registrar avances.
            </p>
          </div>
        )
      ) : (
        /* Plan Structure view */
        <div className="space-y-4">
          {fases.map(fase => {
            const phaseEvs = groupedEvidencias.fases[fase.id] || []
            const phaseExpanded = expandedFases[fase.id]
            const phaseActividades = actividades.filter(a => a.fase_id === fase.id)
            
            return (
              <div 
                key={fase.id} 
                className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-sm"
                style={{ borderLeftColor: fase.color || '#cbd5e1', borderLeftWidth: '6px' }}
              >
                
                {/* Phase Header */}
                <div 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => setExpandedFases(prev => ({ ...prev, [fase.id]: !prev[fase.id] }))}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button className="mt-1 text-gray-400 shrink-0">
                      {phaseExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div>
                      <h3 className="font-black text-base text-principal truncate leading-normal">
                        {fase.nombre}
                      </h3>
                      {fase.descripcion && (
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{fase.descripcion}</p>
                      )}
                    </div>
                  </div>

                  {/* Right side stats & upload */}
                  <div className="flex items-center gap-4 self-end sm:self-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700 bg-gray-100 py-1 px-2.5 rounded-lg shrink-0">
                        {Math.round(Number(fase.porcentaje_completado) || 0)}% Avance
                      </span>
                    </div>

                    {!readOnly && (
                      <button
                        onClick={() => setUploadTarget({ type: 'fase', id: fase.id, name: fase.nombre })}
                        className="flex items-center gap-1 py-1.5 px-3 bg-acento text-white text-xs font-bold rounded-lg hover:bg-acento-claro transition-colors shrink-0 shadow-sm"
                      >
                        <Camera size={14} /> Subir
                      </button>
                    )}
                  </div>
                </div>

                {/* Phase Content (Expanded) */}
                {phaseExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/30 space-y-4">
                    
                    {/* Phase Evidences */}
                    {phaseEvs.length > 0 && (
                      <div className="border-b border-gray-100 pb-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                          Evidencias de la Fase
                        </h4>
                        <EvidenceGallery items={phaseEvs} />
                      </div>
                    )}

                    {/* Activities List */}
                    <div className="space-y-3">
                      {phaseActividades.length > 0 ? (
                        phaseActividades.map(act => {
                          const actEvs = groupedEvidencias.actividades[act.id] || []
                          const actExpanded = expandedActividades[act.id]
                          const actTareas = tareas.filter(t => t.actividad_id === act.id)
                          const responsable = (act as { profiles?: { nombre?: string } }).profiles?.nombre || 'Sin asignar'
                          
                          return (
                            <div key={act.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
                              
                              {/* Activity Row */}
                              <div 
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                                onClick={() => setExpandedActividades(prev => ({ ...prev, [act.id]: !prev[act.id] }))}
                              >
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <button className="mt-0.5 text-gray-400 shrink-0">
                                    {actExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  </button>
                                  <div>
                                    <h4 className="font-bold text-sm text-principal truncate leading-normal">
                                      {act.nombre}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 font-medium">
                                      <span>Resp: <span className="text-gray-600 font-bold">{responsable}</span></span>
                                      {act.fecha_inicio_estimada && (
                                        <span>
                                          {formatDate(act.fecha_inicio_estimada)} al {formatDate(act.fecha_fin_estimada)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 self-end sm:self-auto" onClick={e => e.stopPropagation()}>
                                  <span className="text-xs font-bold text-gray-600 bg-gray-50 py-1 px-2.5 rounded-lg border border-gray-100">
                                    {Math.round(Number(act.porcentaje_completado) || 0)}%
                                  </span>

                                  {!readOnly && (
                                    <button
                                      onClick={() => setUploadTarget({ type: 'actividad', id: act.id, name: act.nombre })}
                                      className="flex items-center gap-1 py-1 px-2.5 bg-acento/10 hover:bg-acento/20 text-acento text-xs font-bold rounded-lg transition-colors"
                                    >
                                      <Camera size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Activity Content (Expanded) */}
                              {actExpanded && (
                                <div className="border-t border-gray-100 p-3.5 bg-gray-50/20 space-y-4">
                                  
                                  {/* Activity Evidences */}
                                  {actEvs.length > 0 && (
                                    <div className="border-b border-gray-100 pb-3">
                                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                                        Evidencias de la Actividad
                                      </h5>
                                      <EvidenceGallery items={actEvs} />
                                    </div>
                                  )}

                                  {/* Tasks List */}
                                  <div className="space-y-2.5">
                                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                      Tareas / Checklist
                                    </h5>
                                    {actTareas.length > 0 ? (
                                      actTareas.map(tarea => {
                                        const tareaEvs = groupedEvidencias.tareas[tarea.id] || []
                                        
                                        return (
                                          <div 
                                            key={tarea.id} 
                                            className="p-3 border border-gray-100 rounded-lg bg-white flex flex-col gap-2.5 shadow-sm hover:border-gray-200 transition-colors"
                                          >
                                            <div className="flex items-center justify-between gap-4">
                                              <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-2 h-2 rounded-full shrink-0 ${
                                                  tarea.estado === 'completado' 
                                                    ? 'bg-green-500' 
                                                    : tarea.estado === 'en_progreso' 
                                                      ? 'bg-amber-500' 
                                                      : 'bg-gray-300'
                                                }`} />
                                                <span className="text-xs font-bold text-principal truncate">
                                                  {tarea.nombre}
                                                </span>
                                              </div>

                                              <div className="flex items-center gap-2 shrink-0">
                                                {tareaEvs.length > 0 && (
                                                  <span className="text-[10px] font-bold text-acento bg-acento/5 py-0.5 px-2 rounded-full border border-acento/10 flex items-center gap-1">
                                                    <Camera size={10} /> {tareaEvs.length}
                                                  </span>
                                                )}

                                                {!readOnly && (
                                                  <button
                                                    onClick={() => setUploadTarget({ type: 'tarea', id: tarea.id, name: tarea.nombre })}
                                                    className="p-1 hover:bg-gray-100 text-gray-400 hover:text-acento rounded-lg transition-colors"
                                                    title="Subir evidencia de tarea"
                                                  >
                                                    <Camera size={13} />
                                                  </button>
                                                )}
                                              </div>
                                            </div>

                                            {/* Tarea Evidences Inline (small view) */}
                                            {tareaEvs.length > 0 && (
                                              <div className="pl-4 border-l-2 border-gray-100 mt-1">
                                                <EvidenceGallery items={tareaEvs} />
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })
                                    ) : (
                                      <p className="text-xs text-gray-400 italic">No hay tareas en esta actividad.</p>
                                    )}
                                  </div>

                                </div>
                              )}

                            </div>
                          )
                        })
                      ) : (
                        <p className="text-xs text-gray-400 italic">No hay actividades registradas en esta fase.</p>
                      )}
                    </div>

                  </div>
                )}
                
              </div>
            )
          })}
        </div>
      )}

      {/* 4. Upload Evidence Modal wrapper */}
      {uploadTarget && (
        <EvidenciaModal
          isOpen={!!uploadTarget}
          onClose={() => setUploadTarget(null)}
          proyectoId={proyectoId}
          targetType={uploadTarget.type}
          targetId={uploadTarget.id}
          targetName={uploadTarget.name}
          currentUser={currentUser}
          onSuccess={handleUploadSuccess}
        />
      )}

      {/* 5. Lightbox Modal for Fullscreen Photo */}
      {activePhotoUrl && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
          onClick={() => setActivePhotoUrl(null)}
        >
          <button 
            onClick={() => setActivePhotoUrl(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={activePhotoUrl} 
            alt="Fullscreen preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-xl select-none"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  )
}
