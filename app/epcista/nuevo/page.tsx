'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Eye, Pencil, Upload, FileText } from 'lucide-react'
import type { TipoProyecto, TecnologiaBateria, Moneda, ModalidadFinanciamiento, Cliente, Sitio } from '@/lib/types'

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
]

interface FormData {
  tipo: TipoProyecto | ''
  nombre_proyecto: string
  cliente_id: string
  capacidad_mwh: string
  capacidad_mw: string
  tecnologia_bateria: TecnologiaBateria | ''
  duracion_descarga_hrs: string
  punto_interconexion: string
  tipo_participacion_mem: string
  volumen_energia_mwh_anual: string
  modalidad_financiamiento: ModalidadFinanciamiento[]
  capex_estimado: string
  moneda: Moneda
  ubicacion_estado: string
  notas_adicionales: string
}

const initial: FormData = {
  tipo: '',
  nombre_proyecto: '',
  cliente_id: '',
  capacidad_mwh: '',
  capacidad_mw: '',
  tecnologia_bateria: '',
  duracion_descarga_hrs: '',
  punto_interconexion: '',
  tipo_participacion_mem: '',
  volumen_energia_mwh_anual: '',
  modalidad_financiamiento: [],
  capex_estimado: '',
  moneda: 'MXN',
  ubicacion_estado: '',
  notas_adicionales: '',
}

const emptyNuevoSitio = { nombre: '', ciudad: '', ubicacion_estado: '', rpu: '' }

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              backgroundColor: i < current ? '#000' : i === current ? '#D7FF2F' : '#CFCFCF',
              color: i < current ? '#D7FF2F' : '#000',
            }}
          >
            {i < current ? '✓' : i + 1}
          </div>
          {i < total - 1 && (
            <div className="h-px w-8" style={{ backgroundColor: i < current ? '#000' : '#CFCFCF' }} />
          )}
        </div>
      ))}
      <span className="ml-3 text-sm" style={{ color: '#666' }}>
        Paso {current + 1} de {total}
      </span>
    </div>
  )
}

