/* eslint-disable */
'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from './ui/Button'
import { Plus, MapPin, FileText, Pencil, Trash2, Upload, ExternalLink, Eye } from 'lucide-react'
import type { Sitio } from '@/lib/types'
import { fmtUnit } from '@/lib/format'

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
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function abrirNuevo() {
    setEditandoId(null)
    setForm(emptyForm)
    setPdfUrl(null)
    setUploadError(null)
    setSaveError(null)
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
    setUploadError(null)
    setSaveError(null)
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
    setUploadError(null)
    setSubiendoPdf(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const effectiveOwnerId = epcistaId || session?.user?.id || 'general'
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${effectiveOwnerId}/${clienteId}/${Date.now()}_${cleanFileName}`

      const { error: upErr } = await supabase.storage.from('recibos-cfe').upload(path, file, {
        cacheControl: '3600',
        upsert: true
      })
      if (upErr) {
        console.error('Storage upload error:', upErr)
        setUploadError(`Error al subir archivo: ${upErr.message}`)
      } else {
        const { data: { publicUrl } } = supabase.storage.from('recibos-cfe').getPublicUrl(path)
        setPdfUrl(publicUrl)
      }
    } catch (err: unknown) {
      console.error('Catch upload error:', err)
      const msg = err instanceof Error ? err.message : 'Error inesperado al subir el recibo.'
      setUploadError(msg)
    } finally {
      setSubiendoPdf(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    setSaveError(null)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const effectiveEpcistaId = epcistaId || session?.user?.id

      const payload = {
        cliente_id: clienteId,
        epcista_id: effectiveEpcistaId,
        nombre: form.nombre.trim(),
        nombre_recibo: form.nombre_recibo.trim() || null,
        ciudad: form.ciudad.trim() || null,
        ubicacion_estado: form.ubicacion_estado || null,
        rpu: form.rpu.trim() || null,
        demanda_contratada_kw: form.demanda_contratada_kw ? Number(form.demanda_contratada_kw) : null,
        recibo_url: pdfUrl,
        notas: form.notas.trim() || null,
      }
      if (editandoId) {
        const { data, error: updErr } = await supabase.from('sitios').update(payload).eq('id', editandoId).select().single()
        if (updErr) throw updErr
        if (data) setSitios(prev => prev.map(s => s.id === editandoId ? data as Sitio : s))
      } else {
        const { data, error: insErr } = await supabase.from('sitios').insert(payload).select().single()
        if (insErr) throw insErr
        if (data) setSitios(prev => [...prev, data as Sitio])
      }
      setMostrando(false)
      setEditandoId(null)
    } catch (err: unknown) {
      console.error('Error saving site:', err)
      const msg = err instanceof Error ? err.message : 'Error al guardar el sitio.'
      setSaveError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function eliminar(id: string) {
    try {
      const { error: delErr } = await supabase.from('sitios').delete().eq('id', id)
      if (delErr) throw delErr
      setSitios(prev => prev.filter(s => s.id !== id))
      setConfirmDelete(null)
    } catch (err: unknown) {
      console.error('Error deleting site:', err)
    }
  }

  const inputClass = "w-full border border-borde rounded-lg px-4 py-2.5 text-sm bg-white focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all"

  const renderFormSitio = () => (
    <div className="glass-card p-6 shadow-sm">
      <h4 className="font-bold text-sm mb-5">{editandoId ? 'Editar sitio' : 'Nuevo sitio'}</h4>
      
      {saveError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-xs font-semibold">
          {saveError}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium mb-1">Nombre del sitio *</label>
          <input type="text" value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            className={inputClass} placeholder="Ej: Planta Monterrey" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Nombre como aparece en el recibo</label>
          <input type="text" value={form.nombre_recibo}
            onChange={e => setForm(f => ({ ...f, nombre_recibo: e.target.value }))}
            className={inputClass} placeholder="Nombre en el recibo CFE" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Ciudad</label>
            <input type="text" value={form.ciudad}
              onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
              className={inputClass} placeholder="Monterrey" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Estado</label>
            <select value={form.ubicacion_estado}
              onChange={e => setForm(f => ({ ...f, ubicacion_estado: e.target.value }))}
              className={inputClass}>
              <option value="">Selecciona</option>
              {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">RPU</label>
            <input type="text" value={form.rpu}
              onChange={e => setForm(f => ({ ...f, rpu: e.target.value }))}
              className={inputClass} placeholder="RPU" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Demanda contratada (kW)</label>
            <input type="number" min="0" value={form.demanda_contratada_kw}
              onChange={e => setForm(f => ({ ...f, demanda_contratada_kw: e.target.value }))}
              className={inputClass} placeholder="0" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Último recibo CFE (PDF)</label>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".pdf" onChange={subirPdf} className="hidden" id="recibo-pdf" />
              <label htmlFor="recibo-pdf"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border border-borde text-sm font-medium cursor-pointer hover:bg-gray-50 transition-all bg-white ${subiendoPdf ? 'opacity-60 pointer-events-none' : ''}`}>
                <Upload size={14} />
                {subiendoPdf ? 'Subiendo archivo…' : 'Seleccionar PDF'}
              </label>
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs underline flex items-center gap-1 text-principal font-medium">
                  <FileText size={12} /> Ver PDF actual <ExternalLink size={10} />
                </a>
              )}
            </div>
            {uploadError && (
              <p className="text-xs text-red-600 font-medium">{uploadError}</p>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Notas</label>
          <textarea rows={2} value={form.notas}
            onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            className={inputClass} placeholder="Observaciones del sitio…" />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-borde">
        <Button variant="outline" size="md" onClick={() => { setMostrando(false); setEditandoId(null); setSaveError(null); setUploadError(null) }}>
          Cancelar
        </Button>
        <Button variant="primary" size="md" onClick={guardar} disabled={loading || subiendoPdf || !form.nombre.trim()}>
          {loading ? 'Guardando…' : subiendoPdf ? 'Subiendo PDF…' : editandoId ? 'Guardar cambios' : 'Agregar sitio'}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="glass-card p-6 mt-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500">Sitios</h3>
        <Button variant="primary" size="sm" onClick={abrirNuevo}>
          <Plus size={14} /> Agregar sitio
        </Button>
      </div>

      {sitios.length === 0 && !mostrando && (
        <p className="text-sm text-gray-300">Sin sitios registrados.</p>
      )}

      <div className="flex flex-col gap-2 mb-4">
        {sitios.map(s => (
          <div key={s.id}>
            <div className={`rounded-xl border transition-all ${confirmDelete === s.id ? 'border-red-500 shadow-md ring-2 ring-red-500/20' : 'border-borde hover:border-gray-300 hover:shadow-sm'} p-5`}>
              {confirmDelete === s.id ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm">¿Eliminar <strong>{s.nombre}</strong>?</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                    <Button variant="danger" size="sm" onClick={() => eliminar(s.id)}>Eliminar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{s.nombre}</p>
                    {(s.ciudad || s.ubicacion_estado) && (
                      <span className="flex items-center gap-1 text-xs mt-0.5 text-gray-500">
                        <MapPin size={11} />
                        {[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => toggleVer(s.id)}
                      className={`p-2 rounded-lg border transition-colors ${viendoId === s.id ? 'border-principal bg-principal text-acento' : 'border-borde bg-white text-gray-500 hover:border-gray-300'}`}>
                      <Eye size={14} />
                    </button>
                    <button onClick={() => abrirEditar(s)}
                      className={`p-2 rounded-lg border transition-colors text-gray-500 ${(editandoId === s.id && mostrando) ? 'border-principal bg-gray-50' : 'border-borde bg-white hover:border-gray-300'}`}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setConfirmDelete(s.id)}
                      className="p-2 rounded-lg border border-borde text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Panel Ver */}
            {viendoId === s.id && (
              <div className="rounded-xl border border-principal px-6 py-5 bg-[#fafafa] mt-2 shadow-inner">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  {s.nombre_recibo && (
                    <div>
                      <div className="text-xs font-medium mb-0.5 text-gray-400">Nombre en el recibo</div>
                      <div className="font-medium">{s.nombre_recibo}</div>
                    </div>
                  )}
                  {(s.ciudad || s.ubicacion_estado) && (
                    <div>
                      <div className="text-xs font-medium mb-0.5 text-gray-400">Ubicación</div>
                      <div className="font-medium">{[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}</div>
                    </div>
                  )}
                  {s.rpu && (
                    <div>
                      <div className="text-xs font-medium mb-0.5 text-gray-400">RPU</div>
                      <div className="font-medium">{s.rpu}</div>
                    </div>
                  )}
                  {s.demanda_contratada_kw != null && (
                    <div>
                      <div className="text-xs font-medium mb-0.5 text-gray-400">Demanda contratada</div>
                      <div className="font-medium">{fmtUnit(s.demanda_contratada_kw, 'kW')}</div>
                    </div>
                  )}
                  {s.recibo_url && (
                    <div className="col-span-2">
                      <div className="text-xs font-medium mb-0.5 text-gray-400">Recibo CFE</div>
                      <a href={s.recibo_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium underline text-principal">
                        <FileText size={13} /> Ver recibo <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                  {s.notas && (
                    <div className="col-span-2">
                      <div className="text-xs font-medium mb-0.5 text-gray-400">Notas</div>
                      <p className="text-sm whitespace-pre-wrap">{s.notas}</p>
                    </div>
                  )}
                  {!s.nombre_recibo && !s.rpu && !s.demanda_contratada_kw && !s.recibo_url && !s.ciudad && !s.ubicacion_estado && !s.notas && (
                    <p className="col-span-2 text-sm text-gray-300">Sin datos adicionales.</p>
                  )}
                </div>
              </div>
            )}

            {/* Formulario editar inline */}
            {editandoId === s.id && mostrando && (
              <div className="mt-2">
                {renderFormSitio()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Formulario nuevo sitio */}
      {mostrando && !editandoId && renderFormSitio()}
    </div>
  )
}
