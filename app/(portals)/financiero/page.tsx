'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Activity, DollarSign, Briefcase } from 'lucide-react'

interface PortfolioMetrics {
  activeProjectsCount: number
  totalGeneratedKwh: number
  estimatedSavingsMxn: number
  batteryCycles: number
}

export default function FinancieroDashboard() {
  const supabase = createClient()
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPortfolioData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // 1. Fetch all projects assigned to this financier
      const { data: projs, error: pErr } = await supabase
        .from('proyectos')
        .select('id')
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
        .select('solar_produccion_kwh')
        .in('proyecto_id', projectIds)

      if (tErr) console.error(tErr)

      const totalGenerated = teleData ? teleData.reduce((acc, row) => acc + row.solar_produccion_kwh, 0) : 0
      
      setMetrics({
        activeProjectsCount: projs.length,
        totalGeneratedKwh: totalGenerated,
        estimatedSavingsMxn: totalGenerated * 3.9, // Aggregate estimated savings
        batteryCycles: Math.floor(totalGenerated / 100) // Rough estimation of cycles based on energy
      })

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

          <div className="p-8 glass-card shadow-sm">
            <h3 className="text-lg font-bold text-principal mb-4">Desglose de Proyectos</h3>
            <p className="text-sm text-gray-500 mb-4">
              Listado de activos individuales operando bajo tu portafolio de inversión.
            </p>
            {/* Future list of individual projects can go here */}
          </div>
        </>
      )}
    </div>
  )
}
