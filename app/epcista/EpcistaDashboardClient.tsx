'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, ChevronDown, ChevronUp, MapPin, FileText, Zap, Sun } from 'lucide-react'
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

const MODALIDAD_LABELS: Record<string, string> = {
  credito: 'Crédito',
  arrendamiento: 'Arrendamiento',
  ensaas: 'EnSaaS',
  mem: 'Mercado Eléctrico Mayorista',
  no_sabe: 'Analista define modalidad',
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
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<Proyecto[]>(initialProyectos)
  const [portafolio] = useState<PortafolioStats | null>(initialPortafolio)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Realtime: sync changes from admin/analista
  useEffect(() => {
    const channel = supabase
      .channel('proyectos-epcista')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'proyectos' }, payload => {
        setProyectos(prev => prev.filter(p => p.id !== (payload.old as { id: string }).id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'proyectos' }, payload => {
        setProyectos(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } as Proyecto : p))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const total = proyectos.length
  const enAnalisis = proyectos.filter(p => p.estado === 'en_analisis').length
  const clienteInteresado = proyectos.filter(p => p.estado === 'cliente_interesado').length

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-gray-400 mb-1">Bienvenido de vuelta</p>
          <h1 className="text-2xl font-black tracking-tight">Mis proyectos</h1>
        </div>
        <Link
          href="/epcista/nuevo"
          className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm bg-acento text-principal rounded-lg shadow-sm hover:shadow-md hover:bg-acento-hover transition-all active:scale-[0.97]"
        >
          <Plus size={16} />
          Nuevo proyecto
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-8">
        {[
          { label: 'Total proyectos', value: total },
          { label: 'En análisis', value: enAnalisis },
          { label: 'Cliente interesado', value: clienteInteresado },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-borde bg-white p-6 shadow-sm">
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
              <div className="rounded-xl border border-borde bg-white p-6 shadow-sm">
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
              <div className="rounded-xl border border-borde bg-white p-6 shadow-sm">
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

      {proyectos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-borde p-16 flex flex-col items-center text-center">
          <p className="font-semibold text-lg">Aún no tienes proyectos</p>
          <p className="text-sm mt-2 mb-6 text-gray-400">Crea tu primer proyecto para comenzar</p>
          <Link href="/epcista/nuevo" className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm bg-acento text-principal rounded-lg shadow-sm hover:shadow-md transition-all">
            <Plus size={16} />
            Nuevo proyecto
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-borde overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-borde">
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Proyecto</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Tipo</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Estado</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Fecha</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400"></th>
              </tr>
            </thead>
            <tbody>
              {proyectos.map((p, i) => {
                const isExpanded = expandedId === p.id
                const modalidades = p.modalidad_financiamiento ?? []
                const noSabe = modalidades.includes('no_sabe')
                return (
                  <>
                    <tr
                      key={p.id}
                      className={`border-t border-borde cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-fondo' : i % 2 === 0 ? 'bg-white' : 'bg-fondo/50'}`}
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium hover:underline">{p.nombre_proyecto}</span>
                          {isExpanded
                            ? <ChevronUp size={13} className="text-gray-400 flex-shrink-0" />
                            : <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />}
                        </div>
                      </td>
                      <td className="px-6 py-3.5"><BadgeTipo tipo={p.tipo} /></td>
                      <td className="px-6 py-3.5"><BadgeEstado estado={p.estado} /></td>
                      <td className="px-6 py-3.5 text-gray-400 text-xs">{formatDate(p.created_at)}</td>
                      <td className="px-6 py-3.5" onClick={e => e.stopPropagation()}>
                        <Link href={`/epcista/proyectos/${p.id}`} className="font-semibold text-xs text-gray-400 hover:text-principal transition-colors">Ver detalle →</Link>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${p.id}-detail`} className="border-t border-borde">
                        <td colSpan={5} className="px-6 py-4 bg-[#f5f5f0]">
                          <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
                            {p.cliente_final_empresa && (
                              <div>
                                <div className="text-xs font-medium mb-0.5 text-gray-400">Empresa</div>
                                <div className="font-medium">{p.cliente_final_empresa}</div>
                              </div>
                            )}
                            {p.cliente_final_nombre && (
                              <div>
                                <div className="text-xs font-medium mb-0.5 text-gray-400">Contacto</div>
                                <div className="font-medium">{p.cliente_final_nombre}</div>
                              </div>
                            )}
                            {p.ubicacion_estado && (
                              <div>
                                <div className="text-xs font-medium mb-0.5 text-gray-400">Estado</div>
                                <div className="font-medium flex items-center gap-1">
                                  <MapPin size={11} className="text-gray-400" />
                                  {p.ubicacion_estado}
                                </div>
                              </div>
                            )}
                            {p.tipo_instalacion && (
                              <div>
                                <div className="text-xs font-medium mb-0.5 text-gray-400">Instalación</div>
                                <div className="font-medium">{p.tipo_instalacion === 'nodo_busca' ? 'Nodo busca instalador' : 'EPCista instala'}</div>
                              </div>
                            )}
                            {p.capex_estimado != null && (
                              <div>
                                <div className="text-xs font-medium mb-0.5 text-gray-400">CAPEX estimado</div>
                                <div className="font-medium">{p.moneda} {p.capex_estimado.toLocaleString('es-MX')}</div>
                              </div>
                            )}
                            {modalidades.length > 0 && (
                              <div>
                                <div className="text-xs font-medium mb-0.5 text-gray-400">Financiamiento</div>
                                <div className="font-medium">
                                  {noSabe ? 'Analista define' : modalidades.map(m => MODALIDAD_LABELS[m] ?? m).join(', ')}
                                </div>
                              </div>
                            )}
                            {p.incluye_mem && (
                              <div>
                                <div className="text-xs font-medium mb-0.5 text-gray-400">MEM</div>
                                <div className="font-medium">Alternativa solicitada</div>
                              </div>
                            )}
                            {p.notas_adicionales && (
                              <div className="col-span-3">
                                <div className="text-xs font-medium mb-0.5 text-gray-400">Notas</div>
                                <div className="text-sm whitespace-pre-wrap">{p.notas_adicionales}</div>
                              </div>
                            )}
                          </div>
                          <div className="mt-4 pt-4 flex justify-end border-t border-borde">
                            <Link href={`/epcista/proyectos/${p.id}`}
                              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-principal text-acento rounded-lg hover:bg-[#1a1a1a] transition-colors">
                              <FileText size={12} />
                              Ver detalle completo
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
