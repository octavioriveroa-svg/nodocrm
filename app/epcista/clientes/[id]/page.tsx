'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil, Trash2, Building2, Mail, Phone, MapPin, FileText } from 'lucide-react'
import type { Cliente } from '@/lib/types'

function Campo({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ElementType }) {
  if (!value) return null
  return (
    <div>
      <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>{label}</div>
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {Icon && <Icon size={13} style={{ color: '#888' }} />}
        {value}
      </div>
    </div>
  )
}

export default function DetalleClientePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient()
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<Partial<Cliente>>({})
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const ESTADOS_MX = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
    'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
    'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
    'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
    'Veracruz','Yucatán','Zacatecas',
  ]

  const INDUSTRIAS = [
    'Manufactura','Minería','Retail / Comercio','Hotelería / Turismo','Agroindustria',
    'Logística / Transporte','Inmobiliario','Salud','Educación','Gobierno','Energía','Tecnología','Otra',
  ]

  useEffect(() => {
    async function load() {
      const { id } = await params
      const { data } = await supabase.from('clientes').select('*').eq('id', id).single()
      if (data) { setCliente(data as Cliente); setForm(data as Cliente) }
    }
    load()
  }, [])

  async function handleGuardar() {
    if (!cliente) return
    setLoading(true)
    const { data } = await supabase
      .from('clientes')
      .update({
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
      .eq('id', cliente.id)
      .select()
      .single()
    if (data) { setCliente(data as Cliente); setForm(data as Cliente) }
    setEditando(false)
    setLoading(false)
  }

  async function handleEliminar() {
    if (!cliente) return
    await supabase.from('clientes').delete().eq('id', cliente.id)
    router.push('/epcista/clientes')
  }

  if (!cliente) return null

  const inputClass = "w-full border px-3 py-2 text-sm bg-white"
  const inputStyle = { borderColor: '#CFCFCF' }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/epcista/clientes" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: '#666' }}>
        <ChevronLeft size={14} />
        Volver a clientes
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">{cliente.razon_social}</h1>
          {cliente.industria && (
            <span className="text-sm mt-1 inline-block" style={{ color: '#666' }}>{cliente.industria}</span>
          )}
        </div>
        <div className="flex gap-2">
          {!editando && (
            <>
              <button onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border font-medium"
                style={{ borderColor: '#CFCFCF' }}>
                <Pencil size={13} /> Editar
              </button>
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border font-medium"
                style={{ borderColor: '#CFCFCF', color: '#c00' }}>
                <Trash2 size={13} /> Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="border p-4 mb-4 flex items-center justify-between" style={{ borderColor: '#c00', backgroundColor: '#fff5f5' }}>
          <p className="text-sm font-medium">¿Eliminar este cliente? Esta acción no se puede deshacer.</p>
          <div className="flex gap-2 ml-4">
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-sm border" style={{ borderColor: '#CFCFCF' }}>Cancelar</button>
            <button onClick={handleEliminar} className="px-3 py-1.5 text-sm font-bold text-white" style={{ backgroundColor: '#c00' }}>Eliminar</button>
          </div>
        </div>
      )}

      {editando ? (
        <div className="border p-8" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Razón social *</label>
              <input type="text" value={form.razon_social ?? ''} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
                className={inputClass} style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">RFC</label>
                <input type="text" value={form.rfc ?? ''} onChange={e => setForm(f => ({ ...f, rfc: e.target.value }))}
                  className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select value={form.ubicacion_estado ?? ''} onChange={e => setForm(f => ({ ...f, ubicacion_estado: e.target.value }))}
                  className={inputClass} style={inputStyle}>
                  <option value="">Selecciona</option>
                  {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Industria</label>
              <select value={form.industria ?? ''} onChange={e => setForm(f => ({ ...f, industria: e.target.value }))}
                className={inputClass} style={inputStyle}>
                <option value="">Selecciona</option>
                {INDUSTRIAS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Contacto *</label>
                <input type="text" value={form.contacto_nombre ?? ''} onChange={e => setForm(f => ({ ...f, contacto_nombre: e.target.value }))}
                  className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cargo</label>
                <input type="text" value={form.contacto_cargo ?? ''} onChange={e => setForm(f => ({ ...f, contacto_cargo: e.target.value }))}
                  className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={form.contacto_email ?? ''} onChange={e => setForm(f => ({ ...f, contacto_email: e.target.value }))}
                  className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input type="tel" value={form.contacto_telefono ?? ''} onChange={e => setForm(f => ({ ...f, contacto_telefono: e.target.value }))}
                  className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notas</label>
              <textarea rows={3} value={form.notas ?? ''} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                className={inputClass} style={inputStyle} />
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button onClick={() => { setEditando(false); setForm(cliente) }}
              className="px-5 py-2 text-sm border" style={{ borderColor: '#CFCFCF' }}>
              Cancelar
            </button>
            <button onClick={handleGuardar} disabled={loading}
              className="px-5 py-2 text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="border p-6 mb-4" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
            <h3 className="font-bold text-xs uppercase tracking-wide mb-4" style={{ color: '#666' }}>Empresa</h3>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Razón social" value={cliente.razon_social} icon={Building2} />
              <Campo label="RFC" value={cliente.rfc} />
              <Campo label="Industria" value={cliente.industria} />
              <Campo label="Estado" value={cliente.ubicacion_estado} icon={MapPin} />
            </div>
          </div>

          <div className="border p-6 mb-4" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
            <h3 className="font-bold text-xs uppercase tracking-wide mb-4" style={{ color: '#666' }}>Contacto principal</h3>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Nombre" value={cliente.contacto_nombre} />
              <Campo label="Cargo" value={cliente.contacto_cargo} />
              <Campo label="Email" value={cliente.contacto_email} icon={Mail} />
              <Campo label="Teléfono" value={cliente.contacto_telefono} icon={Phone} />
            </div>
          </div>

          {cliente.notas && (
            <div className="border p-6" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
              <h3 className="font-bold text-xs uppercase tracking-wide mb-3" style={{ color: '#666' }}>Notas internas</h3>
              <p className="text-sm whitespace-pre-wrap flex gap-2">
                <FileText size={14} style={{ color: '#888', flexShrink: 0, marginTop: 2 }} />
                {cliente.notas}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
