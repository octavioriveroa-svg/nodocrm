'use client'

import React, { useState } from 'react'
import { X, Mail, KeyRound, User, Building2, ShieldCheck } from 'lucide-react'
import { crearUsuarioAdmin } from '@/app/actions/crearUsuario'

const ROL_LABELS: Record<string, string> = {
  epc: 'EPC',
  nodo_analista: 'Analista Nodo',
  nodo_admin: 'Admin Nodo',
  cliente_final: 'Cliente Final',
  financiero: 'Financiero',
  suministrador: 'Suministrador',
  finder: 'Finder Comercial',
}

const ROLES_ASIGNABLES = ['epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador', 'finder']

interface Props {
  onClose: () => void
  onSuccess: () => void
  allowedRoles?: string[]
  defaultRol?: string
}

export default function NuevoUsuarioModal({ onClose, onSuccess, allowedRoles, defaultRol }: Props) {
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
  const [nombre, setNombre] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState(defaultRol || 'cliente_final')
  const [password, setPassword] = useState('')
  const [sendInvite, setSendInvite] = useState(true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    
    if (!nombre.trim() || !email.trim()) {
      setErrorMsg('El nombre y correo son obligatorios.')
      return
    }
    
    if (!sendInvite && password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    
    const result = await crearUsuarioAdmin({
      nombre,
      empresa,
      email,
      rol,
      password: sendInvite ? undefined : password,
    })

    if (result.error) {
      setErrorMsg(result.error)
      setLoading(false)
    } else {
      setLoading(false)
      onSuccess()
    }
  }

  const inp = "w-full border border-borde rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-acento/30 focus:border-acento outline-none transition-all"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-borde flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-bold text-lg text-principal">Añadir Nuevo Usuario</h3>
            <p className="text-xs text-muted">Crea una cuenta o envía una invitación por correo.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {errorMsg && (
            <div className="mb-6 px-4 py-3 text-sm font-medium rounded-xl bg-red-50 text-red-600 border border-red-100">
              {errorMsg}
            </div>
          )}

          <form id="newUserForm" onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">
                  <User size={12} className="inline mr-1 -mt-0.5" /> Nombre completo
                </label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  className={inp} placeholder="Ej. Juan Pérez" required />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">
                  <Building2 size={12} className="inline mr-1 -mt-0.5" /> Empresa (Opcional)
                </label>
                <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)}
                  className={inp} placeholder="Ej. Nodo Energy" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">
                  <Mail size={12} className="inline mr-1 -mt-0.5" /> Correo electrónico
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className={inp} placeholder="correo@ejemplo.com" required />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">
                  <ShieldCheck size={12} className="inline mr-1 -mt-0.5" /> Rol de la cuenta
                </label>
                <select value={rol} onChange={e => setRol(e.target.value)} className={inp}>
                  {(allowedRoles || ROLES_ASIGNABLES).map(r => <option key={r} value={r}>{ROL_LABELS[r] ?? r}</option>)}
                </select>
              </div>
            </div>

            <hr className="border-borde my-2" />

            {/* Authentication Method */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">
                Método de acceso
              </label>
              
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-3 p-3 border border-borde rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="radio" name="authMethod" checked={sendInvite} onChange={() => setSendInvite(true)}
                    className="mt-1 text-black focus:ring-black" />
                  <div>
                    <div className="font-semibold text-sm">Enviar invitación por correo</div>
                    <div className="text-xs text-muted">El usuario recibirá un link para establecer su propia contraseña.</div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${!sendInvite ? 'border-principal bg-gray-50' : 'border-borde hover:bg-gray-50'}`}>
                  <input type="radio" name="authMethod" checked={!sendInvite} onChange={() => { setSendInvite(false); setPassword(''); }}
                    className="mt-1 text-black focus:ring-black" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">Establecer contraseña manualmente</div>
                    <div className="text-xs text-muted mb-2">Crear la cuenta de inmediato con una contraseña definida.</div>
                    
                    {!sendInvite && (
                      <div className="mt-2 relative">
                        <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" value={password} onChange={e => setPassword(e.target.value)}
                          className={`${inp} pl-9`} placeholder="Mínimo 6 caracteres" required={!sendInvite} />
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-borde bg-gray-50/50 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-xl transition-colors">
            Cancelar
          </button>
          <button type="submit" form="newUserForm" disabled={loading}
            className="px-6 py-2 text-sm font-bold bg-principal text-acento rounded-xl hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 shadow-sm">
            {loading ? 'Procesando...' : sendInvite ? 'Enviar invitación' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}
