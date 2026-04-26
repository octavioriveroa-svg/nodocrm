'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
]

const INDUSTRIAS = [
  'Manufactura', 'Minería', 'Retail / Comercio', 'Hotelería / Turismo',
  'Agroindustria', 'Logística / Transporte', 'Inmobiliario', 'Salud',
  'Educación', 'Gobierno', 'Energía', 'Tecnología', 'Otra',
]

export default function NuevoClientePage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    razon_social: '',
    rfc: '',
    industria: '',
    ubicacion_estado: '',
    contacto_nombre: '',
    contacto_cargo: '',
    contacto_email: '',
    contacto_telefono: '',
    notas: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.razon_social.trim()) { setError('La razón social es obligatoria.'); return }
    if (!form.contacto_nombre.trim()) { setError('El nombre del contacto es obligatorio.'); return }

    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError('Sesión expirada.'); setLoading(false); return }

    const { data, error: dbError } = await supabase
      .from('clientes')
      .insert({
        epcista_id: session.user.id,
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
      .select('id')
      .single()

    if (dbError) { setError('Error al guardar: ' + dbError.message); setLoading(false); return }

    router.push(`/epc/clientes/${data.id}`)
  }

  const inputClass = "w-full border px-3 py-2 text-sm bg-white"
  const inputStyle = { borderColor: '#CFCFCF' }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/epc/clientes" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: '#666' }}>
        <ChevronLeft size={14} />
        Volver a clientes
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-black">Nuevo cliente</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Registra los datos de tu cliente</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="border p-8 mb-4" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
          <h2 className="font-bold text-sm uppercase tracking-wide mb-5" style={{ color: '#666' }}>Datos de la empresa</h2>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Razón social *</label>
              <input type="text" value={form.razon_social} onChange={e => set('razon_social', e.target.value)}
                className={inputClass} style={inputStyle} placeholder="Empresa S.A. de C.V." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">RFC</label>
                <input type="text" value={form.rfc} onChange={e => set('rfc', e.target.value)}
                  className={inputClass} style={inputStyle} placeholder="EMP123456789" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select value={form.ubicacion_estado} onChange={e => set('ubicacion_estado', e.target.value)}
                  className={inputClass} style={inputStyle}>
                  <option value="">Selecciona un estado</option>
                  {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Industria / Giro</label>
              <select value={form.industria} onChange={e => set('industria', e.target.value)}
                className={inputClass} style={inputStyle}>
                <option value="">Selecciona una industria</option>
                {INDUSTRIAS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="border p-8 mb-4" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
          <h2 className="font-bold text-sm uppercase tracking-wide mb-5" style={{ color: '#666' }}>Contacto principal</h2>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input type="text" value={form.contacto_nombre} onChange={e => set('contacto_nombre', e.target.value)}
                  className={inputClass} style={inputStyle} placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cargo</label>
                <input type="text" value={form.contacto_cargo} onChange={e => set('contacto_cargo', e.target.value)}
                  className={inputClass} style={inputStyle} placeholder="Director de Operaciones" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={form.contacto_email} onChange={e => set('contacto_email', e.target.value)}
                  className={inputClass} style={inputStyle} placeholder="juan@empresa.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input type="tel" value={form.contacto_telefono} onChange={e => set('contacto_telefono', e.target.value)}
                  className={inputClass} style={inputStyle} placeholder="+52 55 0000 0000" />
              </div>
            </div>
          </div>
        </div>

        <div className="border p-8 mb-6" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
          <h2 className="font-bold text-sm uppercase tracking-wide mb-5" style={{ color: '#666' }}>Notas internas</h2>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
            rows={3} className={inputClass} style={inputStyle}
            placeholder="Información adicional sobre este cliente…" />
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="flex justify-between">
          <Link href="/epc/clientes"
            className="px-5 py-2 text-sm font-medium border"
            style={{ borderColor: '#CFCFCF' }}>
            Cancelar
          </Link>
          <button type="submit" disabled={loading}
            className="px-5 py-2 text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
            {loading ? 'Guardando…' : 'Guardar cliente'}
          </button>
        </div>
      </form>
    </div>
  )
}
