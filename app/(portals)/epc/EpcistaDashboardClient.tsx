'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Zap, Sun, Calendar, ArrowRight } from 'lucide-react'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import type { Proyecto } from '@/lib/types'

interface PortafolioStats {
  bess_kw: number
  bess_kwh: number
  bess_capex: number
  fv_kwp: number
  fv_capex: number
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M`
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} k`
  return n.toLocaleString('es-MX', { maximumFractionDigits: 1 })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

interface Props {
  initialProyectos: Proyecto[]
  initialPortafolio: PortafolioStats | null
}

export default function EpcistaDashboardClient({ initialProyectos, initialPortafolio }: Props) {
  const [proyectos] = useState<Proyecto[]>(initialProyectos)
  const [portafolio] = useState<PortafolioStats | null>(initialPortafolio)

  const total = proyectos.length
  const enAnalisis = proyectos.filter(p => p.estado === 'en_analisis').length
  const clienteInteresado = proyectos.filter(p => p.estado === 'cliente_interesado').length

  const recientes = proyectos.slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-gray-400 mb-1">Bienvenido de vuelta</p>
          <h1 className="text-2xl font-black tracking-tight">Dashboard de EPCista</h1>
        </div>
        <Link
          href="/epc/nuevo"
          className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm bg-acento text-principal rounded-lg shadow-sm hover:shadow-md hover:bg-acento-hover transition-all active:scale-[0.97]"
        >
          <Plus size={16} />
          Nuevo proyecto
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {[
          { label: 'Total proyectos', value: total },
          { label: 'En análisis', value: enAnalisis },
          { label: 'Cliente interesado', value: clienteInteresado },
        ].map(m => (
          <div key={m.label} className="glass-card p-6 shadow-sm">
            <div className="text-3xl font-black tracking-tight">{m.value}</div>
            <div className="text-sm mt-1.5 text-gray-500">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Portafolio técnico */}
      {portafolio && (portafolio.bess_kw > 0 || portafolio.fv_kwp > 0) && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Portafolio técnico</h2>
          <div className="grid grid-cols-2 gap-4">
            {portafolio.bess_kw > 0 && (
              <div className="glass-card p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-principal">
                    <Zap size={16} className="text-acento" />
                  </div>
                  <span className="text-sm font-bold">BESS — Almacenamiento</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-2xl font-black">{fmt(portafolio.bess_kw)}</div>
                    <div className="text-xs mt-0.5 text-gray-400">kW Potencia</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black">{fmt(portafolio.bess_kwh)}</div>
                    <div className="text-xs mt-0.5 text-gray-400">kWh Capacidad</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black">${fmt(portafolio.bess_capex)}</div>
                    <div className="text-xs mt-0.5 text-gray-400">CAPEX total</div>
                  </div>
                </div>
              </div>
            )}
            {portafolio.fv_kwp > 0 && (
              <div className="glass-card p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-acento">
                    <Sun size={16} className="text-principal" />
                  </div>
                  <span className="text-sm font-bold">FV — Solar fotovoltaico</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-black">{fmt(portafolio.fv_kwp)}</div>
                    <div className="text-xs mt-0.5 text-gray-400">kWp instalados</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black">${fmt(portafolio.fv_capex)}</div>
                    <div className="text-xs mt-0.5 text-gray-400">CAPEX total</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Proyectos Recientes Table */}
      {recientes.length > 0 && (
        <div className="rounded-xl border border-borde overflow-hidden shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-borde">
            <h2 className="font-bold text-sm">Proyectos recientes</h2>
            <Link href="/epc/proyectos" className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-principal transition-colors">
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
                      <Link href={`/epc/proyectos/${proj.id}`} className="hover:underline line-clamp-1">{proj.nombre_proyecto}</Link>
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">
                      <span className="line-clamp-1">{proj.cliente_final_empresa || proj.cliente_final_nombre || '—'}</span>
                    </td>
                    <td className="px-6 py-3.5"><BadgeTipo tipo={proj.tipo} /></td>
                    <td className="px-6 py-3.5"><BadgeEstado estado={proj.estado} /></td>
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
          <p className="font-semibold text-lg">Aún no tienes proyectos</p>
          <p className="text-sm mt-2 mb-6 text-gray-400">Crea tu primer proyecto para comenzar a ver métricas</p>
          <Link href="/epc/nuevo" className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm bg-acento text-principal rounded-lg shadow-sm hover:shadow-md transition-all">
            <Plus size={16} />
            Nuevo proyecto
          </Link>
        </div>
      )}
    </div>
  )
}
