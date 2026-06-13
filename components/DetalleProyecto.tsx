/* eslint-disable */
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BadgeEstado from './BadgeEstado'
import BadgeTipo from './BadgeTipo'
import { Button } from './ui/Button'
import { Card, CardTitle } from './ui/Card'
import type { Proyecto, Comentario, Archivo, Profile, EstadoProyecto, ModalidadFinanciamiento, Sitio, ProyectoSitioProducto, ConfiguracionTecnica, Moneda, TipoProyecto, TecnologiaBateria, OpcionFinanciamiento, ConfigFinanciamiento } from '@/lib/types'
import { Send, ChevronLeft, MapPin, Zap, Battery, Wrench, HelpCircle, Trash2, Pencil, CalendarDays, ExternalLink, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fmtNum, fmtCurrency, fmtUnit, parseNum } from '@/lib/format'
import GanttChart from './gantt/GanttChart'
import ModalHito from './gantt/ModalHito'
import type { HitoConstruccion } from '@/lib/types'
import DocumentCenter from './DocumentCenter'
import EditarSolucionTecnicaModal from './EditarSolucionTecnicaModal'
import EditarFinanciamientoModal from './EditarFinanciamientoModal'

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
]

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

// Removed local n2 function

interface Props {
  proyecto: Proyecto
  comentarios: Comentario[]
  archivos: Archivo[]
  currentUser: Profile
  sitios?: Sitio[]
  productos?: ProyectoSitioProducto[]
  hitos?: import('@/lib/types').HitoConstruccion[]
  configuraciones?: ConfiguracionTecnica[]
  opcionesFinanciamiento?: OpcionFinanciamiento[]
  configFinanciamientoLinks?: ConfigFinanciamiento[]
}

