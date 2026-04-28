/* eslint-disable */
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BadgeEstado from './BadgeEstado'
import BadgeTipo from './BadgeTipo'
import { Button } from './ui/Button'
import { Card, CardTitle } from './ui/Card'
import type { Proyecto, Comentario, Archivo, Profile, EstadoProyecto, ModalidadFinanciamiento, Sitio, ProyectoSitioProducto } from '@/lib/types'
import { Send, ChevronLeft, MapPin, Zap, Battery, Wrench, HelpCircle, Trash2, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import GanttChart from './gantt/GanttChart'
import ModalHito from './gantt/ModalHito'
import type { HitoConstruccion } from '@/lib/types'
import DocumentCenter from './DocumentCenter'

const MODALIDAD_LABELS: Record<ModalidadFinanciamiento, string> = {
  credito: 'Crédito',
  arrendamiento: 'Arrendamiento',
  ensaas: 'EnSaaS',
  mem: 'Mercado Eléctrico Mayorista',
  no_sabe: 'Analista define modalidad',
}

const ESTADO_LABELS: Record<string, string> = {
  recibido: 'Lead',
  en_analisis: 'En análisis',
  propuesta_lista: 'Propuesta lista',
  enviada: 'Propuesta enviada',
  cliente_interesado: 'Cliente interesado',
  negociacion: 'Negociación',
  aprobado: 'Cierre',
  en_construccion: 'En construcción',
  operativo: 'Operativo',
  completado: 'Completado',
}

// Ordered sales cycle stages for the timeline
const SALES_CYCLE: { key: string; label: string }[] = [
  { key: 'recibido', label: 'Lead' },
  { key: 'en_analisis', label: 'Análisis' },
  { key: 'propuesta_lista', label: 'Propuesta' },
  { key: 'enviada', label: 'Enviada' },
  { key: 'cliente_interesado', label: 'Interesado' },
  { key: 'negociacion', label: 'Negociación' },
  { key: 'aprobado', label: 'Cierre' },
  { key: 'en_construccion', label: 'Construcción' },
  { key: 'operativo', label: 'Operativo' },
  { key: 'completado', label: 'Completado' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Seccion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <CardTitle>{title}</CardTitle>
      <div className="px-6 pb-6 pt-2 overflow-hidden">
        {children}
      </div>
    </Card>
  )
}

function Campo({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium mb-0.5 text-gray-400">{label}</div>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  )
}

function n2(v: number | null | undefined, dec = 2) {
  if (v == null) return '—'
  return Number(v).toLocaleString('es-MX', { maximumFractionDigits: dec })
}

interface Props {
  proyecto: Proyecto
  comentarios: Comentario[]
  archivos: Archivo[]
  currentUser: Profile
  sitios?: Sitio[]
  productos?: ProyectoSitioProducto[]
  hitos?: import('@/lib/types').HitoConstruccion[]
}

export default function DetalleProyecto({ proyecto: initial, comentarios: initialComentarios, archivos: initialArchivos, currentUser, sitios = [], productos = [], hitos = [] }: Props) {
  const supabase = createClient()
  const [proyecto, setProyecto] = useState(initial)
  const [comentarios, setComentarios] = useState(initialComentarios)
  const [archivos, setArchivos] = useState(initialArchivos)
  const [hitosLocales, setHitosLocales] = useState<HitoConstruccion[]>(hitos)
  const [hitoSeleccionado, setHitoSeleccionado] = useState<HitoConstruccion | null>(null)
  const [generandoCronograma, setGenerandoCronograma] = useState(false)
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)
  
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<Partial<Proyecto>>(initial)

  const isAnalista = currentUser.rol === 'nodo_analista'
  const isAdmin = currentUser.rol === 'nodo_admin'
  const isEpcista = currentUser.rol === 'epc'
  const canChangeEstado = isAnalista || isAdmin
  const backHref = isAdmin ? '/admin/proyectos' : isAnalista ? '/analista' : '/epc'

  async function cambiarEstado(estado: EstadoProyecto) {
    const { data } = await supabase.from('proyectos').update({ estado }).eq('id', proyecto.id).select().single()
    if (data) setProyecto(data as Proyecto)
  }

  async function enviarComentario() {
    if (!nuevoComentario.trim()) return
    setEnviandoComentario(true)
    const { data } = await supabase.from('comentarios').insert({
      proyecto_id: proyecto.id,
      autor_id: currentUser.id,
      contenido: nuevoComentario.trim(),
    }).select('*, profiles(*)').single()
    if (data) {
      setComentarios(prev => [...prev, data as Comentario])
      setNuevoComentario('')
    }
    setEnviandoComentario(false)
  }

  async function handleGuardar() {
    setGuardando(true)
    const { data } = await supabase.from('proyectos').update({
      nombre_proyecto: form.nombre_proyecto,
      cliente_final_nombre: form.cliente_final_nombre,
      cliente_final_empresa: form.cliente_final_empresa,
      cliente_final_contacto: form.cliente_final_contacto,
      capex_estimado: form.capex_estimado ? Number(form.capex_estimado) : null,
      ubicacion_estado: form.ubicacion_estado,
      notas_adicionales: form.notas_adicionales
    }).eq('id', proyecto.id).select().single()
    if (data) {
      setProyecto(data as Proyecto)
      setForm(data as Proyecto)
    }
    setEditando(false)
    setGuardando(false)
  }

  async function handleEliminarProyecto() {
    await supabase.from('proyectos').delete().eq('id', proyecto.id)
    router.push(backHref)
  }

  async function generarCronograma() {
    setGenerandoCronograma(true)
    const baseHitos = [
      { nombre: 'Ingenierías', orden: 1, duracion_semanas: 3 },
      { nombre: 'Permisos y Trámites', orden: 2, duracion_semanas: 4 },
      { nombre: 'Suministro de Equipos', orden: 3, duracion_semanas: 8 },
      { nombre: 'Obra Civil e Instalación Mecánica', orden: 4, duracion_semanas: 4 },
      { nombre: 'Instalación Eléctrica', orden: 5, duracion_semanas: 3 },
      { nombre: 'Pruebas y Comisionamiento', orden: 6, duracion_semanas: 2 },
    ]

    const hitosToInsert = baseHitos.map((h, i) => {
      const fechaInicio = new Date()
      // Incrementar semanas basado en el orden de manera simplificada (cascada básica)
      fechaInicio.setDate(fechaInicio.getDate() + (i * 14)) 
      const fechaFin = new Date(fechaInicio)
      fechaFin.setDate(fechaFin.getDate() + (h.duracion_semanas * 7))
      
      return {
        proyecto_id: proyecto.id,
        nombre: h.nombre,
        orden: h.orden,
        fecha_estimada_inicio: fechaInicio.toISOString().split('T')[0],
        fecha_estimada_fin: fechaFin.toISOString().split('T')[0],
        estado: 'pendiente'
      }
    })

    const { data, error } = await supabase.from('hitos_construccion').insert(hitosToInsert).select()
    if (data) {
      setHitosLocales(data as HitoConstruccion[])
    } else {
      alert('Error al generar cronograma')
    }
    setGenerandoCronograma(false)
  }

  const modalidades = proyecto.modalidad_financiamiento ?? []
  const noSabe = modalidades.includes('no_sabe')

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm mb-4 text-gray-500">
          <ChevronLeft size={14} />
          Volver
        </Link>
        <div className="flex items-start justify-between">
          <div>
            {editando ? (
              <input 
                type="text" 
                value={form.nombre_proyecto || ''} 
                onChange={e => setForm(f => ({...f, nombre_proyecto: e.target.value}))}
                className="text-2xl font-black w-full bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-acento/50"
              />
            ) : (
              <h1 className="text-2xl font-black">{proyecto.nombre_proyecto}</h1>
            )}
            <div className="flex items-center gap-3 mt-2">
              <BadgeTipo tipo={proyecto.tipo} />
              <BadgeEstado estado={proyecto.estado} />
              <span className="text-sm text-gray-400">{formatDate(proyecto.created_at)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-2">
              {!editando && (
                <>
                  <button onClick={() => setEditando(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                    <Pencil size={13} /> Editar
                  </button>
                  {(isAdmin || isEpcista) && (
                    <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-red-200 text-red-600 rounded-md shadow-sm hover:bg-red-50">
                      <Trash2 size={13} /> Eliminar
                    </button>
                  )}
                </>
              )}
            </div>
            {canChangeEstado && !editando && (
              <div className="w-40">
                <label className="block text-xs font-semibold mb-1.5 text-gray-500 uppercase tracking-wide">Cambiar estado</label>
                <select
                  value={proyecto.estado}
                  onChange={e => cambiarEstado(e.target.value as EstadoProyecto)}
                  className="w-full rounded-lg border border-white/40 px-3 py-2 text-sm font-medium focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all bg-white/60 backdrop-blur-md"
                >
                  {Object.entries(ESTADO_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        
        {confirmDelete && (
          <div className="border p-4 mt-4 flex items-center justify-between rounded-lg" style={{ borderColor: '#c00', backgroundColor: '#fff5f5' }}>
            <p className="text-sm font-medium text-red-800">¿Eliminar este proyecto? Esta acción no se puede deshacer e involucrará borrar sus datos asociados.</p>
            <div className="flex gap-2 ml-4 shrink-0">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-sm border rounded-md" style={{ borderColor: '#CFCFCF' }}>Cancelar</button>
              <button onClick={handleEliminarProyecto} className="px-3 py-1.5 text-sm font-bold text-white rounded-md" style={{ backgroundColor: '#c00' }}>Eliminar proyecto</button>
            </div>
          </div>
        )}
      </div>

      {/* Sales Cycle Timeline */}
      {!editando && (
        <Card className="mb-4">
          <div className="px-6 pt-5 pb-1">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Ciclo de Vida del Proyecto</p>
          </div>
          <div className="px-6 pb-6">
            <div className="flex items-center">
              {SALES_CYCLE.map((stage, i) => {
                const currentIdx = SALES_CYCLE.findIndex(s => s.key === proyecto.estado)
                const isActive = i === currentIdx
                const isPast = i < currentIdx
                const isLast = i === SALES_CYCLE.length - 1

                return (
                  <div key={stage.key} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center relative group">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        isActive 
                          ? 'border-acento bg-acento scale-125 shadow-md shadow-acento/30' 
                          : isPast 
                            ? 'border-green-500 bg-green-500' 
                            : 'border-gray-300 bg-white'
                      }`}>
                        {isPast && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-principal" />}
                      </div>
                      <span className={`text-[9px] mt-1.5 font-bold text-center leading-tight whitespace-nowrap ${
                        isActive ? 'text-principal' : isPast ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {stage.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div className={`flex-1 h-0.5 mx-1 transition-colors duration-300 ${
                        isPast ? 'bg-green-400' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {editando && (
        <Seccion title="Modo edición">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1">Nombre contacto final</label>
              <input type="text" value={form.cliente_final_nombre || ''} onChange={e => setForm(f => ({...f, cliente_final_nombre: e.target.value}))} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Empresa cliente final</label>
              <input type="text" value={form.cliente_final_empresa || ''} onChange={e => setForm(f => ({...f, cliente_final_empresa: e.target.value}))} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email / Teléfono de contacto</label>
              <input type="text" value={form.cliente_final_contacto || ''} onChange={e => setForm(f => ({...f, cliente_final_contacto: e.target.value}))} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">CAPEX estimado ({proyecto.moneda})</label>
              <input type="number" value={form.capex_estimado || ''} onChange={e => setForm(f => ({...f, capex_estimado: e.target.value ? Number(e.target.value) : undefined}))} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Estado (Ubicación)</label>
              <input type="text" value={form.ubicacion_estado || ''} onChange={e => setForm(f => ({...f, ubicacion_estado: e.target.value}))} className="w-full border rounded p-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Notas adicionales</label>
              <textarea rows={3} value={form.notas_adicionales || ''} onChange={e => setForm(f => ({...f, notas_adicionales: e.target.value}))} className="w-full border rounded p-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
            <Button variant="outline" size="sm" onClick={() => { setEditando(false); setForm(proyecto) }}>Cancelar</Button>
            <Button size="sm" onClick={handleGuardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cambios'}</Button>
          </div>
        </Seccion>
      )}

      {!editando && (
        <Seccion title="Cliente final">
          <div className="grid grid-cols-3 gap-4">
            <Campo label="Nombre" value={proyecto.cliente_final_nombre} />
            <Campo label="Empresa" value={proyecto.cliente_final_empresa} />
            <Campo label="Contacto" value={proyecto.cliente_final_contacto} />
          </div>
        </Seccion>
      )}

      {/* Accesos al Portal */}
      <Seccion title="Accesos al Portal">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-white/40 rounded-xl p-4 shadow-sm bg-[#fafafa]">
            <p className="font-bold text-sm text-principal mb-1">Portal de Cliente</p>
            {proyecto.cliente_id ? (
              <p className="text-xs font-semibold text-green-600 bg-green-100 inline-block px-2 py-1 rounded-md">Usuario vinculado</p>
            ) : (
              <div>
                <p className="text-xs text-gray-500 mb-3">El cliente no tiene acceso al portal para ver su Gantt ni sus documentos.</p>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={async () => {
                    const email = prompt('Correo del cliente a invitar:', proyecto.cliente_final_contacto?.trim())
                    if (!email) return
                    const { invitarUsuario } = await import('@/app/actions/invitar')
                    const res = await invitarUsuario({
                      email,
                      nombre: proyecto.cliente_final_nombre || 'Cliente',
                      empresa: proyecto.cliente_final_empresa || 'Empresa',
                      rol: 'cliente_final',
                      proyecto_id: proyecto.id
                    })
                    if (res.error) alert(res.error)
                    else {
                      alert('¡Invitación enviada con éxito al cliente!')
                      window.location.reload()
                    }
                  }}
                >
                  <Send size={12} className="mr-1.5" /> Invitar Cliente
                </Button>
              </div>
            )}
          </div>

          <div className="border border-white/40 rounded-xl p-4 shadow-sm bg-[#fafafa]">
            <p className="font-bold text-sm text-principal mb-1">Portal Financiero</p>
            {proyecto.financiero_id ? (
              <p className="text-xs font-semibold text-green-600 bg-green-100 inline-block px-2 py-1 rounded-md">Inversionista vinculado</p>
            ) : (
              <div>
                <p className="text-xs text-gray-500 mb-3">El proyecto no está vinculado al portafolio de ningún usuario financiero.</p>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={async () => {
                    const email = prompt('Correo del financiero a invitar:')
                    if (!email) return
                    const { invitarUsuario } = await import('@/app/actions/invitar')
                    const res = await invitarUsuario({
                      email,
                      nombre: 'Inversionista',
                      empresa: 'Fondo de Inversión',
                      rol: 'financiero',
                      proyecto_id: proyecto.id
                    })
                    if (res.error) alert(res.error)
                    else {
                      alert('¡Invitación enviada con éxito al financiero!')
                      window.location.reload()
                    }
                  }}
                >
                  <Send size={12} className="mr-1.5" /> Invitar Financiero
                </Button>
              </div>
            )}
          </div>
        </div>
      </Seccion>

      {/* Sitios */}
      {sitios.length > 0 && (
        <Seccion title="Sitios del proyecto">
          <div className="flex flex-col gap-3">
            {sitios.map(s => (
              <div key={s.id} className="border border-white/40 rounded-xl p-4 shadow-sm bg-[#fafafa]">
                <p className="font-bold text-sm text-principal">{s.nombre}</p>
                {s.nombre_recibo && <p className="text-xs mt-0.5 text-gray-500">{s.nombre_recibo}</p>}
                <div className="flex flex-wrap gap-4 mt-2 pt-2 border-t border-gray-200/60">
                  {(s.ciudad || s.ubicacion_estado) && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <MapPin size={12} />
                      {[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {s.rpu && <span className="text-xs font-medium text-gray-500">RPU: {s.rpu}</span>}
                  {s.demanda_contratada_kw != null && (
                    <span className="text-xs font-medium text-gray-500">Demanda: {s.demanda_contratada_kw.toLocaleString('es-MX')} kW</span>
                  )}
                  {s.recibo_url && (
                    <a href={s.recibo_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold underline text-principal hover:text-gray-700 transition-colors">Ver recibo CFE</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* Instalación */}
      {proyecto.tipo_instalacion && (
        <Seccion title="Tipo de instalación">
          <div className="flex items-start gap-3">
            {proyecto.tipo_instalacion === 'nodo_busca'
              ? <HelpCircle size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
              : <Wrench size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />}
            <p className="text-sm font-medium">
              {proyecto.tipo_instalacion === 'nodo_busca'
                ? 'Quiero que Nodo me ayude a encontrar un instalador'
                : 'La empresa EPCista realizará la instalación'}
            </p>
          </div>
        </Seccion>
      )}

      {/* Solución técnica */}
      {productos.length > 0 && (() => {
        const bySitio: Record<string, { nombre: string; items: ProyectoSitioProducto[] }> = {}
        for (const p of productos) {
          if (!bySitio[p.sitio_id]) bySitio[p.sitio_id] = { nombre: p.sitios?.nombre ?? 'Sitio', items: [] }
          bySitio[p.sitio_id].items.push(p)
        }
        const usoLabel: Record<string, string> = {
          load_shifting: 'Load Shifting', ups: 'UPS', load_shifting_ups: 'Load Shifting + UPS',
        }
        return (
          <Seccion title="Solución técnica">
            <div className="flex flex-col gap-6">
              {Object.entries(bySitio).map(([sitioId, { nombre, items }]) => (
                <div key={sitioId}>
                  <p className="text-sm font-bold mb-3 flex items-center gap-2">
                    <MapPin size={13} className="text-gray-400" /> {nombre}
                  </p>
                  <div className="flex flex-col gap-3">
                    {items.map(p => {
                      const d = p.datos as Record<string, unknown>
                      if (p.tipo === 'fv') {
                        const nm = Number(d.num_modulos) || 0
                        const pw = Number(d.potencia_modulos_w) || 0
                        const ni = Number(d.num_inversores) || 0
                        const pi = Number(d.potencia_inversores_kw) || 0
                        const capex = Number(d.capex) || 0
                        const kwpSistema = nm > 0 && pw > 0 ? nm * pw / 1000 : null
                        const kwpInv = ni > 0 && pi > 0 ? ni * pi : null
                        const precioWatt = capex > 0 && nm > 0 && pw > 0 ? capex / (nm * pw) : null
                        return (
                          <div key={p.id} className="border border-white/40 rounded-xl p-5 bg-[#fafff0] shadow-sm">
                            <div className="flex items-center gap-2 font-bold text-sm mb-4 text-[#4a5e1e]">
                              <Zap size={16} /> Fotovoltaico
                            </div>
                            <div className="grid grid-cols-3 gap-y-4 gap-x-2">
                              <Campo label="Módulos" value={`${d.num_modulos} × ${d.potencia_modulos_w} W`} />
                              <Campo label="Marca módulos" value={d.marca_modulos as string} />
                              <Campo label="kWp sistema" value={kwpSistema !== null ? `${n2(kwpSistema, 1)} kWp` : undefined} />
                              <Campo label="Inversores" value={`${d.num_inversores} × ${d.potencia_inversores_kw} kW`} />
                              <Campo label="Marca inversores" value={d.marca_inversores as string} />
                              <Campo label="kWp inversores" value={kwpInv !== null ? `${n2(kwpInv, 1)} kW` : undefined} />
                              <Campo label="Generación anual" value={`${Number(d.generacion_anual_kwh).toLocaleString('es-MX')} kWh/año`} />
                              <Campo label="CAPEX" value={`$${capex.toLocaleString('es-MX')}`} />
                              <Campo label="Precio por Watt" value={precioWatt !== null ? `$${n2(precioWatt, 4)}/W` : undefined} />
                            </div>
                          </div>
                        )
                      }
                      if (p.tipo === 'bess') {
                        const capacidad = Number(d.capacidad_kwh) || 0
                        const capex = Number(d.capex) || 0
                        const precioKwh = capacidad > 0 && capex > 0 ? capex / capacidad : null
                        return (
                          <div key={p.id} className="border border-white/40 rounded-xl p-5 bg-[#f0f8ff] shadow-sm">
                            <div className="flex items-center gap-2 font-bold text-sm mb-4 text-[#1a5a8f]">
                              <Battery size={16} /> BESS
                            </div>
                            <div className="grid grid-cols-3 gap-y-4 gap-x-2">
                              <Campo label="Potencia" value={`${d.potencia_kw} kW`} />
                              <Campo label="Capacidad" value={`${d.capacidad_kwh} kWh`} />
                              <Campo label="Marca" value={d.marca as string} />
                              <Campo label="Uso" value={usoLabel[d.uso as string] ?? d.uso as string} />
                              <Campo label="CAPEX" value={`$${capex.toLocaleString('es-MX')}`} />
                              <Campo label="Precio por kWh" value={precioKwh !== null ? `$${n2(precioKwh, 2)}/kWh` : undefined} />
                            </div>
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        )
      })()}

      {/* MEM */}
      {proyecto.incluye_mem && (
        <Seccion title="Mercado Eléctrico Mayorista">
          <span className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-acento text-principal">
            Alternativa MEM solicitada
          </span>
        </Seccion>
      )}

      {/* Técnico legacy */}
      {(proyecto.tipo === 'BESS' || proyecto.tipo === 'BESS+MEM') && productos.length === 0 && (
        <Seccion title="Datos técnicos — BESS">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Capacidad" value={proyecto.capacidad_mwh ? `${proyecto.capacidad_mwh} MWh` : null} />
            <Campo label="Potencia" value={proyecto.capacidad_mw ? `${proyecto.capacidad_mw} MW` : null} />
            <Campo label="Tecnología de batería" value={proyecto.tecnologia_bateria} />
            <Campo label="Duración de descarga" value={proyecto.duracion_descarga_hrs ? `${proyecto.duracion_descarga_hrs} hrs` : null} />
            <Campo label="Punto de interconexión" value={proyecto.punto_interconexion} />
          </div>
        </Seccion>
      )}
      {(proyecto.tipo === 'MEM' || proyecto.tipo === 'BESS+MEM') && productos.length === 0 && (
        <Seccion title="Datos técnicos — MEM">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Tipo de participación MEM" value={proyecto.tipo_participacion_mem} />
            <Campo label="Volumen de energía anual" value={proyecto.volumen_energia_mwh_anual ? `${proyecto.volumen_energia_mwh_anual} MWh` : null} />
          </div>
        </Seccion>
      )}

      {/* Financiamiento */}
      {!editando && (
        <Seccion title="Financiamiento y ubicación">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Campo label="CAPEX estimado" value={proyecto.capex_estimado ? `${proyecto.moneda} ${proyecto.capex_estimado.toLocaleString('es-MX')}` : null} />
            <Campo label="Estado" value={proyecto.ubicacion_estado} />
          </div>
          <div>
            <div className="text-xs font-medium mb-2 text-gray-400">Modalidad de financiamiento</div>
            {noSabe ? (
              <span className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-acento text-principal">
                Analista define modalidad
              </span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {modalidades.map(m => (
                  <span key={m} className="inline-flex items-center px-3 py-1 border border-white/40 text-xs font-medium">
                    {MODALIDAD_LABELS[m]}
                  </span>
                ))}
              </div>
            )}
          </div>
          {proyecto.notas_adicionales && (
            <div className="mt-4">
              <div className="text-xs font-medium mb-1 text-gray-400">Notas adicionales</div>
              <p className="text-sm whitespace-pre-wrap">{proyecto.notas_adicionales}</p>
            </div>
          )}
        </Seccion>
      )}

      {/* Cronograma Gantt */}
      <Seccion title="Cronograma de Construcción">
        {hitosLocales.length === 0 && (isEpcista || isAdmin) ? (
          <div className="flex flex-col items-center justify-center py-10 bg-white/40 border border-dashed border-borde rounded-xl">
            <p className="text-sm font-medium text-gray-500 mb-4">Aún no se ha definido el cronograma de obra.</p>
            <Button onClick={generarCronograma} disabled={generandoCronograma}>
              {generandoCronograma ? 'Generando...' : 'Generar Cronograma Base'}
            </Button>
          </div>
        ) : (
          <GanttChart 
            hitos={hitosLocales} 
            readOnly={!isEpcista && !isAdmin} 
            onHitoClick={(hito) => setHitoSeleccionado(hito)}
          />
        )}
      </Seccion>

      <Seccion title="Documentos y Anexos">
        <DocumentCenter 
          archivos={archivos} 
          proyectoId={proyecto.id} 
          currentUser={currentUser} 
          onUploadSuccess={(newA) => setArchivos(prev => [newA, ...prev])} 
          onDeleteSuccess={(id) => setArchivos(prev => prev.filter(a => a.id !== id))} 
        />
      </Seccion>

      {/* Comentarios */}
      <Seccion title="Comentarios internos">
        <div className="flex flex-col gap-3 mb-4 max-h-80 overflow-y-auto">
          {comentarios.length === 0 && <p className="text-sm text-gray-400">Sin comentarios aún.</p>}
          {comentarios.map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-principal text-acento">
                {((c.profiles as Profile | undefined)?.nombre ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold">{(c.profiles as Profile | undefined)?.nombre ?? 'Usuario'}</span>
                  <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.contenido}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={nuevoComentario}
            onChange={e => setNuevoComentario(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComentario() } }}
            placeholder="Escribe un comentario… (Enter para enviar)"
            rows={2}
            className="flex-1 rounded-lg border border-white/40 px-4 py-3 text-sm resize-none focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all bg-white/60 backdrop-blur-md"
          />
          <Button onClick={enviarComentario} disabled={enviandoComentario || !nuevoComentario.trim()}
            className="self-end">
            <Send size={16} />
          </Button>
        </div>
      </Seccion>

      {hitoSeleccionado && (
        <ModalHito 
          hito={hitoSeleccionado}
          onClose={() => setHitoSeleccionado(null)}
          onUpdate={(updated) => {
            setHitosLocales(prev => prev.map(h => h.id === updated.id ? updated : h))
          }}
        />
      )}
    </div>
  )
}
