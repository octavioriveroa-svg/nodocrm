'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import EnergyChart from '@/components/telemetry/EnergyChart'
import BatteryStatus from '@/components/telemetry/BatteryStatus'
import { fmtNum, fmtCurrency } from '@/lib/format'
import GanttChart from '@/components/gantt/GanttChart'
import { calculateProjectSavingsMxn } from '@/lib/tariffs/cfe-calculator'
import type { HitoConstruccion, ConfiguracionTecnica } from '@/lib/types'
import { MapPin, Zap, CalendarDays } from 'lucide-react'

interface TelemetriaDB {
  timestamp: string
  solar_produccion_kwh: number
  consumo_red_kwh: number
  bateria_porcentaje: number
  bateria_descarga_kwh: number
}

interface ProyectoInfo {
  id: string
  nombre_proyecto: string
  ubicacion_estado: string
  estado: string
  configuraciones_tecnicas?: Pick<
    ConfiguracionTecnica,
    'ahorro_estimado_anual' | 'ahorro_estimado_mensual' | 'ahorro_moneda' | 'seleccionada'
  >[]
}

export default function ClienteDashboard() {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<ProyectoInfo[]>([])
  const [activeProyectoId, setActiveProyectoId] = useState<string | null>(null)

  const [telemetry, setTelemetry] = useState<TelemetriaDB[]>([])
  const [hitos, setHitos] = useState<HitoConstruccion[]>([])
  const [metrics, setMetrics] = useState({ totalGenerated: 0, savingsMxn: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      // 1. Resolve profile.cliente_crm_id (proyectos.cliente_id references clientes.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('cliente_crm_id')
        .eq('id', session.user.id)
        .single()

      if (!profile?.cliente_crm_id) {
        setLoading(false)
        return
      }

      // 2. Fetch real projects assigned to this CRM client entity
      const { data: projs } = await supabase
        .from('proyectos')
        .select(
          'id, nombre_proyecto, ubicacion_estado, estado, configuraciones_tecnicas(ahorro_estimado_anual, ahorro_estimado_mensual, ahorro_moneda, seleccionada)'
        )
        .eq('cliente_id', profile.cliente_crm_id)
        .order('created_at', { ascending: false })

      if (projs && projs.length > 0) {
        setProyectos(projs as unknown as ProyectoInfo[])
        setActiveProyectoId(projs[0].id)
      } else {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeProyectoId) return

    async function loadData() {
      setLoading(true)

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: teleData, error } = await supabase
        .from('telemetria_egauge')
        .select('timestamp, solar_produccion_kwh, consumo_red_kwh, bateria_porcentaje, bateria_descarga_kwh')
        .eq('proyecto_id', activeProyectoId)
        .gte('timestamp', thirtyDaysAgo)
        .order('timestamp', { ascending: true })
        .limit(2000)

      const activeProj = proyectos.find(p => p.id === activeProyectoId)
      const selectedConfig =
        activeProj?.configuraciones_tecnicas?.find(c => c.seleccionada) ??
        activeProj?.configuraciones_tecnicas?.[0] ??
        null

      if (teleData) {
        setTelemetry(teleData)
        const totalGenerated = teleData.reduce((acc, row) => acc + (row.solar_produccion_kwh || 0), 0)
        const savingsMxn = calculateProjectSavingsMxn({
          totalGeneratedKwh: totalGenerated,
          selectedConfig,
        })
        setMetrics({ totalGenerated, savingsMxn })
      } else if (error) {
        console.error('Error fetching telemetry:', error)
      }

      const { data: hitosData } = await supabase
        .from('hitos_construccion')
        .select('*')
        .eq('proyecto_id', activeProyectoId)
        .order('orden', { ascending: true })

      if (hitosData) {
        setHitos(hitosData)
      }

      setLoading(false)
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProyectoId])

  if (loading && proyectos.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
      </div>
    )
  }

  const currentBattery = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null
  const isCharging = currentBattery ? currentBattery.solar_produccion_kwh > currentBattery.consumo_red_kwh : false

  const chartData = telemetry.map(t => ({
    timestamp: t.timestamp,
    solarProductionKwh: t.solar_produccion_kwh,
    gridConsumptionKwh: t.consumo_red_kwh,
    batteryChargePct: t.bateria_porcentaje,
    batteryDischargeKwh: t.bateria_descarga_kwh,
  }))

  const activeProjectInfo = proyectos.find(p => p.id === activeProyectoId)

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black mb-2 tracking-tight text-principal">Mi Portal de Cliente</h1>
          <p className="text-gray-500">Monitoreo en tiempo real de tus sistemas de generación y seguimiento de construcción.</p>
        </div>
        {proyectos.length > 1 && (
          <select
            value={activeProyectoId || ''}
            onChange={e => setActiveProyectoId(e.target.value)}
            className="px-4 py-2 border border-borde rounded-lg text-sm font-bold shadow-sm bg-white"
          >
            {proyectos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre_proyecto}</option>
            ))}
          </select>
        )}
      </div>

      {proyectos.length === 0 ? (
        <div className="py-20 text-center glass-panel border-dashed border-white/50 rounded-2xl bg-white">
          <Zap size={32} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-bold text-gray-600 mb-1">Sin Proyectos Asignados</h3>
          <p className="text-gray-500 text-sm">Aún no tienes proyectos vinculados a tu cuenta.</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-50 border border-borde p-4 rounded-xl flex items-center gap-6">
            <div className="flex items-center gap-2 text-principal font-bold">
              <Zap size={18} className="text-acento" />
              {activeProjectInfo?.nombre_proyecto}
            </div>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <MapPin size={16} /> Ubicación: {activeProjectInfo?.ubicacion_estado || 'N/A'}
            </div>
            <div className="flex items-center gap-2 text-sm ml-auto">
              {activeProjectInfo?.estado === 'operativo' ? (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              ) : (
                <span className="h-3 w-3 rounded-full bg-blue-500"></span>
              )}
              <span className="font-semibold text-gray-700 capitalize">{activeProjectInfo?.estado.replace('_', ' ')}</span>
            </div>
          </div>

          {activeProjectInfo?.estado === 'operativo' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6 shadow-sm flex flex-col justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Generación Medida</h2>
                  <p className="text-4xl font-black text-principal">
                    {fmtNum(metrics.totalGenerated, 1)} <span className="text-lg font-medium text-gray-400">kWh</span>
                  </p>
                </div>
                <div className="glass-card p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Ahorro Estimado Diario</h2>
                  <p className="text-4xl font-black text-green-500">
                    {fmtCurrency(metrics.savingsMxn, 'MXN')} <span className="text-lg font-medium text-gray-400">MXN</span>
                  </p>
                </div>
              </div>

              {telemetry.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <EnergyChart data={chartData} />
                  </div>
                  <div className="lg:col-span-1">
                    <BatteryStatus
                      chargePct={currentBattery?.bateria_porcentaje ?? 0}
                      isCharging={isCharging}
                    />
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500 glass-card">
                  Aún no hay datos de telemetría registrados para este proyecto.
                </div>
              )}
            </>
          ) : (
            <div className="glass-card p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-principal">Avance de Construcción</h3>
                  <p className="text-sm text-gray-500">Sigue en tiempo real el progreso de instalación de tu sistema.</p>
                </div>
              </div>

              {hitos.length > 0 ? (
                <GanttChart hitos={hitos} readOnly={true} />
              ) : (
                <div className="py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  El EPCista aún no ha definido el cronograma de obra.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
