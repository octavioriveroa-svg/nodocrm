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

export default function RolesPage() {
  const supabase = createClient()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_users_admin')
      if (!rpcErr && rpcData) {
        setUsuarios(rpcData as Usuario[])
      } else {
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
      setSaved(userId)
      setTimeout(() => setSaved(null), 2000)
    }
    setUpdatingId(null)
  }

  const filtrados = usuarios.filter(u =>
    !busqueda || [u.nombre, u.empresa, u.email].some(v => v?.toLowerCase().includes(busqueda.toLowerCase()))
  )

  if (loading) return null

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Gestión de roles</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Asigna y modifica el nivel de acceso de cada cuenta</p>
      </div>

      <div className="mb-4">
        <input
          type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, empresa o correo…"
          className="border px-3 py-1.5 text-sm w-full max-w-sm"
          style={{ borderColor: '#CFCFCF' }}
        />
      </div>

      <div className="border overflow-hidden" style={{ borderColor: '#CFCFCF' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#000', color: '#fff' }}>
              <th className="text-left px-4 py-3 font-semibold">Nombre</th>
              <th className="text-left px-4 py-3 font-semibold">Empresa</th>
              <th className="text-left px-4 py-3 font-semibold">Correo</th>
              <th className="text-left px-4 py-3 font-semibold">Rol actual</th>
              <th className="text-left px-4 py-3 font-semibold">Registro</th>
              <th className="text-left px-4 py-3 font-semibold">Cambiar a</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: '#888' }}>Sin resultados.</td></tr>
            )}
            {filtrados.map((u, i) => {
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
                    <div className="flex items-center gap-2">
                      <select
                        value={u.rol}
                        disabled={updatingId === u.id}
                        onChange={e => cambiarRol(u.id, e.target.value)}
                        className="border text-xs px-2 py-1.5 disabled:opacity-40"
                        style={{ borderColor: '#CFCFCF' }}
                      >
                        {Object.entries(ROL_LABELS).map(([r, lbl]) => (
                          <option key={r} value={r}>{lbl}</option>
                        ))}
                      </select>
                      {updatingId === u.id && <span className="text-xs" style={{ color: '#888' }}>Guardando…</span>}
                      {saved === u.id && <span className="text-xs font-medium" style={{ color: '#065f46' }}>✓ Guardado</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: '#888' }}>{filtrados.length} cuenta{filtrados.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
