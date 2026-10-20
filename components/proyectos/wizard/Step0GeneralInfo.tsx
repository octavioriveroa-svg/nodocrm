'use client'

import React, { useState } from 'react'
import { UserPlus, HelpCircle, Wrench } from 'lucide-react'
import type { Profile, Cliente } from '@/lib/types'
import NuevoUsuarioModal from '@/components/NuevoUsuarioModal'
import type { WizardFormData, WizardCapabilities, ManualClienteForm } from './types'
import { inp } from './constants'

interface Step0GeneralInfoProps {
  capabilities: WizardCapabilities
  form: WizardFormData
  setF: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void
  epcList: Profile[]
  nodoUsers: Profile[]
  finderList: Profile[]
  selectedEpcId: string
  handleSelectEpc: (id: string) => void
  selectedResponsableId: string
  setSelectedResponsableId: (id: string) => void
  selectedFinderId: string
  setSelectedFinderId: (id: string) => void
  clienteManual: boolean
  setClienteManual: (val: boolean) => void
  manualCliente: ManualClienteForm
  setManualCliente: React.Dispatch<React.SetStateAction<ManualClienteForm>>
  clientes: Cliente[]
  clientesCargados: boolean
  seleccionarCliente: (id: string) => void
  onInviteEpcSuccess: () => Promise<void> | void
}

