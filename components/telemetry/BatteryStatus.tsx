'use client'

import { Battery, BatteryCharging, Zap } from 'lucide-react'

interface BatteryStatusProps {
  chargePct: number
  isCharging: boolean
}

export default function BatteryStatus({ chargePct, isCharging }: BatteryStatusProps) {
  // Determine color based on charge percentage
  let textColor = 'text-green-500'
  
  if (chargePct <= 20) {
    textColor = 'text-red-500'
  } else if (chargePct <= 50) {
    textColor = 'text-yellow-500'
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-borde flex flex-col justify-between h-full">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-principal">Estado Batería</h3>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            {isCharging ? (
              <><Zap size={14} className="text-acento" /> Cargando (Exceso Solar)</>
            ) : (
              'Descargando o en Reposo'
            )}
          </p>
        </div>
        <div className={`p-3 rounded-xl bg-opacity-10 ${isCharging ? 'bg-acento text-principal' : 'bg-gray-100 text-gray-600'}`}>
          {isCharging ? <BatteryCharging size={24} /> : <Battery size={24} />}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1">
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Outer circle track */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              className="text-gray-100"
            />
            {/* Inner progress circle */}
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={58 * 2 * Math.PI}
              strokeDashoffset={58 * 2 * Math.PI * (1 - chargePct / 100)}
              className={`${textColor} transition-all duration-1000 ease-out`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-principal tracking-tighter">
              {chargePct.toFixed(0)}<span className="text-xl">%</span>
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-6 flex justify-between text-sm">
        <span className="text-gray-500">Salud del Sistema</span>
        <span className="font-bold text-green-500">Óptima (100%)</span>
      </div>
    </div>
  )
}
