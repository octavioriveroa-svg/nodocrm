'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Search,
  Pencil,
  Trash2,
  UserCircle,
} from 'lucide-react'
import type { Cliente, Sitio, Archivo, Profile } from '@/lib/types'
import BadgeEstado from '@/components/BadgeEstado'
import UsuariosCliente from '@/components/UsuariosCliente'
import SitiosCliente from '@/components/SitiosCliente'
import { fetchClienteDetalleCompleto } from '@/lib/domains/clientes/queries'

function Campo({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ElementType }) {
  if (!value) return null
  return (
    <div className="min-w-0 overflow-hidden">
      <div className="text-xs font-medium mb-0.5 text-gray-400">{label}</div>
      <div className="flex items-center gap-1.5 text-sm font-medium break-all">
        {Icon && <Icon size={13} className="text-gray-400 shrink-0" />}
        <span className="break-all">{value}</span>
      </div>
    </div>
  )
}

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
]

const INDUSTRIAS = [
  'Manufactura','Minería','Retail / Comercio','Hotelería / Turismo','Agroindustria',
  'Logística / Transporte','Inmobiliario','Salud','Educación','Gobierno','Energía','Tecnología','Otra',
]

interface ProyectoResumen {
  id: string
  nombre_proyecto: string
  estado: string
  historial_estados?: Record<string, string>
  created_at: string
}

interface Props {
  params: Promise<{ id: string }>
  portalPrefix: 'admin' | 'analista' | 'epc' | 'finder'
  canDelete?: boolean
}