export default function NuevoProyectoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(initial)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Clientes y sitios
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesCargados, setClientesCargados] = useState(false)
  const [sitiosCliente, setSitiosCliente] = useState<Sitio[]>([])
  const [sitiosSeleccionados, setSitiosSeleccionados] = useState<string[]>([])

  // Mini-form de nuevo sitio inline
  const [mostrarNuevoSitio, setMostrarNuevoSitio] = useState(false)
  const [nuevoSitio, setNuevoSitio] = useState(emptyNuevoSitio)
  const [guardandoSitio, setGuardandoSitio] = useState(false)
  const [reciboUrlNuevo, setReciboUrlNuevo] = useState<string | null>(null)
  const [subiendoPdfNuevo, setSubiendoPdfNuevo] = useState(false)
  const fileRefNuevo = useRef<HTMLInputElement>(null)

  // Ver / editar sitios existentes
  const [viendoSitioId, setViendoSitioId] = useState<string | null>(null)
  const [editandoSitioId, setEditandoSitioId] = useState<string | null>(null)
  const [editSitioForm, setEditSitioForm] = useState(emptyNuevoSitio)
  const [editSitioReciboUrl, setEditSitioReciboUrl] = useState<string | null>(null)
  const [subiendoPdfEdit, setSubiendoPdfEdit] = useState(false)
  const [guardandoEditSitio, setGuardandoEditSitio] = useState(false)
  const fileRefEdit = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadClientes() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setClientesCargados(true); return }
      const { data } = await supabase
        .from('clientes').select('*').eq('epcista_id', session.user.id).order('razon_social')
      setClientes((data ?? []) as Cliente[])
      setClientesCargados(true)
    }
    loadClientes()
  }, [])

  async function cargarSitios(clienteId: string) {
    if (!clienteId) { setSitiosCliente([]); setSitiosSeleccionados([]); return }
    const { data } = await supabase.from('sitios').select('*').eq('cliente_id', clienteId).order('nombre')
    setSitiosCliente((data ?? []) as Sitio[])
    setSitiosSeleccionados([])
  }

  function seleccionarCliente(clienteId: string) {
    set('cliente_id', clienteId)
    cargarSitios(clienteId)
    setMostrarNuevoSitio(false)
    setViendoSitioId(null)
    setEditandoSitioId(null)
  }

  function toggleSitio(sitioId: string) {
    setSitiosSeleccionados(prev =>
      prev.includes(sitioId) ? prev.filter(id => id !== sitioId) : [...prev, sitioId]
    )
  }

  async function subirPdfNuevo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !form.cliente_id) return
    setSubiendoPdfNuevo(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSubiendoPdfNuevo(false); return }
    const path = `${session.user.id}/${form.cliente_id}/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage.from('recibos-cfe').upload(path, file)
    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage.from('recibos-cfe').getPublicUrl(path)
      setReciboUrlNuevo(publicUrl)
    }
    setSubiendoPdfNuevo(false)
    if (fileRefNuevo.current) fileRefNuevo.current.value = ''
  }

  async function subirPdfEdit(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !form.cliente_id) return
    setSubiendoPdfEdit(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSubiendoPdfEdit(false); return }
    const path = `${session.user.id}/${form.cliente_id}/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage.from('recibos-cfe').upload(path, file)
    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage.from('recibos-cfe').getPublicUrl(path)
      setEditSitioReciboUrl(publicUrl)
    }
    setSubiendoPdfEdit(false)
    if (fileRefEdit.current) fileRefEdit.current.value = ''
  }

  async function guardarNuevoSitio() {
    if (!nuevoSitio.nombre.trim() || !form.cliente_id) return
    setGuardandoSitio(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setGuardandoSitio(false); return }

    const { data } = await supabase.from('sitios').insert({
      cliente_id: form.cliente_id,
      epcista_id: session.user.id,
      nombre: nuevoSitio.nombre,
      ciudad: nuevoSitio.ciudad || null,
      ubicacion_estado: nuevoSitio.ubicacion_estado || null,
      rpu: nuevoSitio.rpu || null,
      recibo_url: reciboUrlNuevo,
    }).select().single()

    if (data) {
      const sitio = data as Sitio
      setSitiosCliente(prev => [...prev, sitio])
      setSitiosSeleccionados(prev => [...prev, sitio.id])
    }
    setNuevoSitio(emptyNuevoSitio)
    setReciboUrlNuevo(null)
    setMostrarNuevoSitio(false)
    setGuardandoSitio(false)
  }

  async function actualizarSitio() {
    if (!editandoSitioId || !editSitioForm.nombre.trim()) return
    setGuardandoEditSitio(true)
    const { data } = await supabase.from('sitios').update({
      nombre: editSitioForm.nombre,
      ciudad: editSitioForm.ciudad || null,
      ubicacion_estado: editSitioForm.ubicacion_estado || null,
      rpu: editSitioForm.rpu || null,
      recibo_url: editSitioReciboUrl,
    }).eq('id', editandoSitioId).select().single()

    if (data) setSitiosCliente(prev => prev.map(s => s.id === editandoSitioId ? data as Sitio : s))
    setEditandoSitioId(null)
    setEditSitioForm(emptyNuevoSitio)
    setEditSitioReciboUrl(null)
    setGuardandoEditSitio(false)
  }

  function abrirEditarSitio(s: Sitio) {
    setEditandoSitioId(editandoSitioId === s.id ? null : s.id)
    setEditSitioForm({ nombre: s.nombre, ciudad: s.ciudad ?? '', ubicacion_estado: s.ubicacion_estado ?? '', rpu: s.rpu ?? '' })
    setEditSitioReciboUrl(s.recibo_url ?? null)
    setViendoSitioId(null)
    setMostrarNuevoSitio(false)
  }

  function set(field: keyof FormData, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleModalidad(m: ModalidadFinanciamiento) {
    if (m === 'no_sabe') { set('modalidad_financiamiento', ['no_sabe']); return }
    const current = form.modalidad_financiamiento.filter(x => x !== 'no_sabe')
    if (current.includes(m)) set('modalidad_financiamiento', current.filter(x => x !== m))
    else set('modalidad_financiamiento', [...current, m])
  }

  function validarPaso1() {
    if (!form.tipo) return 'Selecciona el tipo de proyecto.'
    if (!form.nombre_proyecto.trim()) return 'Ingresa el nombre del proyecto.'
    if (!form.cliente_id) return 'Selecciona un cliente.'
    if (sitiosSeleccionados.length === 0) return 'Selecciona al menos un sitio a cotizar.'
    return ''
  }

  function validarPaso2() {
    if (form.tipo === 'BESS' || form.tipo === 'BESS+MEM') {
      if (!form.capacidad_mwh) return 'Ingresa la capacidad en MWh.'
      if (!form.capacidad_mw) return 'Ingresa la capacidad en MW.'
      if (!form.tecnologia_bateria) return 'Selecciona la tecnología de batería.'
      if (!form.duracion_descarga_hrs) return 'Ingresa la duración de descarga.'
      if (!form.punto_interconexion.trim()) return 'Ingresa el punto de interconexión.'
    }
    if (form.tipo === 'MEM' || form.tipo === 'BESS+MEM') {
      if (!form.tipo_participacion_mem.trim()) return 'Ingresa el tipo de participación MEM.'
      if (!form.volumen_energia_mwh_anual) return 'Ingresa el volumen de energía anual.'
    }
    return ''
  }

  function validarPaso3() {
    if (form.modalidad_financiamiento.length === 0) return 'Selecciona al menos una modalidad.'
    if (!form.ubicacion_estado) return 'Selecciona el estado.'
    return ''
  }

  function handleNext() {
    setError('')
    const err = step === 0 ? validarPaso1() : step === 1 ? validarPaso2() : ''
    if (err) { setError(err); return }
    setStep(s => s + 1)
  }

  async function handleSubmit() {
    setError('')
    const err = validarPaso3()
    if (err) { setError(err); return }
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError('Sesión expirada.'); setLoading(false); return }

    const cliente = clientes.find(c => c.id === form.cliente_id)

    const payload = {
      epcista_id: session.user.id,
      cliente_id: form.cliente_id,
      tipo: form.tipo,
      nombre_proyecto: form.nombre_proyecto,
      estado: 'recibido',
      cliente_final_nombre: cliente?.contacto_nombre ?? '',
      cliente_final_empresa: cliente?.razon_social ?? '',
      cliente_final_contacto: cliente?.contacto_email ?? cliente?.contacto_telefono ?? '',
      capacidad_mwh: form.capacidad_mwh ? Number(form.capacidad_mwh) : null,
      capacidad_mw: form.capacidad_mw ? Number(form.capacidad_mw) : null,
      tecnologia_bateria: form.tecnologia_bateria || null,
      duracion_descarga_hrs: form.duracion_descarga_hrs ? Number(form.duracion_descarga_hrs) : null,
      punto_interconexion: form.punto_interconexion || null,
      tipo_participacion_mem: form.tipo_participacion_mem || null,
      volumen_energia_mwh_anual: form.volumen_energia_mwh_anual ? Number(form.volumen_energia_mwh_anual) : null,
      capex_estimado: form.capex_estimado ? Number(form.capex_estimado) : null,
      moneda: form.moneda,
      ubicacion_estado: form.ubicacion_estado,
      modalidad_financiamiento: form.modalidad_financiamiento,
      notas_adicionales: form.notas_adicionales || null,
    }

    const { data, error: dbError } = await supabase.from('proyectos').insert(payload).select('id').single()
    if (dbError) { setError('Error al guardar: ' + dbError.message); setLoading(false); return }

    if (sitiosSeleccionados.length > 0) {
      await supabase.from('proyecto_sitios').insert(
        sitiosSeleccionados.map(sitio_id => ({ proyecto_id: data.id, sitio_id }))
      )
    }

    router.push(`/epcista/proyectos/${data.id}`)
  }

  const inp = "w-full border px-3 py-2 text-sm bg-white"
  const borde = { borderColor: '#CFCFCF' }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black">Nuevo proyecto</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Completa los tres pasos para enviar tu proyecto</p>
      </div>

      <StepIndicator current={step} total={3} />

      <div className="border p-8" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>

        {/* ── PASO 1 ── */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-bold text-lg">Cliente y sitios</h2>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de proyecto *</label>
              <div className="grid grid-cols-3 gap-3">
                {(['BESS', 'MEM', 'BESS+MEM'] as TipoProyecto[]).map(t => (
                  <button key={t} type="button" onClick={() => set('tipo', t)}
                    className="border p-4 text-center transition-colors"
                    style={{ borderColor: form.tipo === t ? '#000' : '#CFCFCF', backgroundColor: form.tipo === t ? '#000' : '#fff', color: form.tipo === t ? '#D7FF2F' : '#000' }}>
                    <div className="font-black text-lg">{t}</div>
                    <div className="text-xs mt-1 opacity-70">
                      {t === 'BESS' ? 'Almacenamiento' : t === 'MEM' ? 'Mercado eléctrico' : 'Ambos'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium mb-1">Nombre del proyecto *</label>
              <input type="text" value={form.nombre_proyecto} onChange={e => set('nombre_proyecto', e.target.value)}
                className={inp} style={borde} placeholder="Ej: Planta Solar Norte" />
            </div>

            <hr style={{ borderColor: '#CFCFCF' }} />

            {/* Cliente */}
            <div>
              <label className="block text-sm font-medium mb-1">Cliente *</label>
              {clientesCargados && (
                <select value={form.cliente_id} onChange={e => seleccionarCliente(e.target.value)}
                  className={inp} style={borde}>
                  <option value="">Selecciona un cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
              )}
            </div>

            {/* Sitios */}
            {form.cliente_id && (
              <div>
                <label className="block text-sm font-medium mb-2">Sitios a cotizar *</label>

                {sitiosCliente.length === 0 && !mostrarNuevoSitio && (
                  <p className="text-sm mb-3" style={{ color: '#888' }}>
                    Este cliente no tiene sitios registrados.
                  </p>
                )}

                {/* Lista de sitios con checkboxes + Ver/Editar */}
                {sitiosCliente.length > 0 && (
                  <div className="flex flex-col gap-1 mb-3">
                    {sitiosCliente.map(s => (
                      <div key={s.id}>
                        {/* Fila principal */}
                        <div
                          className="flex items-center gap-3 border p-3"
                          style={{ borderColor: sitiosSeleccionados.includes(s.id) ? '#000' : '#CFCFCF', backgroundColor: sitiosSeleccionados.includes(s.id) ? '#f5f5f0' : '#fff' }}
                        >
                          <input
                            type="checkbox"
                            id={`sitio-${s.id}`}
                            checked={sitiosSeleccionados.includes(s.id)}
                            onChange={() => toggleSitio(s.id)}
                            className="w-4 h-4 flex-shrink-0"
                          />
                          <label htmlFor={`sitio-${s.id}`} className="flex-1 cursor-pointer min-w-0">
                            <div className="text-sm font-semibold">{s.nombre}</div>
                            {(s.ciudad || s.ubicacion_estado) && (
                              <div className="text-xs truncate" style={{ color: '#666' }}>
                                {[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}
                              </div>
                            )}
                          </label>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setViendoSitioId(viendoSitioId === s.id ? null : s.id)
                                setEditandoSitioId(null)
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs border font-medium"
                              style={{ borderColor: viendoSitioId === s.id ? '#000' : '#CFCFCF', backgroundColor: viendoSitioId === s.id ? '#000' : '#fff', color: viendoSitioId === s.id ? '#D7FF2F' : '#444' }}
                            >
                              <Eye size={11} /> Ver
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirEditarSitio(s)}
                              className="flex items-center gap-1 px-2 py-1 text-xs border font-medium"
                              style={{ borderColor: editandoSitioId === s.id ? '#000' : '#CFCFCF', backgroundColor: editandoSitioId === s.id ? '#f0f0f0' : '#fff', color: '#444' }}
                            >
                              <Pencil size={11} /> Editar
                            </button>
                          </div>
                        </div>

                        {/* Panel Ver */}
                        {viendoSitioId === s.id && (
                          <div className="border border-t-0 px-4 py-3" style={{ borderColor: '#000', backgroundColor: '#fafafa' }}>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                              {s.rpu && (
                                <div><span style={{ color: '#888' }}>RPU: </span><span className="font-medium">{s.rpu}</span></div>
                              )}
                              {(s.ciudad || s.ubicacion_estado) && (
                                <div><span style={{ color: '#888' }}>Ubicación: </span><span className="font-medium">{[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}</span></div>
                              )}
                              {s.recibo_url && (
                                <div className="col-span-2">
                                  <a href={s.recibo_url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 underline font-medium" style={{ color: '#000' }}>
                                    <FileText size={11} /> Ver recibo CFE
                                  </a>
                                </div>
                              )}
                              {!s.rpu && !s.recibo_url && !s.ciudad && !s.ubicacion_estado && (
                                <p style={{ color: '#aaa' }} className="col-span-2">Sin datos adicionales.</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Panel Editar */}
                        {editandoSitioId === s.id && (
                          <div className="border border-t-0 px-4 py-4" style={{ borderColor: '#000' }}>
                            <p className="text-xs font-bold mb-3">Editar sitio</p>
                            <div className="flex flex-col gap-3">
                              <div>
                                <label className="block text-xs font-medium mb-1">Nombre *</label>
                                <input type="text" value={editSitioForm.nombre}
                                  onChange={e => setEditSitioForm(f => ({ ...f, nombre: e.target.value }))}
                                  className={inp} style={borde} />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: '12px' }}>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Ciudad</label>
                                  <input type="text" value={editSitioForm.ciudad}
                                    onChange={e => setEditSitioForm(f => ({ ...f, ciudad: e.target.value }))}
                                    className={inp} style={borde} placeholder="Monterrey" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Estado</label>
                                  <select value={editSitioForm.ubicacion_estado}
                                    onChange={e => setEditSitioForm(f => ({ ...f, ubicacion_estado: e.target.value }))}
                                    className={inp} style={borde}>
                                    <option value="">Selecciona</option>
                                    {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">RPU</label>
                                  <input type="text" value={editSitioForm.rpu}
                                    onChange={e => setEditSitioForm(f => ({ ...f, rpu: e.target.value }))}
                                    className={inp} style={borde} placeholder="RPU" />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Recibo CFE (PDF)</label>
                                <div className="flex items-center gap-3">
                                  <input ref={fileRefEdit} type="file" accept=".pdf" onChange={subirPdfEdit} className="hidden" id="edit-recibo-pdf" />
                                  <label htmlFor="edit-recibo-pdf"
                                    className="flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium cursor-pointer"
                                    style={{ borderColor: '#CFCFCF' }}>
                                    <Upload size={11} />
                                    {subiendoPdfEdit ? 'Subiendo…' : 'Seleccionar PDF'}
                                  </label>
                                  {editSitioReciboUrl && (
                                    <a href={editSitioReciboUrl} target="_blank" rel="noopener noreferrer"
                                      className="text-xs underline flex items-center gap-1">
                                      <FileText size={11} /> Ver PDF
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-between mt-3">
                              <button type="button" onClick={() => setEditandoSitioId(null)}
                                className="px-3 py-1.5 text-xs border" style={{ borderColor: '#CFCFCF' }}>
                                Cancelar
                              </button>
                              <button type="button" onClick={actualizarSitio}
                                disabled={guardandoEditSitio || !editSitioForm.nombre.trim()}
                                className="px-4 py-1.5 text-xs font-bold disabled:opacity-50"
                                style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
                                {guardandoEditSitio ? 'Guardando…' : 'Guardar cambios'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Mini-form nuevo sitio */}
                {mostrarNuevoSitio ? (
                  <div className="border p-4" style={{ borderColor: '#000' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold">Nuevo sitio</span>
                      <button type="button" onClick={() => { setMostrarNuevoSitio(false); setNuevoSitio(emptyNuevoSitio); setReciboUrlNuevo(null) }}>
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Nombre *</label>
                        <input type="text" value={nuevoSitio.nombre}
                          onChange={e => setNuevoSitio(f => ({ ...f, nombre: e.target.value }))}
                          className={inp} style={borde} placeholder="Ej: Bodega Norte" />
                      </div>
                      {/* Ciudad + Estado + RPU en misma fila */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: '12px' }}>
                        <div>
                          <label className="block text-xs font-medium mb-1">Ciudad</label>
                          <input type="text" value={nuevoSitio.ciudad}
                            onChange={e => setNuevoSitio(f => ({ ...f, ciudad: e.target.value }))}
                            className={inp} style={borde} placeholder="Monterrey" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Estado</label>
                          <select value={nuevoSitio.ubicacion_estado}
                            onChange={e => setNuevoSitio(f => ({ ...f, ubicacion_estado: e.target.value }))}
                            className={inp} style={borde}>
                            <option value="">Selecciona</option>
                            {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">RPU</label>
                          <input type="text" value={nuevoSitio.rpu}
                            onChange={e => setNuevoSitio(f => ({ ...f, rpu: e.target.value }))}
                            className={inp} style={borde} placeholder="RPU" />
                        </div>
                      </div>
                      {/* PDF recibo */}
                      <div>
                        <label className="block text-xs font-medium mb-1">Recibo CFE (PDF)</label>
                        <div className="flex items-center gap-3">
                          <input ref={fileRefNuevo} type="file" accept=".pdf" onChange={subirPdfNuevo} className="hidden" id="nuevo-recibo-pdf" />
                          <label htmlFor="nuevo-recibo-pdf"
                            className="flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium cursor-pointer"
                            style={{ borderColor: '#CFCFCF' }}>
                            <Upload size={11} />
                            {subiendoPdfNuevo ? 'Subiendo…' : 'Seleccionar PDF'}
                          </label>
                          {reciboUrlNuevo && (
                            <a href={reciboUrlNuevo} target="_blank" rel="noopener noreferrer"
                              className="text-xs underline flex items-center gap-1">
                              <FileText size={11} /> Ver PDF
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <button type="button" onClick={guardarNuevoSitio} disabled={guardandoSitio || !nuevoSitio.nombre.trim()}
                        className="px-4 py-2 text-xs font-bold disabled:opacity-50"
                        style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
                        {guardandoSitio ? 'Guardando…' : 'Agregar sitio'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setMostrarNuevoSitio(true); setViendoSitioId(null); setEditandoSitioId(null) }}
                    className="flex items-center gap-2 px-3 py-2 text-sm border font-medium w-full justify-center"
                    style={{ borderColor: '#CFCFCF', borderStyle: 'dashed' }}>
                    <Plus size={14} />
                    {sitiosCliente.length === 0 ? 'Agregar sitio' : 'Agregar otro sitio'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PASO 2 ── */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-bold text-lg">Datos técnicos</h2>

            {(form.tipo === 'BESS' || form.tipo === 'BESS+MEM') && (
              <div className="flex flex-col gap-4">
                {form.tipo === 'BESS+MEM' && (
                  <h3 className="font-semibold text-sm uppercase tracking-wide" style={{ color: '#666' }}>Sistema de almacenamiento (BESS)</h3>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Capacidad (MWh) *</label>
                    <input type="number" min="0" value={form.capacidad_mwh} onChange={e => set('capacidad_mwh', e.target.value)} className={inp} style={borde} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Potencia (MW) *</label>
                    <input type="number" min="0" value={form.capacidad_mw} onChange={e => set('capacidad_mw', e.target.value)} className={inp} style={borde} placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Tecnología de batería *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['Li-ion', 'LFP', 'NMC', 'Otra'] as TecnologiaBateria[]).map(t => (
                      <button key={t} type="button" onClick={() => set('tecnologia_bateria', t)}
                        className="border py-2 px-3 text-sm font-medium transition-colors"
                        style={{ borderColor: form.tecnologia_bateria === t ? '#000' : '#CFCFCF', backgroundColor: form.tecnologia_bateria === t ? '#000' : '#fff', color: form.tecnologia_bateria === t ? '#D7FF2F' : '#000' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Duración de descarga (hrs) *</label>
                    <input type="number" min="0" value={form.duracion_descarga_hrs} onChange={e => set('duracion_descarga_hrs', e.target.value)} className={inp} style={borde} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Punto de interconexión *</label>
                    <input type="text" value={form.punto_interconexion} onChange={e => set('punto_interconexion', e.target.value)} className={inp} style={borde} placeholder="Ej: Subestación Norte" />
                  </div>
                </div>
              </div>
            )}

            {form.tipo === 'BESS+MEM' && <hr style={{ borderColor: '#CFCFCF' }} />}

            {(form.tipo === 'MEM' || form.tipo === 'BESS+MEM') && (
              <div className="flex flex-col gap-4">
                {form.tipo === 'BESS+MEM' && (
                  <h3 className="font-semibold text-sm uppercase tracking-wide" style={{ color: '#666' }}>Mercado Eléctrico Mayorista (MEM)</h3>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de participación MEM *</label>
                  <input type="text" value={form.tipo_participacion_mem} onChange={e => set('tipo_participacion_mem', e.target.value)} className={inp} style={borde} placeholder="Ej: Suministrador, Generador" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Volumen de energía anual (MWh) *</label>
                  <input type="number" min="0" value={form.volumen_energia_mwh_anual} onChange={e => set('volumen_energia_mwh_anual', e.target.value)} className={inp} style={borde} placeholder="0" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PASO 3 ── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-bold text-lg">Financiamiento y ubicación</h2>

            <div>
              <label className="block text-sm font-medium mb-2">Modalidad de financiamiento *</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'credito', label: 'Crédito', desc: 'Financiamiento bancario o institucional' },
                  { value: 'arrendamiento', label: 'Arrendamiento', desc: 'Renta de equipos a largo plazo' },
                  { value: 'ensaas', label: 'EnSaaS', desc: 'Energy Storage as a Service' },
                  { value: 'mem', label: 'Mercado Eléctrico Mayorista', desc: 'Ingresos por participación MEM' },
                ] as { value: ModalidadFinanciamiento; label: string; desc: string }[]).map(opt => {
                  const noSabe = form.modalidad_financiamiento.includes('no_sabe')
                  const selected = form.modalidad_financiamiento.includes(opt.value)
                  return (
                    <button key={opt.value} type="button" disabled={noSabe}
                      onClick={() => toggleModalidad(opt.value)}
                      className="border p-3 text-left transition-colors disabled:opacity-40"
                      style={{ borderColor: selected ? '#000' : '#CFCFCF', backgroundColor: selected ? '#000' : '#fff', color: selected ? '#D7FF2F' : '#000' }}>
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>
                    </button>
                  )
                })}
              </div>
              <div className="mt-3">
                <button type="button" onClick={() => toggleModalidad('no_sabe')}
                  className="border p-3 text-left w-full transition-colors"
                  style={{ borderColor: form.modalidad_financiamiento.includes('no_sabe') ? '#000' : '#CFCFCF', backgroundColor: form.modalidad_financiamiento.includes('no_sabe') ? '#D7FF2F' : '#fff', color: '#000' }}>
                  <div className="font-semibold text-sm">No sé, que el analista recomiende</div>
                  <div className="text-xs mt-0.5" style={{ color: '#666' }}>El analista definirá la modalidad más adecuada</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">CAPEX estimado</label>
              <div className="flex gap-2">
                <select value={form.moneda} onChange={e => set('moneda', e.target.value as Moneda)}
                  className="border px-2 py-2 text-sm" style={borde}>
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
                <input type="number" min="0" value={form.capex_estimado}
                  onChange={e => set('capex_estimado', e.target.value)}
                  className={`${inp} flex-1`} style={borde} placeholder="0" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Estado de la República *</label>
              <select value={form.ubicacion_estado} onChange={e => set('ubicacion_estado', e.target.value)}
                className={inp} style={borde}>
                <option value="">Selecciona un estado</option>
                {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notas adicionales</label>
              <textarea value={form.notas_adicionales} onChange={e => set('notas_adicionales', e.target.value)}
                rows={4} className={inp} style={borde}
                placeholder="Cualquier información adicional relevante para el analista…" />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        <div className="flex justify-between mt-8">
          <button type="button" onClick={() => { setError(''); setStep(s => s - 1) }}
            disabled={step === 0} className="px-5 py-2 text-sm font-medium border disabled:opacity-30"
            style={{ borderColor: '#CFCFCF' }}>
            Anterior
          </button>
          {step < 2 ? (
            <button type="button" onClick={handleNext}
              className="px-5 py-2 text-sm font-bold"
              style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
              Siguiente
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="px-5 py-2 text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: '#000', color: '#D7FF2F' }}>
              {loading ? 'Enviando...' : 'Enviar proyecto'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
