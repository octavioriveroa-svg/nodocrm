'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Mail, Phone, User } from 'lucide-react'
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          href="/epc/clientes/nuevo"
          className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm bg-acento text-principal rounded-lg shadow-sm hover:shadow-md hover:bg-acento-hover transition-all active:scale-[0.97]"
        >
          <Plus size={16} />
          Nuevo cliente
        </Link>
      </div>

      {clientes.length === 0 ? (
        <div
          className="rounded-xl glass-panel border-dashed border-white/50 p-16 flex flex-col items-center text-center"
        >
          <p className="font-semibold text-lg">Aún no tienes clientes</p>
          <p className="text-sm mt-2 mb-6 text-gray-400">
            Registra tu primer cliente para asociarlo a proyectos
          </p>
          <Link
            href="/epc/clientes/nuevo"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtrados.map(c => (
                <Link
                  key={c.id}
                  href={`/epc/clientes/${c.id}`}
                  className="rounded-xl border border-borde p-5 flex flex-col justify-between hover:shadow-lg hover:border-borde border-transparent shadow-sm transition-all bg-white group h-full"
                  style={{ border: '1px solid #E5E5E5' }}
                >
                  <div>
                    <div className="flex flex-col gap-3 mb-4">
                      {/* Top Action / Header */}
                      <div className="flex items-start justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-principal font-bold text-sm shrink-0 shadow-sm" style={{ backgroundColor: '#D7FF2F' }}>
                            {c.razon_social.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-principal line-clamp-1 break-all" title={c.razon_social}>
                              {c.razon_social}
                            </h3>
                            {c.industria && (
                              <p className="text-xs text-gray-500 mt-0.5">{c.industria}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2.5 mb-5 mt-4">
                      {c.contacto_email && (
                        <span className="flex items-center gap-2.5 text-xs text-gray-600 truncate">
                          <Mail size={14} className="text-gray-400 shrink-0" />
                          <span className="truncate">{c.contacto_email}</span>
                        </span>
                      )}
                      {c.contacto_telefono && (
                        <span className="flex items-center gap-2.5 text-xs text-gray-600 truncate">
                          <Phone size={14} className="text-gray-400 shrink-0" />
                          <span className="truncate">{c.contacto_telefono}</span>
                        </span>
                      )}
                      {c.contacto_nombre && (
                        <span className="flex items-center gap-2.5 text-xs text-gray-600 truncate">
                          <User size={14} className="text-gray-400 shrink-0" />
                          <span className="truncate">
                            {c.contacto_nombre}
                            {c.contacto_cargo && <span className="text-gray-400"> · {c.contacto_cargo}</span>}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-borde flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                      Creado: {formatDate(c.created_at)}
                    </span>
                    <span className="text-xs font-semibold text-principal decoration-2 underline-offset-4 group-hover:underline transition-all">
                      Ver detalles
                    </span>
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
