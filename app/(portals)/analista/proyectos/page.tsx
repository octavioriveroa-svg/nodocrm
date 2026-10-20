'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Eye, Plus } from 'lucide-react'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import type { Proyecto, EstadoProyecto, TipoProyecto } from '@/lib/types'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface ProyectoConEpcista extends Proyecto {
  epcista_nombre: string
  epcista_empresa: string
  responsable_nombre: string
  finder_nombre: string
  finder_empresa: string
}

interface JoinedProfile {
  id?: string
  nombre?: string | null
  empresa?: string | null
}

interface RawProyecto extends Proyecto {
  epc?: JoinedProfile | JoinedProfile[] | null
  responsable?: JoinedProfile | JoinedProfile[] | null
  finder?: JoinedProfile | JoinedProfile[] | null
}

function extractProfile(val: JoinedProfile | JoinedProfile[] | null | undefined): JoinedProfile | null {
  if (!val) return null
  if (Array.isArray(val)) return val[0] ?? null
  return val
}

export default function AnalistaProyectosPage() {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<ProyectoConEpcista[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<EstadoProyecto | 'todos'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<TipoProyecto | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')

  // Realtime: reflect changes made by other sessions
  useEffect(() => {
    const channel = supabase
      .channel('proyectos-analista')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'proyectos' }, async payload => {
        const newProj = payload.new as Proyecto
        const ids = [newProj.epcista_id, newProj.responsable_nodo_id, newProj.finder_id].filter(Boolean) as string[]
        let epcista_nombre = '—'
        let epcista_empresa = '—'
        let responsable_nombre = '—'
        let finder_nombre = '—'
        let finder_empresa = '—'
        if (ids.length > 0) {
          const { data: perfiles } = await supabase.from('profiles').select('id, nombre, empresa').in('id', ids)
          const nameMap: Record<string, { nombre: string; empresa: string }> = {}
          for (const pf of perfiles ?? []) {
            const p = pf as { id: string; nombre: string; empresa: string }
            nameMap[p.id] = { nombre: p.nombre, empresa: p.empresa }
          }
          if (newProj.epcista_id && nameMap[newProj.epcista_id]) {
            epcista_nombre = nameMap[newProj.epcista_id].nombre ?? '—'
            epcista_empresa = nameMap[newProj.epcista_id].empresa ?? '—'
          }
          if (newProj.responsable_nodo_id && nameMap[newProj.responsable_nodo_id]) {
            responsable_nombre = nameMap[newProj.responsable_nodo_id].nombre ?? '—'
          }
          if (newProj.finder_id && nameMap[newProj.finder_id]) {
            finder_nombre = nameMap[newProj.finder_id].nombre ?? '—'
            finder_empresa = nameMap[newProj.finder_id].empresa ?? '—'
          }
        }
        setProyectos(prev => {
          if (prev.some(p => p.id === newProj.id)) return prev
          return [{
            ...newProj,
            epcista_nombre,
            epcista_empresa,
            responsable_nombre,
            finder_nombre,
            finder_empresa,
          }, ...prev]
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'proyectos' }, payload => {
        setProyectos(prev => prev.filter(p => p.id !== (payload.old as { id: string }).id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'proyectos' }, payload => {
        setProyectos(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } as ProyectoConEpcista : p))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function load() {
      // PERF-01 / PERF-03: Single relational join query for project stakeholder profiles
      const { data: joinedData, error: joinError } = await supabase
        .from('proyectos')
        .select(`
          *,
          epc:profiles!proyectos_epcista_id_fkey(id, nombre, empresa),
          responsable:profiles!proyectos_responsable_nodo_id_fkey(id, nombre, empresa),
          finder:profiles!proyectos_finder_id_fkey(id, nombre, empresa)
        `)
        .order('created_at', { ascending: false })

      let prs: RawProyecto[] | null = null

      // Resilient fallback: If PostgREST schema cache hasn't reloaded foreign keys, fallback to basic select
      if (joinError) {
        console.warn('PostgREST join query failed, falling back to manual resolution:', joinError.message)
        const { data: fallbackData } = await supabase
          .from('proyectos')
          .select('*')
          .order('created_at', { ascending: false })
        prs = (fallbackData as RawProyecto[]) || null
      } else {
        prs = (joinedData as unknown as RawProyecto[]) || null
      }

      if (!prs || prs.length === 0) {
        setLoading(false)
        return
      }

      // Check if joined relations were populated
      const hasJoinedRelations = !joinError && prs.some(p => p.epc || p.responsable || p.finder)

      const nameMap: Record<string, { nombre: string; empresa: string }> = {}
      if (!hasJoinedRelations) {
        // Collect all profile IDs we need to resolve (epcista + responsable + finder)
        const allIds = [...new Set([
          ...prs.map(p => p.epcista_id),
          ...prs.map(p => p.responsable_nodo_id).filter(Boolean) as string[],
          ...prs.map(p => p.finder_id).filter(Boolean) as string[],
        ])]
        if (allIds.length > 0) {
          const { data: perfiles } = await supabase.from('profiles').select('id, nombre, empresa').in('id', allIds)
          for (const pf of perfiles ?? []) {
            const p = pf as { id: string; nombre: string; empresa: string }
            nameMap[p.id] = { nombre: p.nombre, empresa: p.empresa }
          }
        }
      }

      setProyectos(prs.map((p) => {
        const epc = extractProfile(p.epc)
        const resp = extractProfile(p.responsable)
        const fnd = extractProfile(p.finder)

        return {
          ...p,
          epcista_nombre: epc?.nombre || (p.epcista_id ? nameMap[p.epcista_id]?.nombre ?? '—' : '—'),
          epcista_empresa: epc?.empresa || (p.epcista_id ? nameMap[p.epcista_id]?.empresa ?? '—' : '—'),
          responsable_nombre: resp?.nombre || (p.responsable_nodo_id ? nameMap[p.responsable_nodo_id]?.nombre ?? '—' : '—'),
          finder_nombre: fnd?.nombre || (p.finder_id ? nameMap[p.finder_id]?.nombre ?? '—' : '—'),
          finder_empresa: fnd?.empresa || (p.finder_id ? nameMap[p.finder_id]?.empresa ?? '—' : '—'),
        }
      }))
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lista = proyectos.filter(p => {
    if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
    if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase().trim()
      if (!p.nombre_proyecto?.toLowerCase().includes(q) &&
          !p.epcista_nombre?.toLowerCase().includes(q) &&
          !p.epcista_empresa?.toLowerCase().includes(q) &&
          !p.cliente_final_empresa?.toLowerCase().includes(q) &&
          !p.cliente_final_nombre?.toLowerCase().includes(q) &&
          !p.finder_nombre?.toLowerCase().includes(q) &&
          !p.responsable_nombre?.toLowerCase().includes(q)) return false
    }
    return true
  })

  if (loading) return null

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 relative flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">Directorio</p>
          <h1 className="text-2xl font-black tracking-tight mt-1">Proyectos</h1>
          <p className="text-sm mt-1.5 text-gray-500">Gestión y análisis de proyectos de la plataforma</p>
        </div>
        <Link href="/analista/proyectos/nuevo" className="flex items-center gap-2 bg-acento text-principal px-4 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity shadow-sm">
          <Plus size={18} />
          Nuevo Proyecto
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-6 flex-wrap items-center">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por proyecto, EPCista o cliente…"
          className="rounded-lg border border-borde px-4 py-2.5 text-sm flex-1 min-w-48 bg-white focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all shadow-sm"
        />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as EstadoProyecto | 'todos')}
          className="rounded-lg border border-borde px-4 py-2.5 text-sm bg-white focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all shadow-sm font-medium">
          <option value="todos">Todos los estados</option>
          <option value="recibido">Recibido</option>
          <option value="en_analisis">En análisis</option>
          <option value="propuesta_lista">Propuesta lista</option>
          <option value="enviada">Propuesta enviada</option>
          <option value="negociacion">Negociación</option>
          <option value="aprobado">Aprobado</option>
          <option value="en_construccion">En construcción</option>
          <option value="operativo">Operativo</option>
          <option value="completado">Completado</option>
          <option value="cliente_interesado">Cliente interesado</option>
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as TipoProyecto | 'todos')}
          className="rounded-lg border border-borde px-4 py-2.5 text-sm bg-white focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all shadow-sm font-medium">
          <option value="todos">Todos los tipos</option>
          <option value="FV">FV</option>
          <option value="BESS">BESS</option>
          <option value="FV+BESS">FV+BESS</option>
          <option value="MEM">MEM</option>
          <option value="BESS+MEM">BESS+MEM</option>
        </select>
        {(busqueda || filtroEstado !== 'todos' || filtroTipo !== 'todos') && (
          <button
            onClick={() => { setBusqueda(''); setFiltroEstado('todos'); setFiltroTipo('todos') }}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="rounded-xl border border-borde overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-fondo border-b border-borde text-muted">
            <tr>
              <th className="px-5 py-4 font-semibold">Proyecto</th>
              <th className="px-5 py-4 font-semibold">Cliente</th>
              <th className="px-5 py-4 font-semibold">EPCista</th>
              <th className="px-5 py-4 font-semibold">Responsable</th>
              <th className="px-5 py-4 font-semibold">Finder</th>
              <th className="px-5 py-4 font-semibold">Tipo</th>
              <th className="px-5 py-4 font-semibold">Estado</th>
              <th className="px-5 py-4 font-semibold">Fecha</th>
              <th className="px-5 py-4 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lista.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-gray-700">No se encontraron proyectos con los filtros actuales.</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">
                    {busqueda && `Búsqueda: "${busqueda}" `}
                    {filtroEstado !== 'todos' && `• Estado: "${filtroEstado}" `}
                    {filtroTipo !== 'todos' && `• Tipo: "${filtroTipo}"`}
                  </p>
                  {(busqueda || filtroEstado !== 'todos' || filtroTipo !== 'todos') && (
                    <button
                      onClick={() => { setBusqueda(''); setFiltroEstado('todos'); setFiltroTipo('todos') }}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-acento text-principal hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                    >
                      Restablecer todos los filtros
                    </button>
                  )}
                </td>
              </tr>
            )}
            {lista.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 font-bold text-principal">
                  <Link href={`/analista/proyectos/${p.id}`} className="hover:underline">
                    {p.nombre_proyecto}
                  </Link>
                </td>
                <td className="px-5 py-3 text-xs text-gray-500 font-medium">{p.cliente_final_empresa || '—'}</td>
                <td className="px-5 py-3 text-xs text-gray-500 font-medium">{p.epcista_nombre}</td>
                <td className="px-5 py-3 text-xs font-medium" style={{ color: p.responsable_nombre !== '—' ? 'var(--color-green-700)' : 'var(--color-gray-300)' }}>{p.responsable_nombre}</td>
                <td className="px-5 py-3 text-xs font-medium text-gray-500">{p.finder_nombre}</td>
                <td className="px-5 py-3"><BadgeTipo tipo={p.tipo} /></td>
                <td className="px-5 py-3"><BadgeEstado estado={p.estado} historial={p.historial_estados} /></td>
                <td className="px-5 py-3 text-xs font-medium text-gray-400">{formatDate(p.created_at)}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/analista/proyectos/${p.id}`} className="inline-flex p-2 rounded-lg text-gray-400 hover:text-principal hover:bg-gray-100 transition-all">
                    <Eye size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2 text-muted">{lista.length} proyecto{lista.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
