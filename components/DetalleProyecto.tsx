/* eslint-disable */
'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import BadgeEstado from './BadgeEstado'
import BadgeTipo from './BadgeTipo'
import { Button } from './ui/Button'
import { Card, CardTitle } from './ui/Card'
import type { Proyecto, Comentario, Archivo, Profile, EstadoProyecto, ModalidadFinanciamiento, Sitio, ProyectoSitioProducto, TipoArchivo } from '@/lib/types'
import { Paperclip, Send, ChevronLeft, MapPin, Zap, Battery, Wrench, HelpCircle, Upload } from 'lucide-react'
import Link from 'next/link'

const MODALIDAD_LABELS: Record<ModalidadFinanciamiento, string> = {
  credito: 'Crédito',
  arrendamiento: 'Arrendamiento',
  ensaas: 'EnSaaS',
  mem: 'Mercado Eléctrico Mayorista',
  no_sabe: 'Analista define modalidad',
}

const ESTADO_LABELS: Record<string, string> = {
  recibido: 'Recibido',
  en_analisis: 'En análisis',
  propuesta_lista: 'Propuesta lista',
  enviada: 'Enviada',
  cliente_interesado: 'Cliente interesado',
}

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
      {children}
    </Card>
  )
}

function Campo({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <div className="text-xs font-medium mb-0.5 text-gray-400">{label}</div>
      <div className="text-sm font-medium">{value}</div>
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
}

export default function DetalleProyecto({ proyecto: initial, comentarios: initialComentarios, archivos: initialArchivos, currentUser, sitios = [], productos = [] }: Props) {
  const supabase = createClient()
  const [proyecto, setProyecto] = useState(initial)
  const [comentarios, setComentarios] = useState(initialComentarios)
  const [archivos, setArchivos] = useState(initialArchivos)
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTipoRef = useRef<TipoArchivo>('recibo_cfe')

  const isAnalista = currentUser.rol === 'analista'
  const isAdmin = currentUser.rol === 'admin'
  const isEpcista = currentUser.rol === 'epcista'
  const canChangeEstado = isAnalista || isAdmin
  const backHref = isAdmin ? '/admin/proyectos' : isAnalista ? '/analista' : '/epcista'

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

  function triggerUpload(tipo: TipoArchivo) {
    uploadTipoRef.current = tipo
    fileInputRef.current?.click()
  }

  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoArchivo(true)

    const ext = file.name.split('.').pop()
    const path = `${proyecto.id}/${Date.now()}.${ext}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('archivos-proyectos')
      .upload(path, file)

    if (uploadError || !uploadData) {
      alert('Error al subir archivo: ' + uploadError?.message)
      setSubiendoArchivo(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('archivos-proyectos').getPublicUrl(path)

    const { data: archivoData } = await supabase.from('archivos').insert({
      proyecto_id: proyecto.id,
      autor_id: currentUser.id,
      nombre: file.name,
      url: publicUrl,
      tipo: uploadTipoRef.current,
    }).select('*, profiles(*)').single()

    if (archivoData) setArchivos(prev => [archivoData as Archivo, ...prev])
    setSubiendoArchivo(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const modalidades = proyecto.modalidad_financiamiento ?? []
  const noSabe = modalidades.includes('no_sabe')

  // Archivos por categoría (incluyendo tipos legacy)
  const recibos = archivos.filter(a => a.tipo === 'recibo_cfe' || a.tipo === 'adjunto_epcista')
  const propuestas = archivos.filter(a => a.tipo === 'propuesta' || a.tipo === 'propuesta_analista')
  const machotes = archivos.filter(a => a.tipo === 'machote_contrato')

  function ArchivoItem({ a }: { a: Archivo }) {
    return (
      <div className="flex items-center gap-3 border border-borde rounded-lg px-4 py-3 bg-white hover:border-gray-300 hover:shadow-sm transition-all group">
        <div className="p-2 bg-gray-50 rounded-md group-hover:bg-gray-100 transition-colors">
          <Paperclip size={16} className="text-gray-500 flex-shrink-0" />
        </div>
        <div className="flex-1 min-w-0">
          <a href={a.url} target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold hover:underline truncate block text-principal transition-all">
            {a.nombre}
          </a>
          <div className="text-xs mt-0.5 text-gray-500">
            {formatDate(a.created_at)} · {(a.profiles as Profile | undefined)?.nombre ?? 'Usuario'}
          </div>
        </div>
      </div>
    )
  }

  function UploadBtn({ tipo, label, allowed }: { tipo: TipoArchivo; label: string; allowed: boolean }) {
    if (!allowed) return null
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => triggerUpload(tipo)}
        disabled={subiendoArchivo}
      >
        <Upload size={11} />
        {subiendoArchivo && uploadTipoRef.current === tipo ? 'Subiendo…' : label}
      </Button>
    )
  }

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
            <h1 className="text-2xl font-black">{proyecto.nombre_proyecto}</h1>
            <div className="flex items-center gap-3 mt-2">
              <BadgeTipo tipo={proyecto.tipo} />
              <BadgeEstado estado={proyecto.estado} />
              <span className="text-sm text-gray-400">{formatDate(proyecto.created_at)}</span>
            </div>
          </div>
          {canChangeEstado && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-500 uppercase tracking-wide">Cambiar estado</label>
              <select
                value={proyecto.estado}
                onChange={e => cambiarEstado(e.target.value as EstadoProyecto)}
                className="w-full rounded-lg border border-borde px-3 py-2 text-sm font-medium focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all bg-white"
              >
                {Object.entries(ESTADO_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Cliente final */}
      <Seccion title="Cliente final">
        <div className="grid grid-cols-3 gap-4">
          <Campo label="Nombre" value={proyecto.cliente_final_nombre} />
          <Campo label="Empresa" value={proyecto.cliente_final_empresa} />
          <Campo label="Contacto" value={proyecto.cliente_final_contacto} />
        </div>
      </Seccion>

      {/* Sitios */}
      {sitios.length > 0 && (
        <Seccion title="Sitios del proyecto">
          <div className="flex flex-col gap-3">
            {sitios.map(s => (
              <div key={s.id} className="border border-borde rounded-xl p-4 shadow-sm bg-[#fafafa]">
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
                          <div key={p.id} className="border border-borde rounded-xl p-5 bg-[#fafff0] shadow-sm">
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
                          <div key={p.id} className="border border-borde rounded-xl p-5 bg-[#f0f8ff] shadow-sm">
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
                <span key={m} className="inline-flex items-center px-3 py-1 border border-borde text-xs font-medium">
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

      {/* Archivos — divididos en 3 categorías */}
      <Seccion title="Archivos">
        <input ref={fileInputRef} type="file" onChange={subirArchivo} className="hidden" />

        {/* Recibo CFE */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#444]">Recibo CFE</h4>
            <UploadBtn tipo="recibo_cfe" label="Subir recibo" allowed={isEpcista || isAdmin} />
          </div>
          {recibos.length === 0
            ? <p className="text-xs text-gray-300">Sin archivos.</p>
            : <div className="flex flex-col gap-1">{recibos.map(a => <ArchivoItem key={a.id} a={a} />)}</div>}
        </div>

        <div className="border-t border-borde mb-5 pt-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#444]">Propuesta</h4>
            <UploadBtn tipo="propuesta" label="Subir propuesta" allowed={isAnalista} />
          </div>
          {propuestas.length === 0
            ? <p className="text-xs text-gray-300">Sin archivos.</p>
            : <div className="flex flex-col gap-1">{propuestas.map(a => <ArchivoItem key={a.id} a={a} />)}</div>}
        </div>

        <div className="border-t border-borde pt-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#444]">Machote de contrato</h4>
            <UploadBtn tipo="machote_contrato" label="Subir machote" allowed={isAnalista || isAdmin} />
          </div>
          {machotes.length === 0
            ? <p className="text-xs text-gray-300">Sin archivos.</p>
            : <div className="flex flex-col gap-1">{machotes.map(a => <ArchivoItem key={a.id} a={a} />)}</div>}
        </div>
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
            className="flex-1 rounded-lg border border-borde px-4 py-3 text-sm resize-none focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all bg-white"
          />
          <Button onClick={enviarComentario} disabled={enviandoComentario || !nuevoComentario.trim()}
            className="self-end">
            <Send size={16} />
          </Button>
        </div>
      </Seccion>
    </div>
  )
}
