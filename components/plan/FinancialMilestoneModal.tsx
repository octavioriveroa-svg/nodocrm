/* eslint-disable */
'use client'

import { useState } from 'react'
import type { HitoFinanciero, PlanFase } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  hito?: HitoFinanciero | null
  proyectoId: string
  fases: PlanFase[]
  isFinanciero?: boolean
  onClose: () => void
  onSaved: (hito: HitoFinanciero) => void
}

export default function FinancialMilestoneModal({ hito, proyectoId, fases, isFinanciero, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [form, setForm] = useState({
    nombre: hito?.nombre || '',
    descripcion: hito?.descripcion || '',
    monto: hito?.monto?.toString() || '',
    moneda: hito?.moneda || 'MXN',
    porcentaje_del_total: hito?.porcentaje_del_total?.toString() || '',
    fase_id: hito?.fase_id || '',
    condicion_desbloqueo: hito?.condicion_desbloqueo || '',
    fecha_estimada: hito?.fecha_estimada || '',
    estado: hito?.estado || 'pendiente',
    fecha_pago_real: hito?.fecha_pago_real || '',
    notas: hito?.notas || '',
  })

  const [comprobanteUrl, setComprobanteUrl] = useState(hito?.comprobante_url || '')
  const [comprobanteTipo, setComprobanteTipo] = useState(hito?.comprobante_tipo || '')

  async function handleSave() {
    if (!form.nombre.trim() || !form.monto) return
    setLoading(true)

    const payload = {
      proyecto_id: proyectoId,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion || null,
      monto: parseFloat(form.monto),
      moneda: form.moneda,
      porcentaje_del_total: form.porcentaje_del_total ? parseFloat(form.porcentaje_del_total) : null,
      fase_id: form.fase_id || null,
      fase_gatillo_id: form.fase_id || null,
      condicion_desbloqueo: form.condicion_desbloqueo || null,
      fecha_estimada: form.fecha_estimada || null,
      estado: form.estado,
      fecha_pago_real: form.fecha_pago_real || null,
      comprobante_url: comprobanteUrl || null,
      comprobante_tipo: comprobanteTipo || null,
      notas: form.notas || null,
      orden: hito?.orden || 0,
    }

    if (hito) {
      const { data } = await supabase.from('hitos_financieros').update(payload).eq('id', hito.id).select().single()
      if (data) onSaved(data as HitoFinanciero)
    } else {
      const { data } = await supabase.from('hitos_financieros').insert(payload).select().single()
      if (data) onSaved(data as HitoFinanciero)
    }

    setLoading(false)
    onClose()
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()?.toLowerCase()
    const tipo = ext === 'pdf' ? 'pdf' : 'imagen'
    const path = `comprobantes/${proyectoId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('archivos').upload(path, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path)
      setComprobanteUrl(urlData.publicUrl)
      setComprobanteTipo(tipo)
    }
    setUploading(false)
  }

  const ESTADO_OPTIONS = isFinanciero
    ? [
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'elegible', label: 'Elegible' },
        { value: 'aprobado', label: 'Aprobado' },
        { value: 'pagado', label: 'Pagado' },
      ]
    : [
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'elegible', label: 'Elegible' },
      ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <DollarSign size={16} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-principal leading-none mb-0.5">
                {hito ? 'Editar Hito Financiero' : 'Nuevo Hito Financiero'}
              </h2>
              <p className="text-[11px] text-gray-500">Define un desembolso del proyecto</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Nombre del hito *</label>
            <input type="text" value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder='Ej: "Anticipo 30%", "Contra entrega de equipos"'
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-acento focus:ring-2 focus:ring-acento/30" />
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Monto *</label>
              <input type="number" min="0" step="0.01" value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                placeholder="500000.00"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-acento focus:ring-2 focus:ring-acento/30 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Moneda</label>
              <select value={form.moneda}
                onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* Percentage + Phase */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">% del total</label>
              <input type="number" min="0" max="100" step="0.01" value={form.porcentaje_del_total}
                onChange={e => setForm(f => ({ ...f, porcentaje_del_total: e.target.value }))}
                placeholder="30"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Fase vinculada</label>
              <select value={form.fase_id}
                onChange={e => setForm(f => ({ ...f, fase_id: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                <option value="">Sin fase</option>
                {fases.map(f => (
                  <option key={f.id} value={f.id}>{f.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Unlock condition */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Condición de desbloqueo</label>
            <input type="text" value={form.condicion_desbloqueo}
              onChange={e => setForm(f => ({ ...f, condicion_desbloqueo: e.target.value }))}
              placeholder='Ej: "Fase Ingeniería completada al 100%"'
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-acento focus:ring-2 focus:ring-acento/30" />
          </div>

          {/* Dates + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Fecha estimada</label>
              <input type="date" value={form.fecha_estimada}
                onChange={e => setForm(f => ({ ...f, fecha_estimada: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Estado</label>
              <select value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value as typeof f.estado }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                {ESTADO_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment proof (financiero only or EPC editing) */}
          {(form.estado === 'pagado' || form.estado === 'aprobado') && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <label className="block text-xs font-bold text-green-800 mb-2">Comprobante de pago</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-green-600 mb-1">Fecha de pago</label>
                  <input type="date" value={form.fecha_pago_real}
                    onChange={e => setForm(f => ({ ...f, fecha_pago_real: e.target.value }))}
                    className="w-full text-sm border border-green-200 rounded-lg px-3 py-2 bg-white" />
                </div>
                <div>
                  <label className="block text-[10px] text-green-600 mb-1">Archivo</label>
                  {comprobanteUrl ? (
                    <a href={comprobanteUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-green-700 underline">
                      Ver comprobante ({comprobanteTipo})
                    </a>
                  ) : (
                    <label className="flex items-center gap-2 text-xs text-green-700 cursor-pointer border border-dashed border-green-300 rounded-lg px-3 py-2 hover:bg-green-100 transition-colors">
                      <Upload size={12} />
                      {uploading ? 'Subiendo...' : 'Subir PDF/imagen'}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Notas</label>
            <textarea value={form.notas} rows={2}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Notas adicionales..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-acento focus:ring-2 focus:ring-acento/30" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading || !form.nombre.trim() || !form.monto}>
            {loading ? 'Guardando...' : hito ? 'Guardar Cambios' : 'Crear Hito'}
          </Button>
        </div>
      </div>
    </div>
  )
}
