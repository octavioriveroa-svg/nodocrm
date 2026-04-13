'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, CheckCircle } from 'lucide-react'

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
  pendiente: 'Pendiente',
}
const ROL_COLORS: Record<string, { bg: string; color: string }> = {
  epcista: { bg: '#E8E8E8', color: '#444' },
  analista: { bg: '#D7FF2F', color: '#000' },
  admin: { bg: '#000', color: '#fff' },
  pendiente: { bg: '#FFF3CD', color: '#856404' },
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminUsuariosPage() {
  const supabase = createClient()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filtroRol, setFiltroRol] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function load() {
      // Intentar RPC primero (incluye emails); si falla, usar profiles directo
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_users_admin')
      if (!rpcErr && rpcData) {
        setUsuarios(rpcData as Usuario[])
      } else {
        // Fallback: solo profiles (sin email)
        const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        setUsuarios(
          (profilesData ?? []).map((p: Record<string, unknown>) => ({
            id: p.id as string,
            nombre: (p.nombre as string) ?? '',
            empresa: (p.empresa as string) ?? '',
            rol: (p.rol as string) ?? '',
            email: '—',
            created_at: (p.created_at as string) ?? '',
          }))
        )
      }
      setLoading(false)
    }
    load()
  }, [])

  async function cambiarRol(userId: string, nuevoRol: string) {
    setUpdatingId(userId)
    const { error } = await supabase.rpc('admin_update_role', { target_id: userId, new_rol: nuevoRol })
    if (!error) {
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, rol: nuevoRol } : u))
    }
    setUpdatingId(null)
  }

  const pendientes = usuarios.filter(u => u.rol === 'pendiente')
  const activos = usuarios.filter(u => u.rol !== 'pendiente' && (
    filtroRol === 'todos' || u.rol === filtroRol
  ) && (
    !busqueda || [u.nombre, u.empresa, u.email].some(v => v?.toLowerCase().includes(busqueda.toLowerCase()))
  ))

  if (loading) return null

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Usuarios</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Gestiona accesos y roles de todos los usuarios</p>
      </div>

      {/* Solicitudes pendientes */}
      {pendientes.length > 0 && (
        <div className="border mb-8" style={{ borderColor: '#856404', backgroundColor: '#FFFBF0' }}>
          <div className="px-5 py-3 flex items-center gap-2 border-b" style={{ borderColor: '#F0D070' }}>
            <Clock size={15} style={{ color: '#856404' }} />
            <h2 className="font-bold text-sm" style={{ color: '#856404' }}>
              Solicitudes de acceso pendientes ({pendientes.length})
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: '#F0D070' }}>
            {pendientes.map(u => (
              <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm">{u.nombre || '—'}</p>
                  <p className="text-xs" style={{ color: '#666' }}>{u.empresa || '—'} {u.email !== '—' ? `· ${u.email}` : ''}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#aaa' }}>{formatDate(u.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs" style={{ color: '#888' }}>Asignar rol:</span>
                  {['epcista', 'analista'].map(r => (
                    <button key={r}
                      onClick={() => cambiarRol(u.id, r)}
                      disabled={updatingId === u.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border disabled:opacity-40 transition-colors"
                      style={{ borderColor: '#000', backgroundColor: '#000', color: '#D7FF2F' }}>
                      {updatingId === u.id ? '…' : <><CheckCircle size={11} /> {ROL_LABELS[r]}</>}
                    </button>
                  ))}
                  <button
                    onClick={() => cambiarRol(u.id, 'admin')}
                    disabled={updatingId === u.id}
                    className="px-3 py-1.5 text-xs font-medium border disabled:opacity-40"
                    style={{ borderColor: '#CFCFCF' }}>
                    Admin
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input
          type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
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

      {/* Tabla usuarios activos */}
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
            {activos.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: '#888' }}>Sin resultados.</td></tr>
            )}
            {activos.map((u, i) => {
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
      <p className="text-xs mt-2" style={{ color: '#888' }}>{activos.length} usuario{activos.length !== 1 ? 's' : ''} activos</p>
    </div>
  )
}
