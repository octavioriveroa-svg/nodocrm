'use client'

import { useState } from 'react'
import { Users, UserPlus, Mail, Key, Eye, EyeOff, X, Unlink } from 'lucide-react'
import { crearUsuarioAdmin } from '@/app/actions/crearUsuario'
import { invitarUsuario } from '@/app/actions/invitar'
import { vincularUsuarioCliente } from '@/app/actions/vincularUsuario'

const ROL_LABELS: Record<string, string> = {
  cliente_final: 'Cliente',
  financiero: 'Financiero',
  epc: 'EPC',
  nodo_analista: 'Analista Nodo',
  nodo_admin: 'Admin Nodo',
  suministrador: 'Suministrador',
}

const ROL_COLORS: Record<string, { bg: string; color: string }> = {
  cliente_final: { bg: '#E0F2FE', color: '#0369A1' },
  financiero: { bg: '#DCFCE7', color: '#15803D' },
  epc: { bg: '#E8E8E8', color: '#444' },
  nodo_analista: { bg: '#D7FF2F', color: '#000' },
  nodo_admin: { bg: '#000', color: '#fff' },
  suministrador: { bg: '#F3E8FF', color: '#7E22CE' },
}

interface LinkedUser {
  id: string
  nombre: string
  empresa: string
  rol: string
  created_at: string
}

interface Props {
  clienteId: string
  clienteNombre: string
  linkedUsers: LinkedUser[]
  onUsersChanged: () => void
  /** If true, user can create with password (Admin/Analyst) */
  canCreateWithPassword: boolean
  /** If true, user can manage all roles. If false, only cliente_final & financiero */
  canManageAllRoles: boolean
  readOnly?: boolean
}

