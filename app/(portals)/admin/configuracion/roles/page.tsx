'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Edit2, X, Trash2, Save, Mail, KeyRound, Eye, EyeOff, UserPlus } from 'lucide-react'
import { adminUpdateEmail } from '@/app/actions/adminUpdateEmail'
import { adminResetPassword } from '@/app/actions/adminResetPassword'
import { adminDeleteUser } from '@/app/actions/adminDeleteUser'
import NuevoUsuarioModal from '@/components/NuevoUsuarioModal'

interface Usuario {
  id: string
  nombre: string
  empresa: string
  rol: string
  email: string
  created_at: string
}

const ROL_LABELS: Record<string, string> = {
  epc: 'EPC', nodo_analista: 'Analista Nodo', nodo_admin: 'Admin Nodo',
  cliente_final: 'Cliente Final', financiero: 'Financiero', suministrador: 'Suministrador',
  pendiente: 'Pendiente', finder: 'Finder Comercial',
}

const ROL_COLORS: Record<string, { bg: string; color: string }> = {
  epc: { bg: '#E8E8E8', color: '#444' }, nodo_analista: { bg: '#D7FF2F', color: '#000' },
  nodo_admin: { bg: '#000', color: '#fff' }, cliente_final: { bg: '#E0F2FE', color: '#0369A1' },
  financiero: { bg: '#DCFCE7', color: '#15803D' }, suministrador: { bg: '#F3E8FF', color: '#7E22CE' },
  pendiente: { bg: '#FFF3CD', color: '#856404' }, finder: { bg: '#FDE68A', color: '#92400E' },
}

