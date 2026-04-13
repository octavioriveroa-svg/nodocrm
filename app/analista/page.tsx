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

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  recibido: { bg: '#E8E8E8', color: '#444' },
  en_analisis: { bg: '#D7FF2F', color: '#000' },
  propuesta_lista: { bg: '#DBEAFE', color: '#1e40af' },
  enviada: { bg: '#FDE68A', color: '#92400e' },
  cliente_interesado: { bg: '#D1FAE5', color: '#065f46' },
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

export default function AnalistaDashboard() {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoProyecto | 'todos'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<TipoProyecto | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('proyectos')
        .select('id, nombre_proyecto, tipo, estado, epcista_id, created_at')
        .order('created_at', { ascending: false })

      const prs = (data ?? []) as Omit<ProyectoRow, 'epcista_nombre'>[]

      if (prs.length > 0) {
        const ids = [...new Set(prs.map(p => p.epcista_id))]
        const { data: profilesData } = await supabase.from('profiles').select('id, nombre').in('id', ids)
        const nameMap: Record<string, string> = {}
        for (const pf of profilesData ?? []) {
          nameMap[(pf as { id: string; nombre: string }).id] = (pf as { id: string; nombre: string }).nombre
        }
        setProyectos(prs.map(p => ({ ...p, epcista_nombre: nameMap[p.epcista_id] ?? '—' })))
      } else {
        setProyectos([])
      }
      setLoading(false)
    }
    load()
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

  if (loading) return null

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Proyectos</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Todos los proyectos de la plataforma</p>
      </div>

      {/* Stats por estado — clicables como filtro */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {ESTADOS.map(estado => {
          const count = proyectos.filter(p => p.estado === estado).length
          const { bg, color } = ESTADO_COLORS[estado]
          const active = filtroEstado === estado
          return (
            <button
              key={estado}
              onClick={() => setFiltroEstado(active ? 'todos' : estado)}
              className="border p-4 text-left transition-colors"
              style={{
                borderColor: active ? '#000' : '#CFCFCF',
                backgroundColor: active ? '#fafaf8' : '#fff',
                outline: active ? '2px solid #000' : 'none',
              }}
            >
              <div className="text-2xl font-black mb-2">{count}</div>
              <span className="text-xs font-semibold px-1.5 py-0.5" style={{ backgroundColor: bg, color }}>
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
          className="border px-3 py-1.5 text-sm flex-1 min-w-48"
          style={{ borderColor: '#CFCFCF' }}
        />
        <div className="flex gap-1">
          {(['todos', 'BESS', 'MEM', 'BESS+MEM', 'FV', 'FV+BESS'] as const).map(t => (
            <button key={t}
              onClick={() => setFiltroTipo(t as TipoProyecto | 'todos')}
              className="px-3 py-1.5 text-xs font-medium border transition-colors"
              style={{
                borderColor: filtroTipo === t ? '#000' : '#CFCFCF',
                backgroundColor: filtroTipo === t ? '#000' : '#fff',
                color: filtroTipo === t ? '#D7FF2F' : '#444',
              }}>
              {t === 'todos' ? 'Todos' : t}
            </button>
          ))}
        </div>
        {(filtroEstado !== 'todos' || filtroTipo !== 'todos' || busqueda) && (
          <button onClick={() => { setFiltroEstado('todos'); setFiltroTipo('todos'); setBusqueda('') }}
            className="text-xs underline" style={{ color: '#666' }}>
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      {lista.length === 0 ? (
        <div className="border p-12 text-center" style={{ borderColor: '#CFCFCF', borderStyle: 'dashed' }}>
          <p className="text-sm" style={{ color: '#666' }}>No hay proyectos con estos filtros.</p>
        </div>
      ) : (
        <div className="border overflow-hidden" style={{ borderColor: '#CFCFCF' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#000', color: '#fff' }}>
                <th className="text-left px-4 py-3 font-semibold">Proyecto</th>
                <th className="text-left px-4 py-3 font-semibold">EPCista</th>
                <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                <th className="text-left px-4 py-3 font-semibold">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p, i) => {
                const ec = ESTADO_COLORS[p.estado] ?? ESTADO_COLORS.recibido
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #CFCFCF', backgroundColor: i % 2 === 0 ? '#fff' : '#fafaf8' }}>
                    <td className="px-4 py-3 font-medium">{p.nombre_proyecto}</td>
                    <td className="px-4 py-3" style={{ color: '#666' }}>{p.epcista_nombre}</td>
                    <td className="px-4 py-3"><BadgeTipo tipo={p.tipo} /></td>
                    <td className="px-4 py-3">
                      <select
                        value={p.estado}
                        disabled={updatingId === p.id}
                        onChange={e => cambiarEstado(p.id, e.target.value as EstadoProyecto)}
                        className="border text-xs px-2 py-1 font-semibold disabled:opacity-50 cursor-pointer"
                        style={{ borderColor: ec.bg, backgroundColor: ec.bg, color: ec.color }}
                      >
                        {ESTADOS.map(val => (
                          <option key={val} value={val}>{ESTADO_LABELS[val]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/analista/proyectos/${p.id}`} className="text-xs font-semibold underline">
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: '#888' }}>{lista.length} proyecto{lista.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