export default function UsuariosCliente({ clienteId, clienteNombre, linkedUsers, onUsersChanged, canCreateWithPassword, canManageAllRoles, readOnly = false }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [mode, setMode] = useState<'invite' | 'create'>('invite')
  const [newNombre, setNewNombre] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [newRol, setNewRol] = useState<string>('cliente_final')
  const [newEmpresa, setNewEmpresa] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null)

  const availableRoles = canManageAllRoles
    ? ['cliente_final', 'financiero', 'epc', 'nodo_analista', 'nodo_admin', 'suministrador']
    : ['cliente_final', 'financiero']

  function resetForm() {
    setNewNombre('')
    setNewEmail('')
    setNewPassword('')
    setNewRol('cliente_final')
    setNewEmpresa('')
    setError('')
    setSuccess('')
    setShowPassword(false)
  }

  function openModal(m: 'invite' | 'create') {
    setMode(m)
    resetForm()
    setNewEmpresa(clienteNombre)
    setShowModal(true)
  }

  async function handleSubmit() {
    if (!newEmail.trim() || !newNombre.trim()) {
      setError('Nombre y email son obligatorios.')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'invite') {
      const result = await invitarUsuario({
        email: newEmail.trim(),
        nombre: newNombre.trim(),
        empresa: newEmpresa.trim() || clienteNombre,
        rol: newRol as 'cliente_final' | 'financiero',
        cliente_crm_id: clienteId,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess('Invitación enviada correctamente.')
        onUsersChanged()
      }
    } else {
      const result = await crearUsuarioAdmin({
        email: newEmail.trim(),
        nombre: newNombre.trim(),
        empresa: newEmpresa.trim() || clienteNombre,
        rol: newRol,
        password: newPassword || undefined,
        cliente_crm_id: clienteId,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(result.method === 'created'
          ? 'Usuario creado exitosamente. Puedes compartir las credenciales.'
          : 'Invitación enviada al email proporcionado.'
        )
        onUsersChanged()
      }
    }
    setLoading(false)
  }

  async function handleUnlink(userId: string) {
    setLoading(true)
    const result = await vincularUsuarioCliente({ userId, clienteId: null })
    if (result.error) {
      setError(result.error)
    } else {
      onUsersChanged()
    }
    setConfirmUnlink(null)
    setLoading(false)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="border border-borde rounded-xl bg-white shadow-sm mb-6 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-borde flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={18} className="text-acento" />
          <h3 className="font-bold text-lg">Usuarios del Cliente</h3>
          <span className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-md">
            {linkedUsers.length}
          </span>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button
              onClick={() => openModal('invite')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-borde hover:bg-gray-50 transition-colors"
            >
              <Mail size={13} /> Invitar
            </button>
            {canCreateWithPassword && (
              <button
                onClick={() => openModal('create')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-acento text-principal transition-colors hover:opacity-90"
              >
                <UserPlus size={13} /> Crear usuario
              </button>
            )}
          </div>
        )}
      </div>

      {/* Linked users list */}
      {linkedUsers.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">
          No hay usuarios vinculados a este cliente.
          {!readOnly && (
            <>
              <br />
              <span className="text-xs">Invita o crea usuarios para darles acceso a la plataforma.</span>
            </>
          )}
        </div>
      ) : (
        <div>
          {linkedUsers.map(u => (
            <div key={u.id} className="flex items-center justify-between p-4 border-b border-borde/50 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                  {u.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{u.nombre}</div>
                  <div className="text-xs text-gray-400">{u.empresa} · {formatDate(u.created_at)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="px-2.5 py-1 text-[10px] font-bold rounded-md"
                  style={{
                    backgroundColor: ROL_COLORS[u.rol]?.bg ?? '#E8E8E8',
                    color: ROL_COLORS[u.rol]?.color ?? '#444',
                  }}
                >
                  {ROL_LABELS[u.rol] ?? u.rol}
                </span>
                {!readOnly && (
                  confirmUnlink === u.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUnlink(u.id)}
                        className="text-[10px] font-bold text-red-600 hover:text-red-800 px-2 py-1 border border-red-200 rounded-md"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmUnlink(null)}
                        className="text-[10px] text-gray-400 hover:text-gray-600 px-1"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmUnlink(u.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Desvincular usuario"
                    >
                      <Unlink size={14} />
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for invite / create */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-5 border-b border-borde flex items-center justify-between">
              <h3 className="font-bold text-lg">
                {mode === 'invite' ? 'Invitar usuario' : 'Crear usuario'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newNombre}
                  onChange={e => setNewNombre(e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full border border-borde px-3 py-2 text-sm rounded-lg focus:ring-2 focus:ring-acento/30 focus:border-acento transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="juan@empresa.com"
                  className="w-full border border-borde px-3 py-2 text-sm rounded-lg focus:ring-2 focus:ring-acento/30 focus:border-acento transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Empresa</label>
                <input
                  type="text"
                  value={newEmpresa}
                  onChange={e => setNewEmpresa(e.target.value)}
                  className="w-full border border-borde px-3 py-2 text-sm rounded-lg focus:ring-2 focus:ring-acento/30 focus:border-acento transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Rol</label>
                <select
                  value={newRol}
                  onChange={e => setNewRol(e.target.value)}
                  className="w-full border border-borde px-3 py-2 text-sm rounded-lg focus:ring-2 focus:ring-acento/30 focus:border-acento transition-all outline-none"
                >
                  {availableRoles.map(r => (
                    <option key={r} value={r}>{ROL_LABELS[r] ?? r}</option>
                  ))}
                </select>
              </div>

              {mode === 'create' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <span className="flex items-center gap-1"><Key size={13} /> Contraseña</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full border border-borde px-3 py-2 text-sm rounded-lg pr-10 focus:ring-2 focus:ring-acento/30 focus:border-acento transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Si proporcionas contraseña, el usuario se crea directamente. Si no, se envía invitación por email.
                  </p>
                </div>
              )}

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                  {success}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-borde flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-borde rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
              {!success && (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-acento text-principal disabled:opacity-50 transition-colors hover:opacity-90"
                >
                  {loading ? 'Procesando…' : mode === 'invite' ? 'Enviar invitación' : 'Crear usuario'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
