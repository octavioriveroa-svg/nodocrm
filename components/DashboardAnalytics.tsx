'use client'

import type { DashboardData } from '@/lib/dashboard-data'
import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Folder, DollarSign, Zap, Target, Clock, Activity, Users, BarChart3, AlertTriangle, Map, PieChart } from 'lucide-react'
import { TimePeriodButtons, filterProjects, computePipeline, computeFinancial, type TimePeriod } from './TimePeriodSelector'

import { fmtNum, fmtCurrency, fmtCompact, fmtPct } from '@/lib/format'

function Trend({ current, previous, suffix = '' }: { current: number; previous: number; suffix?: string }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-gray-400">—</span>
  const diff = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus
  const color = diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'
  return <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${color}`}><Icon size={12} />{Math.abs(diff)}%{suffix}</span>
}

// Escala de marca: salvia → menta → lima → petróleo (tokens en globals.css @theme)
const STAGE_COLORS: Record<string, string> = {
  recibido: 'var(--color-etapa-1)', en_analisis: 'var(--color-etapa-2)', propuesta_lista: 'var(--color-etapa-3)', enviada: 'var(--color-etapa-4)',
  cliente_interesado: 'var(--color-etapa-5)', negociacion: 'var(--color-etapa-6)', aprobado: 'var(--color-etapa-7)',
  en_construccion: 'var(--color-etapa-7)', operativo: 'var(--color-etapa-4)', completado: 'var(--color-etapa-final)',
}

const FINANCING_LABELS: Record<string, string> = {
  credito: 'Crédito', arrendamiento: 'Arrendamiento', ensaas: 'ENSaaS', mem: 'MEM', no_sabe: 'No definido',
}

// ─── Section wrapper ───
function Section({ title, icon: Icon, children, id }: { title: string; icon: React.ElementType; children: React.ReactNode; id: string }) {
  return (
    <div id={id} className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-principal"><Icon size={14} className="text-acento" /></div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default function DashboardAnalytics({ data }: { data: DashboardData }) {
  const [staleThreshold, setStaleThreshold] = useState(30)
  const [pipelinePeriod, setPipelinePeriod] = useState<TimePeriod>('all')
  const [financialPeriod, setFinancialPeriod] = useState<TimePeriod>('last_year')
  const { kpis, technical, activity, epcLeaderboard, stalePipeline, financingMix, techMix, geoCAPEX } = data
  const filteredStale = stalePipeline.filter(s => s.daysInStage >= staleThreshold)

  const filteredPipeline = useMemo(() => {
    const fp = filterProjects(data.rawProjects, pipelinePeriod)
    return computePipeline(fp)
  }, [data.rawProjects, pipelinePeriod])

  const filteredFinancial = useMemo(() => {
    const fp = filterProjects(data.rawProjects, financialPeriod)
    return computeFinancial(fp, data.rawProducts, data.rawFinancingOptions)
  }, [data.rawProjects, data.rawProducts, data.rawFinancingOptions, financialPeriod])

  return (
    <div>
      {/* ═══ KPI BAR ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Proyectos', value: kpis.totalProjects, icon: Folder, color: 'bg-acento/20 text-principal' },
          { label: 'Pipeline activo', value: fmtCurrency(kpis.activePipelineCapex, 'MXN'), icon: DollarSign, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Capacidad instalada', value: `${fmtCompact(kpis.installedCapacityKwp)} kWp`, icon: Zap, color: 'bg-amber-50 text-amber-600' },
          { label: 'Tasa de cierre', value: fmtPct(kpis.winRate, 0), icon: Target, color: 'bg-blue-50 text-blue-600' },
          { label: 'Días hasta cierre', value: kpis.avgDaysToClose ?? '—', icon: Clock, color: 'bg-purple-50 text-purple-600' },
          { label: 'Días hasta instalar', value: kpis.avgDaysToInstall ?? '—', icon: Activity, color: 'bg-teal-50 text-teal-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-5 group hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div>
                <div className="num text-2xl font-black tracking-tight">{value}</div>
                <div className="text-xs mt-1.5 text-gray-500">{label}</div>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}><Icon size={16} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ PIPELINE ═══ */}
      <Section title="Pipeline de ventas" icon={BarChart3} id="pipeline">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-gray-500">Periodo:</span>
          <TimePeriodButtons value={pipelinePeriod} onChange={setPipelinePeriod} />
        </div>
        {/* Projects by stage - bar chart */}
        <div className="glass-card p-6 mb-4">
          <h3 className="text-sm font-bold mb-1">Proyectos por etapa</h3>
          <p className="text-[11px] text-gray-400 mb-4">{filteredPipeline.total} proyectos · Tasa de cierre: {fmtPct(filteredPipeline.winRate, 0)}</p>
          <div className="space-y-2.5">
            {Object.entries(filteredPipeline.byStage).map(([stage, count]) => {
              const maxCount = Math.max(...Object.values(filteredPipeline.byStage), 1)
              const pct = (count / maxCount) * 100
              return (
                <div key={stage} className="flex items-center gap-3">
                  <div className="w-32 text-xs font-medium text-gray-600 text-right shrink-0 truncate">
                    {filteredPipeline.funnel.find(f => f.stage === stage)?.label ?? stage}
                  </div>
                  <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden relative">
                    <div className="h-full rounded-md transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: STAGE_COLORS[stage] || 'var(--color-linea)' }} />
                    {count > 0 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-700">{count}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Conversion funnel */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold mb-4">Embudo de conversión</h3>
            <div className="space-y-1.5">
              {filteredPipeline.funnel.map((f, i) => (
                <div key={f.stage} className="flex items-center gap-2">
                  <div className="w-28 text-[11px] font-medium text-gray-500 text-right shrink-0 truncate">{f.label}</div>
                  <div className="flex-1 h-6 bg-gray-50 rounded overflow-hidden relative">
                    <div className="h-full rounded transition-all duration-700" style={{
                      width: `${Math.max(f.pct, 3)}%`,
                      backgroundColor: STAGE_COLORS[f.stage] || 'var(--color-linea)',
                      opacity: 0.6 + (i < 5 ? 0.4 : 0.4 * ((10 - i) / 10)),
                    }} />
                    <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-gray-700">
                      {f.pct}% ({f.count})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Velocity */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold mb-4">Velocidad del pipeline</h3>
            <div className="space-y-2">
              {filteredPipeline.velocity.filter(s => s.avgDays !== null).map(s => (
                <div key={s.from} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div className="text-[11px] text-gray-600">
                    <span className="font-medium">{s.fromLabel}</span>
                    <span className="mx-1 text-gray-300">→</span>
                    <span className="font-medium">{s.toLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black">{s.avgDays}d</span>
                    <span className="text-[10px] text-gray-400">({s.count})</span>
                  </div>
                </div>
              ))}
              {filteredPipeline.velocity.every(s => s.avgDays === null) && (
                <p className="text-xs text-gray-400 text-center py-4">Sin datos de transiciones en este periodo</p>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ FINANCIAL ═══ */}
      <Section title="Rendimiento financiero" icon={DollarSign} id="financial">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-gray-500">Periodo:</span>
          <TimePeriodButtons value={financialPeriod} onChange={setFinancialPeriod} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'CAPEX total', value: fmtCurrency(filteredFinancial.totalCapex, 'MXN') },
            { label: 'CAPEX FV', value: fmtCurrency(filteredFinancial.fvCapex, 'MXN') },
            { label: 'CAPEX BESS', value: fmtCurrency(filteredFinancial.bessCapex, 'MXN') },
            { label: 'CAPEX prom/proyecto', value: fmtCurrency(filteredFinancial.avgCapexPerProject, 'MXN') },
          ].map(s => (
            <div key={s.label} className="glass-card p-5">
              <div className="num text-xl font-black">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <div className="num text-xl font-black">{fmtCurrency(filteredFinancial.totalSavingsMonthly, 'MXN')}</div>
            <div className="text-xs text-gray-500 mt-1">Ahorro mensual estimado</div>
          </div>
          <div className="glass-card p-5">
            <div className="num text-xl font-black">{filteredFinancial.avgPaybackMonths ? `${fmtNum(filteredFinancial.avgPaybackMonths, 1)} meses` : '—'}</div>
            <div className="text-xs text-gray-500 mt-1">Payback promedio</div>
          </div>
          <div className="glass-card p-5">
            <div className="num text-xl font-black">{filteredFinancial.totalSavingsMonthly > 0 && filteredFinancial.totalCapex > 0 ? fmtPct(((filteredFinancial.totalSavingsMonthly * 12 * 25) / filteredFinancial.totalCapex * 100), 0) : '—'}</div>
            <div className="text-xs text-gray-500 mt-1">ROI proyectado (25 años)</div>
          </div>
        </div>
      </Section>

      {/* ═══ TECHNICAL ═══ */}
      <Section title="Rendimiento técnico" icon={Zap} id="technical">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-5"><div className="num text-xl font-black">{technical.operativeProjects}</div><div className="text-xs text-gray-500 mt-1">Proyectos operativos</div></div>
          <div className="glass-card p-5"><div className="num text-xl font-black">{fmtCompact(technical.totalSolarKwh)} kWh</div><div className="text-xs text-gray-500 mt-1">Producción solar total</div></div>
          <div className="glass-card p-5"><div className="num text-xl font-black">{fmtCompact(technical.totalGridKwh)} kWh</div><div className="text-xs text-gray-500 mt-1">Consumo de red</div></div>
          <div className="glass-card p-5"><div className="num text-xl font-black">{fmtCompact(technical.totalBatteryDischargeKwh)} kWh</div><div className="text-xs text-gray-500 mt-1">Descarga batería</div></div>
        </div>
        {technical.constructionProjects.length > 0 && (
          <div className="glass-card p-6 mt-4">
            <h3 className="text-sm font-bold mb-3">Proyectos en construcción</h3>
            <div className="space-y-3">
              {technical.constructionProjects.map(cp => {
                const pct = cp.totalHitos > 0 ? Math.round((cp.completedHitos / cp.totalHitos) * 100) : 0
                return (
                  <div key={cp.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{cp.nombre}</span>
                      <span className="text-[11px] font-bold">{pct}%{cp.delayedHitos > 0 && <span className="text-red-500 ml-1">({cp.delayedHitos} retrasado{cp.delayedHitos > 1 ? 's' : ''})</span>}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cp.delayedHitos > 0 ? 'var(--color-alerta)' : 'var(--color-exito)' }} /></div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Section>

      {/* ═══ ACTIVITY ═══ */}
      <Section title="Actividad de la plataforma" icon={Activity} id="activity">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          {[
            { label: 'Proyectos nuevos', current: activity.newProjectsThisMonth, previous: activity.newProjectsLastMonth },
            { label: 'Documentos subidos', current: activity.docsThisMonth, previous: activity.docsLastMonth },
            { label: 'Comentarios', current: activity.commentsThisMonth, previous: activity.commentsLastMonth },
            { label: 'Usuarios nuevos', current: activity.newUsersThisMonth, previous: activity.newUsersLastMonth },
            { label: 'Clientes nuevos', current: activity.newClientsThisMonth, previous: activity.newClientsLastMonth },
          ].map(m => (
            <div key={m.label} className="glass-card p-5">
              <div className="flex items-end justify-between">
                <div className="num text-2xl font-black">{m.current}</div>
                <Trend current={m.current} previous={m.previous} />
              </div>
              <div className="text-xs text-gray-500 mt-1">{m.label} <span className="text-gray-300">este mes</span></div>
            </div>
          ))}
        </div>

        {/* EPC Leaderboard */}
        {epcLeaderboard.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-3 border-b border-borde"><h3 className="text-sm font-bold flex items-center gap-2"><Users size={14} /> Top EPCistas</h3></div>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-borde text-xs text-gray-400 uppercase">
                <th className="text-left px-5 py-2.5 font-semibold">EPCista</th>
                <th className="text-left px-5 py-2.5 font-semibold">Empresa</th>
                <th className="text-right px-5 py-2.5 font-semibold">Proyectos</th>
                <th className="text-right px-5 py-2.5 font-semibold">CAPEX</th>
                <th className="text-right px-5 py-2.5 font-semibold">Cerrados</th>
              </tr></thead>
              <tbody>{epcLeaderboard.map((ep, i) => (
                <tr key={ep.id} className={`border-t border-borde/50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-5 py-3 font-medium">{ep.nombre}</td>
                  <td className="px-5 py-3 text-gray-500">{ep.empresa}</td>
                  <td className="px-5 py-3 text-right font-bold">{ep.totalProjects}</td>
                  <td className="px-5 py-3 text-right">{fmtCurrency(ep.totalCapex, 'MXN')}</td>
                  <td className="px-5 py-3 text-right"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">{ep.closedProjects}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ═══ STALE PIPELINE ═══ */}
      <Section title="Proyectos estancados" icon={AlertTriangle} id="stale">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500">Mostrar proyectos con más de:</span>
          {[15, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setStaleThreshold(d)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${staleThreshold === d ? 'bg-principal text-acento border-principal' : 'bg-white text-gray-500 border-borde hover:bg-gray-50'}`}>
              {d}d
            </button>
          ))}
        </div>
        {filteredStale.length === 0 ? (
          <div className="glass-card p-8 text-center text-gray-400 text-sm">¡Sin proyectos estancados! 🎉</div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-borde text-xs text-gray-400 uppercase">
                <th className="text-left px-5 py-2.5 font-semibold">Proyecto</th>
                <th className="text-left px-5 py-2.5 font-semibold">Etapa</th>
                <th className="text-left px-5 py-2.5 font-semibold">EPCista</th>
                <th className="text-right px-5 py-2.5 font-semibold">Días estancado</th>
              </tr></thead>
              <tbody>{filteredStale.map((s, i) => (
                <tr key={s.id} className={`border-t border-borde/50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-5 py-3 font-medium">{s.nombre}</td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: STAGE_COLORS[s.estado] || 'var(--color-linea)' }}>{s.estadoLabel}</span></td>
                  <td className="px-5 py-3 text-gray-500">{s.epcistaNombre}</td>
                  <td className="px-5 py-3 text-right"><span className={`font-black ${s.daysInStage >= 60 ? 'text-red-600' : s.daysInStage >= 30 ? 'text-amber-600' : 'text-gray-600'}`}>{s.daysInStage}d</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ═══ BREAKDOWNS ═══ */}
      <Section title="Desglose del portafolio" icon={PieChart} id="breakdown">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tech mix */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold mb-4">Por tecnología</h3>
            <div className="space-y-2">
              {Object.entries(techMix).sort((a, b) => b[1] - a[1]).map(([tipo, count]) => (
                <div key={tipo} className="flex items-center justify-between">
                  <span className="text-xs font-medium">{tipo}</span>
                  <span className="text-xs font-black bg-gray-100 px-2 py-0.5 rounded">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Financing mix */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold mb-4">Por financiamiento</h3>
            <div className="space-y-2">
              {Object.entries(financingMix).sort((a, b) => b[1] - a[1]).map(([mod, count]) => (
                <div key={mod} className="flex items-center justify-between">
                  <span className="text-xs font-medium">{FINANCING_LABELS[mod] || mod}</span>
                  <span className="text-xs font-black bg-gray-100 px-2 py-0.5 rounded">{count}</span>
                </div>
              ))}
              {Object.keys(financingMix).length === 0 && <p className="text-xs text-gray-400">Sin datos</p>}
            </div>
          </div>

          {/* Geo CAPEX */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-1"><Map size={13} /> CAPEX por estado</h3>
            <div className="space-y-2">
              {Object.entries(geoCAPEX).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([state, capex]) => (
                <div key={state} className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate max-w-[120px]">{state}</span>
                  <span className="text-xs font-black">{fmtCurrency(capex, 'MXN')}</span>
                </div>
              ))}
              {Object.entries(geoCAPEX).every(([, v]) => v === 0) && <p className="text-xs text-gray-400">Sin datos</p>}
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
