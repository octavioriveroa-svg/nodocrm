'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trash2, Eye, Plus, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import { fetchProyectosDirectory } from '@/lib/domains/proyectos/queries'
import type { ProyectoConEpcista } from '@/lib/domains/proyectos/queries'
import type { EstadoProyecto, TipoProyecto, Rol } from '@/lib/types'

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

interface Props {
  portalPrefix: 'admin' | 'analista' | 'epc' | 'finder'
  canDelete?: boolean
}

export default function SharedProjectDirectoryView({ portalPrefix, canDelete = false }: Props) {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<ProyectoConEpcista[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<EstadoProyecto | 'todos'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<TipoProyecto | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    const channel = supabase
      .channel(`proyectos-${portalPrefix}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'proyectos' }, (payload) => {
        setProyectos((prev) => prev.filter((p) => p.id !== (payload.old as { id: string }).id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'proyectos' }, (payload) => {
        setProyectos((prev) =>
          prev.map((p) => (p.id === payload.new.id ? ({ ...p, ...payload.new } as ProyectoConEpcista) : p))
        )
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [portalPrefix, supabase])

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const roleMap: Record<string, Rol> = {
        admin: 'nodo_admin',
        analista: 'nodo_analista',
        epc: 'epc',
        finder: 'finder',
      }
      const role = roleMap[portalPrefix]
      const data = await fetchProyectosDirectory(supabase, {
        role,
        userId: session?.user?.id,
      })
      setProyectos(data)
      setLoading(false)
    }
    load()
  }, [portalPrefix, supabase])

  async function handleDelete(id: string) {
    setDeleting(true)
    const { error } = await supabase.from('proyectos').delete().eq('id', id)
    if (!error) {
      setProyectos((prev) => prev.filter((p) => p.id !== id))
    }
    setDeleting(false)
    setConfirmDelete(null)
  }

  const filtrados = proyectos.filter((p) => {
    const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado
    const matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo
    const matchBusqueda =
      !busqueda ||
      p.nombre_proyecto.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.cliente_final_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.cliente_final_empresa.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.epcista_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.epcista_empresa.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.responsable_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.finder_nombre.toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchTipo && matchBusqueda
  })

  const newProjectHref =
    portalPrefix === 'epc' || portalPrefix === 'finder' ? `/${portalPrefix}/nuevo` : `/${portalPrefix}/proyectos/nuevo`

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Directorio de Proyectos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtrados.length} {filtrados.length === 1 ? 'proyecto' : 'proyectos'} encontrados
          </p>
        </div>
        <Link
          href={newProjectHref}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-principal text-acento text-sm font-semibold rounded-xl hover:opacity-95 transition-opacity self-start sm:self-auto shadow-sm"
        >
          <Plus size={16} />
          Nuevo Proyecto
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por proyecto, cliente, EPC o responsable..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-principal/20 focus:border-principal"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoProyecto | 'todos')}
          className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-principal/20 focus:border-principal text-gray-700 font-medium"
        >
          <option value="todos">Todos los Estados</option>
          <option value="prospecto">Prospecto</option>
          <option value="evaluacion">Evaluación</option>
          <option value="oferta_enviada">Oferta Enviada</option>
          <option value="negociacion">Negociación</option>
          <option value="aprobado">Aprobado</option>
          <option value="en_construccion">En Construcción</option>
          <option value="operativo">Operativo</option>
          <option value="rechazado">Rechazado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as TipoProyecto | 'todos')}
          className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-principal/20 focus:border-principal text-gray-700 font-medium"
        >
          <option value="todos">Todas las Tecnologías</option>
          <option value="FV">FV</option>
          <option value="BESS">BESS</option>
          <option value="FV+BESS">FV + BESS</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400 flex flex-col items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-acento border-t-transparent animate-spin" />
            Cargando proyectos...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            No se encontraron proyectos con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200/80 bg-gray-50/50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Proyecto</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Tecnología</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">EPC / Finder</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filtrados.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/${portalPrefix}/proyectos/${p.id}`}
                        className="font-semibold text-principal hover:underline"
                      >
                        {p.nombre_proyecto}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{p.cliente_final_empresa}</div>
                      <div className="text-xs text-gray-400">{p.cliente_final_nombre}</div>
                    </td>
                    <td className="py-3 px-4">
                      <BadgeTipo tipo={p.tipo} />
                    </td>
                    <td className="py-3 px-4">
                      <BadgeEstado estado={p.estado} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-gray-700 font-medium">{p.epcista_empresa || p.epcista_nombre || '—'}</div>
                      {p.finder_empresa && (
                        <div className="text-[11px] text-gray-400">Finder: {p.finder_empresa}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/${portalPrefix}/proyectos/${p.id}`}
                          className="p-1.5 text-gray-400 hover:text-principal hover:bg-gray-100 rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <Eye size={16} />
                        </Link>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(p.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar proyecto"
                          >
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
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">¿Eliminar proyecto?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Esta acción eliminará el proyecto y todos sus registros técnicos y financieros vinculados de manera permanente.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
