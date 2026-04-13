'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, MapPin, FileText, Pencil, Trash2, Upload, ExternalLink, Eye } from 'lucide-react'
import type { Sitio } from '@/lib/types'

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
]

const emptyForm = {
  nombre: '',
  nombre_recibo: '',
  ciudad: '',
  ubicacion_estado: '',
  rpu: '',
  demanda_contratada_kw: '',
  notas: '',
}

interface Props {
  clienteId: string
  epcistaId: string
  initialSitios: Sitio[]
}

export default function SitiosCliente({ clienteId, epcistaId, initialSitios }: Props) {
  const supabase = createClient()
  const [sitios, setSitios] = useState<Sitio[]>(initialSitios)
  const [mostrando, setMostrando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [viendoId, setViendoId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [subiendoPdf, setSubiendoPdf] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function abrirNuevo() {
    setEditandoId(null)
    setForm(emptyForm)
    setPdfUrl(null)
    setViendoId(null)
    setMostrando(true)
  }

  function abrirEditar(s: Sitio) {
    if (editandoId === s.id && mostrando) { setMostrando(false); setEditandoId(null); return }
    setEditandoId(s.id)
    setForm({
      nombre: s.nombre,
      nombre_recibo: s.nombre_recibo ?? '',
      ciudad: s.ciudad ?? '',
      ubicacion_estado: s.ubicacion_estado ?? '',
      rpu: s.rpu ?? '',
      demanda_contratada_kw: s.demanda_contratada_kw?.toString() ?? '',
      notas: s.notas ?? '',
    })
    setPdfUrl(s.recibo_url ?? null)
    setViendoId(null)
    setMostrando(true)
  }

  function toggleVer(id: string) {
    setViendoId(viendoId === id ? null : id)
    if (editandoId === id && mostrando) { setMostrando(false); setEditandoId(null) }
  }

  async function subirPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoPdf(true)
    const path = `${epcistaId}/${clienteId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('recibos-cfe').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('recibos-cfe').getPublicUrl(path)
      setPdfUrl(publicUrl)
    }
    setSubiendoPdf(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    setLoading(true)
    const payload = {
      cliente_id: clienteId,
      epcista_id: epcistaId,
      nombre: form.nombre,
      nombre_recibo: form.nombre_recibo || null,
      ciudad: form.ciudad || null,
      ubicacion_estado: form.ubicacion_estado || null,
      rpu: form.rpu || null,
      demanda_contratada_kw: form.demanda_contratada_kw ? Number(form.demanda_contratada_kw) : null,
      recibo_url: pdfUrl,
      notas: form.notas || null,
    }
    if (editandoId) {
      const { data } = await supabase.from('sitios').update(payload).eq('id', editandoId).select().single()
      if (data) setSitios(prev => prev.map(s => s.id === editandoId ? data as Sitio : s))
    } else {
      const { data } = await supabase.from('sitios').insert(payload).select().single()
      if (data) setSitios(prev => [...prev, data as Sitio])
    }
    setMostrando(false)
    setEditandoId(null)
    setLoading(false)
  }

  async function eliminar(id: string) {
    await supabase.from('sitios').delete().eq('id', id)
    setSitios(prev => prev.filter(s => s.id !== id))
    setConfirmDelete(null)
  }

  const inputClass = "w-full border px-3 py-2 text-sm bg-white"
  const inputStyle = { borderColor: '#CFCFCF' }

  function FormSitio() {
    return (
      <div className="border p-5" style={{ borderColor: '#000', backgroundColor: '#fff' }}>
        <h4 className="font-bold text-sm mb-4">{editandoId ? 'Editar sitio' : 'Nuevo sitio'}</h4>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Nombre del sitio *</label>
            <input type="text" value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className={inputClass} style={inputStyle} placeholder="Ej: Planta Monterrey" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nombre como aparece en el recibo</label>
            <input type="text" value={form.nombre_recibo}
              onChange={e => setForm(f => ({ ...f, nombre_recibo: e.target.value }))}
              className={inputClass} style={inputStyle} placeholder="Nombre en el recibo CFE" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Ciudad</label>
              <input type="text" value={form.ciudad}
                onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                className={inputClass} style={inputStyle} placeholder="Monterrey" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Estado</label>
              <select value={form.ubicacion_estado}
                onChange={e => setForm(f => ({ ...f, ubicacion_estado: e.target.value }))}
                className={inputClass} style={inputStyle}>
                <option value="">Selecciona</option>
                {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '110px 1fr' }}>
            <div>
              <label className="block text-xs font-medium mb-1">RPU</label>
              <input type="text" value={form.rpu}
                onChange={e => setForm(f => ({ ...f, rpu: e.target.value }))}
                className={inputClass} style={inputStyle} placeholder="RPU" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Demanda contratada (kW)</label>
              <input type="number" min="0" value={form.demanda_contratada_kw}
                onChange={e => setForm(f => ({ ...f, demanda_contratada_kw: e.target.value }))}
                className={inputClass} style={inputStyle} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Último recibo CFE (PDF)</label>
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".pdf" onChange={subirPdf} className="hidden" id="recibo-pdf" />
              <label htmlFor="recibo-pdf"
                className="flex items-center gap-2 px-3 py-2 border text-xs font-medium cursor-pointer"
                style={{ borderColor: '#CFCFCF' }}>
                <Upload size={12} />
                {subiendoPdf ? 'Subiendo…' : 'Seleccionar PDF'}
              </label>
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs underline flex items-center gap-1">
                  <FileText size={11} /> Ver PDF actual
                </a>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Notas</label>
            <textarea rows={2} value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              className={inputClass} style={inputStyle} placeholder="Observaciones del sitio…" />
          </div>
        </div>
        <div className="flex justify-between mt-4">
          <button onClick={() => { setMostrando(false); setEditandoId(null) }}
            className="px-4 py-2 text-xs border" style={{ borderColor: '#CFCFCF' }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={loading || !form.nombre.trim()}
            className="px-4 py-2 text-xs font-bold disabled:opacity-50"
            style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
            {loading ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar sitio'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border p-6 mt-4" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-xs uppercase tracking-wide" style={{ color: '#666' }}>Sitios</h3>
        <button onClick={abrirNuevo}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
          style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
          <Plus size={12} /> Agregar sitio
        </button>
      </div>

      {sitios.length === 0 && !mostrando && (
        <p className="text-sm" style={{ color: '#aaa' }}>Sin sitios registrados.</p>
      )}

      <div className="flex flex-col gap-2 mb-4">
        {sitios.map(s => (
          <div key={s.id}>
            <div className="border p-4" style={{ borderColor: '#CFCFCF' }}>
              {confirmDelete === s.id ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm">¿Eliminar <strong>{s.nombre}</strong>?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(null)}
                      className="px-3 py-1 text-xs border" style={{ borderColor: '#CFCFCF' }}>Cancelar</button>
                    <button onClick={() => eliminar(s.id)}
                      className="px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: '#c00' }}>Eliminar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{s.nombre}</p>
                    {(s.ciudad || s.ubicacion_estado) && (
                      <span className="flex items-center gap-1 text-xs mt-0.5" style={{ color: '#666' }}>
                        <MapPin size={11} />
                        {[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleVer(s.id)}
                      className="p-1.5 border transition-colors"
                      style={{
                        borderColor: viendoId === s.id ? '#000' : '#CFCFCF',
                        backgroundColor: viendoId === s.id ? '#000' : '#fff',
                        color: viendoId === s.id ? '#D7FF2F' : '#444',
                      }}>
                      <Eye size={13} />
                    </button>
                    <button onClick={() => abrirEditar(s)}
                      className="p-1.5 border transition-colors"
                      style={{
                        borderColor: (editandoId === s.id && mostrando) ? '#000' : '#CFCFCF',
                        backgroundColor: (editandoId === s.id && mostrando) ? '#f0f0f0' : '#fff',
                        color: '#444',
                      }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setConfirmDelete(s.id)}
                      className="p-1.5 border transition-colors"
                      style={{ borderColor: '#CFCFCF', color: '#c00' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Panel Ver */}
            {viendoId === s.id && (
              <div className="border border-t-0 px-5 py-4" style={{ borderColor: '#000', backgroundColor: '#fafafa' }}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  {s.nombre_recibo && (
                    <div>
                      <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>Nombre en el recibo</div>
                      <div className="font-medium">{s.nombre_recibo}</div>
                    </div>
                  )}
                  {(s.ciudad || s.ubicacion_estado) && (
                    <div>
                      <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>Ubicación</div>
                      <div className="font-medium">{[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}</div>
                    </div>
                  )}
                  {s.rpu && (
                    <div>
                      <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>RPU</div>
                      <div className="font-medium">{s.rpu}</div>
                    </div>
                  )}
                  {s.demanda_contratada_kw != null && (
                    <div>
                      <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>Demanda contratada</div>
                      <div className="font-medium">{s.demanda_contratada_kw.toLocaleString('es-MX')} kW</div>
                    </div>
                  )}
                  {s.recibo_url && (
                    <div className="col-span-2">
                      <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>Recibo CFE</div>
                      <a href={s.recibo_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium underline" style={{ color: '#000' }}>
                        <FileText size={13} /> Ver recibo <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                  {s.notas && (
                    <div className="col-span-2">
                      <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>Notas</div>
                      <p className="text-sm whitespace-pre-wrap">{s.notas}</p>
                    </div>
                  )}
                  {!s.nombre_recibo && !s.rpu && !s.demanda_contratada_kw && !s.recibo_url && !s.ciudad && !s.ubicacion_estado && !s.notas && (
                    <p className="col-span-2 text-sm" style={{ color: '#aaa' }}>Sin datos adicionales.</p>
                  )}
                </div>
              </div>
            )}

            {/* Formulario editar inline */}
            {editandoId === s.id && mostrando && <FormSitio />}
          </div>
        ))}
      </div>

      {/* Formulario nuevo sitio */}
      {mostrando && !editandoId && <FormSitio />}
    </div>
  )
}
