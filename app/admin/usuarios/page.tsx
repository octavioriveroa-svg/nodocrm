'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Usuario {
  id: string
  nombre: string
  empresa: string
  rol: string
  email: string
  created_at: string
}

const ROL_LABELS: Record<string, string> = {
  epcista: 'EPCista',
  analista: 'Analista',
  admin: 'Admin',
}
const ROL_COLORS: Record<string, { bg: string; color: string }> = {
  epcista: { bg: '#E8E8E8', color: '#444' },
  analista: { bg: '#D7FF2F', color: '#000' },
  admin: { bg: '#000', color: '#fff' },
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminUsuariosPage() {
  const supabase = createClient()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filtroRol, setFiltroRol] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase.rpc('get_all_users_admin')
      if (err) { setError(err.message); setLoading(false); return }
      setUsuarios((data ?? []) as Usuario[])
      setLoading(false)
    }
    load()
  }, [])

  async function cambiarRol(userId: string, nuevoRol: string) {
    setUpdatingId(userId)
    const { error: err } = await supabase.rpc('admin_update_role', { target_id: userId, new_rol: nuevoRol })
    if (!err) {
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, rol: nuevoRol } : u))
    }
    setUpdatingId(null)
  }

  const lista = usuarios.filter(u => {
    if (filtroRol !== 'todos' && u.rol !== filtroRol) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!u.nombre?.toLowerCase().includes(q) && !u.empresa?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false
    }
    return true
  })

  if (loading) return null

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Usuarios</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Gestiona accesos y roles de todos los usuarios</p>
      </div>

      {error && (
        <div className="border p-4 mb-6 text-sm" style={{ borderColor: '#fcc', backgroundColor: '#fff5f5', color: '#c00' }}>
          Error al cargar usuarios: {error}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, empresa o correo…"
          className="border px-3 py-1.5 text-sm flex-1 min-w-48"
          style={{ borderColor: '#CFCFCF' }}
        />
        <div className="flex gap-1">
          {['todos', 'epcista', 'analista', 'admin'].map(r => (
            <button key={r} onClick={() => setFiltroRol(r)}
              className="px-3 py-1.5 text-xs font-medium border transition-colors"
              style={{
                borderColor: filtroRol === r ? '#000' : '#CFCFCF',
                backgroundColor: filtroRol === r ? '#000' : '#fff',
                color: filtroRol === r ? '#D7FF2F' : '#444',
              }}>
              {r === 'todos' ? 'Todos' : ROL_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="border overflow-hidden" style={{ borderColor: '#CFCFCF' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#000', color: '#fff' }}>
              <th className="text-left px-4 py-3 font-semibold">Nombre</th>
              <th className="text-left px-4 py-3 font-semibold">Empresa</th>
              <th className="text-left px-4 py-3 font-semibold">Correo</th>
              <th className="text-left px-4 py-3 font-semibold">Rol</th>
              <th className="text-left px-4 py-3 font-semibold">Registro</th>
              <th className="text-left px-4 py-3 font-semibold">Cambiar rol</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: '#888' }}>Sin resultados.</td></tr>
            )}
            {lista.map((u, i) => {
              const rc = ROL_COLORS[u.rol] ?? ROL_COLORS.epcista
              return (
                <tr key={u.id} style={{ borderTop: '1px solid #CFCFCF', backgroundColor: i % 2 === 0 ? '#fff' : '#fafaf8' }}>
                  <td className="px-4 py-3 font-medium">{u.nombre || '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#666' }}>{u.empresa || '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 font-semibold" style={{ backgroundColor: rc.bg, color: rc.color }}>
                      {ROL_LABELS[u.rol] ?? u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {['epcista', 'analista', 'admin'].filter(r => r !== u.rol).map(r => (
                        <button key={r}
                          onClick={() => cambiarRol(u.id, r)}
                          disabled={updatingId === u.id}
                          className="px-2 py-1 text-xs border font-medium disabled:opacity-40 transition-colors hover:border-black"
                          style={{ borderColor: '#CFCFCF' }}>
                          {updatingId === u.id ? '…' : `→ ${ROL_LABELS[r]}`}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: '#888' }}>{lista.length} usuario{lista.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
