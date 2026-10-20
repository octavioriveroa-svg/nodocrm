'use client'

import React, { useState } from 'react'
import { CalendarDays, ExternalLink, Send, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Seccion, Campo } from './common'
import type { Proyecto, Profile } from '@/lib/types'
import { invitarUsuario } from '@/app/actions/invitar'

interface Props {
  proyecto: Proyecto
  currentUser: Profile
  responsableProfile: { nombre: string; empresa: string; calendario_url: string | null } | null
  finderProfile: { nombre: string; empresa: string } | null
  onAssignResponsable?: () => void
  onRefresh: () => Promise<void>
}

export default function ProjectStakeholdersAndAccess({
  proyecto,
  currentUser,
  responsableProfile,
  finderProfile,
  onAssignResponsable,
  onRefresh,
}: Props) {
  const isAdmin = currentUser.rol === 'nodo_admin'
  const isAnalista = currentUser.rol === 'nodo_analista'
  const isEpcista = currentUser.rol === 'epc'

  // Invitation Form State for Cliente
  const [showInviteCliente, setShowInviteCliente] = useState(false)
  const [clienteEmail, setClienteEmail] = useState(proyecto.cliente_final_contacto?.trim() || '')
  const [clienteNombre, setClienteNombre] = useState(proyecto.cliente_final_nombre || 'Cliente')
  const [clienteEmpresa, setClienteEmpresa] = useState(proyecto.cliente_final_empresa || 'Empresa')
  const [invitandoCliente, setInvitandoCliente] = useState(false)
  const [clienteMsg, setClienteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Invitation Form State for Financiero
  const [showInviteFinanciero, setShowInviteFinanciero] = useState(false)
  const [finEmail, setFinEmail] = useState('')
  const [finNombre, setFinNombre] = useState('Inversionista')
  const [finEmpresa, setFinEmpresa] = useState('Fondo de Inversión')
  const [invitandoFinanciero, setInvitandoFinanciero] = useState(false)
  const [finMsg, setFinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleInvitarCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteEmail.trim()) {
      setClienteMsg({ type: 'error', text: 'Por favor ingresa un correo electrónico válido.' })
      return
    }

    setInvitandoCliente(true)
    setClienteMsg(null)
    try {
      const res = await invitarUsuario({
        email: clienteEmail.trim(),
        nombre: clienteNombre.trim() || 'Cliente',
        empresa: clienteEmpresa.trim() || 'Empresa',
        rol: 'cliente_final',
        proyecto_id: proyecto.id,
      })

      if (res.error) {
        setClienteMsg({ type: 'error', text: res.error })
      } else {
        setClienteMsg({ type: 'success', text: '¡Invitación enviada con éxito al cliente!' })
        setShowInviteCliente(false)
        await onRefresh()
      }
    } catch (err: unknown) {
      setClienteMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error inesperado al enviar invitación',
      })
    } finally {
      setInvitandoCliente(false)
    }
  }

  async function handleInvitarFinanciero(e: React.FormEvent) {
    e.preventDefault()
    if (!finEmail.trim()) {
      setFinMsg({ type: 'error', text: 'Por favor ingresa un correo electrónico válido.' })
      return
    }

    setInvitandoFinanciero(true)
    setFinMsg(null)
    try {
      const res = await invitarUsuario({
        email: finEmail.trim(),
        nombre: finNombre.trim() || 'Inversionista',
        empresa: finEmpresa.trim() || 'Fondo de Inversión',
        rol: 'financiero',
        proyecto_id: proyecto.id,
      })

      if (res.error) {
        setFinMsg({ type: 'error', text: res.error })
      } else {
        setFinMsg({ type: 'success', text: '¡Invitación enviada con éxito al financiero!' })
        setShowInviteFinanciero(false)
        await onRefresh()
      }
    } catch (err: unknown) {
      setFinMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error inesperado al enviar invitación',
      })
    } finally {
      setInvitandoFinanciero(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cliente final */}
      <Seccion title="Cliente final">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Campo label="Nombre" value={proyecto.cliente_final_nombre} />
          <Campo label="Empresa" value={proyecto.cliente_final_empresa} />
          <Campo label="Contacto" value={proyecto.cliente_final_contacto} />
        </div>
      </Seccion>

      {/* Responsable Nodo */}
      <Seccion title="Responsable Nodo">
        {responsableProfile ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{responsableProfile.nombre}</p>
              <p className="text-xs text-gray-500">{responsableProfile.empresa}</p>
            </div>
            {responsableProfile.calendario_url && isEpcista && (
              <a
                href={responsableProfile.calendario_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-md bg-acento text-principal whitespace-nowrap self-start sm:self-auto"
              >
                <CalendarDays size={16} /> Agendar Reunión <ExternalLink size={12} />
              </a>
            )}
            {responsableProfile.calendario_url && !isEpcista && (
              <a
                href={responsableProfile.calendario_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-principal transition-colors self-start sm:self-auto"
              >
                <CalendarDays size={13} /> Ver calendario <ExternalLink size={11} />
              </a>
            )}
          </div>
        ) : (
          <div>
            {isAdmin || isAnalista ? (
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-600 text-sm">⚠️</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Sin analista asignado</p>
                  <p className="text-xs text-amber-600">Edita el proyecto para asignar un responsable de Nodo.</p>
                </div>
                {onAssignResponsable && (
                  <button
                    onClick={onAssignResponsable}
                    className="px-3 py-1.5 text-xs font-bold bg-principal text-acento rounded-lg hover:opacity-90 transition-all whitespace-nowrap"
                  >
                    Asignar
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin responsable asignado.</p>
            )}
          </div>
        )}
      </Seccion>

      {/* Finder / Originador */}
      <Seccion title="Finder / Originador">
        {finderProfile ? (
          <div>
            <p className="text-sm font-semibold">{finderProfile.nombre}</p>
            <p className="text-xs text-gray-500">{finderProfile.empresa}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin finder asignado.</p>
        )}
      </Seccion>

      {/* Accesos al Portal */}
      <Seccion title="Accesos al Portal">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Portal de Cliente */}
          <div className="border border-borde rounded-xl p-4 shadow-sm bg-fondo flex flex-col justify-between">
            <div>
              <p className="font-bold text-sm text-principal mb-1">Portal de Cliente</p>
              {proyecto.cliente_id ? (
                <p className="text-xs font-semibold text-green-700 bg-green-100 inline-block px-2.5 py-1 rounded-md">
                  Usuario vinculado
                </p>
              ) : (
                <p className="text-xs text-gray-500 mb-3">
                  El cliente no tiene acceso al portal para ver su Gantt ni sus documentos.
                </p>
              )}

              {clienteMsg && (
                <div
                  className={`mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    clienteMsg.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {clienteMsg.type === 'success' ? (
                    <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-red-600 shrink-0" />
                  )}
                  <span>{clienteMsg.text}</span>
                </div>
              )}
            </div>

            {!proyecto.cliente_id && (
              <div className="mt-3">
                {!showInviteCliente ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowInviteCliente(true)
                      setClienteMsg(null)
                    }}
                  >
                    <Send size={12} className="mr-1.5" /> Invitar Cliente
                  </Button>
                ) : (
                  <form onSubmit={handleInvitarCliente} className="bg-white border border-borde rounded-xl p-3 flex flex-col gap-2.5 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-principal">Invitar al Portal de Cliente</span>
                      <button
                        type="button"
                        onClick={() => setShowInviteCliente(false)}
                        className="text-gray-400 hover:text-gray-600 p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Correo electrónico *</label>
                      <input
                        type="email"
                        required
                        value={clienteEmail}
                        onChange={(e) => setClienteEmail(e.target.value)}
                        placeholder="cliente@ejemplo.com"
                        className="w-full border rounded-lg p-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Nombre</label>
                      <input
                        type="text"
                        value={clienteNombre}
                        onChange={(e) => setClienteNombre(e.target.value)}
                        className="w-full border rounded-lg p-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Empresa</label>
                      <input
                        type="text"
                        value={clienteEmpresa}
                        onChange={(e) => setClienteEmpresa(e.target.value)}
                        className="w-full border rounded-lg p-1.5 text-xs bg-white"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowInviteCliente(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={invitandoCliente}
                        className="bg-principal text-acento"
                      >
                        {invitandoCliente ? 'Enviando...' : 'Enviar Invitación'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Portal Financiero */}
          <div className="border border-borde rounded-xl p-4 shadow-sm bg-fondo flex flex-col justify-between">
            <div>
              <p className="font-bold text-sm text-principal mb-1">Portal Financiero</p>
              {proyecto.financiero_id ? (
                <p className="text-xs font-semibold text-green-700 bg-green-100 inline-block px-2.5 py-1 rounded-md">
                  Inversionista vinculado
                </p>
              ) : (
                <p className="text-xs text-gray-500 mb-3">
                  El proyecto no está vinculado al portafolio de ningún usuario financiero.
                </p>
              )}

              {finMsg && (
                <div
                  className={`mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    finMsg.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {finMsg.type === 'success' ? (
                    <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-red-600 shrink-0" />
                  )}
                  <span>{finMsg.text}</span>
                </div>
              )}
            </div>

            {!proyecto.financiero_id && (
              <div className="mt-3">
                {!showInviteFinanciero ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowInviteFinanciero(true)
                      setFinMsg(null)
                    }}
                  >
                    <Send size={12} className="mr-1.5" /> Invitar Financiero
                  </Button>
                ) : (
                  <form onSubmit={handleInvitarFinanciero} className="bg-white border border-borde rounded-xl p-3 flex flex-col gap-2.5 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-principal">Invitar al Portal Financiero</span>
                      <button
                        type="button"
                        onClick={() => setShowInviteFinanciero(false)}
                        className="text-gray-400 hover:text-gray-600 p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Correo electrónico *</label>
                      <input
                        type="email"
                        required
                        value={finEmail}
                        onChange={(e) => setFinEmail(e.target.value)}
                        placeholder="financiero@fondo.com"
                        className="w-full border rounded-lg p-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Nombre</label>
                      <input
                        type="text"
                        value={finNombre}
                        onChange={(e) => setFinNombre(e.target.value)}
                        className="w-full border rounded-lg p-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Empresa / Fondo</label>
                      <input
                        type="text"
                        value={finEmpresa}
                        onChange={(e) => setFinEmpresa(e.target.value)}
                        className="w-full border rounded-lg p-1.5 text-xs bg-white"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowInviteFinanciero(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={invitandoFinanciero}
                        className="bg-principal text-acento"
                      >
                        {invitandoFinanciero ? 'Enviando...' : 'Enviar Invitación'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </Seccion>
    </div>
  )
}
