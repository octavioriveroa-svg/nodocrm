'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Users, FolderOpen, UserPlus, Calendar, ArrowRight } from 'lucide-react'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import NuevoUsuarioModal from '@/components/NuevoUsuarioModal'
import type { Proyecto } from '@/lib/types'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

interface Props {
  initialProyectos: Proyecto[]
  initialClientesCount: number
}

export default function FinderDashboardClient({ initialProyectos, initialClientesCount }: Props) {
  const [proyectos] = useState<Proyecto[]>(initialProyectos)
  const [clientesCount] = useState<number>(initialClientesCount)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  const total = proyectos.length
  const enAnalisis = proyectos.filter(p => p.estado === 'en_analisis').length
  const negociacion = proyectos.filter(p => p.estado === 'negociacion').length

  const recientes = proyectos.slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-gray-400 mb-1">Bienvenido de vuelta</p>
          <h1 className="text-2xl font-black tracking-tight">Dashboard de Finder</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm border border-borde rounded-lg hover:bg-gray-50 transition-all active:scale-[0.97]"
          >
            <UserPlus size={16} />
            Invitar EPC
          </button>
          <Link
            href="/finder/nuevo"
            className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm bg-acento text-principal rounded-lg shadow-sm hover:shadow-md hover:bg-acento-hover transition-all active:scale-[0.97]"
          >
            <Plus size={16} />
            Nuevo proyecto
          </Link>
        </div>
      </div>

      {/* Invitation Notification */}
      {inviteSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex justify-between items-center">
          <span className="text-sm font-semibold">¡Invitación enviada correctamente al EPC!</span>
          <button onClick={() => setInviteSuccess(false)} className="text-xs underline hover:no-underline">Cerrar</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Total proyectos', value: total },
          { label: 'En análisis', value: enAnalisis },
          { label: 'En negociación', value: negociacion },
          { label: 'Clientes registrados', value: clientesCount },
        ].map(m => (
          <div key={m.label} className="glass-card p-6 shadow-sm">
            <div className="text-3xl font-black tracking-tight">{m.value}</div>
            <div className="text-sm mt-1.5 text-gray-500">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6 border hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
              <Users className="text-blue-600" size={20} />
            </div>
            <h3 className="font-bold text-base mb-1">Registrar Cliente</h3>
            <p className="text-sm text-gray-400">Crea un cliente final para asociarlo a tus proyectos originados.</p>
          </div>
          <Link href="/finder/clientes/nuevo" className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-acento hover:underline self-start">
            Nuevo cliente <ArrowRight size={12} />
          </Link>
        </div>

        <div className="glass-card p-6 border hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-4">
              <FolderOpen className="text-green-600" size={20} />
            </div>
            <h3 className="font-bold text-base mb-1">Crear Proyecto</h3>
            <p className="text-sm text-gray-400">Genera una nueva propuesta técnica asignando cliente y EPC.</p>
          </div>
          <Link href="/finder/nuevo" className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-acento hover:underline self-start">
            Nuevo proyecto <ArrowRight size={12} />
          </Link>
        </div>

        <div className="glass-card p-6 border hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
              <UserPlus className="text-amber-600" size={20} />
            </div>
            <h3 className="font-bold text-base mb-1">Invitar nuevo EPC</h3>
            <p className="text-sm text-gray-400">Invita a una nueva empresa de ingeniería a la plataforma.</p>
          </div>
          <button onClick={() => setShowInviteModal(true)} className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-acento hover:underline self-start">
            Invitar EPC <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Proyectos Recientes Table */}
      {recientes.length > 0 && (
        <div className="rounded-xl border border-borde overflow-hidden shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-borde">
            <h2 className="font-bold text-sm">Proyectos recientes</h2>
            <Link href="/finder/proyectos" className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-principal transition-colors">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-borde">
                  <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400 w-[30%]">Proyecto</th>
                  <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400 w-[20%]">Cliente</th>
                  <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Tipo</th>
                  <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Estado</th>
                  <th className="text-right px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((proj, i) => (
                  <tr key={proj.id} className={`border-t border-borde hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-fondo/50'}`}>
                    <td className="px-6 py-3.5 font-medium">
                      <Link href={`/finder/proyectos/${proj.id}`} className="hover:underline line-clamp-1">{proj.nombre_proyecto}</Link>
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">
                      <span className="line-clamp-1">{proj.cliente_final_empresa || proj.cliente_final_nombre || '—'}</span>
                    </td>
                    <td className="px-6 py-3.5"><BadgeTipo tipo={proj.tipo} /></td>
                    <td className="px-6 py-3.5"><BadgeEstado estado={proj.estado} historial={proj.historial_estados} /></td>
                    <td className="px-6 py-3.5 text-xs text-gray-400 text-right">
                      <span className="flex items-center justify-end gap-1.5">
                        <Calendar size={11} /> {formatDate(proj.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {proyectos.length === 0 && (
        <div className="rounded-xl glass-panel border-dashed border-white/50 p-16 flex flex-col items-center text-center">
          <p className="font-semibold text-lg">Aún no tienes proyectos creados</p>
          <p className="text-sm mt-2 mb-6 text-gray-400">Crea tu primer proyecto para comenzar a ver métricas</p>
          <Link href="/finder/nuevo" className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm bg-acento text-principal rounded-lg shadow-sm hover:shadow-md transition-all">
            <Plus size={16} />
            Nuevo proyecto
          </Link>
        </div>
      )}

      {/* Invite EPC Modal */}
      {showInviteModal && (
        <NuevoUsuarioModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false)
            setInviteSuccess(true)
            setTimeout(() => setInviteSuccess(false), 5000)
          }}
          allowedRoles={['epc']}
          defaultRol="epc"
        />
      )}
    </div>
  )
}
