'use client'

import React, { useMemo } from 'react'
import type { HitoConstruccion } from '@/lib/types'
import { Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

interface GanttChartProps {
  hitos: HitoConstruccion[]
  onHitoClick?: (hito: HitoConstruccion) => void
  readOnly?: boolean
}

// Utilidad para diferencia de semanas
const getWeeksBetween = (d1: Date, d2: Date) => {
  return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 7)))
}

export default function GanttChart({ hitos, onHitoClick, readOnly = true }: GanttChartProps) {
  const sortedHitos = [...hitos].sort((a, b) => a.orden - b.orden)

  // Calcular la fecha de inicio y fin globales para el eje X
  const { globalStart, globalEnd } = useMemo(() => {
    let minDate = new Date()
    let maxDate = new Date()
    minDate.setFullYear(minDate.getFullYear() + 10)
    maxDate.setFullYear(maxDate.getFullYear() - 10)

    let hasDates = false

    sortedHitos.forEach(h => {
      const s = h.fecha_estimada_inicio ? new Date(h.fecha_estimada_inicio) : null
      const e = h.fecha_estimada_fin ? new Date(h.fecha_estimada_fin) : null
      const rs = h.fecha_real_inicio ? new Date(h.fecha_real_inicio) : null
      const re = h.fecha_real_fin ? new Date(h.fecha_real_fin) : null

      const dates = [s, e, rs, re].filter(Boolean) as Date[]
      dates.forEach(d => {
        hasDates = true
        if (d < minDate) minDate = d
        if (d > maxDate) maxDate = d
      })
    })

    if (!hasDates) {
      minDate = new Date()
      maxDate = new Date()
      maxDate.setMonth(maxDate.getMonth() + 4) // Default 4 months
    }

    // Acolchonar una semana al inicio y al final
    minDate.setDate(minDate.getDate() - minDate.getDay()) // Iniciar en domingo
    maxDate.setDate(maxDate.getDate() + (6 - maxDate.getDay())) // Terminar en sábado
    maxDate.setDate(maxDate.getDate() + 7)

    return { globalStart: minDate, globalEnd: maxDate }
     
  }, [sortedHitos])

  const totalWeeks = getWeeksBetween(globalStart, globalEnd)

  const getPercentage = (date: string | null) => {
    if (!date) return null
    const d = new Date(date)
    return ((d.getTime() - globalStart.getTime()) / (globalEnd.getTime() - globalStart.getTime())) * 100
  }

  const getStatusColor = (estado: string) => {
    switch(estado) {
      case 'completado': return 'bg-principal text-acento'
      case 'en_progreso': return 'bg-acento text-principal border border-principal/10'
      case 'retrasado': return 'bg-red-500 text-white'
      default: return 'bg-gray-100 text-gray-500 border border-gray-200'
    }
  }

  const getStatusIcon = (estado: string) => {
    switch(estado) {
      case 'completado': return <CheckCircle2 size={14} className="text-acento" />
      case 'en_progreso': return <Clock size={14} className="text-principal" />
      case 'retrasado': return <AlertCircle size={14} className="text-white" />
      default: return <Calendar size={14} className="text-gray-400" />
    }
  }

  if (sortedHitos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-borde rounded-xl bg-gray-50/50">
        <Calendar size={32} className="text-gray-300 mb-4" />
        <p className="text-gray-500 text-sm font-medium">No hay hitos de construcción definidos.</p>
        {!readOnly && (
          <p className="text-gray-400 text-xs mt-1">Usa el botón superior para generar el cronograma.</p>
        )}
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[800px] border border-borde rounded-xl bg-white overflow-hidden shadow-sm">
        
        {/* Cabecera (Timeline de Semanas) */}
        <div className="flex border-b border-borde bg-gray-50">
          <div className="w-64 flex-shrink-0 border-r border-borde px-4 py-3 flex items-center bg-white z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Hito de Construcción</span>
          </div>
          <div className="flex-1 relative h-10 flex">
            {Array.from({ length: totalWeeks }).map((_, i) => (
              <div key={i} className="flex-1 border-r border-borde border-dashed flex items-center justify-center">
                <span className="text-[10px] font-semibold text-gray-400">Sem {i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filas de Hitos */}
        <div className="relative">
          {/* Líneas de cuadrícula de fondo */}
          <div className="absolute top-0 bottom-0 left-64 right-0 flex pointer-events-none">
            {Array.from({ length: totalWeeks }).map((_, i) => (
              <div key={i} className="flex-1 border-r border-borde/50 border-dashed h-full" />
            ))}
          </div>

          <div className="relative z-10 flex flex-col">
            {sortedHitos.map((hito) => {
              const startPct = getPercentage(hito.fecha_estimada_inicio)
              const endPct = getPercentage(hito.fecha_estimada_fin)
              const hasEstimates = startPct !== null && endPct !== null
              const width = hasEstimates ? Math.max(endPct - startPct, 2) : 0 // min 2% width

              const realStartPct = getPercentage(hito.fecha_real_inicio)
              const realEndPct = getPercentage(hito.fecha_real_fin)
              const hasReals = realStartPct !== null

              return (
                <div 
                  key={hito.id} 
                  onClick={() => !readOnly && onHitoClick && onHitoClick(hito)}
                  className={`flex border-b border-borde group ${!readOnly ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
                >
                  {/* Nombre del Hito */}
                  <div className="w-64 flex-shrink-0 border-r border-borde px-4 py-4 bg-white group-hover:bg-gray-50 transition-colors z-10">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(hito.estado)}
                      <h4 className="text-sm font-bold text-gray-900 truncate">{hito.nombre}</h4>
                    </div>
                    {hito.descripcion && (
                      <p className="text-xs text-gray-500 truncate ml-5">{hito.descripcion}</p>
                    )}
                  </div>

                  {/* Área del Gráfico */}
                  <div className="flex-1 relative py-4">
                    {/* Barra Estimada */}
                    {hasEstimates && (
                      <div 
                        className={`absolute h-6 rounded-md shadow-sm flex items-center px-2 overflow-hidden ${getStatusColor(hito.estado)}`}
                        style={{ 
                          left: `${startPct}%`, 
                          width: `${width}%`,
                          top: '50%',
                          transform: 'translateY(-50%)'
                        }}
                      >
                        <span className="text-[10px] font-bold truncate opacity-90 drop-shadow-sm w-full">
                          {hito.fecha_estimada_inicio && new Date(hito.fecha_estimada_inicio).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    )}

                    {/* Indicador Real (Si difiere o está en progreso) */}
                    {hasReals && (
                      <div 
                        className="absolute h-1.5 bg-principal rounded-full shadow-sm z-20"
                        style={{ 
                          left: `${realStartPct}%`, 
                          width: `${realEndPct ? Math.max(realEndPct - realStartPct, 1) : 2}%`,
                          top: '75%',
                        }}
                        title={`Real: ${hito.fecha_real_inicio} - ${hito.fecha_real_fin || '?'}`}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
