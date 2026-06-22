'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Wrench, Search, Camera, FileText, Clock, ChevronRight } from 'lucide-react'
import BadgeEstado from '@/components/BadgeEstado'
import type { Proyecto, EstadoProyecto } from '@/lib/types'

interface InstalacionStats {
  evidenciaCount: number
  lastUpload: string | null
  fasesTotal: number
  fasesCompletadas: number
  progreso: number
}

interface InstalacionesListClientProps {
  portalPrefix: string
  initialProyectos: Proyecto[]
}

export default function InstalacionesListClient({
  portalPrefix,
  initialProyectos,
}: InstalacionesListClientProps) {
  const supabase = createClient()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoProyecto | 'todos'>('todos')
  const [stats, setStats] = useState<Record<string, InstalacionStats>>({})
  const [loadingStats, setLoadingStats] = useState(true)

  // Fetch installation stats for all projects
  useEffect(() => {
    async function fetchStats() {
      setLoadingStats(true)
      const projectIds = initialProyectos.map(p => p.id)
      if (projectIds.length === 0) { setLoadingStats(false); return }

      // Fetch evidencias counts and last upload per project
      const { data: evidencias } = await supabase
        .from('instalacion_evidencias')
        .select('id, proyecto_id, created_at')
        .in('proyecto_id', projectIds)
        .order('created_at', { ascending: false })

      // Fetch plan phases per project
      const { data: fases } = await supabase
        .from('plan_fases')
        .select('id, proyecto_id, porcentaje_completado')
        .in('proyecto_id', projectIds)

      const statsMap: Record<string, InstalacionStats> = {}

      for (const pid of projectIds) {
        const projEvidencias = (evidencias ?? []).filter(e => e.proyecto_id === pid)
        const projFases = (fases ?? []).filter(f => f.proyecto_id === pid)

        const fasesCompletadas = projFases.filter(f => (f.porcentaje_completado ?? 0) >= 100).length
        const progreso = projFases.length > 0
          ? Math.round(projFases.reduce((sum, f) => sum + (f.porcentaje_completado ?? 0), 0) / projFases.length)
          : 0

        statsMap[pid] = {
          evidenciaCount: projEvidencias.length,
          lastUpload: projEvidencias.length > 0 ? projEvidencias[0].created_at : null,
          fasesTotal: projFases.length,
          fasesCompletadas,
          progreso,
        }
      }

      setStats(statsMap)
      setLoadingStats(false)
    }
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProyectos])

  // Filter projects
  const filtered = initialProyectos.filter(p => {
    const matchBusqueda = busqueda === '' ||
      p.nombre_proyecto.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.cliente_final_empresa.toLowerCase().includes(busqueda.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado
    return matchBusqueda && matchEstado
  })

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="py-6 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center">
              <Wrench size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-principal">Monitor de Instalaciones</h1>
              <p className="text-sm text-gray-500">Seguimiento de avance, evidencias y documentación de instalaciones activas</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por proyecto o cliente..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-borde bg-white text-sm focus:outline-none focus:ring-2 focus:ring-principal/20 focus:border-principal transition-all"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as EstadoProyecto | 'todos')}
            className="px-4 py-2.5 rounded-xl border border-borde bg-white text-sm focus:outline-none focus:ring-2 focus:ring-principal/20 focus:border-principal transition-all"
          >
            <option value="todos">Todos los estados</option>
            <option value="aprobado">Cierre</option>
            <option value="en_construccion">En construcción</option>
            <option value="operativo">Operativo</option>
            <option value="completado">Completado</option>
          </select>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-white/60 border border-dashed border-borde rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Wrench size={28} className="text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500 mb-1">No hay proyectos en fase de instalación</p>
            <p className="text-xs text-gray-400 max-w-sm text-center">
              Los proyectos aparecerán aquí cuando alcancen el estado &quot;Cierre&quot; (aprobado) o posterior.
            </p>
          </div>
        )}

        {/* Project Cards Grid */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(proyecto => {
              const s = stats[proyecto.id]
              return (
                <Link
                  key={proyecto.id}
                  href={`${portalPrefix}/proyectos/${proyecto.id}/instalaciones`}
                  className="group block bg-white rounded-2xl border border-borde p-5 hover:shadow-lg hover:border-principal/30 transition-all duration-200 hover:-translate-y-0.5"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-principal truncate group-hover:text-green-700 transition-colors">
                        {proyecto.nombre_proyecto}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{proyecto.cliente_final_empresa}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-principal transition-colors flex-shrink-0 mt-0.5" />
                  </div>

                  {/* Status Badge */}
                  <div className="mb-4">
                    <BadgeEstado estado={proyecto.estado} />
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-500">Progreso de instalación</span>
                      <span className="text-xs font-bold text-principal">
                        {loadingStats ? '...' : `${s?.progreso ?? 0}%`}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${loadingStats ? 0 : (s?.progreso ?? 0)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {/* Evidence Count */}
                    <div className="flex items-center gap-1.5">
                      <Camera size={13} className="text-gray-400" />
                      <span>{loadingStats ? '...' : `${s?.evidenciaCount ?? 0} evidencias`}</span>
                    </div>

                    {/* Phases */}
                    <div className="flex items-center gap-1.5">
                      <FileText size={13} className="text-gray-400" />
                      <span>{loadingStats ? '...' : `${s?.fasesCompletadas ?? 0}/${s?.fasesTotal ?? 0} fases`}</span>
                    </div>
                  </div>

                  {/* Last Upload */}
                  {!loadingStats && s?.lastUpload && (
                    <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-gray-400">
                      <Clock size={11} />
                      <span>Última evidencia: {formatDate(s.lastUpload)}</span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
