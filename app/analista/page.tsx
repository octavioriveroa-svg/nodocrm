'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import type { Proyecto, EstadoProyecto, TipoProyecto } from '@/lib/types'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AnalistaDashboard() {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<EstadoProyecto | 'todos'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<TipoProyecto | 'todos'>('todos')

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('proyectos')
        .select('*, profiles(*)')
        .order('created_at', { ascending: false })
      setProyectos((data ?? []) as Proyecto[])
      setLoading(false)
    }
    fetch()
  }, [])

  const lista = proyectos.filter(p => {
    if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
    if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false
    return true
  })

  const total = proyectos.length
  const recibidos = proyectos.filter(p => p.estado === 'recibido').length
  const enAnalisis = proyectos.filter(p => p.estado === 'en_analisis').length
  const completados = proyectos.filter(p => p.estado === 'completado').length
  const bess = proyectos.filter(p => p.tipo === 'BESS').length
  const mem = proyectos.filter(p => p.tipo === 'MEM').length
  const bessMore = proyectos.filter(p => p.tipo === 'BESS+MEM').length

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Dashboard Analista</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>
          Visión global de todos los proyectos
        </p>
      </div>

      {/* Métricas de estado */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: total },
          { label: 'Recibidos', value: recibidos },
          { label: 'En análisis', value: enAnalisis },
          { label: 'Completados', value: completados },
        ].map(m => (
          <div
            key={m.label}
            className="border p-5"
            style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}
          >
            <div className="text-3xl font-black">{m.value}</div>
            <div className="text-sm mt-1" style={{ color: '#666' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Métricas por tipo */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'BESS', value: bess },
          { label: 'MEM', value: mem },
          { label: 'BESS+MEM', value: bessMore },
        ].map(m => (
          <div
            key={m.label}
            className="border p-4 flex items-center justify-between"
            style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}
          >
            <span className="font-bold text-sm">{m.label}</span>
            <span
              className="text-xl font-black px-3 py-0.5"
              style={{ backgroundColor: '#D7FF2F' }}
            >
              {m.value}
            </span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Estado:</label>
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as EstadoProyecto | 'todos')}
            className="border px-2 py-1.5 text-sm"
            style={{ borderColor: '#CFCFCF' }}
          >
            <option value="todos">Todos</option>
            <option value="recibido">Recibido</option>
            <option value="en_analisis">En análisis</option>
            <option value="completado">Completado</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Tipo:</label>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as TipoProyecto | 'todos')}
            className="border px-2 py-1.5 text-sm"
            style={{ borderColor: '#CFCFCF' }}
          >
            <option value="todos">Todos</option>
            <option value="BESS">BESS</option>
            <option value="MEM">MEM</option>
            <option value="BESS+MEM">BESS+MEM</option>
          </select>
        </div>
        {(filtroEstado !== 'todos' || filtroTipo !== 'todos') && (
          <button
            onClick={() => { setFiltroEstado('todos'); setFiltroTipo('todos') }}
            className="text-sm underline"
            style={{ color: '#666' }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="text-sm" style={{ color: '#666' }}>Cargando proyectos…</p>
      ) : lista.length === 0 ? (
        <div
          className="border p-12 text-center"
          style={{ borderColor: '#CFCFCF', borderStyle: 'dashed' }}
        >
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
              {lista.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    backgroundColor: i % 2 === 0 ? '#fff' : '#fafaf8',
                    borderTop: '1px solid #CFCFCF',
                  }}
                >
                  <td className="px-4 py-3 font-medium">{p.nombre_proyecto}</td>
                  <td className="px-4 py-3" style={{ color: '#666' }}>
                    {(p.profiles as { nombre?: string } | undefined)?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3"><BadgeTipo tipo={p.tipo} /></td>
                  <td className="px-4 py-3"><BadgeEstado estado={p.estado} /></td>
                  <td className="px-4 py-3" style={{ color: '#666' }}>{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/analista/proyectos/${p.id}`}
                      className="font-semibold text-xs underline"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
