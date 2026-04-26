'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Trash2, Eye, Plus } from 'lucide-react'
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

  // Realtime: reflect changes made by other admin sessions
  useEffect(() => {
    const channel = supabase
      .channel('proyectos-admin')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const { error } = await supabase.rpc('admin_delete_proyecto', { proyecto_id: id })
    if (error) {
      alert('Error al borrar: ' + error.message)
    } else {
      setProyectos(prev => prev.filter(p => p.id !== id))
    }
    setConfirmDelete(null)
    setDeleting(false)
  }

  if (loading) return null

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 relative">
        <p className="text-sm text-gray-400 mb-1">Directorio</p>
        <h1 className="text-2xl font-black tracking-tight mt-1">Proyectos</h1>
        <p className="text-sm mt-1.5 text-gray-500">Todos los proyectos de la plataforma</p>
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
          <option value="enviada">Enviada</option>
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
      </div>

      <div className="rounded-xl border border-borde overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#fafafa] border-b border-borde text-[#444]">
            <tr>
              <th className="px-5 py-4 font-semibold">Proyecto</th>
              <th className="px-5 py-4 font-semibold">Cliente</th>
              <th className="px-5 py-4 font-semibold">EPCista</th>
              <th className="px-5 py-4 font-semibold">Tipo</th>
              <th className="px-5 py-4 font-semibold">Estado</th>
              <th className="px-5 py-4 font-semibold">Fecha</th>
              <th className="px-5 py-4 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lista.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: '#888' }}>Sin proyectos.</td></tr>
            )}
            {lista.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 font-bold text-principal">{p.nombre_proyecto}</td>
                <td className="px-5 py-3 text-xs text-gray-500 font-medium">{p.cliente_final_empresa || '—'}</td>
                <td className="px-5 py-3 text-xs text-gray-500 font-medium">{p.epcista_nombre}</td>
                <td className="px-5 py-3"><BadgeTipo tipo={p.tipo} /></td>
                <td className="px-5 py-3"><BadgeEstado estado={p.estado} /></td>
                <td className="px-5 py-3 text-xs font-medium text-gray-400">{formatDate(p.created_at)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Link href={`/admin/proyectos/${p.id}`} className="p-2 rounded-lg text-gray-400 hover:text-principal hover:bg-gray-100 transition-all">
                      <Eye size={16} />
                    </Link>
                    {confirmDelete === p.id ? (
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">¿Eliminar?</span>
                        <button
                          onClick={() => eliminarProyecto(p.id)}
                          disabled={deleting}
                          className="text-xs font-semibold px-2.5 py-1 rounded-md disabled:opacity-50 transition-colors bg-red-500 text-white hover:bg-red-600">
                          {deleting ? '…' : 'Sí'}
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs font-medium hover:underline text-gray-500 hover:text-gray-700 transition-colors">
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelete(p.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all">
                        <Trash2 size={16} />
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
