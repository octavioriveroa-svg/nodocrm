'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ChevronLeft, Building2, Mail, Phone, MapPin, FileText, Paperclip, Search, Filter, Briefcase, UserCircle } from 'lucide-react'
import type { Cliente, Sitio, Archivo, Profile } from '@/lib/types'
import BadgeEstado from '@/components/BadgeEstado'
import UsuariosCliente from '@/components/UsuariosCliente'
import SitiosCliente from '@/components/SitiosCliente'

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

interface ProyectoResumen {
  id: string
  nombre_proyecto: string
  estado: string
  historial_estados?: Record<string, string>
  created_at: string
}

export default function AnalistaClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [proyectos, setProyectos] = useState<ProyectoResumen[]>([])
  const [archivosCliente, setArchivosCliente] = useState<(Archivo & { proyecto_nombre?: string })[]>([])
  const [docSearch, setDocSearch] = useState('')
  const [docTagFilter, setDocTagFilter] = useState<string | null>(null)
  const [sitios, setSitios] = useState<Sitio[]>([])
  const [epcistaInfo, setEpcistaInfo] = useState<{ nombre: string; empresa: string } | null>(null)

  const [linkedUsers, setLinkedUsers] = useState<{id: string; nombre: string; empresa: string; rol: string; created_at: string}[]>([])
  const clienteIdRef = useRef<string>('')

  const loadLinkedUsers = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nombre, empresa, rol, created_at')
      .eq('cliente_crm_id', id)
      .order('created_at', { ascending: false })
    if (data) setLinkedUsers(data)
  }, [supabase])

  useEffect(() => {
    async function load() {
      const { id } = await params
      clienteIdRef.current = id

      const { data: clienteData } = await supabase.from('clientes').select('*').eq('id', id).single()
      if (clienteData) {
        setCliente(clienteData as Cliente)

        const { data: epcistaProfile } = await supabase
          .from('profiles')
          .select('nombre, empresa')
          .eq('id', (clienteData as Cliente).epcista_id)
          .single()
        if (epcistaProfile) setEpcistaInfo(epcistaProfile as { nombre: string; empresa: string })
      }

      await loadLinkedUsers(id)

      const { data: sitiosData } = await supabase
        .from('sitios')
        .select('*')
        .eq('cliente_id', id)
        .order('created_at', { ascending: true })
      if (sitiosData) setSitios(sitiosData as Sitio[])

      const { data: projs } = await supabase
        .from('proyectos')
        .select('id, nombre_proyecto, estado, historial_estados, created_at')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })

      if (projs) setProyectos(projs as ProyectoResumen[])

      if (projs && projs.length > 0) {
        const projectIds = projs.map((p: ProyectoResumen) => p.id)
        const projNameMap: Record<string, string> = {}
        projs.forEach((p: ProyectoResumen) => { projNameMap[p.id] = p.nombre_proyecto })

        const { data: archData } = await supabase
          .from('archivos')
          .select('*, profiles(*)')
          .in('proyecto_id', projectIds)
          .order('created_at', { ascending: false })

        if (archData) {
          setArchivosCliente(archData.map((a: Archivo) => ({
            ...a,
            proyecto_nombre: projNameMap[a.proyecto_id] || 'Proyecto',
          })))
        }
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!cliente) return null

  const allTags = Array.from(new Set(archivosCliente.flatMap(a => a.tags || [])))
  const filteredArchivos = archivosCliente.filter(a => {
    if (docSearch && !a.nombre.toLowerCase().includes(docSearch.toLowerCase()) && !(a.descripcion || '').toLowerCase().includes(docSearch.toLowerCase())) return false
    if (docTagFilter && !(a.tags || []).includes(docTagFilter)) return false
    return true
  })

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/analista/clientes" className="inline-flex items-center gap-1 text-sm mb-6 text-gray-500 hover:text-principal transition-colors">
        <ChevronLeft size={14} />
        Volver a clientes
      </Link>

      {/* EPCista Owner Badge */}
      {epcistaInfo && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl border border-borde bg-gray-50">
          <UserCircle size={18} className="text-gray-400 shrink-0" />
          <div className="text-sm">
            <span className="text-gray-500">EPCista propietario: </span>
            <span className="font-bold text-principal">{epcistaInfo.nombre}</span>
            <span className="text-gray-400 ml-1">({epcistaInfo.empresa})</span>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-black">{cliente.razon_social}</h1>
        {cliente.industria && (
          <span className="text-sm mt-1 inline-block text-gray-500">{cliente.industria}</span>
        )}
      </div>

      {/* Client Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border border-borde rounded-xl p-5 bg-white shadow-sm">
          <h3 className="font-bold text-xs uppercase tracking-wide text-gray-400 mb-4">Empresa</h3>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Razón social" value={cliente.razon_social} icon={Building2} />
            <Campo label="RFC" value={cliente.rfc} />
            <Campo label="Industria" value={cliente.industria} />
            <Campo label="Estado" value={cliente.ubicacion_estado} icon={MapPin} />
          </div>
        </div>

        <div className="border border-borde rounded-xl p-5 bg-white shadow-sm">
          <h3 className="font-bold text-xs uppercase tracking-wide text-gray-400 mb-4">Contacto principal</h3>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Nombre" value={cliente.contacto_nombre} />
                <Campo label="Cargo" value={cliente.contacto_cargo} />
              </div>
              <Campo label="Email" value={cliente.contacto_email} icon={Mail} />
              <Campo label="Teléfono" value={cliente.contacto_telefono} icon={Phone} />
            </div>
        </div>
      </div>

      {cliente.notas && (
        <div className="border border-borde rounded-xl p-5 bg-white shadow-sm mb-6">
          <h3 className="font-bold text-xs uppercase tracking-wide text-gray-400 mb-3">Notas internas</h3>
          <p className="text-sm whitespace-pre-wrap flex gap-2 text-gray-700">
            <FileText size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
            {cliente.notas}
          </p>
        </div>
      )}

      {/* Usuarios del Cliente (read-only view) */}
      <UsuariosCliente
        clienteId={cliente.id}
        clienteNombre={cliente.razon_social}
        linkedUsers={linkedUsers}
        onUsersChanged={() => loadLinkedUsers(clienteIdRef.current)}
        canCreateWithPassword={false}
        canManageAllRoles={false}
      />

      {/* Sitios del Cliente (read-only) */}
      <SitiosCliente
        clienteId={cliente.id}
        epcistaId={cliente.epcista_id}
        initialSitios={sitios}
      />

      {/* Projects linked to client */}
      {proyectos.length > 0 && (
        <div className="border border-borde rounded-xl bg-white shadow-sm mb-6 overflow-hidden">
          <div className="p-5 border-b border-borde flex items-center gap-3">
            <Briefcase size={18} className="text-acento" />
            <h3 className="font-bold text-lg">Proyectos del Cliente</h3>
            <span className="ml-auto text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-md">
              {proyectos.length}
            </span>
          </div>
          {proyectos.map(p => (
            <Link key={p.id} href={`/analista/proyectos/${p.id}`}
              className="flex items-center justify-between p-4 border-b border-borde/50 hover:bg-gray-50 transition-colors group">
              <div>
                <span className="font-bold text-principal group-hover:underline">{p.nombre_proyecto}</span>
                <span className="text-xs text-gray-400 ml-3">
                  {new Date(p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <BadgeEstado estado={p.estado} />
            </Link>
          ))}
        </div>
      )}

      {/* Aggregated Document Center */}
      {archivosCliente.length > 0 && (
        <div className="border border-borde rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-borde flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-lg">Documentos del Cliente</h3>
              <p className="text-sm text-gray-500">Todos los archivos de todos los proyectos de {cliente.razon_social}.</p>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-md bg-gray-100 text-gray-600">
              {archivosCliente.length} archivo{archivosCliente.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="p-4 border-b border-borde bg-gray-50 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o descripción..."
                value={docSearch}
                onChange={e => setDocSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-borde rounded-lg focus:ring-2 focus:ring-acento/30 focus:border-acento transition-all outline-none"
              />
            </div>
            {allTags.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <Filter size={14} className="text-gray-400 shrink-0" />
                <button
                  onClick={() => setDocTagFilter(null)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md shrink-0 transition-colors ${!docTagFilter ? 'bg-principal text-acento' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                >
                  Todos
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setDocTagFilter(tag)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md shrink-0 transition-colors uppercase ${docTagFilter === tag ? 'bg-principal text-acento' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            {filteredArchivos.length === 0 ? (
              <div className="p-10 text-center text-gray-400">No se encontraron documentos.</div>
            ) : (
              filteredArchivos.map(a => (
                <div key={a.id} className="flex items-start gap-4 p-4 border-b border-borde/50 hover:bg-gray-50/50 transition-colors">
                  <div className="p-2 bg-gray-100 text-gray-500 rounded-lg mt-1">
                    <Paperclip size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-bold text-principal hover:underline truncate">
                        {a.nombre}
                      </a>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md">
                        {a.proyecto_nombre}
                      </span>
                      {(a.tags || []).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[10px] font-bold uppercase rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {a.descripcion && (
                      <p className="text-sm text-gray-600 mb-1">{a.descripcion}</p>
                    )}
                    <div className="text-xs text-gray-400 font-medium">
                      {new Date(a.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} · {(a.profiles as Profile | undefined)?.nombre ?? 'Usuario'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
