'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Building2, User, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente, Profile } from '@/lib/types'
import { createCliente, type ClienteInput } from '@/lib/domains/clientes/mutations'

export const ESTADOS_MX = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
]

export const INDUSTRIAS = [
  'Manufactura',
  'Minería',
  'Retail / Comercio',
  'Hotelería / Turismo',
  'Agroindustria',
  'Logística / Transporte',
  'Inmobiliario',
  'Salud',
  'Educación',
  'Gobierno',
  'Energía',
  'Tecnología',
  'Otra',
]

export interface SharedNewClientViewProps {
  portalPrefix: 'admin' | 'analista' | 'epc' | 'finder'
  prefill?: Partial<ClienteInput>
  onSuccessRedirect?: (cliente: Cliente) => string
}

export default function SharedNewClientView({
  portalPrefix,
  prefill,
  onSuccessRedirect,
}: SharedNewClientViewProps) {
  const router = useRouter()
  const supabase = createClient()

  const [viewerProfile, setViewerProfile] = useState<Profile | null>(null)
  const [epcistas, setEpcistas] = useState<{ id: string; nombre: string; empresa: string }[]>([])
  const [loadingProfile, setLoadingProfile] = useState(true)

  const [form, setForm] = useState({
    razon_social: prefill?.razon_social || '',
    rfc: prefill?.rfc || '',
    industria: prefill?.industria || '',
    ubicacion_estado: prefill?.ubicacion_estado || '',
    contacto_nombre: prefill?.contacto_nombre || '',
    contacto_cargo: prefill?.contacto_cargo || '',
    contacto_email: prefill?.contacto_email || '',
    contacto_telefono: prefill?.contacto_telefono || '',
    notas: prefill?.notas || '',
    epcista_id: prefill?.epcista_id || '',
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isNodo = portalPrefix === 'admin' || portalPrefix === 'analista'

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setLoadingProfile(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setViewerProfile(profile as Profile)
      }

      // If Admin or Analista, fetch list of EPCs for optional assignment
      if (isNodo) {
        const { data: epcList } = await supabase
          .from('profiles')
          .select('id, nombre, empresa')
          .eq('rol', 'epc')
          .order('nombre', { ascending: true })

        if (epcList) {
          setEpcistas(epcList)
        }
      }

      setLoadingProfile(false)
    }

    void init()
  }, [supabase, isNodo])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.razon_social.trim()) {
      setError('La razón social es obligatoria.')
      return
    }
    if (!form.contacto_nombre.trim()) {
      setError('El nombre del contacto es obligatorio.')
      return
    }

    if (!viewerProfile) {
      setError('Sesión expirada o perfil no encontrado.')
      return
    }

    setLoading(true)

    const payload: ClienteInput = {
      razon_social: form.razon_social,
      rfc: form.rfc || null,
      industria: form.industria || null,
      ubicacion_estado: form.ubicacion_estado || null,
      contacto_nombre: form.contacto_nombre,
      contacto_cargo: form.contacto_cargo || null,
      contacto_email: form.contacto_email || null,
      contacto_telefono: form.contacto_telefono || null,
      notas: form.notas || null,
      epcista_id: form.epcista_id || null,
    }

    const res = await createCliente(supabase, payload, viewerProfile)

    if (!res.success || !res.data) {
      setError('Error al guardar: ' + (res.error || 'Desconocido'))
      setLoading(false)
      return
    }

    const redirectPath = onSuccessRedirect
      ? onSuccessRedirect(res.data)
      : `/${portalPrefix}/clientes/${res.data.id}`

    router.push(redirectPath)
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all shadow-sm'

  if (loadingProfile) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-sm text-gray-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
          <span>Cargando formulario…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/${portalPrefix}/clientes`}
        className="inline-flex items-center gap-1.5 text-sm mb-6 text-gray-500 hover:text-principal transition-colors font-medium"
      >
        <ChevronLeft size={16} />
        Volver a clientes
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">Nuevo cliente</h1>
        <p className="text-sm mt-1 text-gray-500">
          {isNodo
            ? 'Registra un nuevo cliente en la plataforma y asígnalo a un EPCista'
            : 'Registra los datos de tu cliente'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Empresa */}
        <div className="border border-gray-200 rounded-xl p-6 mb-5 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-acento" />
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-500">Datos de la empresa</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-800">Razón social *</label>
              <input
                type="text"
                value={form.razon_social}
                onChange={(e) => set('razon_social', e.target.value)}
                className={inputClass}
                placeholder="Empresa S.A. de C.V."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-800">RFC</label>
                <input
                  type="text"
                  value={form.rfc}
                  onChange={(e) => set('rfc', e.target.value.toUpperCase())}
                  className={inputClass}
                  placeholder="EMP123456789"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-800">Estado</label>
                <select
                  value={form.ubicacion_estado}
                  onChange={(e) => set('ubicacion_estado', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecciona un estado</option>
                  {ESTADOS_MX.map((est) => (
                    <option key={est} value={est}>
                      {est}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-800">Industria / Giro</label>
                <select
                  value={form.industria}
                  onChange={(e) => set('industria', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecciona una industria</option>
                  {INDUSTRIAS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>

              {isNodo && (
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-800">EPCista responsable</label>
                  <select
                    value={form.epcista_id}
                    onChange={(e) => set('epcista_id', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Asignar a mí / Sin EPCista</option>
                    {epcistas.map((epc) => (
                      <option key={epc.id} value={epc.id}>
                        {epc.nombre} {epc.empresa ? `(${epc.empresa})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contacto Principal */}
        <div className="border border-gray-200 rounded-xl p-6 mb-5 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <User size={16} className="text-acento" />
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-500">Contacto principal</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-800">Nombre *</label>
                <input
                  type="text"
                  value={form.contacto_nombre}
                  onChange={(e) => set('contacto_nombre', e.target.value)}
                  className={inputClass}
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-800">Cargo</label>
                <input
                  type="text"
                  value={form.contacto_cargo}
                  onChange={(e) => set('contacto_cargo', e.target.value)}
                  className={inputClass}
                  placeholder="Director de Operaciones"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-800">Email</label>
                <input
                  type="email"
                  value={form.contacto_email}
                  onChange={(e) => set('contacto_email', e.target.value)}
                  className={inputClass}
                  placeholder="juan@empresa.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-800">Teléfono</label>
                <input
                  type="tel"
                  value={form.contacto_telefono}
                  onChange={(e) => set('contacto_telefono', e.target.value)}
                  className={inputClass}
                  placeholder="+52 55 0000 0000"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="border border-gray-200 rounded-xl p-6 mb-6 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-acento" />
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-500">Notas internas</h2>
          </div>
          <textarea
            value={form.notas}
            onChange={(e) => set('notas', e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Información adicional sobre este cliente…"
          />
        </div>

        {error && (
          <div className="p-4 mb-5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/${portalPrefix}/clientes`}
            className="px-5 py-2.5 text-sm font-semibold border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold disabled:opacity-50 bg-principal text-acento rounded-lg shadow-sm hover:opacity-95 active:scale-[0.98] transition-all"
          >
            {loading ? 'Guardando…' : 'Guardar cliente'}
          </button>
        </div>
      </form>
    </div>
  )
}
