'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { TipoProyecto, TecnologiaBateria, Moneda, ModalidadFinanciamiento, Cliente } from '@/lib/types'

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
]

interface FormData {
  // Paso 1
  tipo: TipoProyecto | ''
  nombre_proyecto: string
  cliente_id: string
  cliente_final_nombre: string
  cliente_final_empresa: string
  cliente_final_contacto: string
  // Paso 2 BESS
  capacidad_mwh: string
  capacidad_mw: string
  tecnologia_bateria: TecnologiaBateria | ''
  duracion_descarga_hrs: string
  punto_interconexion: string
  // Paso 2 MEM
  tipo_participacion_mem: string
  volumen_energia_mwh_anual: string
  // Paso 3
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
  cliente_final_nombre: '',
  cliente_final_empresa: '',
  cliente_final_contacto: '',
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
            <div
              className="h-px w-8"
              style={{ backgroundColor: i < current ? '#000' : '#CFCFCF' }}
            />
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
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesCargados, setClientesCargados] = useState(false)

  useEffect(() => {
    async function loadClientes() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setClientesCargados(true); return }
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('epcista_id', session.user.id)
        .order('razon_social', { ascending: true })
      if (!error) setClientes((data ?? []) as Cliente[])
      setClientesCargados(true)
    }
    loadClientes()
  }, [])

  function seleccionarCliente(clienteId: string) {
    const c = clientes.find(c => c.id === clienteId)
    if (!c) {
      set('cliente_id', '')
      set('cliente_final_nombre', '')
      set('cliente_final_empresa', '')
      set('cliente_final_contacto', '')
      return
    }
    set('cliente_id', c.id)
    set('cliente_final_nombre', c.contacto_nombre)
    set('cliente_final_empresa', c.razon_social)
    set('cliente_final_contacto', c.contacto_email ?? c.contacto_telefono ?? '')
  }

  function set(field: keyof FormData, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleModalidad(m: ModalidadFinanciamiento) {
    if (m === 'no_sabe') {
      set('modalidad_financiamiento', ['no_sabe'])
      return
    }
    const current = form.modalidad_financiamiento.filter(x => x !== 'no_sabe')
    if (current.includes(m)) {
      set('modalidad_financiamiento', current.filter(x => x !== m))
    } else {
      set('modalidad_financiamiento', [...current, m])
    }
  }

  function validarPaso1() {
    if (!form.tipo) return 'Selecciona el tipo de proyecto.'
    if (!form.nombre_proyecto.trim()) return 'Ingresa el nombre del proyecto.'
    if (!form.cliente_final_nombre.trim()) return 'Ingresa el nombre del cliente final.'
    if (!form.cliente_final_empresa.trim()) return 'Ingresa la empresa del cliente final.'
    if (!form.cliente_final_contacto.trim()) return 'Ingresa el contacto del cliente final.'
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
    if (form.modalidad_financiamiento.length === 0) return 'Selecciona al menos una modalidad de financiamiento.'
    if (!form.ubicacion_estado) return 'Selecciona el estado de la República.'
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

    const payload = {
      epcista_id: session.user.id,
      cliente_id: form.cliente_id || null,
      tipo: form.tipo,
      nombre_proyecto: form.nombre_proyecto,
      estado: 'recibido',
      cliente_final_nombre: form.cliente_final_nombre,
      cliente_final_empresa: form.cliente_final_empresa,
      cliente_final_contacto: form.cliente_final_contacto,
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

    if (dbError) {
      setError('Error al guardar: ' + dbError.message)
      setLoading(false)
      return
    }

    router.push(`/epcista/proyectos/${data.id}`)
  }

  const inputClass = "w-full border px-3 py-2 text-sm bg-white"
  const inputStyle = { borderColor: '#CFCFCF' }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black">Nuevo proyecto</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Completa los tres pasos para enviar tu proyecto</p>
      </div>

      <StepIndicator current={step} total={3} />

      <div className="border p-8" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>

        {/* PASO 1 */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-bold text-lg">Tipo y cliente final</h2>

            <div>
              <label className="block text-sm font-medium mb-2">Tipo de proyecto *</label>
              <div className="grid grid-cols-3 gap-3">
                {(['BESS', 'MEM', 'BESS+MEM'] as TipoProyecto[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('tipo', t)}
                    className="border p-4 text-center transition-colors"
                    style={{
                      borderColor: form.tipo === t ? '#000' : '#CFCFCF',
                      backgroundColor: form.tipo === t ? '#000' : '#fff',
                      color: form.tipo === t ? '#D7FF2F' : '#000',
                    }}
                  >
                    <div className="font-black text-lg">{t}</div>
                    <div className="text-xs mt-1 opacity-70">
                      {t === 'BESS' ? 'Almacenamiento' : t === 'MEM' ? 'Mercado eléctrico' : 'Ambos'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nombre del proyecto *</label>
              <input
                type="text"
                value={form.nombre_proyecto}
                onChange={e => set('nombre_proyecto', e.target.value)}
                className={inputClass}
                style={inputStyle}
                placeholder="Ej: Planta Solar Norte"
              />
            </div>

            <hr style={{ borderColor: '#CFCFCF' }} />
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Cliente final</h3>
              <Link href="/epcista/clientes/nuevo" className="flex items-center gap-1 text-xs font-medium underline" style={{ color: '#666' }}>
                <Plus size={11} /> Nuevo cliente
              </Link>
            </div>

            {clientesCargados && (
              <div>
                <label className="block text-sm font-medium mb-1">Seleccionar cliente guardado</label>
                <select
                  value={form.cliente_id}
                  onChange={e => seleccionarCliente(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">— Capturar manualmente —</option>
                  {clientes.length === 0 && (
                    <option disabled>Sin clientes guardados aún</option>
                  )}
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.razon_social} · {c.contacto_nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre del contacto *</label>
                <input
                  type="text"
                  value={form.cliente_final_nombre}
                  onChange={e => set('cliente_final_nombre', e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Nombre del contacto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Empresa *</label>
                <input
                  type="text"
                  value={form.cliente_final_empresa}
                  onChange={e => set('cliente_final_empresa', e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Empresa cliente"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Contacto (email o teléfono) *</label>
              <input
                type="text"
                value={form.cliente_final_contacto}
                onChange={e => set('cliente_final_contacto', e.target.value)}
                className={inputClass}
                style={inputStyle}
                placeholder="contacto@empresa.com"
              />
            </div>
          </div>
        )}

        {/* PASO 2 */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-bold text-lg">Datos técnicos</h2>

            {(form.tipo === 'BESS' || form.tipo === 'BESS+MEM') && (
              <div className="flex flex-col gap-4">
                {form.tipo === 'BESS+MEM' && (
                  <h3 className="font-semibold text-sm uppercase tracking-wide" style={{ color: '#666' }}>
                    Sistema de almacenamiento (BESS)
                  </h3>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Capacidad (MWh) *</label>
                    <input type="number" min="0" value={form.capacidad_mwh}
                      onChange={e => set('capacidad_mwh', e.target.value)}
                      className={inputClass} style={inputStyle} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Potencia (MW) *</label>
                    <input type="number" min="0" value={form.capacidad_mw}
                      onChange={e => set('capacidad_mw', e.target.value)}
                      className={inputClass} style={inputStyle} placeholder="0" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tecnología de batería *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['Li-ion', 'LFP', 'NMC', 'Otra'] as TecnologiaBateria[]).map(t => (
                      <button key={t} type="button"
                        onClick={() => set('tecnologia_bateria', t)}
                        className="border py-2 px-3 text-sm font-medium transition-colors"
                        style={{
                          borderColor: form.tecnologia_bateria === t ? '#000' : '#CFCFCF',
                          backgroundColor: form.tecnologia_bateria === t ? '#000' : '#fff',
                          color: form.tecnologia_bateria === t ? '#D7FF2F' : '#000',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Duración de descarga (hrs) *</label>
                    <input type="number" min="0" value={form.duracion_descarga_hrs}
                      onChange={e => set('duracion_descarga_hrs', e.target.value)}
                      className={inputClass} style={inputStyle} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Punto de interconexión *</label>
                    <input type="text" value={form.punto_interconexion}
                      onChange={e => set('punto_interconexion', e.target.value)}
                      className={inputClass} style={inputStyle} placeholder="Ej: Subestación Norte" />
                  </div>
                </div>
              </div>
            )}

            {form.tipo === 'BESS+MEM' && (
              <hr style={{ borderColor: '#CFCFCF' }} />
            )}

            {(form.tipo === 'MEM' || form.tipo === 'BESS+MEM') && (
              <div className="flex flex-col gap-4">
                {form.tipo === 'BESS+MEM' && (
                  <h3 className="font-semibold text-sm uppercase tracking-wide" style={{ color: '#666' }}>
                    Mercado Eléctrico Mayorista (MEM)
                  </h3>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de participación MEM *</label>
                  <input type="text" value={form.tipo_participacion_mem}
                    onChange={e => set('tipo_participacion_mem', e.target.value)}
                    className={inputClass} style={inputStyle}
                    placeholder="Ej: Suministrador, Generador, Comercializador" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Volumen de energía anual (MWh) *</label>
                  <input type="number" min="0" value={form.volumen_energia_mwh_anual}
                    onChange={e => set('volumen_energia_mwh_anual', e.target.value)}
                    className={inputClass} style={inputStyle} placeholder="0" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 3 */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-bold text-lg">Financiamiento y ubicación</h2>

            <div>
              <label className="block text-sm font-medium mb-2">Modalidad de financiamiento sugerida *</label>
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
                    <button
                      key={opt.value}
                      type="button"
                      disabled={noSabe}
                      onClick={() => toggleModalidad(opt.value)}
                      className="border p-3 text-left transition-colors disabled:opacity-40"
                      style={{
                        borderColor: selected ? '#000' : '#CFCFCF',
                        backgroundColor: selected ? '#000' : '#fff',
                        color: selected ? '#D7FF2F' : '#000',
                      }}
                    >
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>
                    </button>
                  )
                })}
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => toggleModalidad('no_sabe')}
                  className="border p-3 text-left w-full transition-colors"
                  style={{
                    borderColor: form.modalidad_financiamiento.includes('no_sabe') ? '#000' : '#CFCFCF',
                    backgroundColor: form.modalidad_financiamiento.includes('no_sabe') ? '#D7FF2F' : '#fff',
                    color: '#000',
                  }}
                >
                  <div className="font-semibold text-sm">No sé, que el analista recomiende</div>
                  <div className="text-xs mt-0.5" style={{ color: '#666' }}>El analista definirá la modalidad más adecuada</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">CAPEX estimado</label>
              <div className="flex gap-2">
                <select
                  value={form.moneda}
                  onChange={e => set('moneda', e.target.value as Moneda)}
                  className="border px-2 py-2 text-sm"
                  style={{ borderColor: '#CFCFCF' }}
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
                <input
                  type="number"
                  min="0"
                  value={form.capex_estimado}
                  onChange={e => set('capex_estimado', e.target.value)}
                  className={`${inputClass} flex-1`}
                  style={inputStyle}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Estado de la República *</label>
              <select
                value={form.ubicacion_estado}
                onChange={e => set('ubicacion_estado', e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Selecciona un estado</option>
                {ESTADOS_MX.map(est => (
                  <option key={est} value={est}>{est}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notas adicionales</label>
              <textarea
                value={form.notas_adicionales}
                onChange={e => set('notas_adicionales', e.target.value)}
                rows={4}
                className={inputClass}
                style={inputStyle}
                placeholder="Cualquier información adicional relevante para el analista…"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 mt-4">{error}</p>
        )}

        <div className="flex justify-between mt-8">
          <button
            type="button"
            onClick={() => { setError(''); setStep(s => s - 1) }}
            disabled={step === 0}
            className="px-5 py-2 text-sm font-medium border disabled:opacity-30"
            style={{ borderColor: '#CFCFCF' }}
          >
            Anterior
          </button>

          {step < 2 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 text-sm font-bold"
              style={{ backgroundColor: '#D7FF2F', color: '#000' }}
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: '#000', color: '#D7FF2F' }}
            >
              {loading ? 'Enviando...' : 'Enviar proyecto'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
