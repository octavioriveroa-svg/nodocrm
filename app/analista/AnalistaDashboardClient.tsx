'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import BadgeTipo from '@/components/BadgeTipo'
import type { EstadoProyecto, TipoProyecto } from '@/lib/types'

const ESTADO_LABELS: Record<string, string> = {
  recibido: 'Recibido',
  en_analisis: 'En análisis',
  propuesta_lista: 'Propuesta lista',
  enviada: 'Enviada',
  cliente_interesado: 'Cliente interesado',
}

const ESTADO_CLASSES: Record<string, string> = {
  recibido: 'bg-gray-100 text-gray-600',
  en_analisis: 'bg-acento text-principal',
  propuesta_lista: 'bg-blue-100 text-blue-700',
  enviada: 'bg-amber-100 text-amber-700',
  cliente_interesado: 'bg-emerald-100 text-emerald-700',
}

const ESTADOS = Object.keys(ESTADO_LABELS) as EstadoProyecto[]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface ProyectoRow {
  id: string
  nombre_proyecto: string
  tipo: TipoProyecto
  estado: EstadoProyecto
  epcista_id: string
  epcista_nombre: string
  created_at: string
}

interface Props {
  initialProyectos: ProyectoRow[]
}

export default function AnalistaDashboardClient({ initialProyectos }: Props) {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<ProyectoRow[]>(initialProyectos)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoProyecto | 'todos'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<TipoProyecto | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')

  // Realtime: sync deletes and status updates
  useEffect(() => {
    const channel = supabase
      .channel('proyectos-analista')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'proyectos' }, payload => {
        setProyectos(prev => prev.filter(p => p.id !== (payload.old as { id: string }).id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'proyectos' }, payload => {
        setProyectos(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } as ProyectoRow : p))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function cambiarEstado(id: string, nuevoEstado: EstadoProyecto) {
    setUpdatingId(id)
    const { error } = await supabase.from('proyectos').update({ estado: nuevoEstado }).eq('id', id)
    if (!error) {
      setProyectos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p))
    }
    setUpdatingId(null)
  }

  const lista = proyectos.filter(p => {
    if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
    if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!p.nombre_proyecto.toLowerCase().includes(q) && !p.epcista_nombre.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-1">Panel de analista</p>
        <h1 className="text-2xl font-black tracking-tight">Proyectos</h1>
      </div>

      {/* Stats por estado — clicables como filtro */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {ESTADOS.map(estado => {
          const count = proyectos.filter(p => p.estado === estado).length
          const classes = ESTADO_CLASSES[estado]
          const active = filtroEstado === estado
          return (
            <button
              key={estado}
              onClick={() => setFiltroEstado(active ? 'todos' : estado)}
              className={`rounded-xl border p-5 text-left transition-all duration-200 ${active ? 'border-principal bg-fondo shadow-md ring-2 ring-principal' : 'border-borde bg-white hover:shadow-sm'}`}
            >
              <div className="text-2xl font-black mb-2">{count}</div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${classes}`}>
                {ESTADO_LABELS[estado]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input
          type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por proyecto o EPCista…"
          className="border border-borde rounded-lg px-4 py-2.5 text-sm flex-1 min-w-48 bg-white"
        />
        <div className="flex gap-1.5">
          {(['todos', 'BESS', 'MEM', 'BESS+MEM', 'FV', 'FV+BESS'] as const).map(t => (
            <button key={t}
              onClick={() => setFiltroTipo(t as TipoProyecto | 'todos')}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${filtroTipo === t ? 'border-principal bg-principal text-acento shadow-sm' : 'border-borde bg-white text-gray-500 hover:border-gray-300'}`}>
              {t === 'todos' ? 'Todos' : t}
            </button>
          ))}
        </div>
        {(filtroEstado !== 'todos' || filtroTipo !== 'todos' || busqueda) && (
          <button onClick={() => { setFiltroEstado('todos'); setFiltroTipo('todos'); setBusqueda('') }}
            className="text-xs font-medium text-gray-400 hover:text-principal transition-colors">
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      {lista.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-borde p-12 text-center">
          <p className="text-sm text-gray-400">No hay proyectos con estos filtros.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-borde overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-borde">
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Proyecto</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">EPCista</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Tipo</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Estado</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Fecha</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p, i) => {
                const ec = ESTADO_CLASSES[p.estado] ?? ESTADO_CLASSES.recibido
                return (
                  <tr key={p.id} className={`border-t border-borde hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-fondo/50'}`}>
                    <td className="px-6 py-3.5 font-medium">{p.nombre_proyecto}</td>
                    <td className="px-6 py-3.5 text-gray-500">{p.epcista_nombre}</td>
                    <td className="px-6 py-3.5"><BadgeTipo tipo={p.tipo} /></td>
                    <td className="px-6 py-3.5">
                      <select
                        value={p.estado}
                        disabled={updatingId === p.id}
                        onChange={e => cambiarEstado(p.id, e.target.value as EstadoProyecto)}
                        className={`border rounded-full text-xs px-3 py-1.5 font-semibold disabled:opacity-50 cursor-pointer ${ec}`}
                      >
                        {ESTADOS.map(val => (
                          <option key={val} value={val}>{ESTADO_LABELS[val]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-gray-400">{formatDate(p.created_at)}</td>
                    <td className="px-6 py-3.5">
                      <Link href={`/analista/proyectos/${p.id}`} className="text-xs font-semibold text-gray-400 hover:text-principal transition-colors">
                        Ver detalle →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs mt-3 text-gray-400">{lista.length} proyecto{lista.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
