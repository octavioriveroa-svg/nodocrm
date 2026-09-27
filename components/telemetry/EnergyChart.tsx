'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TelemetryDataPoint } from '@/lib/egauge'

interface EnergyChartProps {
  data: TelemetryDataPoint[]
}

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export default function EnergyChart({ data }: EnergyChartProps) {
  // We need to pass clean data to recharts
  const chartData = data.map(d => ({
    time: formatTime(d.timestamp),
    Solar: d.solarProductionKwh,
    Consumo: d.gridConsumptionKwh,
    Descarga: d.batteryDischargeKwh
  }))

  return (
    <div className="w-full h-[400px] bg-white p-6 rounded-2xl shadow-sm border border-borde">
      <h3 className="text-lg font-bold text-principal mb-6">Generación vs Consumo Diario (kWh)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-amber-500)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--color-amber-500)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorConsumo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-red-500)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--color-red-500)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorDescarga" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-emerald-500)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--color-emerald-500)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--color-gray-400)', fontSize: 12 }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--color-gray-400)', fontSize: 12 }} 
          />
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-gray-200)" />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-gray-200)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
          <Area 
            type="monotone" 
            dataKey="Solar" 
            stroke="var(--color-amber-500)" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorSolar)" 
            animationDuration={1500}
          />
          <Area 
            type="monotone" 
            dataKey="Descarga" 
            name="Descarga Batería"
            stroke="var(--color-emerald-500)" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorDescarga)" 
            animationDuration={1500}
          />
          <Area 
            type="monotone" 
            dataKey="Consumo" 
            name="Consumo Red"
            stroke="var(--color-red-500)" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorConsumo)" 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