export default function DetalleProyecto({ proyecto: initial, comentarios: initialComentarios, archivos: initialArchivos, currentUser, sitios = [], productos = [], hitos = [], configuraciones = [], opcionesFinanciamiento = [], configFinanciamientoLinks = [] }: Props) {
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

  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [configsList, setConfigsList] = useState<ConfiguracionTecnica[]>([])
  const [opcionesFin, setOpcionesFin] = useState<OpcionFinanciamiento[]>([])
  const [configFinLinks, setConfigFinLinks] = useState<ConfigFinanciamiento[]>([])
  const [showEditTecnica, setShowEditTecnica] = useState(false)
  const [showEditFinanciamiento, setShowEditFinanciamiento] = useState(false)
  const [seleccionandoConfig, setSeleccionandoConfig] = useState(false)
  const [seleccionandoFinancing, setSeleccionandoFinancing] = useState(false)
  const [errorEstado, setErrorEstado] = useState<string | null>(null)

  useEffect(() => {
    const list = configuraciones ?? []
    setConfigsList(list)
    const selected = list.find(c => c.seleccionada)
    if (selected) {
      setSelectedConfigId(selected.id)
    } else if (list.length > 0) {
      setSelectedConfigId(list[0].id)
    }
  }, [configuraciones])

  useEffect(() => {
    setOpcionesFin(opcionesFinanciamiento ?? [])
    setConfigFinLinks(configFinanciamientoLinks ?? [])
  }, [opcionesFinanciamiento, configFinanciamientoLinks])

  const isAnalista = currentUser.rol === 'nodo_analista'
  const isAdmin = currentUser.rol === 'nodo_admin'
  const isEpcista = currentUser.rol === 'epc'
  const isFinder = currentUser.rol === 'finder'
  const canChangeEstado = isAnalista || isAdmin
  const backHref = isAdmin ? '/admin/proyectos' : isAnalista ? '/analista' : isFinder ? '/finder' : '/epc'

  // Fetch responsable nodo profile
  const [responsableProfile, setResponsableProfile] = useState<{nombre: string; empresa: string; calendario_url: string | null} | null>(null)
  const [nodoUsers, setNodoUsers] = useState<{id: string; nombre: string; empresa: string}[]>([])
  const [allClientes, setAllClientes] = useState<{id: string; razon_social: string}[]>([])
  const [allEpcistas, setAllEpcistas] = useState<{id: string; nombre: string; empresa: string}[]>([])

  useEffect(() => {
    if (initial.responsable_nodo_id) {
      supabase.from('profiles').select('nombre, empresa, calendario_url').eq('id', initial.responsable_nodo_id).single()
        .then(({ data }) => { if (data) setResponsableProfile(data as {nombre: string; empresa: string; calendario_url: string | null}) })
    }
    // Load nodo users for responsable selector (admin/analista only)
    if (isAdmin || isAnalista) {
      supabase.from('profiles').select('id, nombre, empresa').in('rol', ['nodo_admin', 'nodo_analista']).order('nombre')
        .then(({ data }) => { if (data) setNodoUsers(data) })
    }

    if (isAdmin || isAnalista) {
      // Admins/Analysts can see all clients
      supabase.from('clientes').select('id, razon_social').order('razon_social')
        .then(({ data }) => { if (data) setAllClientes(data as {id: string; razon_social: string}[]) })
      
      // Admins/Analysts can see all EPCistas
      supabase.from('profiles').select('id, nombre, empresa').eq('rol', 'epc').order('nombre')
        .then(({ data }) => { if (data) setAllEpcistas(data as {id: string; nombre: string; empresa: string}[]) })
    } else if (isFinder) {
      // Finders can only see their own clients
      supabase.from('clientes').select('id, razon_social').eq('finder_id', currentUser.id).order('razon_social')
        .then(({ data }) => { if (data) setAllClientes(data as {id: string; razon_social: string}[]) })

      // Finders can see all EPCistas to assign to the project
      supabase.from('profiles').select('id, nombre, empresa').eq('rol', 'epc').order('nombre')
        .then(({ data }) => { if (data) setAllEpcistas(data as {id: string; nombre: string; empresa: string}[]) })
    }
  }, [isAdmin, isAnalista, isFinder, currentUser.id, initial.responsable_nodo_id])
  async function handleSelectConfig(configId: string) {
    if (configId === 'legacy') return
    setSeleccionandoConfig(true)
    setErrorEstado(null)
    try {
      // 1. Reset all to false
      const { error: err1 } = await supabase.from('configuraciones_tecnicas').update({ seleccionada: false }).eq('proyecto_id', proyecto.id)
      if (err1) throw err1
      
      // 2. Set target to true
      const { error: err2 } = await supabase.from('configuraciones_tecnicas').update({ seleccionada: true }).eq('id', configId)
      if (err2) throw err2

      // 3. Update local state
      const updatedList = configsList.map(c => ({ ...c, seleccionada: c.id === configId }))
      setConfigsList(updatedList)

      // 4. Update project table fields (capex, currency)
      const targetConfig = updatedList.find(c => c.id === configId)
      if (targetConfig) {
        const { data: updatedProj, error: projErr } = await supabase.from('proyectos').update({
          capex_estimado: targetConfig.inversion_total,
          moneda: targetConfig.moneda,
        }).eq('id', proyecto.id).select().single()
        
        if (projErr) throw projErr
        if (updatedProj) setProyecto(updatedProj as Proyecto)
      }
    } catch (err) {
      console.error(err)
      setErrorEstado(err instanceof Error ? err.message : 'Error al seleccionar configuración')
    } finally {
      setSeleccionandoConfig(false)
    }
  }

  async function handleSelectFinancing(optionId: string) {
    setSeleccionandoFinancing(true)
    setErrorEstado(null)
    try {
      // 1. Reset all to false
      const { error: err1 } = await supabase.from('opciones_financiamiento').update({ seleccionada: false }).eq('proyecto_id', proyecto.id)
      if (err1) throw err1
      
      // 2. Set target to true
      const { error: err2 } = await supabase.from('opciones_financiamiento').update({ seleccionada: true }).eq('id', optionId)
      if (err2) throw err2

      // 3. Update local state
      const updatedList = opcionesFin.map(o => ({ ...o, seleccionada: o.id === optionId }))
      setOpcionesFin(updatedList)

      // 4. Sync project-level modalidad_financiamiento
      const targetOption = updatedList.find(o => o.id === optionId)
      if (targetOption) {
        const { data: updatedProj, error: projErr } = await supabase.from('proyectos').update({
          modalidad_financiamiento: [targetOption.vehiculo_inversion as ModalidadFinanciamiento],
        }).eq('id', proyecto.id).select().single()
        
        if (projErr) throw projErr
        if (updatedProj) setProyecto(updatedProj as Proyecto)
      }
    } catch (err) {
      console.error(err)
      setErrorEstado(err instanceof Error ? err.message : 'Error al seleccionar opción de financiamiento')
    } finally {
      setSeleccionandoFinancing(false)
    }
  }

  async function cambiarEstado(estado: EstadoProyecto) {
    setErrorEstado(null)
    const configRequired = ['aprobado', 'en_construccion', 'operativo', 'completado'].includes(estado)
    if (configRequired) {
      const hasSelectedConfig = configsList.some(c => c.seleccionada)
      const hasSelectedFin = opcionesFin.some(o => o.seleccionada)
      if (!hasSelectedConfig || !hasSelectedFin) {
        const msg = 'Se deben seleccionar una configuración técnica ganadora Y una opción de financiamiento ganadora antes de aprobar el proyecto o avanzar en el pipeline.'
        setErrorEstado(msg)
        alert(msg)
        return
      }
    }

    const prevHistorial = (proyecto.historial_estados ?? {}) as Record<string, string>
    const historial_estados = {
      ...prevHistorial,
      [estado]: new Date().toISOString(),
    }
    const updatePayload: Record<string, any> = { estado, historial_estados }
    if (estado === 'en_construccion') {
      updatePayload.plan_bloqueado = true
    }
    const { data, error } = await supabase.from('proyectos').update(updatePayload).eq('id', proyecto.id).select().single()
    if (error) {
      setErrorEstado('Error al cambiar de estado: ' + error.message)
    } else if (data) {
      setProyecto(data as Proyecto)
    }
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

  async function handleGuardar(exitsEditMode: boolean | any = true) {
    setGuardando(true)

    const shouldExit = exitsEditMode === true || (exitsEditMode && typeof exitsEditMode === 'object')

    const updatePayload: Record<string, any> = {
      nombre_proyecto: form.nombre_proyecto,
      cliente_final_nombre: form.cliente_final_nombre,
      cliente_final_empresa: form.cliente_final_empresa,
      cliente_final_contacto: form.cliente_final_contacto,
      capex_estimado: form.capex_estimado ? Number(form.capex_estimado) : null,
      ubicacion_estado: form.ubicacion_estado,
      notas_adicionales: form.notas_adicionales,
    }

    if (isAdmin || isAnalista) {
      updatePayload.responsable_nodo_id = form.responsable_nodo_id || null
      updatePayload.cliente_id = form.cliente_id || null
    }

    if (isAdmin || isAnalista || isFinder) {
      updatePayload.epcista_id = form.epcista_id || null
    }

    if (isAdmin || isAnalista || isEpcista) {
      updatePayload.tipo = form.tipo
      updatePayload.demanda_kw = form.demanda_kw ?? null
      updatePayload.capacidad_mwh = form.capacidad_mwh ?? null
      updatePayload.capacidad_mw = form.capacidad_mw ?? null
      updatePayload.tecnologia_bateria = form.tecnologia_bateria || null
      updatePayload.duracion_descarga_hrs = form.duracion_descarga_hrs ?? null
      updatePayload.punto_interconexion = form.punto_interconexion || null
      updatePayload.tipo_participacion_mem = form.tipo_participacion_mem || null
      updatePayload.volumen_energia_mwh_anual = form.volumen_energia_mwh_anual ?? null

      updatePayload.tipo_instalacion = form.tipo_instalacion || null
      updatePayload.incluye_mem = !!form.incluye_mem
      updatePayload.modalidad_financiamiento = form.modalidad_financiamiento || []
      updatePayload.moneda = form.moneda || 'MXN'
    }

    const { data, error } = await supabase.from('proyectos').update(updatePayload).eq('id', proyecto.id).select().single()
    if (error) {
      alert('Error al guardar cambios: ' + error.message)
      setGuardando(false)
      return false
    }

    if (data) {
      setProyecto(data as Proyecto)
      setForm(data as Proyecto)
      // Refresh responsable profile display
      if ((data as Proyecto).responsable_nodo_id) {
        const { data: rp } = await supabase.from('profiles').select('nombre, empresa, calendario_url').eq('id', (data as Proyecto).responsable_nodo_id!).single()
        if (rp) setResponsableProfile(rp as {nombre: string; empresa: string; calendario_url: string | null})
      } else {
        setResponsableProfile(null)
      }
    }
    if (shouldExit) {
      setEditando(false)
    }
    setGuardando(false)
    return true
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
              <BadgeEstado estado={proyecto.estado} historial={proyecto.historial_estados} />
              <span className="text-sm text-gray-400">{formatDate(proyecto.created_at)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-2">
              {!editando && (
                <>
                  <button onClick={() => { setEditando(true); setForm(proyecto) }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
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
              <div className="w-40 flex flex-col">
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
                {errorEstado && (
                  <p className="text-[10px] text-red-500 font-bold mt-1.5 leading-tight">{errorEstado}</p>
                )}
              </div>
            )}
          </div>
        </div>
        
        {confirmDelete && (
          <div className="border p-4 mt-4 flex items-center justify-between rounded-lg" style={{ borderColor: '#c00', backgroundColor: '#fff5f5' }}>
            <p className="text-sm font-medium text-red-800">¿Eliminar este proyecto? Esta acción no se puede deshacer e involucrará borrar sus datos asociados.</p>
            <div className="flex gap-2 ml-4 shrink-0">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-sm border rounded-md border-borde rounded-xl">Cancelar</button>
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
          <div className="flex flex-col gap-6 mb-4">
            {/* Group 1 — Información básica */}
            {(isAdmin || isAnalista || (isEpcista && proyecto.epcista_id === currentUser.id) || (isFinder && proyecto.finder_id === currentUser.id)) && (
              <div className="border border-borde rounded-xl p-4 bg-[#fafafa]">
                <h4 className="font-bold text-xs uppercase tracking-wide text-gray-500 mb-3">Grupo 1: Información básica</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1">Nombre del proyecto *</label>
                    <input type="text" value={form.nombre_proyecto || ''} onChange={e => setForm(f => ({...f, nombre_proyecto: e.target.value}))} className="w-full border rounded p-2 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Nombre contacto final</label>
                    <input type="text" value={form.cliente_final_nombre || ''} onChange={e => setForm(f => ({...f, cliente_final_nombre: e.target.value}))} className="w-full border rounded p-2 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Empresa cliente final</label>
                    <input type="text" value={form.cliente_final_empresa || ''} onChange={e => setForm(f => ({...f, cliente_final_empresa: e.target.value}))} className="w-full border rounded p-2 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email / Teléfono de contacto</label>
                    <input type="text" value={form.cliente_final_contacto || ''} onChange={e => setForm(f => ({...f, cliente_final_contacto: e.target.value}))} className="w-full border rounded p-2 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Estado (Ubicación)</label>
                    <select
                      value={form.ubicacion_estado || ''}
                      onChange={e => setForm(f => ({...f, ubicacion_estado: e.target.value}))}
                      className="w-full border rounded p-2 text-sm bg-white"
                    >
                      <option value="">Selecciona un estado</option>
                      {ESTADOS_MX.map(est => (
                        <option key={est} value={est}>{est}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1">Notas adicionales</label>
                    <textarea rows={3} value={form.notas_adicionales || ''} onChange={e => setForm(f => ({...f, notas_adicionales: e.target.value}))} className="w-full border rounded p-2 text-sm bg-white" />
                  </div>
                </div>
              </div>
            )}

            {/* Group 2 — Instalación y financiamiento */}
            {(isAdmin || isAnalista || (isEpcista && proyecto.epcista_id === currentUser.id)) && (
              <div className="border border-borde rounded-xl p-4 bg-[#fafafa]">
                <h4 className="font-bold text-xs uppercase tracking-wide text-gray-500 mb-3">Grupo 2: Instalación y financiamiento</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Tipo de instalación</label>
                    <select
                      value={form.tipo_instalacion || ''}
                      onChange={e => setForm(f => ({...f, tipo_instalacion: e.target.value as any || null}))}
                      className="w-full border rounded p-2 text-sm bg-white"
                    >
                      <option value="">Selecciona</option>
                      <option value="nodo_busca">Nodo busca</option>
                      <option value="epcista_instala">EPCista instala</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">CAPEX estimado ({form.moneda || 'MXN'})</label>
                    <input type="number" value={form.capex_estimado || ''} onChange={e => setForm(f => ({...f, capex_estimado: e.target.value ? Number(e.target.value) : undefined}))} className="w-full border rounded p-2 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Moneda</label>
                    <select
                      value={form.moneda || 'MXN'}
                      onChange={e => setForm(f => ({...f, moneda: e.target.value as Moneda}))}
                      className="w-full border rounded p-2 text-sm bg-white"
                    >
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div className="flex items-center mt-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={!!form.incluye_mem}
                        onChange={e => setForm(f => ({...f, incluye_mem: e.target.checked}))}
                      />
                      <span>Incluye MEM</span>
                    </label>
                  </div>
                  <div className="col-span-2 border-t border-gray-200/60 pt-4 mt-2">
                    <label className="block text-xs font-bold text-gray-400 mb-2">Vehículos de financiamiento</label>
                    <div className="bg-white border border-borde rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
                      <div>
                        <p className="text-xs font-bold text-principal">Opciones de financiamiento alternativas</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Puedes configurar múltiples alternativas de financiamiento, sus plazos, y vincularlos a las configuraciones técnicas.</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const saved = await handleGuardar(false)
                          if (saved) {
                            setShowEditFinanciamiento(true)
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-principal text-acento rounded-lg hover:opacity-90 transition-all whitespace-nowrap"
                      >
                        <Pencil size={12} /> Configurar Opciones de Financiamiento
                      </button>
                    </div>
                  </div>
                </div>              
              </div>
            )}

            {/* Group 3 — Asignaciones */}
            {(isAdmin || isAnalista || isFinder) && (
              <div className="border border-borde rounded-xl p-4 bg-[#fafafa]">
                <h4 className="font-bold text-xs uppercase tracking-wide text-gray-500 mb-3">Grupo 3: Asignaciones</h4>
                <div className="grid grid-cols-2 gap-4">
                  {(isAdmin || isAnalista) && (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1">Responsable Nodo</label>
                        <select
                          value={form.responsable_nodo_id || ''}
                          onChange={e => setForm(f => ({...f, responsable_nodo_id: e.target.value || null}))}
                          className="w-full border rounded p-2 text-sm bg-white"
                        >
                          <option value="">Sin asignar</option>
                          {nodoUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.nombre} — {u.empresa}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Cliente</label>
                        <select
                          value={form.cliente_id || ''}
                          onChange={e => setForm(f => ({...f, cliente_id: e.target.value || null}))}
                          className="w-full border rounded p-2 text-sm bg-white"
                        >
                          <option value="">Sin asignar</option>
                          {allClientes.map(c => (
                            <option key={c.id} value={c.id}>{c.razon_social}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  {(isAdmin || isAnalista || isFinder) && (
                    <div>
                      <label className="block text-xs font-medium mb-1">EPC Asignado</label>
                      <select
                        value={form.epcista_id || ''}
                        onChange={e => setForm(f => ({...f, epcista_id: e.target.value || ''}))}
                        className="w-full border rounded p-2 text-sm bg-white"
                      >
                        <option value="">Sin asignar</option>
                        {allEpcistas.map(epc => (
                          <option key={epc.id} value={epc.id}>{epc.nombre} — {epc.empresa}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Group 4 — Solución técnica */}
            {(isAdmin || isAnalista || (isEpcista && proyecto.epcista_id === currentUser.id)) && (
              <div className="border border-borde rounded-xl p-4 bg-[#fafafa]">
                <h4 className="font-bold text-xs uppercase tracking-wide text-gray-500 mb-3">Grupo 4: Solución técnica</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Tipo de proyecto *</label>
                    <select
                      value={form.tipo || ''}
                      onChange={e => setForm(f => ({...f, tipo: e.target.value as TipoProyecto}))}
                      className="w-full border rounded p-2 text-sm bg-white font-semibold"
                    >
                      <option value="FV">Fotovoltaico (FV)</option>
                      <option value="BESS">Baterías (BESS)</option>
                      <option value="FV+BESS">FV + BESS</option>
                      <option value="MEM">MEM</option>
                      <option value="BESS+MEM">BESS + MEM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Demanda contratada (kW)</label>
                    <input
                      type="number"
                      value={form.demanda_kw ?? ''}
                      onChange={e => setForm(f => ({...f, demanda_kw: e.target.value ? Number(e.target.value) : null}))}
                      className="w-full border rounded p-2 text-sm bg-white"
                      placeholder="Ej: 500"
                    />
                  </div>

                  {/* BESS fields */}
                  {(form.tipo === 'BESS' || form.tipo === 'FV+BESS' || form.tipo === 'BESS+MEM') && (
                    <div className="col-span-2 border-t border-gray-200/60 pt-4 mt-2 grid grid-cols-2 gap-4">
                      <p className="col-span-2 text-xs font-bold uppercase tracking-wide text-gray-400">Datos BESS</p>
                      <div>
                        <label className="block text-xs font-medium mb-1">Capacidad (MWh)</label>
                        <input
                          type="number"
                          step="any"
                          value={form.capacidad_mwh ?? ''}
                          onChange={e => setForm(f => ({...f, capacidad_mwh: e.target.value ? Number(e.target.value) : null}))}
                          className="w-full border rounded p-2 text-sm bg-white"
                          placeholder="Ej: 1.2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Potencia (MW)</label>
                        <input
                          type="number"
                          step="any"
                          value={form.capacidad_mw ?? ''}
                          onChange={e => setForm(f => ({...f, capacidad_mw: e.target.value ? Number(e.target.value) : null}))}
                          className="w-full border rounded p-2 text-sm bg-white"
                          placeholder="Ej: 0.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Tecnología de batería</label>
                        <select
                          value={form.tecnologia_bateria || ''}
                          onChange={e => setForm(f => ({...f, tecnologia_bateria: e.target.value as TecnologiaBateria || null}))}
                          className="w-full border rounded p-2 text-sm bg-white"
                        >
                          <option value="">Selecciona</option>
                          <option value="Li-ion">Li-ion</option>
                          <option value="LFP">LFP</option>
                          <option value="NMC">NMC</option>
                          <option value="Otra">Otra</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Duración descarga (hrs)</label>
                        <input
                          type="number"
                          step="any"
                          value={form.duracion_descarga_hrs ?? ''}
                          onChange={e => setForm(f => ({...f, duracion_descarga_hrs: e.target.value ? Number(e.target.value) : null}))}
                          className="w-full border rounded p-2 text-sm bg-white"
                          placeholder="Ej: 4"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium mb-1">Punto de interconexión</label>
                        <input
                          type="text"
                          value={form.punto_interconexion || ''}
                          onChange={e => setForm(f => ({...f, punto_interconexion: e.target.value || null}))}
                          className="w-full border rounded p-2 text-sm bg-white"
                          placeholder="Ej: Subestación A, 13.8 kV"
                        />
                      </div>
                    </div>
                  )}

                  {/* MEM fields */}
                  {(form.tipo === 'MEM' || form.tipo === 'BESS+MEM') && (
                    <div className="col-span-2 border-t border-gray-200/60 pt-4 mt-2 grid grid-cols-2 gap-4">
                      <p className="col-span-2 text-xs font-bold uppercase tracking-wide text-gray-400">Datos MEM</p>
                      <div>
                        <label className="block text-xs font-medium mb-1">Tipo de participación MEM</label>
                        <input
                          type="text"
                          value={form.tipo_participacion_mem || ''}
                          onChange={e => setForm(f => ({...f, tipo_participacion_mem: e.target.value || null}))}
                          className="w-full border rounded p-2 text-sm bg-white"
                          placeholder="Ej: Usuario Calificado Co-representado"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Volumen de energía anual (MWh)</label>
                        <input
                          type="number"
                          step="any"
                          value={form.volumen_energia_mwh_anual ?? ''}
                          onChange={e => setForm(f => ({...f, volumen_energia_mwh_anual: e.target.value ? Number(e.target.value) : null}))}
                          className="w-full border rounded p-2 text-sm bg-white"
                          placeholder="Ej: 1500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Alternative configurations link */}
                  {['FV', 'BESS', 'FV+BESS'].includes(form.tipo || '') && (
                    <div className="col-span-2 border-t border-gray-200/60 pt-4 mt-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Configuraciones y productos</p>
                      <div className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-principal">Alternativas técnicas de la solución</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">Puedes configurar múltiples alternativas técnicas, sitios y productos (FV/BESS) asociados al proyecto.</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            // First, save the current form edits to avoid losing them
                            const saved = await handleGuardar(false)
                            if (saved) {
                              setShowEditTecnica(true)
                            }
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-principal text-acento rounded-lg hover:opacity-90 transition-all whitespace-nowrap"
                        >
                          <Pencil size={12} /> Configurar Alternativas y Productos
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
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
      {!editando && (
        <Seccion title="Responsable Nodo">
          {responsableProfile ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{responsableProfile.nombre}</p>
                <p className="text-xs text-gray-500">{responsableProfile.empresa}</p>
              </div>
              {responsableProfile.calendario_url && isEpcista && (
                <a
                  href={responsableProfile.calendario_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all hover:scale-105 active:scale-95 shadow-md bg-acento text-principal rounded-xl"
                >
                  <CalendarDays size={16} /> Agendar Reunión <ExternalLink size={12} />
                </a>
              )}
              {responsableProfile.calendario_url && !isEpcista && (
                <a
                  href={responsableProfile.calendario_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-principal transition-colors"
                >
                  <CalendarDays size={13} /> Ver calendario <ExternalLink size={11} />
                </a>
              )}
            </div>
          ) : (
            <div>
              {(isAdmin || isAnalista) ? (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-600 text-sm">⚠️</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">Sin analista asignado</p>
                    <p className="text-xs text-amber-600">Edita el proyecto para asignar un responsable de Nodo.</p>
                  </div>
                  <button onClick={() => { setEditando(true); setForm(proyecto) }}
                    className="px-3 py-1.5 text-xs font-bold bg-principal text-acento rounded-lg hover:opacity-90 transition-all whitespace-nowrap">
                    Asignar
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Sin responsable asignado.</p>
              )}
            </div>
          )}
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
                    <span className="text-xs font-medium text-gray-500">Demanda: {fmtUnit(s.demanda_contratada_kw, 'kW')}</span>
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
      {(() => {
        const canEditTecnica = (isAdmin || isAnalista) || (isEpcista && proyecto.epcista_id === currentUser.id)

        if (productos.length === 0) {
          if (proyecto.tipo && ['FV', 'BESS', 'FV+BESS'].includes(proyecto.tipo) || canEditTecnica) {
            return (
              <Seccion title="Solución técnica">
                {canEditTecnica && (
                  <div className="flex justify-end mb-4">
                    <Button size="sm" variant="outline" onClick={() => setShowEditTecnica(true)} className="flex items-center gap-1">
                      <Pencil size={11} /> Editar Solución Técnica
                    </Button>
                  </div>
                )}
                <p className="text-sm text-gray-400">Sin productos configurados para este proyecto.</p>
              </Seccion>
            )
          }
          return null
        }

        const configsToUse = configsList.length > 0 ? configsList : [{
          id: 'legacy',
          proyecto_id: proyecto.id,
          nombre: 'Configuración original',
          descripcion: 'Configuración importada del proyecto original',
          inversion_total: proyecto.capex_estimado,
          moneda: proyecto.moneda,
          seleccionada: true,
          created_at: '',
          updated_at: ''
        }]

        const activeConfigId = selectedConfigId || configsToUse[0]?.id
        const activeConfig = configsToUse.find(c => c.id === activeConfigId) || configsToUse[0]

        const activeProducts = productos.filter(p => p.configuracion_id === activeConfig.id || (activeConfig.id === 'legacy' && !p.configuracion_id))

        const bySitio: Record<string, { nombre: string; items: ProyectoSitioProducto[] }> = {}
        for (const p of activeProducts) {
          if (!bySitio[p.sitio_id]) bySitio[p.sitio_id] = { nombre: p.sitios?.nombre ?? 'Sitio', items: [] }
          bySitio[p.sitio_id].items.push(p)
        }

        const usoLabel: Record<string, string> = {
          load_shifting: 'Load Shifting', ups: 'UPS', load_shifting_ups: 'Load Shifting + UPS',
        }

        let totalKwp = 0, totalKwh = 0, totalFvCapex = 0, totalBessCapex = 0
        for (const p of activeProducts) {
          const d = p.datos as Record<string, unknown>
          if (p.tipo === 'fv') {
            const nm = parseNum(d.num_modulos as string) || 0
            const pw = parseNum(d.potencia_modulos_w as string) || 0
            totalKwp += nm > 0 && pw > 0 ? (nm * pw) / 1000 : 0
            totalFvCapex += parseNum(d.capex as string) || 0
          } else if (p.tipo === 'bess') {
            totalKwh += parseNum(d.capacidad_kwh as string) || 0
            totalBessCapex += parseNum(d.capex as string) || 0
          }
        }

        const canSelectConfig = (isAdmin || isAnalista) || (isEpcista && proyecto.epcista_id === currentUser.id)

        return (
          <Seccion title="Solución técnica">
            {canEditTecnica && (
              <div className="flex justify-end mb-4">
                <Button size="sm" variant="outline" onClick={() => setShowEditTecnica(true)} className="flex items-center gap-1">
                  <Pencil size={11} /> Editar Solución Técnica
                </Button>
              </div>
            )}
            {/* Warning if no config selected and state is negociacion or beyond */}
            {!configsList.some(c => c.seleccionada) && ['negociacion', 'aprobado', 'en_construccion', 'operativo', 'completado'].includes(proyecto.estado) && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2.5 text-amber-800 text-xs font-semibold">
                <AlertTriangle className="shrink-0 text-amber-500" size={16} />
                <div>
                  <p className="font-bold text-amber-900">Configuración técnica requerida</p>
                  <p className="font-medium text-amber-800 mt-0.5">Se debe seleccionar una configuración técnica ganadora antes de poder avanzar en el pipeline del proyecto.</p>
                </div>
              </div>
            )}

            {/* Config Tabs */}
            {configsToUse.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-4 border-b border-borde pb-3">
                {configsToUse.map(c => {
                  const isActive = activeConfig.id === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConfigId(c.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                        isActive
                          ? 'bg-principal text-acento border-principal shadow-sm'
                          : 'border-borde bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {c.nombre}
                      {c.seleccionada && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Seleccionada como ganadora" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Active Config Overview */}
            <div className="bg-gray-50/50 border border-borde rounded-xl p-5 mb-5">
              <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-principal flex items-center gap-2">
                    {activeConfig.nombre}
                    {activeConfig.seleccionada && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Ganadora
                      </span>
                    )}
                  </h4>
                  {activeConfig.descripcion && (
                    <p className="text-xs text-gray-500 mt-1">{activeConfig.descripcion}</p>
                  )}
                </div>
                {canSelectConfig && !activeConfig.seleccionada && activeConfig.id !== 'legacy' && (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={seleccionandoConfig}
                    onClick={() => handleSelectConfig(activeConfig.id)}
                  >
                    {seleccionandoConfig ? 'Seleccionando...' : 'Seleccionar como ganadora'}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white p-4 rounded-lg border border-borde shadow-sm flex justify-between items-center">
                  <div>
                    <div className="text-xs uppercase font-bold text-gray-400">Inversión total</div>
                    <div className="text-xl font-black text-principal mt-1">
                      {fmtCurrency(activeConfig.inversion_total, activeConfig.moneda)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase font-bold text-gray-400">Moneda</div>
                    <div className="text-sm font-bold text-gray-600 mt-1">
                      {activeConfig.moneda}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {totalKwp > 0 && (
                <div className="bg-[#fafff0] border border-[#e0f0c0] rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-[#4a5e1e]">{fmtNum(totalKwp, 1)}</div>
                  <div className="text-[10px] font-bold uppercase text-[#6a8e2e] tracking-wider">kWp total FV</div>
                </div>
              )}
              {totalKwh > 0 && (
                <div className="bg-[#f0f8ff] border border-[#c0e0f0] rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-[#1a5a8f]">{fmtNum(totalKwh, 1)}</div>
                  <div className="text-[10px] font-bold uppercase text-[#3a7abf] tracking-wider">kWh total BESS</div>
                </div>
              )}
              {totalFvCapex > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                  <div className="text-lg font-black">{fmtCurrency(totalFvCapex, activeConfig.moneda)}</div>
                  <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">CAPEX FV</div>
                </div>
              )}
              {totalBessCapex > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                  <div className="text-lg font-black">{fmtCurrency(totalBessCapex, activeConfig.moneda)}</div>
                  <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">CAPEX BESS</div>
                </div>
              )}
            </div>

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
                        const nm = parseNum(d.num_modulos as string) || 0
                        const pw = parseNum(d.potencia_modulos_w as string) || 0
                        const ni = parseNum(d.num_inversores as string) || 0
                        const pi = parseNum(d.potencia_inversores_kw as string) || 0
                        const capex = parseNum(d.capex as string) || 0
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
                              <Campo label="kWp sistema" value={kwpSistema !== null ? fmtUnit(kwpSistema, 'kWp', 1) : undefined} />
                              <Campo label="Inversores" value={`${d.num_inversores} × ${d.potencia_inversores_kw} kW`} />
                              <Campo label="Marca inversores" value={d.marca_inversores as string} />
                              <Campo label="kWp inversores" value={kwpInv !== null ? fmtUnit(kwpInv, 'kW', 1) : undefined} />
                              <Campo label="Generación anual" value={parseNum(d.generacion_anual_kwh as string) ? fmtUnit(parseNum(d.generacion_anual_kwh as string), 'kWh/año') : undefined} />
                              <Campo label="CAPEX" value={fmtCurrency(capex, (d.capex_moneda as string) || 'USD')} />
                              <Campo label="Precio por Watt" value={precioWatt !== null ? `$${fmtNum(precioWatt, 4)}/W` : undefined} />
                            </div>
                          </div>
                        )
                      }
                      if (p.tipo === 'bess') {
                        const capacidad = parseNum(d.capacidad_kwh as string) || 0
                        const capex = parseNum(d.capex as string) || 0
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
                              <Campo label="CAPEX" value={fmtCurrency(capex, (d.capex_moneda as string) || 'USD')} />
                              <Campo label="Precio por kWh" value={precioKwh !== null ? `${fmtCurrency(precioKwh, (d.capex_moneda as string) || 'USD')}/kWh` : undefined} />
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

      {/* Opciones de financiamiento */}
      {!editando && (
        <Seccion title="Opciones de financiamiento">
          {configsList.length > 0 && (isAdmin || isAnalista || (isEpcista && proyecto.epcista_id === currentUser.id)) && (
            <div className="flex justify-end mb-4">
              <Button size="sm" variant="outline" onClick={() => setShowEditFinanciamiento(true)} className="flex items-center gap-1">
                <Pencil size={11} /> Editar Opciones de Financiamiento
              </Button>
            </div>
          )}

          {opcionesFin.length === 0 ? (
            <p className="text-sm text-gray-400">Sin opciones de financiamiento configuradas para este proyecto.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Warning if no financing selected and state is negociacion or beyond */}
              {!opcionesFin.some(o => o.seleccionada) && ['negociacion', 'aprobado', 'en_construccion', 'operativo', 'completado'].includes(proyecto.estado) && (
                <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2.5 text-amber-800 text-xs font-semibold">
                  <AlertTriangle className="shrink-0 text-amber-500" size={16} />
                  <div>
                    <p className="font-bold text-amber-900">Opción de financiamiento requerida</p>
                    <p className="font-medium text-amber-800 mt-0.5">Se debe seleccionar una opción de financiamiento ganadora antes de poder avanzar en el pipeline del proyecto.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {opcionesFin.map(o => {
                  const isSelected = o.seleccionada
                  const linkedConfigs = configFinLinks.filter(link => link.opcion_financiamiento_id === o.id)
                    .map(link => configsList.find(c => c.id === link.configuracion_id)?.nombre)
                    .filter(Boolean)
                  const canSelect = (isAdmin || isAnalista) || (isEpcista && proyecto.epcista_id === currentUser.id)

                  return (
                    <div key={o.id} className={`border rounded-xl p-5 relative transition-all shadow-sm ${
                      isSelected ? 'border-green-500 bg-green-50/10' : 'border-borde bg-white'
                    }`}>
                      {isSelected && (
                        <span className="absolute top-4 right-4 text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          ✓ Ganadora
                        </span>
                      )}

                      <h4 className="font-bold text-sm text-principal mb-2 pr-20">{o.nombre}</h4>
                      
                      {o.vehiculo_inversion === 'no_sabe' ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-2 rounded-lg font-medium">
                          Nodo definirá las mejores alternativas de financiamiento para este proyecto.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                          <div>
                            <span className="text-muted block">Vehículo:</span>
                            <span className="font-bold text-principal">{MODALIDAD_LABELS[o.vehiculo_inversion as ModalidadFinanciamiento] || o.vehiculo_inversion}</span>
                          </div>
                          <div>
                            <span className="text-muted block">Ahorro mensual:</span>
                            <span className="font-bold text-green-600">
                              {o.ahorro_estimado_mensual !== null ? fmtCurrency(o.ahorro_estimado_mensual, o.moneda || 'MXN') : '—'}
                            </span>
                          </div>
                          {o.plazo_meses && (
                            <div>
                              <span className="text-muted block">Plazo:</span>
                              <span className="font-semibold text-principal">{o.plazo_meses} meses</span>
                            </div>
                          )}
                          {o.notas && (
                            <div className="col-span-2">
                              <span className="text-muted block">Notas:</span>
                              <span className="text-gray-600 break-words">{o.notas}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {o.vehiculo_inversion !== 'no_sabe' && linkedConfigs.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5">Alternativas compatibles:</span>
                          <div className="flex flex-wrap gap-1">
                            {linkedConfigs.map(name => (
                              <span key={name} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-semibold border border-gray-200">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {canSelect && !isSelected && (
                        <div className="mt-4 flex justify-end">
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={seleccionandoFinancing}
                            onClick={() => handleSelectFinancing(o.id)}
                          >
                            {seleccionandoFinancing ? 'Seleccionando...' : 'Seleccionar como ganadora'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Seccion>
      )}

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

      {/* Ubicación y Notas */}
      {!editando && (
        <Seccion title="Ubicación y Notas">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Campo label="CAPEX estimado (Ganador)" value={proyecto.capex_estimado ? fmtCurrency(proyecto.capex_estimado, proyecto.moneda || 'MXN') : null} />
            <Campo label="Estado" value={proyecto.ubicacion_estado} />
          </div>
          {proyecto.notas_adicionales ? (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="text-xs font-medium mb-1 text-gray-400">Notas adicionales</div>
              <p className="text-sm whitespace-pre-wrap">{proyecto.notas_adicionales}</p>
            </div>
          ) : null}
        </Seccion>
      )}

      {/* Plan EPC — new project management tool */}
      <Seccion title="Plan de Proyecto EPC">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              Plan detallado de ingeniería, procurement y construcción con fases, actividades, tareas y hitos financieros.
            </p>
          </div>
          <Link
            href={`${isEpcista ? '/epc' : isAdmin ? '/admin' : isAnalista ? '/analista' : '/financiero'}/proyectos/${proyecto.id}/plan`}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all hover:scale-105 active:scale-95 shadow-md bg-principal text-acento whitespace-nowrap"
          >
            <CalendarDays size={16} />
            {isEpcista ? 'Gestionar Plan' : 'Ver Plan'}
          </Link>
        </div>
      </Seccion>

      {/* Monitor de Instalación — only visible after project approval */}
      {['aprobado', 'en_construccion', 'operativo', 'completado'].includes(proyecto.estado) && (
        <Seccion title="Monitor de Instalación">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Seguimiento en tiempo real de la instalación con evidencia fotográfica, avance por fase y actividad.
              </p>
            </div>
            <Link
              href={`${isEpcista ? '/epc' : isAdmin ? '/admin' : isAnalista ? '/analista' : isFinder ? '/finder' : '/financiero'}/proyectos/${proyecto.id}/instalaciones`}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all hover:scale-105 active:scale-95 shadow-md bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
            >
              <Wrench size={16} />
              {isEpcista ? 'Gestionar Instalación' : 'Ver Instalación'}
            </Link>
          </div>
        </Seccion>
      )}

      {/* Cronograma Gantt (legacy) */}
      <Seccion title="Cronograma de Construcción (Legacy)">
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

      <EditarSolucionTecnicaModal
        isOpen={showEditTecnica}
        onClose={() => setShowEditTecnica(false)}
        proyecto={proyecto}
        configuraciones={configsList}
        productos={productos}
        sitios={sitios}
        onSave={() => {
          setShowEditTecnica(false)
          window.location.reload()
        }}
      />

      <EditarFinanciamientoModal
        isOpen={showEditFinanciamiento}
        onClose={() => setShowEditFinanciamiento(false)}
        proyecto={proyecto}
        configuraciones={configsList}
        opcionesFinanciamiento={opcionesFin}
        configFinanciamientoLinks={configFinLinks}
        onSave={() => {
          setShowEditFinanciamiento(false)
          window.location.reload()
        }}
      />
    </div>
  )
}
