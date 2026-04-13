'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import type { Proyecto, EstadoProyecto, TipoProyecto } from '@/lib/types'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface ProyectoConEpcista extends Proyecto {
  epcista_nombre: string
  epcista_empresa: string
}

export default function AdminProyectosPage() {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<ProyectoConEpcista[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<EstadoProyecto | 'todos'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<TipoProyecto | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function load() {
      const { data: prs } = await supabase
        .from('proyectos')
        .select('*')
        .order('created_at', { ascending: false })

      if (!prs || prs.length === 0) { setLoading(false); return }

      const ids = [...new Set(prs.map((p: { epcista_id: string }) => p.epcista_id))]
      const { data: perfiles } = await supabase.from('profiles').select('id, nombre, empresa').in('id', ids)
      const nameMap: Record<string, { nombre: string; empresa: string }> = {}
      for (const pf of perfiles ?? []) {
        const p = pf as { id: string; nombre: string; empresa: string }
        nameMap[p.id] = { nombre: p.nombre, empresa: p.empresa }
      }

      setProyectos(prs.map((p: Proyecto) => ({
        ...p,
        epcista_nombre: nameMap[p.epcista_id]?.nombre ?? '—',
        epcista_empresa: nameMap[p.epcista_id]?.empresa ?? '—',
      })))
      setLoading(false)
    }
    load()
  }, [])

  const lista = proyectos.filter(p => {
    if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
    if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!p.nombre_proyecto?.toLowerCase().includes(q) &&
          !p.epcista_nombre?.toLowerCase().includes(q) &&
          !p.cliente_final_empresa?.toLowerCase().includes(q)) return false
    }
    return true
  })

  async function eliminarProyecto(id: string) {
    setDeleting(true)
    const { error } = await supabase.from('proyectos').delete().eq('id', id)
    if (!error) setProyectos(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
    setDeleting(false)
  }

  if (loading) return null

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Proyectos</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Todos los proyectos de la plataforma</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por proyecto, EPCista o cliente…"
          className="border px-3 py-1.5 text-sm flex-1 min-w-48"
          style={{ borderColor: '#CFCFCF' }}
        />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as EstadoProyecto | 'todos')}
          className="border px-2 py-1.5 text-sm" style={{ borderColor: '#CFCFCF' }}>
          <option value="todos">Todos los estados</option>
          <option value="recibido">Recibido</option>
          <option value="en_analisis">En análisis</option>
          <option value="propuesta_lista">Propuesta lista</option>
          <option value="enviada">Enviada</option>
          <option value="cliente_interesado">Cliente interesado</option>
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as TipoProyecto | 'todos')}
          className="border px-2 py-1.5 text-sm" style={{ borderColor: '#CFCFCF' }}>
          <option value="todos">Todos los tipos</option>
          <option value="FV">FV</option>
          <option value="BESS">BESS</option>
          <option value="FV+BESS">FV+BESS</option>
          <option value="MEM">MEM</option>
          <option value="BESS+MEM">BESS+MEM</option>
        </select>
      </div>

      <div className="border overflow-hidden" style={{ borderColor: '#CFCFCF' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#000', color: '#fff' }}>
              <th className="text-left px-4 py-3 font-semibold">Proyecto</th>
              <th className="text-left px-4 py-3 font-semibold">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold">EPCista</th>
              <th className="text-left px-4 py-3 font-semibold">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold">Estado</th>
              <th className="text-left px-4 py-3 font-semibold">Fecha</th>
              <th className="text-left px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: '#888' }}>Sin proyectos.</td></tr>
            )}
            {lista.map((p, i) => (
              <tr key={p.id} style={{ borderTop: '1px solid #CFCFCF', backgroundColor: i % 2 === 0 ? '#fff' : '#fafaf8' }}>
                <td className="px-4 py-3 font-medium">{p.nombre_proyecto}</td>
                <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{p.cliente_final_empresa || '—'}</td>
                <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{p.epcista_nombre}</td>
                <td className="px-4 py-3"><BadgeTipo tipo={p.tipo} /></td>
                <td className="px-4 py-3"><BadgeEstado estado={p.estado} /></td>
                <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{formatDate(p.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/proyectos/${p.id}`} className="text-xs font-semibold underline">Ver</Link>
                    {confirmDelete === p.id ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: '#666' }}>¿Eliminar?</span>
                        <button
                          onClick={() => eliminarProyecto(p.id)}
                          disabled={deleting}
                          className="text-xs font-bold px-2 py-0.5 disabled:opacity-50"
                          style={{ backgroundColor: '#ef4444', color: '#fff' }}>
                          {deleting ? '…' : 'Sí'}
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs underline" style={{ color: '#666' }}>
                          No
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelete(p.id)} className="opacity-40 hover:opacity-100 transition-opacity">
                        <Trash2 size={14} style={{ color: '#ef4444' }} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: '#888' }}>{lista.length} proyecto{lista.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