export default function SharedClientDetailView({ params, portalPrefix, canDelete = false }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [sitios, setSitios] = useState<Sitio[]>([])
  const [proyectos, setProyectos] = useState<ProyectoResumen[]>([])
  const [archivosCliente, setArchivosCliente] = useState<(Archivo & { proyecto_nombre?: string })[]>([])
  const [epcistaInfo, setEpcistaInfo] = useState<{ nombre: string; empresa: string } | null>(null)
  const [linkedUsers, setLinkedUsers] = useState<Profile[]>([])
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState<Partial<Cliente>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [docTagFilter, setDocTagFilter] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const clienteIdRef = useRef<string>('')

  const loadData = useCallback(async () => {
    const { id } = await params
    clienteIdRef.current = id

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

    const data = await fetchClienteDetalleCompleto(supabase, id, viewerProfile as Profile)
    if (!data) {
      setNotFound(true)
      return
    }

    setCliente(data.cliente)
    setForm(data.cliente)
    setSitios(data.sitios)
    setProyectos(data.proyectos)
    setArchivosCliente(data.archivos)
    setEpcistaInfo(data.epcistaInfo)
    setLinkedUsers(data.linkedUsers)
  }, [params, supabase])

  useEffect(() => {
    void (async () => {
      await loadData()
    })()
  }, [loadData])

  async function handleGuardar() {
    if (!cliente) return
    setGuardando(true)
    const { data } = await supabase
      .from('clientes')
      .update({
        razon_social: form.razon_social,
        rfc: form.rfc || null,
        industria: form.industria || null,
        ubicacion_estado: form.ubicacion_estado || null,
        contacto_nombre: form.contacto_nombre,
        contacto_cargo: form.contacto_cargo || null,
        contacto_email: form.contacto_email || null,
        contacto_telefono: form.contacto_telefono || null,
        notas: form.notas || null,
      })
      .eq('id', cliente.id)
      .select()
      .single()

    if (data) {
      setCliente(data as Cliente)
      setForm(data as Cliente)
    }
    setEditando(false)
    setGuardando(false)
  }

  async function handleEliminar() {
    if (!cliente) return
    await supabase.from('clientes').delete().eq('id', cliente.id)
    router.push(`/${portalPrefix}/clientes`)
  }

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center">
        <p className="text-gray-500 mb-4">Cliente no encontrado o sin permisos de acceso</p>
        <Link
          href={`/${portalPrefix}/clientes`}
          className="inline-flex items-center gap-2 text-sm text-acento hover:underline"
        >
          <ChevronLeft size={16} /> Volver a clientes
        </Link>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
          <span className="text-sm text-gray-400">Cargando cliente…</span>
        </div>
      </div>
    )
  }

  const allTags = Array.from(new Set(archivosCliente.flatMap((a) => a.tags || [])))
  const filteredArchivos = archivosCliente.filter((a) => {
    if (
      docSearch &&
      !a.nombre.toLowerCase().includes(docSearch.toLowerCase()) &&
      !(a.descripcion || '').toLowerCase().includes(docSearch.toLowerCase())
    )
      return false
    if (docTagFilter && !(a.tags || []).includes(docTagFilter)) return false
    return true
  })

  const inputClass = 'w-full border px-3 py-2 text-sm bg-white rounded-lg border-gray-300'

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href={`/${portalPrefix}/clientes`}
        className="inline-flex items-center gap-1 text-sm mb-6 text-gray-500 hover:text-principal transition-colors"
      >
        <ChevronLeft size={14} />
        Volver a clientes
      </Link>

      {/* EPCista Owner Badge */}
      {epcistaInfo && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
          <UserCircle size={18} className="text-gray-400 shrink-0" />
          <div className="text-sm">
            <span className="text-gray-500">EPCista propietario: </span>
            <span className="font-bold text-principal">{epcistaInfo.nombre}</span>
            <span className="text-gray-400 ml-1">({epcistaInfo.empresa})</span>
          </div>
        </div>
      )}

      {/* Header with Edit/Delete buttons */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">{cliente.razon_social}</h1>
          {cliente.industria && (
            <span className="text-sm mt-1 inline-block text-gray-500">{cliente.industria}</span>
          )}
        </div>
        <div className="flex gap-2">
          {!editando && (
            <>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border font-semibold rounded-xl hover:bg-gray-50 transition-colors border-gray-200"
              >
                <Pencil size={14} /> Editar
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm border font-semibold rounded-xl hover:bg-red-50 transition-colors border-gray-200 text-red-600"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="border p-4 mb-6 flex items-center justify-between rounded-xl border-red-300 bg-red-50">
          <p className="text-sm font-medium text-red-800">
            ¿Eliminar este cliente y todos sus datos? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 ml-4 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-2 text-sm border rounded-xl bg-white border-gray-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleEliminar}
              className="px-4 py-2 text-sm font-bold text-white rounded-xl bg-red-600 hover:bg-red-700"
            >
              Eliminar cliente
            </button>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editando ? (
        <div className="border border-gray-200 rounded-xl p-8 bg-white shadow-sm mb-6">
          <h3 className="font-bold text-xs uppercase tracking-wide text-gray-400 mb-6">Editar Cliente</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Razón social *</label>
              <input
                type="text"
                value={form.razon_social ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, razon_social: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">RFC</label>
                <input
                  type="text"
                  value={form.rfc ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Industria</label>
                <select
                  value={form.industria ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, industria: e.target.value || null }))}
                  className={inputClass}
                >
                  <option value="">Selecciona industria</option>
                  {INDUSTRIAS.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <select
                value={form.ubicacion_estado ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, ubicacion_estado: e.target.value || null }))}
                className={inputClass}
              >
                <option value="">Selecciona estado</option>
                {ESTADOS_MX.map((est) => (
                  <option key={est} value={est}>
                    {est}
                  </option>
                ))}
              </select>
            </div>
            <div className="border-t border-gray-100 pt-4 mt-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Contacto Principal</p>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={form.contacto_nombre ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, contacto_nombre: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Cargo</label>
                    <input
                      type="text"
                      value={form.contacto_cargo ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, contacto_cargo: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={form.contacto_email ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, contacto_email: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={form.contacto_telefono ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, contacto_telefono: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notas</label>
              <textarea
                value={form.notas ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                rows={3}
                className={inputClass}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="px-4 py-2 text-sm border rounded-xl border-gray-300 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardar}
                disabled={guardando || !form.razon_social?.trim() || !form.contacto_nombre?.trim()}
                className="px-5 py-2 text-sm font-bold bg-principal text-acento rounded-xl hover:opacity-95 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Info Card */}
          <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <h3 className="font-bold text-xs uppercase tracking-wide text-gray-400 mb-4">Información General</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Campo label="RFC" value={cliente.rfc} icon={Building2} />
              <Campo label="Industria" value={cliente.industria} icon={Building2} />
              <Campo label="Estado" value={cliente.ubicacion_estado} icon={MapPin} />
              <Campo label="Contacto" value={cliente.contacto_nombre} icon={UserCircle} />
              <Campo label="Cargo" value={cliente.contacto_cargo} />
              <Campo label="Email" value={cliente.contacto_email} icon={Mail} />
              <Campo label="Teléfono" value={cliente.contacto_telefono} icon={Phone} />
            </div>
            {cliente.notas && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">
                <span className="font-medium text-gray-800">Notas: </span>
                {cliente.notas}
              </div>
            )}
          </div>

          {/* Linked Users Section */}
          <UsuariosCliente
            clienteId={cliente.id}
            clienteNombre={cliente.razon_social}
            linkedUsers={linkedUsers}
            onUsersChanged={() => {
              void loadData()
            }}
            canCreateWithPassword={portalPrefix === 'admin' || portalPrefix === 'analista'}
            canManageAllRoles={portalPrefix === 'admin' || portalPrefix === 'analista'}
            readOnly={!canDelete && portalPrefix !== 'admin' && portalPrefix !== 'analista' && portalPrefix !== 'epc'}
          />

          {/* Sites Section */}
          <SitiosCliente
            clienteId={cliente.id}
            epcistaId={cliente.epcista_id || ''}
            initialSitios={sitios}
          />

          {/* Projects Section */}
          <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-xs uppercase tracking-wide text-gray-400">Proyectos Vinculados</h3>
              <span className="text-xs text-gray-400">{proyectos.length} proyectos</span>
            </div>
            {proyectos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay proyectos vinculados a este cliente.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {proyectos.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between">
                    <div>
                      <Link
                        href={`/${portalPrefix}/proyectos/${p.id}`}
                        className="font-semibold text-sm text-principal hover:underline"
                      >
                        {p.nombre_proyecto}
                      </Link>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Creado el {new Date(p.created_at).toLocaleDateString('es-MX')}
                      </div>
                    </div>
                    <BadgeEstado estado={p.estado} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents Section */}
          <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-xs uppercase tracking-wide text-gray-400">Documentos del Cliente</h3>
              <span className="text-xs text-gray-400">{archivosCliente.length} documentos</span>
            </div>

            {archivosCliente.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Buscar documento..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-principal"
                  />
                </div>
                {allTags.length > 0 && (
                  <select
                    value={docTagFilter || ''}
                    onChange={(e) => setDocTagFilter(e.target.value || null)}
                    className="px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none text-gray-600"
                  >
                    <option value="">Todas las etiquetas</option>
                    {allTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {filteredArchivos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay documentos cargados para este cliente.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredArchivos.map((a) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={16} className="text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-principal hover:underline truncate block"
                        >
                          {a.nombre}
                        </a>
                        <div className="text-[10px] text-gray-400">
                          {a.proyecto_nombre} • {new Date(a.created_at).toLocaleDateString('es-MX')}
                        </div>
                      </div>
                    </div>
                    {a.tags && a.tags.length > 0 && (
                      <div className="flex gap-1 shrink-0">
                        {a.tags.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 text-[9px] font-medium bg-gray-100 text-gray-600 rounded"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
