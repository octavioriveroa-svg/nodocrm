'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import BadgeEstado from './BadgeEstado'
import BadgeTipo from './BadgeTipo'
import type { Proyecto, Comentario, Archivo, Profile, EstadoProyecto, ModalidadFinanciamiento, Sitio } from '@/lib/types'
import { Paperclip, Send, ChevronLeft, MapPin } from 'lucide-react'
import Link from 'next/link'

const MODALIDAD_LABELS: Record<ModalidadFinanciamiento, string> = {
  credito: 'Crédito',
  arrendamiento: 'Arrendamiento',
  ensaas: 'EnSaaS',
  mem: 'Mercado Eléctrico Mayorista',
  no_sabe: 'Analista define modalidad',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Seccion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border p-6 mb-4" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
      <h3 className="font-bold text-sm uppercase tracking-wide mb-4" style={{ color: '#666' }}>{title}</h3>
      {children}
    </div>
  )
}

function Campo({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

interface Props {
  proyecto: Proyecto
  comentarios: Comentario[]
  archivos: Archivo[]
  currentUser: Profile
  sitios?: Sitio[]
}

export default function DetalleProyecto({ proyecto: initial, comentarios: initialComentarios, archivos: initialArchivos, currentUser, sitios = [] }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [proyecto, setProyecto] = useState(initial)
  const [comentarios, setComentarios] = useState(initialComentarios)
  const [archivos, setArchivos] = useState(initialArchivos)
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isAnalista = currentUser.rol === 'analista'
  const backHref = isAnalista ? '/analista' : '/epcista'

  async function cambiarEstado(estado: EstadoProyecto) {
    const { data } = await supabase
      .from('proyectos')
      .update({ estado })
      .eq('id', proyecto.id)
      .select()
      .single()
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

  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoArchivo(true)

    const ext = file.name.split('.').pop()
    const path = `${proyecto.id}/${Date.now()}.${ext}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('archivos-proyectos')
      .upload(path, file)

    if (uploadError) {
      alert('Error al subir archivo: ' + uploadError.message)
      setSubiendoArchivo(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('archivos-proyectos').getPublicUrl(path)

    const tipo = isAnalista ? 'propuesta_analista' : 'adjunto_epcista'
    const { data: archivoData } = await supabase.from('archivos').insert({
      proyecto_id: proyecto.id,
      autor_id: currentUser.id,
      nombre: file.name,
      url: publicUrl,
      tipo,
    }).select('*, profiles(*)').single()

    if (archivoData) {
      setArchivos(prev => [archivoData as Archivo, ...prev])
    }
    setSubiendoArchivo(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const modalidades = proyecto.modalidad_financiamiento ?? []
  const noSabe = modalidades.includes('no_sabe')

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm mb-4"
          style={{ color: '#666' }}
        >
          <ChevronLeft size={14} />
          Volver al dashboard
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black">{proyecto.nombre_proyecto}</h1>
            <div className="flex items-center gap-3 mt-2">
              <BadgeTipo tipo={proyecto.tipo} />
              <BadgeEstado estado={proyecto.estado} />
              <span className="text-sm" style={{ color: '#888' }}>
                {formatDate(proyecto.created_at)}
              </span>
            </div>
          </div>

          {isAnalista && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#666' }}>Cambiar estado</label>
              <select
                value={proyecto.estado}
                onChange={e => cambiarEstado(e.target.value as EstadoProyecto)}
                className="border px-3 py-1.5 text-sm font-medium"
                style={{ borderColor: '#CFCFCF' }}
              >
                <option value="recibido">Recibido</option>
                <option value="en_analisis">En análisis</option>
                <option value="completado">Completado</option>
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
              <div key={s.id} className="border p-3" style={{ borderColor: '#CFCFCF' }}>
                <p className="font-semibold text-sm">{s.nombre}</p>
                <div className="flex flex-wrap gap-3 mt-1">
                  {(s.ciudad || s.ubicacion_estado) && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: '#666' }}>
                      <MapPin size={11} />
                      {[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {s.rpu && <span className="text-xs" style={{ color: '#666' }}>RPU: {s.rpu}</span>}
                  {s.recibo_url && (
                    <a href={s.recibo_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs underline" style={{ color: '#000' }}>
                      Ver recibo CFE
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* Técnico BESS */}
      {(proyecto.tipo === 'BESS' || proyecto.tipo === 'BESS+MEM') && (
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

      {/* Técnico MEM */}
      {(proyecto.tipo === 'MEM' || proyecto.tipo === 'BESS+MEM') && (
        <Seccion title="Datos técnicos — MEM">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Tipo de participación MEM" value={proyecto.tipo_participacion_mem} />
            <Campo label="Volumen de energía anual" value={proyecto.volumen_energia_mwh_anual ? `${proyecto.volumen_energia_mwh_anual} MWh` : null} />
          </div>
        </Seccion>
      )}

      {/* Financiero */}
      <Seccion title="Financiamiento y ubicación">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Campo
            label="CAPEX estimado"
            value={proyecto.capex_estimado ? `${proyecto.moneda} ${proyecto.capex_estimado.toLocaleString('es-MX')}` : null}
          />
          <Campo label="Estado" value={proyecto.ubicacion_estado} />
        </div>

        <div>
          <div className="text-xs font-medium mb-2" style={{ color: '#888' }}>Modalidad de financiamiento</div>
          {noSabe ? (
            <span
              className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded"
              style={{ backgroundColor: '#D7FF2F', color: '#000' }}
            >
              Analista define modalidad
            </span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {modalidades.map(m => (
                <span
                  key={m}
                  className="inline-flex items-center px-3 py-1 border text-xs font-medium rounded"
                  style={{ borderColor: '#CFCFCF' }}
                >
                  {MODALIDAD_LABELS[m]}
                </span>
              ))}
              {modalidades.length > 0 && (
                <span className="text-xs self-center" style={{ color: '#888' }}>
                  Sugerido por el EPCista
                </span>
              )}
            </div>
          )}
        </div>

        {proyecto.notas_adicionales && (
          <div className="mt-4">
            <div className="text-xs font-medium mb-1" style={{ color: '#888' }}>Notas adicionales</div>
            <p className="text-sm whitespace-pre-wrap">{proyecto.notas_adicionales}</p>
          </div>
        )}
      </Seccion>

      {/* Archivos */}
      <Seccion title="Archivos">
        <div className="mb-4 flex flex-col gap-2">
          {archivos.length === 0 && (
            <p className="text-sm" style={{ color: '#888' }}>No hay archivos adjuntos.</p>
          )}
          {archivos.map(a => (
            <div
              key={a.id}
              className="flex items-center justify-between border px-3 py-2"
              style={{ borderColor: '#CFCFCF' }}
            >
              <div className="flex items-center gap-3">
                <Paperclip size={14} style={{ color: '#888' }} />
                <div>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium underline"
                  >
                    {a.nombre}
                  </a>
                  <div className="text-xs mt-0.5" style={{ color: '#888' }}>
                    {formatDate(a.created_at)} · {(a.profiles as Profile | undefined)?.nombre ?? 'Usuario'}
                  </div>
                </div>
              </div>
              <span
                className="text-xs px-2 py-0.5 font-semibold"
                style={{
                  backgroundColor: a.tipo === 'propuesta_analista' ? '#000' : '#E8E8E8',
                  color: a.tipo === 'propuesta_analista' ? '#D7FF2F' : '#444',
                }}
              >
                {a.tipo === 'propuesta_analista' ? 'Propuesta analista' : 'Adjunto EPCista'}
              </span>
            </div>
          ))}
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={subirArchivo}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border cursor-pointer transition-colors hover:bg-gray-50"
            style={{ borderColor: '#CFCFCF' }}
          >
            <Paperclip size={14} />
            {subiendoArchivo ? 'Subiendo...' : isAnalista ? 'Subir propuesta' : 'Adjuntar documento'}
          </label>
        </div>
      </Seccion>

      {/* Comentarios */}
      <Seccion title="Comentarios internos">
        <div className="flex flex-col gap-3 mb-4 max-h-80 overflow-y-auto">
          {comentarios.length === 0 && (
            <p className="text-sm" style={{ color: '#888' }}>Sin comentarios aún.</p>
          )}
          {comentarios.map(c => (
            <div key={c.id} className="flex gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: '#000', color: '#D7FF2F' }}
              >
                {((c.profiles as Profile | undefined)?.nombre ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold">
                    {(c.profiles as Profile | undefined)?.nombre ?? 'Usuario'}
                  </span>
                  <span className="text-xs" style={{ color: '#888' }}>
                    {formatDateTime(c.created_at)}
                  </span>
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
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviarComentario()
              }
            }}
            placeholder="Escribe un comentario… (Enter para enviar)"
            rows={2}
            className="flex-1 border px-3 py-2 text-sm resize-none"
            style={{ borderColor: '#CFCFCF' }}
          />
          <button
            onClick={enviarComentario}
            disabled={enviandoComentario || !nuevoComentario.trim()}
            className="px-3 py-2 self-end disabled:opacity-40"
            style={{ backgroundColor: '#D7FF2F', color: '#000' }}
          >
            <Send size={16} />
          </button>
        </div>
      </Seccion>
    </div>
  )
}
