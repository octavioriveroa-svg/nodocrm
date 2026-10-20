'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Mail,
  Phone,
  User,
  Trash2,
  Eye,
  Building2,
  MapPin,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchClientesDirectory, type ClienteSummary } from '@/lib/domains/clientes/queries'
import { deleteCliente } from '@/lib/domains/clientes/mutations'
import type { Profile } from '@/lib/types'

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

export interface SharedClientDirectoryViewProps {
  portalPrefix: 'admin' | 'analista' | 'epc' | 'finder'
  canCreate?: boolean
  canDelete?: boolean
  defaultView?: 'table' | 'grid'
  initialClients?: ClienteSummary[]
}

export default function SharedClientDirectoryView({
  portalPrefix,
  canCreate = true,
  canDelete = false,
  defaultView = 'table',
  initialClients,
}: SharedClientDirectoryViewProps) {
  const supabase = createClient()
  const [clientes, setClientes] = useState<ClienteSummary[]>(initialClients || [])
  const [loading, setLoading] = useState(!initialClients)
  const [busqueda, setBusqueda] = useState('')
  const [filtroIndustria, setFiltroIndustria] = useState<string>('todos')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(defaultView)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (initialClients) return

    let cancelled = false
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user || cancelled) {
        setLoading(false)
        return
      }

      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (!viewerProfile || cancelled) {
        setLoading(false)
        return
      }

      const data = await fetchClientesDirectory(supabase, viewerProfile as Profile)
      if (!cancelled) {
        setClientes(data)
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [initialClients, supabase])

  // Real-time updates subscription
  useEffect(() => {
    async function reload() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (!viewerProfile) return
      const data = await fetchClientesDirectory(supabase, viewerProfile as Profile)
      setClientes(data)
    }

    const channel = supabase
      .channel(`clientes-directory-${portalPrefix}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'clientes' }, (payload) => {
        setClientes((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clientes' }, (payload) => {
        setClientes((prev) =>
          prev.map((c) => (c.id === payload.new.id ? ({ ...c, ...payload.new } as ClienteSummary) : c))
        )
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clientes' }, () => {
        void reload()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [portalPrefix, supabase])

  async function handleDelete(id: string) {
    setDeleting(true)
    const res = await deleteCliente(supabase, id)
    if (res.success) {
      setClientes((prev) => prev.filter((c) => c.id !== id))
    }
    setDeleting(false)
    setConfirmDelete(null)
  }

  // Filter clients
  const filtrados = clientes.filter((c) => {
    const matchIndustria = filtroIndustria === 'todos' || c.industria === filtroIndustria
    if (!matchIndustria) return false

    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      (c.razon_social || '').toLowerCase().includes(q) ||
      (c.contacto_nombre || '').toLowerCase().includes(q) ||
      (c.contacto_email || '').toLowerCase().includes(q) ||
      (c.contacto_telefono || '').toLowerCase().includes(q) ||
      (c.rfc || '').toLowerCase().includes(q) ||
      (c.industria || '').toLowerCase().includes(q) ||
      (c.epcista_nombre || '').toLowerCase().includes(q) ||
      (c.ubicacion_estado || '').toLowerCase().includes(q)
    )
  })

  // Unique industries
  const allIndustrias = Array.from(new Set(clientes.map((c) => c.industria).filter(Boolean) as string[]))

  const newClientHref = `/${portalPrefix}/clientes/nuevo`

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400 mb-1">Directorio</p>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Clientes</h1>
          <p className="text-sm mt-1 text-gray-500">
            {clientes.length} {clientes.length === 1 ? 'cliente registrado' : 'clientes registrados'}
          </p>
        </div>
        {canCreate && (
          <Link
            href={newClientHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-principal text-acento text-sm font-semibold rounded-xl hover:opacity-95 transition-all shadow-sm active:scale-[0.98] self-start sm:self-auto"
          >
            <Plus size={16} />
            Nuevo cliente
          </Link>
        )}
      </div>

      {/* Toolbar: Search, Filter, Layout Toggle */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por razón social, contacto, email, RFC o EPCista..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-principal/20 focus:border-principal"
          />
        </div>

        {allIndustrias.length > 0 && (
          <select
            value={filtroIndustria}
            onChange={(e) => setFiltroIndustria(e.target.value)}
            className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-principal/20 focus:border-principal text-gray-700 font-medium"
          >
            <option value="todos">Todas las industrias</option>
            {allIndustrias.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        )}

        {/* View Mode Toggle */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'table' ? 'bg-white text-principal shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Vista de tabla"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-white text-principal shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Vista de cuadrícula"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200/80 p-16 text-center shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
            <span className="text-sm text-gray-400">Cargando directorio de clientes...</span>
          </div>
        </div>
      ) : clientes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 flex flex-col items-center text-center shadow-sm">
          <Building2 size={40} className="text-gray-300 mb-3" />
          <h3 className="font-bold text-lg text-gray-800">Aún no hay clientes registrados</h3>
          <p className="text-sm mt-1 mb-6 text-gray-400 max-w-sm">
            Registra tu primer cliente para asociarlo a sitios y proyectos solares o de almacenamiento.
          </p>
          {canCreate && (
            <Link
              href={newClientHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-principal text-acento font-semibold text-sm rounded-xl hover:opacity-95 shadow-sm transition-all"
            >
              <Plus size={16} />
              Nuevo cliente
            </Link>
          )}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 p-12 text-center text-sm text-gray-400 shadow-sm">
          No se encontraron clientes que coincidan con &quot;{busqueda}&quot;.
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="rounded-xl border border-gray-200/80 overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-400 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Razón social</th>
                  <th className="px-5 py-3.5">RFC</th>
                  <th className="px-5 py-3.5">Industria</th>
                  <th className="px-5 py-3.5">Contacto</th>
                  <th className="px-5 py-3.5">EPCista</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5">Registro</th>
                  {canDelete && <th className="px-5 py-3.5 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/${portalPrefix}/clientes/${c.id}`}
                        className="font-bold text-principal hover:underline block"
                      >
                        {c.razon_social}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-gray-400">{c.rfc || '—'}</td>
                    <td className="px-5 py-3.5 text-xs font-medium text-gray-500">{c.industria || '—'}</td>
                    <td className="px-5 py-3.5 text-xs">
                      <div className="font-semibold text-gray-800">{c.contacto_nombre}</div>
                      {c.contacto_email && <div className="text-gray-400 mt-0.5">{c.contacto_email}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-gray-600">{c.epcista_nombre || '—'}</td>
                    <td className="px-5 py-3.5 text-xs font-medium text-gray-500">{c.ubicacion_estado || '—'}</td>
                    <td className="px-5 py-3.5 text-xs font-medium text-gray-400">{formatDate(c.created_at)}</td>
                    {canDelete && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/${portalPrefix}/clientes/${c.id}`}
                            className="p-1.5 text-gray-400 hover:text-principal hover:bg-gray-100 rounded-lg transition-colors"
                            title="Ver cliente"
                          >
                            <Eye size={15} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(c.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar cliente"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-400">
            Mostrando {filtrados.length} de {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
          </div>
        </div>
      ) : (
        /* CARD GRID VIEW */
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtrados.map((c) => (
              <Link
                key={c.id}
                href={`/${portalPrefix}/clientes/${c.id}`}
                className="rounded-xl border border-gray-200/80 p-5 flex flex-col justify-between hover:shadow-lg hover:border-gray-300 transition-all bg-white group h-full shadow-sm"
              >
                <div>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-principal font-bold text-sm shrink-0 shadow-sm bg-acento">
                      {c.razon_social.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-principal line-clamp-1 break-all" title={c.razon_social}>
                        {c.razon_social}
                      </h3>
                      {c.industria && <p className="text-xs text-gray-500 mt-0.5 truncate">{c.industria}</p>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mb-4 text-xs text-gray-600">
                    {c.contacto_email && (
                      <span className="flex items-center gap-2 truncate">
                        <Mail size={14} className="text-gray-400 shrink-0" />
                        <span className="truncate">{c.contacto_email}</span>
                      </span>
                    )}
                    {c.contacto_telefono && (
                      <span className="flex items-center gap-2 truncate">
                        <Phone size={14} className="text-gray-400 shrink-0" />
                        <span className="truncate">{c.contacto_telefono}</span>
                      </span>
                    )}
                    {c.contacto_nombre && (
                      <span className="flex items-center gap-2 truncate">
                        <User size={14} className="text-gray-400 shrink-0" />
                        <span className="truncate">
                          {c.contacto_nombre}
                          {c.contacto_cargo && <span className="text-gray-400"> · {c.contacto_cargo}</span>}
                        </span>
                      </span>
                    )}
                    {c.ubicacion_estado && (
                      <span className="flex items-center gap-2 truncate text-gray-400">
                        <MapPin size={14} className="text-gray-400 shrink-0" />
                        <span className="truncate">{c.ubicacion_estado}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-auto">
                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                    {formatDate(c.created_at)}
                  </span>
                  <span className="text-xs font-semibold text-principal inline-flex items-center gap-1 group-hover:underline">
                    Ver detalles <ChevronRight size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <p className="text-xs mt-3 text-gray-400">
            Mostrando {filtrados.length} de {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">¿Eliminar cliente?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Esta acción eliminará el cliente de forma permanente. Los sitios o proyectos vinculados deberán ser reasignados.
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
                onClick={() => confirmDelete && handleDelete(confirmDelete)}
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
