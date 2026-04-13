'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, ChevronDown, ChevronUp, MapPin, FileText } from 'lucide-react'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import type { Proyecto } from '@/lib/types'

const MODALIDAD_LABELS: Record<string, string> = {
  credito: 'Crédito',
  arrendamiento: 'Arrendamiento',
  ensaas: 'EnSaaS',
  mem: 'Mercado Eléctrico Mayorista',
  no_sabe: 'Analista define modalidad',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function EpcistaDashboard() {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data } = await supabase
        .from('proyectos')
        .select('*')
        .eq('epcista_id', session.user.id)
        .order('created_at', { ascending: false })
      setProyectos((data ?? []) as Proyecto[])
      setLoading(false)
    }
    load()
  }, [])

  const total = proyectos.length
  const enAnalisis = proyectos.filter(p => p.estado === 'en_analisis').length
  const completados = proyectos.filter(p => p.estado === 'completado').length

  if (loading) return null

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black">Mis proyectos</h1>
          <p className="text-sm mt-1" style={{ color: '#666' }}>
            Gestiona y da seguimiento a tus proyectos de energía
          </p>
        </div>
        <Link
          href="/epcista/nuevo"
          className="flex items-center gap-2 px-4 py-2.5 font-bold text-sm"
          style={{ backgroundColor: '#D7FF2F', color: '#000' }}
        >
          <Plus size={16} />
          Nuevo proyecto
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total proyectos', value: total },
          { label: 'En análisis', value: enAnalisis },
          { label: 'Completados', value: completados },
        ].map(m => (
          <div key={m.label} className="border p-5" style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
            <div className="text-3xl font-black">{m.value}</div>
            <div className="text-sm mt-1" style={{ color: '#666' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {proyectos.length === 0 ? (
        <div className="border p-16 flex flex-col items-center text-center" style={{ borderColor: '#CFCFCF', borderStyle: 'dashed' }}>
          <p className="font-semibold">Aún no tienes proyectos</p>
          <p className="text-sm mt-1 mb-5" style={{ color: '#666' }}>Crea tu primer proyecto para comenzar</p>
          <Link href="/epcista/nuevo" className="flex items-center gap-2 px-4 py-2.5 font-bold text-sm" style={{ backgroundColor: '#D7FF2F', color: '#000' }}>
            <Plus size={16} />
            Nuevo proyecto
          </Link>
        </div>
      ) : (
        <div className="border overflow-hidden" style={{ borderColor: '#CFCFCF' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#000', color: '#fff' }}>
                <th className="text-left px-4 py-3 font-semibold">Proyecto</th>
                <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                <th className="text-left px-4 py-3 font-semibold">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold"></th>
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
                      style={{
                        backgroundColor: isExpanded ? '#f5f5f0' : i % 2 === 0 ? '#fff' : '#fafaf8',
                        borderTop: '1px solid #CFCFCF',
                        cursor: 'pointer',
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold hover:underline">{p.nombre_proyecto}</span>
                          {isExpanded
                            ? <ChevronUp size={13} style={{ color: '#888', flexShrink: 0 }} />
                            : <ChevronDown size={13} style={{ color: '#888', flexShrink: 0 }} />}
                        </div>
                      </td>
                      <td className="px-4 py-3"><BadgeTipo tipo={p.tipo} /></td>
                      <td className="px-4 py-3"><BadgeEstado estado={p.estado} /></td>
                      <td className="px-4 py-3" style={{ color: '#666' }}>{formatDate(p.created_at)}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <Link href={`/epcista/proyectos/${p.id}`} className="font-semibold text-xs underline">Ver detalle</Link>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${p.id}-detail`} style={{ borderTop: '1px solid #CFCFCF' }}>
                        <td colSpan={5} className="px-6 py-4" style={{ backgroundColor: '#f5f5f0' }}>
                          <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
                            {p.cliente_final_empresa && (
                              <div>
                                <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>Empresa</div>
                                <div className="font-medium">{p.cliente_final_empresa}</div>
                              </div>
                            )}
                            {p.cliente_final_nombre && (
                              <div>
                                <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>Contacto</div>
                                <div className="font-medium">{p.cliente_final_nombre}</div>
                              </div>
                            )}
                            {p.ubicacion_estado && (
                              <div>
                                <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>Estado</div>
                                <div className="font-medium flex items-center gap-1">
                                  <MapPin size={11} style={{ color: '#888' }} />
                                  {p.ubicacion_estado}
                                </div>
                              </div>
                            )}
                            {p.tipo_instalacion && (
                              <div>
                                <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>Instalación</div>
                                <div className="font-medium">{p.tipo_instalacion === 'nodo_busca' ? 'Nodo busca instalador' : 'EPCista instala'}</div>
                              </div>
                            )}
                            {p.capex_estimado != null && (
                              <div>
                                <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>CAPEX estimado</div>
                                <div className="font-medium">{p.moneda} {p.capex_estimado.toLocaleString('es-MX')}</div>
                              </div>
                            )}
                            {modalidades.length > 0 && (
                              <div>
                                <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>Financiamiento</div>
                                <div className="font-medium">
                                  {noSabe ? 'Analista define' : modalidades.map(m => MODALIDAD_LABELS[m] ?? m).join(', ')}
                                </div>
                              </div>
                            )}
                            {p.incluye_mem && (
                              <div>
                                <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>MEM</div>
                                <div className="font-medium">Alternativa solicitada</div>
                              </div>
                            )}
                            {p.notas_adicionales && (
                              <div className="col-span-3">
                                <div className="text-xs font-medium mb-0.5" style={{ color: '#888' }}>Notas</div>
                                <div className="text-sm whitespace-pre-wrap">{p.notas_adicionales}</div>
                              </div>
                            )}
                          </div>
                          <div className="mt-3 pt-3 flex justify-end" style={{ borderTop: '1px solid #CFCFCF' }}>
                            <Link href={`/epcista/proyectos/${p.id}`}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
                              style={{ backgroundColor: '#000', color: '#D7FF2F' }}>
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
