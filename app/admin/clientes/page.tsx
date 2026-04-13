'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente } from '@/lib/types'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface ClienteConEpcista extends Cliente {
  epcista_nombre: string
}

export default function AdminClientesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<ClienteConEpcista[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function load() {
      const { data: cls } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false })

      if (!cls || cls.length === 0) { setLoading(false); return }

      const ids = [...new Set(cls.map((c: { epcista_id: string }) => c.epcista_id))]
      const { data: perfiles } = await supabase.from('profiles').select('id, nombre').in('id', ids)
      const nameMap: Record<string, string> = {}
      for (const pf of perfiles ?? []) {
        const p = pf as { id: string; nombre: string }
        nameMap[p.id] = p.nombre
      }

      setClientes(cls.map((c: Cliente) => ({
        ...c,
        epcista_nombre: nameMap[c.epcista_id] ?? '—',
      })))
      setLoading(false)
    }
    load()
  }, [])

  const lista = clientes.filter(c => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      c.razon_social?.toLowerCase().includes(q) ||
      c.epcista_nombre?.toLowerCase().includes(q) ||
      c.contacto_nombre?.toLowerCase().includes(q) ||
      c.rfc?.toLowerCase().includes(q)
    )
  })

  if (loading) return null

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Clientes</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Todos los clientes registrados en la plataforma</p>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por razón social, EPCista, RFC o contacto…"
          className="border px-3 py-1.5 text-sm flex-1"
          style={{ borderColor: '#CFCFCF' }}
        />
      </div>

      <div className="border overflow-hidden" style={{ borderColor: '#CFCFCF' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#000', color: '#fff' }}>
              <th className="text-left px-4 py-3 font-semibold">Razón social</th>
              <th className="text-left px-4 py-3 font-semibold">RFC</th>
              <th className="text-left px-4 py-3 font-semibold">Industria</th>
              <th className="text-left px-4 py-3 font-semibold">Contacto</th>
              <th className="text-left px-4 py-3 font-semibold">EPCista</th>
              <th className="text-left px-4 py-3 font-semibold">Estado</th>
              <th className="text-left px-4 py-3 font-semibold">Registro</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: '#888' }}>Sin clientes.</td></tr>
            )}
            {lista.map((c, i) => (
              <tr key={c.id} style={{ borderTop: '1px solid #CFCFCF', backgroundColor: i % 2 === 0 ? '#fff' : '#fafaf8' }}>
                <td className="px-4 py-3 font-medium">{c.razon_social}</td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: '#666' }}>{c.rfc || '—'}</td>
                <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{c.industria || '—'}</td>
                <td className="px-4 py-3 text-xs">
                  <div className="font-medium">{c.contacto_nombre}</div>
                  {c.contacto_email && <div style={{ color: '#888' }}>{c.contacto_email}</div>}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{c.epcista_nombre}</td>
                <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{c.ubicacion_estado || '—'}</td>
                <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: '#888' }}>{lista.length} cliente{lista.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
