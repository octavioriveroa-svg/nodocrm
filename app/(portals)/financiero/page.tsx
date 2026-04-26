'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Activity, DollarSign, Briefcase, ChevronRight } from 'lucide-react'
import EnergyChart from '@/components/telemetry/EnergyChart'
import Link from 'next/link'

interface PortfolioMetrics {
  activeProjectsCount: number
  totalGeneratedKwh: number
  estimatedSavingsMxn: number
  batteryCycles: number
}

interface ProjectMetric {
  id: string
  nombre_proyecto: string
  cliente_final_empresa: string
  capex_estimado: number | null
  estado: string
  totalGeneratedKwh: number
  estimatedSavingsMxn: number
}

export default function FinancieroDashboard() {
  const supabase = createClient()
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [projectMetrics, setProjectMetrics] = useState<ProjectMetric[]>([])
  const [chartData, setChartData] = useState<{timestamp: string, solarProductionKwh: number, gridConsumptionKwh: number, batteryDischargeKwh: number, batteryChargePct: number}[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPortfolioData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // 1. Fetch all projects assigned to this financier
      const { data: projs, error: pErr } = await supabase
        .from('proyectos')
        .select('id, nombre_proyecto, cliente_final_empresa, capex_estimado, estado')
        .eq('financiero_id', session.user.id)
      
      if (pErr) {
        console.error(pErr)
        setLoading(false)
        return
      }

      if (!projs || projs.length === 0) {
        setMetrics({ activeProjectsCount: 0, totalGeneratedKwh: 0, estimatedSavingsMxn: 0, batteryCycles: 0 })
        setLoading(false)
        return
      }

      const projectIds = projs.map(p => p.id)

      // 2. Fetch all telemetry for these projects to aggregate
      const { data: teleData, error: tErr } = await supabase
        .from('telemetria_egauge')
        .select('*')
        .in('proyecto_id', projectIds)
        .order('timestamp', { ascending: true })

      if (tErr) console.error(tErr)

      const totalGenerated = teleData ? teleData.reduce((acc, row) => acc + (row.solar_produccion_kwh || 0), 0) : 0
      
      setMetrics({
        activeProjectsCount: projs.length,
        totalGeneratedKwh: totalGenerated,
        estimatedSavingsMxn: totalGenerated * 3.9, // Aggregate estimated savings
        batteryCycles: Math.floor(totalGenerated / 100) // Rough estimation of cycles based on energy
      })

      // Aggregate chart data by timestamp across portfolio
      const timeMap = new Map<string, { solarProductionKwh: number, gridConsumptionKwh: number, batteryDischargeKwh: number, batteryChargePctSum: number, count: number }>()

      if (teleData) {
        teleData.forEach(t => {
          const key = t.timestamp
          const exist = timeMap.get(key) || { solarProductionKwh: 0, gridConsumptionKwh: 0, batteryDischargeKwh: 0, batteryChargePctSum: 0, count: 0 }
          
          exist.solarProductionKwh += t.solar_produccion_kwh || 0
          exist.gridConsumptionKwh += t.consumo_red_kwh || 0
          exist.batteryDischargeKwh += t.bateria_descarga_kwh || 0
          exist.batteryChargePctSum += t.bateria_porcentaje || 0
          exist.count += 1
          
          timeMap.set(key, exist)
        })
      }

      const cData = Array.from(timeMap.entries()).map(([timestamp, data]) => ({
        timestamp,
        solarProductionKwh: data.solarProductionKwh,
        gridConsumptionKwh: data.gridConsumptionKwh,
        batteryDischargeKwh: data.batteryDischargeKwh,
        batteryChargePct: data.count > 0 ? Math.round(data.batteryChargePctSum / data.count) : 0
      })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      
      setChartData(cData)

      // Calculate project breakdown
      const pMetrics = projs.map(p => {
        const pTele = teleData?.filter(t => t.proyecto_id === p.id) || []
        const pGen = pTele.reduce((acc, row) => acc + (row.solar_produccion_kwh || 0), 0)
        return {
          id: p.id,
          nombre_proyecto: p.nombre_proyecto,
          cliente_final_empresa: p.cliente_final_empresa,
          capex_estimado: p.capex_estimado,
          estado: p.estado,
          totalGeneratedKwh: pGen,
          estimatedSavingsMxn: pGen * 3.9
        }
      })

      setProjectMetrics(pMetrics)
      setLoading(false)
    }

    loadPortfolioData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black mb-2 tracking-tight text-principal">Portafolio Financiero</h1>
          <p className="text-gray-500">Métricas agregadas y rendimiento real de todos los activos financiados.</p>
        </div>
        <div className="bg-acento/20 text-principal px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
          <Briefcase size={16} /> {metrics?.activeProjectsCount} Proyectos en Portafolio
        </div>
      </div>
      
      {metrics?.activeProjectsCount === 0 ? (
        <div className="py-20 text-center glass-panel border-dashed border-white/50 rounded-2xl bg-white">
          <Briefcase size={32} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-bold text-gray-600 mb-1">Sin Activos Asignados</h3>
          <p className="text-gray-500 text-sm">Aún no tienes proyectos operativos en tu portafolio de inversión.</p>
        </div>
      ) : (
        <>
          {/* Portfolio Aggregates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-4">
                <TrendingUp size={24} />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-1">Generación Global (24h)</h2>
              <p className="text-3xl font-black text-principal">
                {metrics?.totalGeneratedKwh.toLocaleString('es-MX', { maximumFractionDigits: 1 })} <span className="text-sm font-medium text-gray-400">kWh</span>
              </p>
            </div>

            <div className="glass-card p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-500 mb-4">
                <DollarSign size={24} />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-1">Retorno Estimado (24h)</h2>
              <p className="text-3xl font-black text-green-600">
                ${metrics?.estimatedSavingsMxn.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-medium text-gray-400">MXN</span>
              </p>
            </div>

            <div className="glass-card p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 mb-4">
                <Activity size={24} />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-1">Ciclos de Batería (Est.)</h2>
              <p className="text-3xl font-black text-principal">
                {metrics?.batteryCycles.toLocaleString('es-MX')} <span className="text-sm font-medium text-gray-400">ciclos</span>
              </p>
            </div>
          </div>

          {/* Aggregate Telemetry Chart */}
          {chartData.length > 0 && (
            <div className="mt-8">
              <EnergyChart data={chartData} />
            </div>
          )}

          {/* Breakdown Table */}
          <div className="p-8 glass-card shadow-sm mt-8">
            <h3 className="text-lg font-bold text-principal mb-4">Desglose de Proyectos</h3>
            <p className="text-sm text-gray-500 mb-6">
              Listado de activos individuales operando bajo tu portafolio de inversión.
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-borde/50 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                    <th className="py-3 px-4">Proyecto</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">CAPEX</th>
                    <th className="py-3 px-4">Generado</th>
                    <th className="py-3 px-4">Retorno Est.</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {projectMetrics.map(p => (
                    <tr key={p.id} className="border-b border-borde/50 hover:bg-black/5 transition-colors group">
                      <td className="py-4 px-4 font-bold text-principal">{p.nombre_proyecto}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">{p.cliente_final_empresa}</td>
                      <td className="py-4 px-4 font-mono text-sm">
                        ${(p.capex_estimado || 0).toLocaleString('es-MX')}
                      </td>
                      <td className="py-4 px-4 font-mono text-sm">
                        {p.totalGeneratedKwh.toLocaleString('es-MX', { maximumFractionDigits: 1 })} kWh
                      </td>
                      <td className="py-4 px-4 font-mono text-sm text-green-600 font-medium">
                        ${p.estimatedSavingsMxn.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${p.estado === 'operativo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {p.estado.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Link href={`/financiero/proyectos/${p.id}`} className="text-gray-400 hover:text-acento transition-colors flex items-center justify-end">
                          <span className="text-sm font-medium mr-1 opacity-0 group-hover:opacity-100 transition-opacity">Ver</span>
                          <ChevronRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