export function Step0GeneralInfo({
  capabilities,
  form,
  setF,
  epcList,
  nodoUsers,
  finderList,
  selectedEpcId,
  handleSelectEpc,
  selectedResponsableId,
  setSelectedResponsableId,
  selectedFinderId,
  setSelectedFinderId,
  clienteManual,
  setClienteManual,
  manualCliente,
  setManualCliente,
  clientes,
  clientesCargados,
  seleccionarCliente,
  onInviteEpcSuccess,
}: Step0GeneralInfoProps) {
  const [showInviteModal, setShowInviteModal] = useState(false)

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-bold text-lg">Información básica</h2>

      {/* Nombre del proyecto */}
      <div>
        <label className="block text-sm font-medium mb-1">Nombre del proyecto *</label>
        <input
          type="text"
          value={form.nombre_proyecto}
          onChange={e => setF('nombre_proyecto', e.target.value)}
          className={inp}
          placeholder="Ej: Proyecto Energía Norte"
        />
      </div>

      {/* Selectores de roles específicos */}
      {(capabilities.canAssignEpc || capabilities.canAssignResponsableNodo || capabilities.canAssignFinder) && (
        <div
          className={`grid grid-cols-1 ${
            capabilities.canAssignResponsableNodo ? 'md:grid-cols-3' : 'md:grid-cols-2'
          } gap-4`}
        >
          {/* EPCista */}
          {capabilities.canAssignEpc && (
            <div>
              <label className="block text-sm font-medium mb-1">EPCista *</label>
              <div className="flex gap-2">
                <select
                  value={selectedEpcId}
                  onChange={e => handleSelectEpc(e.target.value)}
                  className={inp}
                >
                  <option value="">Selecciona un EPCista</option>
                  {epcList.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} {u.empresa ? `— ${u.empresa}` : ''}
                    </option>
                  ))}
                </select>
                {capabilities.canInviteEpc && (
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg border border-borde hover:bg-gray-50 transition-colors shrink-0"
                  >
                    <UserPlus size={14} />
                    Invitar EPC
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Responsable Nodo */}
          {capabilities.canAssignResponsableNodo && (
            <div>
              <label className="block text-sm font-medium mb-1">Responsable Nodo</label>
              <select
                value={selectedResponsableId}
                onChange={e => setSelectedResponsableId(e.target.value)}
                className={inp}
              >
                <option value="">Sin asignar</option>
                {nodoUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.rol === 'nodo_admin' ? 'Admin' : 'Analista'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Finder / Originador */}
          {capabilities.canAssignFinder && (
            <div>
              <label className="block text-sm font-medium mb-1">Finder / Originador</label>
              <select
                value={selectedFinderId}
                onChange={e => setSelectedFinderId(e.target.value)}
                className={inp}
              >
                <option value="">Sin asignar (opcional)</option>
                {finderList.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} {u.empresa ? `— ${u.empresa}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <hr className="border-borde rounded-xl" />

      {/* Selector de Cliente */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Cliente *</label>
          {capabilities.canUseManualClient && selectedEpcId && (
            <button
              type="button"
              onClick={() => {
                setClienteManual(!clienteManual)
                setF('cliente_id', '')
              }}
              className="text-xs font-medium underline transition-colors"
              style={{ color: clienteManual ? 'var(--color-green-700)' : 'var(--color-texto-suave)' }}
            >
              {clienteManual ? '← Elegir cliente existente' : 'Ingresar datos manualmente'}
            </button>
          )}
        </div>

        {capabilities.canUseManualClient ? (
          !clienteManual ? (
            <>
              {!selectedEpcId && (
                <p className="text-xs text-gray-400">Selecciona un EPCista primero para ver sus clientes.</p>
              )}
              {selectedEpcId && !clientesCargados && (
                <div className="text-sm text-gray-400">Cargando clientes…</div>
              )}
              {selectedEpcId && clientesCargados && (
                <select
                  value={form.cliente_id}
                  onChange={e => seleccionarCliente(e.target.value)}
                  className={inp}
                >
                  <option value="">Selecciona un cliente</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.razon_social}
                    </option>
                  ))}
                </select>
              )}
              {selectedEpcId && clientesCargados && clientes.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Este EPCista no tiene clientes. Puedes ingresar datos manualmente.
                </p>
              )}
            </>
          ) : (
            <div className="border border-borde rounded-lg p-4 flex flex-col gap-3 bg-gray-50/50">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Datos del cliente (manual)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Nombre contacto *</label>
                  <input
                    type="text"
                    value={manualCliente.nombre}
                    onChange={e => setManualCliente(prev => ({ ...prev, nombre: e.target.value }))}
                    className={inp}
                    placeholder="Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Empresa *</label>
                  <input
                    type="text"
                    value={manualCliente.empresa}
                    onChange={e => setManualCliente(prev => ({ ...prev, empresa: e.target.value }))}
                    className={inp}
                    placeholder="Empresa del cliente"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email o teléfono de contacto</label>
                <input
                  type="text"
                  value={manualCliente.contacto}
                  onChange={e => setManualCliente(prev => ({ ...prev, contacto: e.target.value }))}
                  className={inp}
                  placeholder="contacto@empresa.com o 55 1234 5678"
                />
              </div>
            </div>
          )
        ) : (
          <div>
            {!clientesCargados ? (
              <div className="text-sm text-gray-400">Cargando clientes…</div>
            ) : (
              <select
                value={form.cliente_id}
                onChange={e => seleccionarCliente(e.target.value)}
                className={inp}
              >
                <option value="">Selecciona un cliente</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.razon_social}
                  </option>
                ))}
              </select>
            )}
            {capabilities.portalType === 'finder' && (
              <p className="text-xs text-gray-400 mt-1">Solo se muestran los clientes creados por ti.</p>
            )}
          </div>
        )}
      </div>

      <hr className="border-borde rounded-xl" />

      {/* Tipo de instalación */}
      <div>
        <label className="block text-sm font-medium mb-3">Tipo de instalación *</label>
        <div className="flex flex-col gap-3">
          {(
            [
              {
                value: 'nodo_busca',
                icon: HelpCircle,
                title: 'Quiero que Nodo me ayude a encontrar un instalador',
                desc: 'Nodo buscará una empresa certificada que se encargue de la instalación del proyecto.',
              },
              {
                value: 'epcista_instala',
                icon: Wrench,
                title: 'El EPC asignado tiene la capacidad para realizar la instalación',
                desc: 'El EPC seleccionado cuenta con la experiencia y certificaciones para instalar.',
              },
            ] as const
          ).map(opt => {
            const selected = form.tipo_instalacion === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setF('tipo_instalacion', opt.value)}
                className="flex items-start gap-4 rounded-xl border p-4 text-left w-full transition-all duration-200"
                style={{
                  borderColor: selected ? 'var(--color-principal)' : 'var(--color-neutral-200)',
                  backgroundColor: selected ? 'var(--color-principal)' : 'var(--color-white)',
                  boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ borderColor: selected ? 'var(--color-acento)' : 'var(--color-linea)' }}
                >
                  {selected && (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-acento)' }} />
                  )}
                </div>
                <div>
                  <div
                    className="font-semibold text-sm"
                    style={{ color: selected ? 'var(--color-acento)' : 'var(--color-principal)' }}
                  >
                    {opt.title}
                  </div>
                  <div
                    className="text-xs mt-1.5"
                    style={{ color: selected ? 'var(--color-gray-300)' : 'var(--color-texto-suave)' }}
                  >
                    {opt.desc}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modal invitar EPC (para finder) */}
      {showInviteModal && (
        <NuevoUsuarioModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={async () => {
            setShowInviteModal(false)
            await onInviteEpcSuccess()
          }}
          allowedRoles={['epc']}
          defaultRol="epc"
        />
      )}
    </div>
  )
}
