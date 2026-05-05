'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil, Trash2, Building2, Mail, Phone, MapPin, FileText, Paperclip, Search, Filter } from 'lucide-react'
import type { Cliente, Sitio, Archivo, Profile } from '@/lib/types'
import SitiosCliente from '@/components/SitiosCliente'
import UsuariosCliente from '@/components/UsuariosCliente'

function Campo({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ElementType }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium mb-0.5 text-muted">{label}</div>
      <div className="flex items-center gap-1.5 text-sm font-medium break-words">
        {Icon && <Icon size={13} className="text-muted shrink-0" />}
        <span className="break-words">{value}</span>
      </div>
    </div>
  )
}

export default function DetalleClientePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient()
   
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [sitios, setSitios] = useState<Sitio[]>([])
  const [epcistaId, setEpcistaId] = useState<string>('')
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<Partial<Cliente>>({})
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [archivosCliente, setArchivosCliente] = useState<(Archivo & { proyecto_nombre?: string })[]>([])
  const [docSearch, setDocSearch] = useState('')
  const [docTagFilter, setDocTagFilter] = useState<string | null>(null)

  // Linked users
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

  useEffect(() => {
    async function load() {
      const { id } = await params
      clienteIdRef.current = id
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) setEpcistaId(session.user.id)
      const [{ data: clienteData }, { data: sitiosData }] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', id).single(),
        supabase.from('sitios').select('*').eq('cliente_id', id).order('created_at', { ascending: true }),
      ])
      if (clienteData) { setCliente(clienteData as Cliente); setForm(clienteData as Cliente) }
      if (sitiosData) setSitios(sitiosData as Sitio[])

      // Load linked users
      await loadLinkedUsers(id)

      // Fetch all projects related to this client, then all archivos for those projects
      const { data: proyectos } = await supabase
        .from('proyectos')
        .select('id, nombre_proyecto')
        .or(`cliente_id.eq.${id},epcista_id.eq.${session?.user?.id}`)
      
      if (proyectos && proyectos.length > 0) {
        const projectIds = proyectos.map((p: { id: string }) => p.id)
        const projNameMap: Record<string, string> = {}
        proyectos.forEach((p: { id: string; nombre_proyecto: string }) => { projNameMap[p.id] = p.nombre_proyecto })

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

  async function handleGuardar() {
    if (!cliente) return
    setLoading(true)
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
    if (data) { setCliente(data as Cliente); setForm(data as Cliente) }
    setEditando(false)
    setLoading(false)
  }

  async function handleEliminar() {
    if (!cliente) return
    await supabase.from('clientes').delete().eq('id', cliente.id)
    router.push('/epc/clientes')
  }

  if (!cliente) return null

  const inputClass = "w-full border px-3 py-2 text-sm bg-white"
  const inputStyle = {}

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/epc/clientes" className="inline-flex items-center gap-1 text-sm mb-6 text-muted">
        <ChevronLeft size={14} />
        Volver a clientes
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">{cliente.razon_social}</h1>
          {cliente.industria && (
            <span className="text-sm mt-1 inline-block text-muted">{cliente.industria}</span>
          )}
        </div>
        <div className="flex gap-2">
          {!editando && (
            <>
              <button onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border font-medium border-borde rounded-xl">
                <Pencil size={13} /> Editar
              </button>
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border font-medium border-borde rounded-xl text-red-600">
                <Trash2 size={13} /> Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="border p-4 mb-4 flex items-center justify-between" style={{ borderColor: '#c00', backgroundColor: '#fff5f5' }}>
          <p className="text-sm font-medium">¿Eliminar este cliente? Esta acción no se puede deshacer.</p>
          <div className="flex gap-2 ml-4">
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-sm border border-borde rounded-xl">Cancelar</button>
            <button onClick={handleEliminar} className="px-3 py-1.5 text-sm font-bold text-white" style={{ backgroundColor: '#c00' }}>Eliminar</button>
          </div>
        </div>
      )}

      {editando ? (
        <div className="border p-8 glass-card">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Razón social *</label>
              <input type="text" value={form.razon_social ?? ''} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
                className={inputClass} style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">RFC</label>
                <input type="text" value={form.rfc ?? ''} onChange={e => setForm(f => ({ ...f, rfc: e.target.value }))}
                  className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select value={form.ubicacion_estado ?? ''} onChange={e => setForm(f => ({ ...f, ubicacion_estado: e.target.value }))}
                  className={inputClass} style={inputStyle}>
                  <option value="">Selecciona</option>
                  {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Industria</label>
              <select value={form.industria ?? ''} onChange={e => setForm(f => ({ ...f, industria: e.target.value }))}
                className={inputClass} style={inputStyle}>
                <option value="">Selecciona</option>
                {INDUSTRIAS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Contacto *</label>
                <input type="text" value={form.contacto_nombre ?? ''} onChange={e => setForm(f => ({ ...f, contacto_nombre: e.target.value }))}
                  className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cargo</label>
                <input type="text" value={form.contacto_cargo ?? ''} onChange={e => setForm(f => ({ ...f, contacto_cargo: e.target.value }))}
                  className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={form.contacto_email ?? ''} onChange={e => setForm(f => ({ ...f, contacto_email: e.target.value }))}
                  className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input type="tel" value={form.contacto_telefono ?? ''} onChange={e => setForm(f => ({ ...f, contacto_telefono: e.target.value }))}
                  className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notas</label>
              <textarea rows={3} value={form.notas ?? ''} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                className={inputClass} style={inputStyle} />
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button onClick={() => { setEditando(false); setForm(cliente) }}
              className="px-5 py-2 text-sm border border-borde rounded-xl">
              Cancelar
            </button>
            <button onClick={handleGuardar} disabled={loading}
              className="px-5 py-2 text-sm font-bold disabled:opacity-50 bg-acento text-principal rounded-xl">
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="border p-6 mb-4 glass-card">
            <h3 className="font-bold text-xs uppercase tracking-wide mb-4 text-muted">Empresa</h3>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Razón social" value={cliente.razon_social} icon={Building2} />
              <Campo label="RFC" value={cliente.rfc} />
              <Campo label="Industria" value={cliente.industria} />
              <Campo label="Estado" value={cliente.ubicacion_estado} icon={MapPin} />
            </div>
          </div>

          <div className="border p-6 mb-4 glass-card">
            <h3 className="font-bold text-xs uppercase tracking-wide mb-4 text-muted">Contacto principal</h3>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Nombre" value={cliente.contacto_nombre} />
              <Campo label="Cargo" value={cliente.contacto_cargo} />
              <Campo label="Email" value={cliente.contacto_email} icon={Mail} />
              <Campo label="Teléfono" value={cliente.contacto_telefono} icon={Phone} />
            </div>
          </div>

          {cliente.notas && (
            <div className="border p-6 glass-card">
              <h3 className="font-bold text-xs uppercase tracking-wide mb-3 text-muted">Notas internas</h3>
              <p className="text-sm whitespace-pre-wrap flex gap-2">
                <FileText size={14} style={{ color: '#888', flexShrink: 0, marginTop: 2 }} />
                {cliente.notas}
              </p>
            </div>
          )}

          {/* Usuarios del Cliente */}
          <UsuariosCliente
            clienteId={cliente.id}
            clienteNombre={cliente.razon_social}
            linkedUsers={linkedUsers}
            onUsersChanged={() => loadLinkedUsers(clienteIdRef.current)}
            canCreateWithPassword={true}
            canManageAllRoles={false}
          />

          <SitiosCliente
            clienteId={cliente.id}
            epcistaId={epcistaId}
            initialSitios={sitios}
          />

          {/* Aggregated Document Center */}
          {archivosCliente.length > 0 && (
            <div className="border mt-4 bg-white shadow-sm overflow-hidden border-borde rounded-xl">
              <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-borde rounded-xl">
                <div>
                  <h3 className="font-bold text-lg">Documentos del Cliente</h3>
                  <p className="text-sm text-muted">Todos los archivos de todos los proyectos de {cliente.razon_social}.</p>
                </div>
                <span className="text-xs font-bold px-3 py-1.5 rounded-md bg-gray-100 text-muted">
                  {archivosCliente.length} archivo{archivosCliente.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row gap-3 border-borde rounded-xl">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar por nombre o descripción..." 
                    value={docSearch}
                    onChange={e => setDocSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-acento/30 focus:border-acento transition-all outline-none border-borde rounded-xl"
                  />
                </div>
                {(() => {
                  const allTags = Array.from(new Set(archivosCliente.flatMap(a => a.tags || [])))
                  if (allTags.length === 0) return null
                  return (
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
                  )
                })()}
              </div>

              <div>
                {archivosCliente
                  .filter(a => {
                    if (docSearch && !a.nombre.toLowerCase().includes(docSearch.toLowerCase()) && !(a.descripcion || '').toLowerCase().includes(docSearch.toLowerCase())) return false
                    if (docTagFilter && !(a.tags || []).includes(docTagFilter)) return false
                    return true
                  })
                  .map(a => (
                    <div key={a.id} className="flex items-start gap-4 p-4 border-b hover:bg-gray-50/50 transition-colors" style={{ borderColor: '#eee' }}>
                      <div className="p-2 bg-gray-100 text-gray-500 rounded-lg mt-1">
                        <Paperclip size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline truncate">
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
                          <p className="text-sm mb-1 text-muted">{a.descripcion}</p>
                        )}
                        <div className="text-xs font-medium" style={{ color: '#999' }}>
                          {new Date(a.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} · {(a.profiles as Profile | undefined)?.nombre ?? 'Usuario'}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
