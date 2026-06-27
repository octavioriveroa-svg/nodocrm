'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search } from 'lucide-react'

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
  finder: 'Finder Comercial',
  epcista: 'EPC',
  analista: 'Analista Nodo',
  admin: 'Admin Nodo',
}

const ROL_COLORS: Record<string, { bg: string; color: string }> = {
  epc: { bg: '#E8E8E8', color: 'var(--color-texto-suave)' },
  nodo_analista: { bg: 'var(--color-acento)', color: 'var(--color-principal)' },
  nodo_admin: { bg: 'var(--color-principal)', color: '#fff' },
  cliente_final: { bg: '#E0F2FE', color: '#0369A1' },
  financiero: { bg: '#DCFCE7', color: '#15803D' },
  suministrador: { bg: '#F3E8FF', color: '#7E22CE' },
  pendiente: { bg: '#FFF3CD', color: '#856404' },
  finder: { bg: '#FDE68A', color: '#92400E' },
}

const FILTER_ROLES = ['todos', 'epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador', 'pendiente']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function UsuariosReadOnlyPage() {
  const supabase = createClient()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroRol, setFiltroRol] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  async function loadUsers() {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_users_admin')
    if (!rpcErr && rpcData) {
      setUsuarios(rpcData as Usuario[])
    } else {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
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

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = usuarios.filter(u =>
    (filtroRol === 'todos' || u.rol === filtroRol || (filtroRol === 'epc' && u.rol === 'epcista') || (filtroRol === 'nodo_analista' && u.rol === 'analista'))
    && (!busqueda || [u.nombre, u.empresa, u.email].some(v => v?.toLowerCase().includes(busqueda.toLowerCase())))
  )

  // Stats
  const totalActivos = usuarios.filter(u => u.rol !== 'pendiente').length
  const totalPendientes = usuarios.filter(u => u.rol === 'pendiente').length
  const rolCounts: Record<string, number> = {}
  for (const u of usuarios) {
    const key = u.rol === 'epcista' ? 'epc' : u.rol === 'analista' ? 'nodo_analista' : u.rol === 'admin' ? 'nodo_admin' : u.rol
    rolCounts[key] = (rolCounts[key] ?? 0) + 1
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-acento border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black">Usuarios</h1>
        <p className="text-sm mt-1 text-muted">Directorio de todos los usuarios de la plataforma</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="glass-card p-4">
          <div className="text-2xl font-black">{usuarios.length}</div>
          <div className="text-xs text-muted mt-0.5">Total registrados</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-black">{totalActivos}</div>
          <div className="text-xs text-muted mt-0.5">Activos</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-black" style={{ color: totalPendientes > 0 ? '#856404' : undefined }}>{totalPendientes}</div>
          <div className="text-xs text-muted mt-0.5">Pendientes</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-black">{rolCounts['epc'] ?? 0}</div>
          <div className="text-xs text-muted mt-0.5">EPCistas</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, empresa o correo…"
            className="w-full border border-borde pl-9 pr-3 py-2 text-sm rounded-xl focus:ring-2 focus:ring-black/10 outline-none transition-all bg-white/60"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 max-w-full">
          {FILTER_ROLES.map(r => (
            <button
              key={r}
              onClick={() => setFiltroRol(r)}
              className="px-3 py-2 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap"
              style={{
                borderColor: filtroRol === r ? 'var(--color-principal)' : 'var(--color-linea)',
                backgroundColor: filtroRol === r ? 'var(--color-principal)' : '#fff',
                color: filtroRol === r ? 'var(--color-acento)' : 'var(--color-texto-suave)',
              }}
            >
              {r === 'todos' ? 'Todos' : ROL_LABELS[r] ?? r}
              {r !== 'todos' && rolCounts[r] ? ` (${rolCounts[r]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border overflow-hidden rounded-xl shadow-sm bg-white border-borde">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-principal)', color: '#fff' }}>
                <th className="text-left px-5 py-4 font-semibold whitespace-nowrap">Nombre</th>
                <th className="text-left px-5 py-4 font-semibold whitespace-nowrap">Empresa</th>
                <th className="text-left px-5 py-4 font-semibold whitespace-nowrap">Correo</th>
                <th className="text-left px-5 py-4 font-semibold whitespace-nowrap">Rol</th>
                <th className="text-left px-5 py-4 font-semibold whitespace-nowrap">Registro</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                    Sin resultados.
                  </td>
                </tr>
              )}
              {filtrados.map((u, i) => {
                const rc = ROL_COLORS[u.rol] ?? ROL_COLORS.epc
                return (
                  <tr
                    key={u.id}
                    className={`border-t border-borde transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-fondo/30'} hover:bg-gray-50`}
                  >
                    <td className="px-5 py-4 font-medium">{u.nombre || '—'}</td>
                    <td className="px-5 py-4 text-gray-600">{u.empresa || '—'}</td>
                    <td className="px-5 py-4 text-xs text-gray-500">{u.email}</td>
                    <td className="px-5 py-4">
                      <span
                        className="text-xs px-2.5 py-1 font-semibold rounded-md whitespace-nowrap"
                        style={{ backgroundColor: rc.bg, color: rc.color }}
                      >
                        {ROL_LABELS[u.rol] ?? u.rol}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(u.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs mt-3 text-gray-400">
        {filtrados.length} de {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
