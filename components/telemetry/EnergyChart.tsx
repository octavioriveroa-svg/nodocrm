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
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorConsumo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorDescarga" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 12 }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 12 }} 
          />
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
          <Area 
            type="monotone" 
            dataKey="Solar" 
            stroke="#F59E0B" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorSolar)" 
            animationDuration={1500}
          />
          <Area 
            type="monotone" 
            dataKey="Descarga" 
            name="Descarga Batería"
            stroke="#10B981" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorDescarga)" 
            animationDuration={1500}
          />
          <Area 
            type="monotone" 
            dataKey="Consumo" 
            name="Consumo Red"
            stroke="#EF4444" 
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
