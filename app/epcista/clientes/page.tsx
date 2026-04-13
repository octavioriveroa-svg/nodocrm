'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Building2, Mail, Phone } from 'lucide-react'
import type { Cliente } from '@/lib/types'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ClientesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('epcista_id', session.user.id)
        .order('created_at', { ascending: false })
      setClientes((data ?? []) as Cliente[])
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = clientes.filter(c =>
    c.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.contacto_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.industria ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  if (loading) return null

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-gray-400 mb-1">Directorio</p>
          <h1 className="text-2xl font-black tracking-tight">Clientes</h1>
          <p className="text-sm mt-1.5 text-gray-500">
            {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} registrado{clientes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/epcista/clientes/nuevo"
          className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm bg-acento text-principal rounded-lg shadow-sm hover:shadow-md hover:bg-acento-hover transition-all active:scale-[0.97]"
        >
          <Plus size={16} />
          Nuevo cliente
        </Link>
      </div>

      {clientes.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed border-borde p-16 flex flex-col items-center text-center"
        >
          <p className="font-semibold text-lg">Aún no tienes clientes</p>
          <p className="text-sm mt-2 mb-6 text-gray-400">
            Registra tu primer cliente para asociarlo a proyectos
          </p>
          <Link
            href="/epcista/clientes/nuevo"
            className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm bg-acento text-principal rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
          >
            <Plus size={16} />
            Nuevo cliente
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por empresa, contacto o industria…"
              className="w-full rounded-lg border border-borde px-4 py-3 text-sm bg-white focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all shadow-sm"
            />
          </div>

          {filtrados.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: '#888' }}>
              Sin resultados para &quot;{busqueda}&quot;
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filtrados.map(c => (
                <Link
                  key={c.id}
                  href={`/epcista/clientes/${c.id}`}
                  className="rounded-xl border border-borde p-6 flex items-start justify-between hover:shadow-md hover:border-gray-300 transition-all bg-white group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg">{c.razon_social}</h3>
                      {c.industria && (
                        <span
                          className="text-xs px-2.5 py-1 rounded-full border border-borde text-gray-500 font-medium"
                        >
                          {c.industria}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-5 mt-3">
                      <span className="flex items-center gap-1.5 text-sm" style={{ color: '#666' }}>
                        <Building2 size={13} />
                        {c.contacto_nombre}
                        {c.contacto_cargo && ` · ${c.contacto_cargo}`}
                      </span>
                      {c.contacto_email && (
                        <span className="flex items-center gap-1.5 text-sm" style={{ color: '#666' }}>
                          <Mail size={13} />
                          {c.contacto_email}
                        </span>
                      )}
                      {c.contacto_telefono && (
                        <span className="flex items-center gap-1.5 text-sm" style={{ color: '#666' }}>
                          <Phone size={13} />
                          {c.contacto_telefono}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs ml-4 flex-shrink-0" style={{ color: '#aaa' }}>
                    {formatDate(c.created_at)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