const ROLES_ASIGNABLES = ['epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador', 'finder']

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
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Edit state
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [savingUser, setSavingUser] = useState(false)

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadUsers() {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_users_admin')
    if (!rpcErr && rpcData) {
      setUsuarios(rpcData as Usuario[])
    } else {
      const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      setUsuarios(
        (profilesData ?? []).map((p: Record<string, unknown>) => ({
          id: p.id as string, nombre: (p.nombre as string) ?? '', empresa: (p.empresa as string) ?? '',
          rol: (p.rol as string) ?? '', email: '—', created_at: (p.created_at as string) ?? '',
        }))
      )
    }
    setLoading(false)
  }

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

  async function handleSaveEdit(u: Usuario) {
    setSavingUser(true)
    let hasError = false
    if (editEmail && editEmail !== u.email) {
      const r = await adminUpdateEmail(u.id, editEmail)
      if (r.error) { alert('Error al cambiar email: ' + r.error); hasError = true }
      else { setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, email: editEmail } : x)) }
    }
    if (editPassword && editPassword.length >= 6 && !hasError) {
      const r = await adminResetPassword(u.id, editPassword)
      if (r.error) { alert('Error al cambiar contraseña: ' + r.error); hasError = true }
    } else if (editPassword && editPassword.length > 0 && editPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.')
      hasError = true
    }
    setSavingUser(false)
    if (!hasError) { setEditingUser(null); setEditPassword(''); setShowEditPassword(false) }
  }

  async function handleDelete(userId: string) {
    setDeletingId(userId)
    const result = await adminDeleteUser(userId)
    if (result.error) {
      alert('Error al eliminar: ' + result.error)
    } else {
      setUsuarios(prev => prev.filter(u => u.id !== userId))
    }
    setDeletingId(null)
    setConfirmDeleteId(null)
  }

  // Pending approval state
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approveRol, setApproveRol] = useState<string>('epc')
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null)

  const pendientes = usuarios.filter(u => u.rol === 'pendiente')

  const filtrados = usuarios.filter(u =>
    !busqueda || [u.nombre, u.empresa, u.email].some(v => v?.toLowerCase().includes(busqueda.toLowerCase()))
  )

  if (loading) return null

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Gestión de roles</h1>
        <p className="text-sm mt-1 text-muted">Asigna y modifica el nivel de acceso de cada cuenta</p>
      </div>

      {/* ── Solicitudes pendientes ── */}
      {pendientes.length > 0 && (
        <div className="mb-8">
          <div className="rounded-2xl border-2 border-amber-300 overflow-hidden">
            <div className="px-5 py-3 flex items-center gap-2" style={{ backgroundColor: '#FFF3CD' }}>
              <span className="text-lg">⏳</span>
              <h2 className="font-bold text-sm" style={{ color: '#856404' }}>
                Solicitudes pendientes ({pendientes.length})
              </h2>
            </div>
            <div className="divide-y divide-amber-200 bg-amber-50/50">
              {pendientes.map(u => {
                const isApproving = approvingId === u.id
                const isConfirmingReject = confirmRejectId === u.id
                return (
                  <div key={u.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{u.nombre || '—'}</p>
                      <p className="text-xs text-muted truncate">{u.empresa || '—'} · {u.email}</p>
                      <p className="text-[11px] text-muted mt-0.5">Registrado: {formatDate(u.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isApproving ? (
                        <>
                          <select value={approveRol} onChange={e => setApproveRol(e.target.value)}
                            className="border border-borde text-xs px-2 py-1.5 rounded-lg bg-white">
                            {ROLES_ASIGNABLES.map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
                          </select>
                          <button onClick={() => { cambiarRol(u.id, approveRol); setApprovingId(null) }}
                            disabled={updatingId === u.id}
                            className="px-3 py-1.5 text-xs font-bold bg-acento text-principal rounded-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                            Confirmar
                          </button>
                          <button onClick={() => setApprovingId(null)}
                            className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                            Cancelar
                          </button>
                        </>
                      ) : isConfirmingReject ? (
                        <>
                          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
                          <button onClick={() => { handleDelete(u.id); setConfirmRejectId(null) }}
                            disabled={deletingId === u.id}
                            className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                            {deletingId === u.id ? '…' : 'Sí, eliminar'}
                          </button>
                          <button onClick={() => setConfirmRejectId(null)}
                            className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setApprovingId(u.id); setApproveRol('epc') }}
                            className="px-3 py-1.5 text-xs font-bold bg-acento text-principal rounded-lg hover:scale-105 active:scale-95 transition-all">
                            Aprobar
                          </button>
                          <button onClick={() => setConfirmRejectId(u.id)}
                            className="px-3 py-1.5 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                            Rechazar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, empresa o correo…"
          className="border border-borde px-3 py-1.5 text-sm w-full max-w-sm rounded-xl bg-white/60" />
        
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-principal text-acento text-sm font-bold rounded-xl hover:opacity-90 transition-all shadow-sm shrink-0">
          <UserPlus size={16} />
          Nuevo Usuario
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-principal text-white">
              <th className="text-left px-4 py-3 font-semibold">Nombre</th>
              <th className="text-left px-4 py-3 font-semibold">Empresa</th>
              <th className="text-left px-4 py-3 font-semibold">Correo</th>
              <th className="text-left px-4 py-3 font-semibold">Rol actual</th>
              <th className="text-left px-4 py-3 font-semibold">Registro</th>
              <th className="text-left px-4 py-3 font-semibold">Cambiar a</th>
              <th className="text-right px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">Sin resultados.</td></tr>
            )}
            {filtrados.map((u, i) => {
              const rc = ROL_COLORS[u.rol] ?? ROL_COLORS.epc
              const isEditing = editingUser === u.id
              const isConfirmingDelete = confirmDeleteId === u.id

              return (
                <React.Fragment key={u.id}>
                  <tr className={`group border-t border-borde ${i % 2 === 0 ? 'bg-white/40' : 'bg-fondo/50'} hover:bg-gray-50/80 transition-colors`}>
                    <td className="px-4 py-3 font-medium">{u.nombre || '—'}</td>
                    <td className="px-4 py-3 text-muted">{u.empresa || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 font-semibold rounded-full" style={{ backgroundColor: rc.bg, color: rc.color }}>
                        {ROL_LABELS[u.rol] ?? u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select value={u.rol} disabled={updatingId === u.id} onChange={e => cambiarRol(u.id, e.target.value)}
                          className="border border-borde text-xs px-2 py-1.5 rounded-lg bg-white/60 disabled:opacity-40">
                          {ROLES_ASIGNABLES.map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
                        </select>
                        {updatingId === u.id && <span className="text-xs text-muted">Guardando…</span>}
                        {saved === u.id && <span className="text-xs font-medium text-emerald-700">✓ Guardado</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isConfirmingDelete ? (
                          <>
                            <button onClick={() => handleDelete(u.id)} disabled={deletingId === u.id}
                              className="px-2.5 py-1 text-[11px] font-bold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors">
                              {deletingId === u.id ? '…' : 'Confirmar'}
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 transition-colors">
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingUser(isEditing ? null : u.id); setEditEmail(u.email); setEditPassword(''); setShowEditPassword(false) }}
                              className={`p-1.5 rounded transition-all inline-flex ${isEditing ? 'text-gray-700 bg-gray-200' : 'text-gray-400 hover:text-principal md:opacity-0 group-hover:opacity-100 hover:bg-gray-100'}`}
                              title={isEditing ? 'Cerrar edición' : 'Editar usuario'}>
                              {isEditing ? <X size={14} /> : <Edit2 size={14} />}
                            </button>
                            <button onClick={() => setConfirmDeleteId(u.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded md:opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all inline-flex"
                              title="Eliminar usuario">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expandable edit row */}
                  {isEditing && (
                    <tr>
                      <td colSpan={7} className="px-4 py-5 bg-gray-50/80 border-b border-borde">
                        <div className="max-w-2xl space-y-4">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Editando: {u.nombre}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold mb-1 text-gray-600"><Mail size={12} className="inline mr-1" />Correo</label>
                              <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                                className="w-full border border-borde rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-acento/30 focus:border-acento outline-none transition-all"
                                placeholder="nuevo@email.com" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold mb-1 text-gray-600"><KeyRound size={12} className="inline mr-1" />Nueva contraseña</label>
                              <div className="relative">
                                <input type={showEditPassword ? 'text' : 'password'} value={editPassword} onChange={e => setEditPassword(e.target.value)}
                                  className="w-full border border-borde rounded-lg px-3 py-2 pr-9 text-sm bg-white focus:ring-2 focus:ring-acento/30 focus:border-acento outline-none transition-all"
                                  placeholder="Dejar vacío para no cambiar" />
                                <button type="button" onClick={() => setShowEditPassword(!showEditPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                  {showEditPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 pt-2">
                            <button onClick={() => handleSaveEdit(u)} disabled={savingUser}
                              className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 bg-acento text-principal rounded-xl">
                              <Save size={14} /> {savingUser ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                            <button onClick={() => { setEditingUser(null); setEditPassword(''); setShowEditPassword(false) }}
                              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                              Cancelar
                            </button>
                            {editPassword && <p className="text-xs text-amber-600">⚠️ La contraseña se cambiará de inmediato al guardar.</p>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2 text-muted">{filtrados.length} cuenta{filtrados.length !== 1 ? 's' : ''}</p>

      {/* Delete confirmation overlay for mobile */}
      {confirmDeleteId && (
        <div className="md:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-lg mb-2">¿Eliminar usuario?</h3>
            <p className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer. El usuario perderá acceso a la plataforma.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 text-sm font-medium border border-borde rounded-xl">Cancelar</button>
              <button onClick={() => handleDelete(confirmDeleteId)} disabled={deletingId === confirmDeleteId}
                className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50">
                {deletingId === confirmDeleteId ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <NuevoUsuarioModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadUsers() // refresh list
          }}
        />
      )}
    </div>
  )
}
