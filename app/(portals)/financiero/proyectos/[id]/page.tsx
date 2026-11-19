'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import EnergyChart from '@/components/telemetry/EnergyChart'
import BatteryStatus from '@/components/telemetry/BatteryStatus'
import { SimuladorAhorrosSeccion } from '@/components/calculator/SimuladorAhorrosSeccion'
import { loadFullProjectSimulatorBundle } from '@/lib/calculator/load-context'
import { ChevronLeft, Zap, MapPin, Briefcase } from 'lucide-react'
import Link from 'next/link'
import type {
  CalculadoraTemplate,
  ConfigFinanciamiento,
  ConfiguracionTecnica,
  OfertaMem,
  OpcionFinanciamiento,
  Proyecto,
  ProyectoSitioProducto,
  Rol,
  SimulacionAhorro,
  Sitio,
} from '@/lib/types'
import { fmtNum, fmtCurrency } from '@/lib/format'
import { calculateProjectSavingsMxn } from '@/lib/tariffs/cfe-calculator'

interface TelemetriaDB {
  timestamp: string
  solar_produccion_kwh: number
  consumo_red_kwh: number
  bateria_porcentaje: number
  bateria_descarga_kwh: number
}

interface SimulatorBundle {
  sitios: Sitio[]
  productos: ProyectoSitioProducto[]
  configuraciones: ConfiguracionTecnica[]
  opcionesFinanciamiento: OpcionFinanciamiento[]
  configFinanciamientoLinks: ConfigFinanciamiento[]
  ofertasMem: OfertaMem[]
  activeTemplate: CalculadoraTemplate
  templatesById: Record<string, CalculadoraTemplate>
  initialSimulaciones: SimulacionAhorro[]
}

export default function FinancieroProyectoDetalle() {
  const { id } = useParams()
  const proyectoId = Array.isArray(id) ? id[0] : (id ?? '')
  const router = useRouter()
  const supabase = createClient()
  
  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [userRole, setUserRole] = useState<Rol>('financiero')
  const [simBundle, setSimBundle] = useState<SimulatorBundle | null>(null)
  const [telemetry, setTelemetry] = useState<TelemetriaDB[]>([])
  const [metrics, setMetrics] = useState({ totalGenerated: 0, savingsMxn: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!proyectoId) {
        setError('Proyecto no encontrado.')
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }
      setUserId(session.user.id)

      const [{ data: pData, error: pErr }, { data: profileRow }, { data: teleData }, simContext] =
        await Promise.all([
          supabase
            .from('proyectos')
            .select('*')
            .eq('id', proyectoId)
            .eq('financiero_id', session.user.id)
            .single(),
          supabase.from('profiles').select('rol').eq('id', session.user.id).single(),
          supabase
            .from('telemetria_egauge')
            .select('*')
            .eq('proyecto_id', proyectoId)
            .order('timestamp', { ascending: true }),
          loadFullProjectSimulatorBundle(supabase, proyectoId),
        ])
      
      if (pErr || !pData) {
        setError('Proyecto no encontrado o no autorizado.')
        setLoading(false)
        return
      }

      const typedProyecto = pData as Proyecto
      setProyecto(typedProyecto)
      if (profileRow?.rol) {
        setUserRole(profileRow.rol as Rol)
      }
      setSimBundle(simContext)
      
      if (teleData && teleData.length > 0) {
        setTelemetry(teleData)
        const totalGenerated = teleData.reduce((acc, row) => acc + (row.solar_produccion_kwh || 0), 0)
        const savingsMxn = calculateProjectSavingsMxn({
          totalGeneratedKwh: totalGenerated,
          tarifaCfe: typedProyecto.tarifa_actual_cfe,
        })
        setMetrics({ totalGenerated, savingsMxn })
      }

      setLoading(false)
    }

    loadData()
  }, [proyectoId, router, supabase])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error || !proyecto || !simBundle) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <h2 className="text-2xl font-bold mb-4">{error}</h2>
        <Link href="/financiero" className="text-blue-500 underline">Volver al portafolio</Link>
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
    batteryDischargeKwh: t.bateria_descarga_kwh
  }))

  const activeConfigId =
    simBundle.configuraciones.find((c) => c.seleccionada)?.id ??
    simBundle.configuraciones[0]?.id ??
    null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <Link href="/financiero" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-principal transition-colors mb-4">
          <ChevronLeft size={16} /> Volver al Portafolio
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black mb-1 tracking-tight text-principal">{proyecto.nombre_proyecto}</h1>
            <p className="text-gray-500 flex items-center gap-2">
              <Briefcase size={16} /> {proyecto.cliente_final_empresa}
            </p>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-bold uppercase ${proyecto.estado === 'operativo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
              {proyecto.estado.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">CAPEX Estimado</p>
          <p className="text-xl font-black text-principal">
            {fmtCurrency(proyecto.capex_estimado, proyecto.moneda || 'MXN')}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Generación Total</p>
          <p className="text-xl font-black text-principal">
            {fmtNum(metrics.totalGenerated, 1)} <span className="text-sm font-medium text-gray-500">kWh</span>
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Retorno (Ahorro)</p>
          <p className="text-xl font-black text-green-600">
            {fmtCurrency(metrics.savingsMxn, 'MXN')} <span className="text-sm font-medium text-green-600/70">MXN</span>
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Ubicación</p>
          <p className="text-sm font-medium text-principal flex items-center gap-1 mt-2">
            <MapPin size={16} className="text-gray-400" /> {proyecto.ubicacion_estado}
          </p>
        </div>
      </div>

      {proyecto.estado === 'operativo' && telemetry.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
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
        <div className="py-20 text-center glass-panel border-dashed border-gray-200 rounded-2xl bg-white mt-8">
          <Zap size={32} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-bold text-gray-600 mb-1">Sin Datos de Operación</h3>
          <p className="text-gray-500 text-sm">Este proyecto aún no transmite telemetría o no está operativo.</p>
        </div>
      )}

      <SimuladorAhorrosSeccion
        proyecto={proyecto}
        sitios={simBundle.sitios}
        productos={simBundle.productos}
        configuraciones={simBundle.configuraciones}
        opcionesFinanciamiento={simBundle.opcionesFinanciamiento}
        configFinanciamiento={simBundle.configFinanciamientoLinks}
        ofertasMem={simBundle.ofertasMem}
        activeTemplate={simBundle.activeTemplate}
        templatesById={simBundle.templatesById}
        initialSimulaciones={simBundle.initialSimulaciones}
        userRole={userRole}
        currentUserId={userId}
        activeConfigId={activeConfigId}
        readOnlyMode={false}
      />
    </div>
  )
}
