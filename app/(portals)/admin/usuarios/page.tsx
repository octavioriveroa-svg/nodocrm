'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, CheckCircle, Edit2, X } from 'lucide-react'

interface Usuario {
  id: string
  nombre: string
  empresa: string
  rol: string
  email: string
  created_at: string
}

const ROL_LABELS: Record<string, string> = {
  epc: 'EPC',
  nodo_analista: 'Analista Nodo',
  nodo_admin: 'Admin Nodo',
  cliente_final: 'Cliente Final',
  financiero: 'Financiero',
  suministrador: 'Suministrador',
  pendiente: 'Pendiente',
  // Legacy backups
  epcista: 'EPC',
  analista: 'Analista Nodo',
  admin: 'Admin Nodo',
}

const ROL_COLORS: Record<string, { bg: string; color: string }> = {
  epc: { bg: '#E8E8E8', color: '#444' },
  nodo_analista: { bg: '#D7FF2F', color: '#000' },
  nodo_admin: { bg: '#000', color: '#fff' },
  cliente_final: { bg: '#E0F2FE', color: '#0369A1' },
  financiero: { bg: '#DCFCE7', color: '#15803D' },
  suministrador: { bg: '#F3E8FF', color: '#7E22CE' },
  pendiente: { bg: '#FFF3CD', color: '#856404' },
}

const ROLES_ASIGNABLES = ['epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador']

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
  const [editingUser, setEditingUser] = useState<string | null>(null)

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
  }, [supabase])

  async function cambiarRol(userId: string, nuevoRol: string) {
    setUpdatingId(userId)
    const { error } = await supabase.rpc('admin_update_role', { target_id: userId, new_rol: nuevoRol })
    if (!error) {
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, rol: nuevoRol } : u))
      setEditingUser(null)
    } else {
      alert('Error al cambiar el rol: ' + error.message)
    }
    setUpdatingId(null)
  }

  const pendientes = usuarios.filter(u => u.rol === 'pendiente')
  const activos = usuarios.filter(u => u.rol !== 'pendiente' && (
    filtroRol === 'todos' || u.rol === filtroRol || (filtroRol === 'epc' && u.rol === 'epcista') || (filtroRol === 'nodo_analista' && u.rol === 'analista')
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
        <div className="border mb-8 rounded-xl overflow-hidden shadow-sm" style={{ borderColor: '#856404', backgroundColor: '#FFFBF0' }}>
          <div className="px-5 py-3 flex items-center gap-2 border-b" style={{ borderColor: '#F0D070' }}>
            <Clock size={15} style={{ color: '#856404' }} />
            <h2 className="font-bold text-sm" style={{ color: '#856404' }}>
              Solicitudes de acceso pendientes ({pendientes.length})
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: '#F0D070' }}>
            {pendientes.map(u => (
              <div key={u.id} className="px-5 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm">{u.nombre || '—'}</p>
                  <p className="text-xs mt-1" style={{ color: '#666' }}>{u.empresa || '—'} {u.email !== '—' ? `· ${u.email}` : ''}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#aaa' }}>{formatDate(u.created_at)}</p>
                </div>
                <div className="flex flex-col md:items-end gap-2 flex-shrink-0">
                  <span className="text-xs font-bold" style={{ color: '#888' }}>Asignar rol:</span>
                  <div className="flex flex-wrap gap-2">
                    {ROLES_ASIGNABLES.map(r => (
                      <button key={r}
                        onClick={() => cambiarRol(u.id, r)}
                        disabled={updatingId === u.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-md disabled:opacity-40 transition-colors ${updatingId === u.id ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                        style={{ 
                          borderColor: ROL_COLORS[r]?.color || '#000', 
                          backgroundColor: ROL_COLORS[r]?.bg || '#fff', 
                          color: ROL_COLORS[r]?.color || '#000' 
                        }}>
                        {updatingId === u.id ? '…' : <><CheckCircle size={11} /> {ROL_LABELS[r]}</>}
                      </button>
                    ))}
                  </div>
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
          className="border px-3 py-2 text-sm flex-1 min-w-[200px] rounded-lg focus:ring-2 focus:ring-black/10 outline-none transition-all"
          style={{ borderColor: '#CFCFCF' }}
        />
        <div className="flex gap-1 overflow-x-auto pb-1 max-w-full hide-scrollbar">
          {['todos', ...ROLES_ASIGNABLES].map(r => (
            <button key={r} onClick={() => setFiltroRol(r)}
              className="px-3 py-2 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap"
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
      <div className="border overflow-hidden rounded-xl shadow-sm bg-white" style={{ borderColor: '#CFCFCF' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#000', color: '#fff' }}>
                <th className="text-left px-5 py-4 font-semibold whitespace-nowrap">Nombre</th>
                <th className="text-left px-5 py-4 font-semibold whitespace-nowrap">Empresa</th>
                <th className="text-left px-5 py-4 font-semibold whitespace-nowrap">Correo</th>
                <th className="text-left px-5 py-4 font-semibold whitespace-nowrap">Rol</th>
                <th className="text-left px-5 py-4 font-semibold whitespace-nowrap">Registro</th>
                <th className="text-right px-5 py-4 font-semibold whitespace-nowrap">Acción</th>
              </tr>
            </thead>
            <tbody>
              {activos.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color: '#888' }}>Sin resultados.</td></tr>
              )}
              {activos.map((u) => {
                const rc = ROL_COLORS[u.rol] ?? ROL_COLORS.epc
                const isEditing = editingUser === u.id
                
                return (
                  <tr key={u.id} className="group border-t border-borde hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-medium">{u.nombre || '—'}</td>
                    <td className="px-5 py-4 text-gray-600">{u.empresa || '—'}</td>
                    <td className="px-5 py-4 text-xs text-gray-500">{u.email}</td>
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <select 
                          className="border border-borde rounded px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-black outline-none font-medium"
                          value={u.rol}
                          onChange={(e) => cambiarRol(u.id, e.target.value)}
                          disabled={updatingId === u.id}
                        >
                          {ROLES_ASIGNABLES.map(r => (
                            <option key={r} value={r}>{ROL_LABELS[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs px-2.5 py-1 font-semibold rounded-md whitespace-nowrap" style={{ backgroundColor: rc.bg, color: rc.color }}>
                          {ROL_LABELS[u.rol] ?? u.rol}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-4 text-right">
                      {isEditing ? (
                        <button 
                          onClick={() => setEditingUser(null)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors inline-flex"
                          title="Cancelar"
                        >
                          <X size={14} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => setEditingUser(u.id)}
                          className="p-1.5 text-gray-400 hover:text-principal bg-transparent group-hover:bg-gray-100 rounded md:opacity-0 group-hover:opacity-100 transition-all inline-flex"
                          title="Editar rol"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs mt-3 text-gray-500">{activos.length} usuario{activos.length !== 1 ? 's' : ''} activos</p>
    </div>
  )
}
