'use client'

import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, Zap } from 'lucide-react'
import type { GranularidadProyeccion, Moneda, PeriodoAgregadoSimulacion } from '@/lib/types'
import { fmtCurrency, fmtCurrencyCompact, fmtNum, fmtUnit } from '@/lib/format'

export interface ProyeccionesChartProps {
  rows: readonly PeriodoAgregadoSimulacion[]
  granularidad: GranularidadProyeccion
  moneda: Moneda
  paybackSimpleMeses?: number | null
}

type ChartTab = 'monetario' | 'energia'

interface TooltipPayloadEntry {
  name?: string
  value?: number
  color?: string
  dataKey?: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
  tab: ChartTab
  moneda: Moneda
}

function ChartTooltipContent({ active, payload, label, tab, moneda }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="bg-white/95 backdrop-blur-md border border-linea rounded-xl px-3.5 py-2.5 shadow-lg text-xs">
      <p className="font-bold text-principal mb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const val = typeof entry.value === 'number' ? entry.value : 0
          const formatted =
            tab === 'monetario' ? fmtCurrency(val, moneda) : fmtUnit(val, 'kWh', 0)
          return (
            <div key={entry.dataKey ?? idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-texto-suave">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color || 'var(--color-principal)' }}
                />
                {entry.name}
              </span>
              <span className="num font-bold text-principal">{formatted}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ProyeccionesChart({
  rows,
  granularidad,
  moneda,
  paybackSimpleMeses,
}: ProyeccionesChartProps) {
  const [tab, setTab] = useState<ChartTab>('monetario')

  const chartData = useMemo(() => rows.map((r) => ({ ...r })), [rows])

  const paybackEtiqueta = useMemo(() => {
    if (paybackSimpleMeses == null || paybackSimpleMeses <= 0 || chartData.length === 0) {
      return null
    }
    const targetPeriod =
      granularidad === 'mensual'
        ? Math.max(1, Math.ceil(paybackSimpleMeses))
        : granularidad === 'trimestral'
          ? Math.max(1, Math.ceil(paybackSimpleMeses / 3))
          : Math.max(1, Math.ceil(paybackSimpleMeses / 12))
    const match = chartData.find((r) => r.periodo === targetPeriod)
    return match?.etiqueta ?? null
  }, [chartData, granularidad, paybackSimpleMeses])

  const showBrush = chartData.length > 60
  const showDots = chartData.length <= 36

  if (chartData.length === 0) {
    return null
  }

  return (
    <div className="bg-white/80 backdrop-blur-md border border-borde rounded-2xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="text-sm font-bold text-principal">
            {tab === 'monetario'
              ? `Proyección de Flujo Monetario (${moneda})`
              : 'Proyección de Ahorro Energético (kWh)'}
          </h4>
          <p className="text-xs text-texto-suave mt-0.5">
            {tab === 'monetario'
              ? 'Ahorro bruto, flujo neto y acumulado con punto de retorno (Payback).'
              : 'Desglose de generación solar FV y energía desplazada BESS.'}
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-borde bg-fondo p-1 gap-1">
          <button
            type="button"
            onClick={() => setTab('monetario')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              tab === 'monetario'
                ? 'bg-principal text-acento shadow-sm'
                : 'text-texto-suave hover:text-principal'
            }`}
          >
            <BarChart3 size={13} />
            Flujo Monetario
          </button>
          <button
            type="button"
            onClick={() => setTab('energia')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              tab === 'energia'
                ? 'bg-principal text-acento shadow-sm'
                : 'text-texto-suave hover:text-principal'
            }`}
          >
            <Zap size={13} />
            Energía (kWh)
          </button>
        </div>
      </div>

      <div className="w-full h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          {tab === 'monetario' ? (
            <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-linea)" />
              <XAxis
                dataKey="etiqueta"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-texto-suave)', fontSize: 11 }}
                minTickGap={20}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={88}
                tick={{ fill: 'var(--color-texto-suave)', fontSize: 11 }}
                tickFormatter={(val: number) => fmtCurrencyCompact(val, moneda).replace(/ ([Mk])$/, '$1')}
              />
              <Tooltip content={<ChartTooltipContent tab="monetario" moneda={moneda} />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <ReferenceLine y={0} stroke="var(--color-texto-suave)" strokeDasharray="4 4" />
              {paybackEtiqueta && (
                <ReferenceLine
                  x={paybackEtiqueta}
                  stroke="var(--color-exito)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: 'Payback',
                    position: 'top',
                    fill: 'var(--color-exito)',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
              )}
              <Bar
                dataKey="ahorro_bruto"
                name="Ahorro Monetario Bruto"
                fill="var(--color-menta)"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
              />
              <Bar
                dataKey="flujo_neto"
                name="Flujo Neto"
                fill="var(--color-acento)"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="flujo_acumulado"
                name="Flujo Acumulado"
                stroke="var(--color-principal)"
                strokeWidth={2.5}
                dot={showDots ? { r: 3, fill: 'var(--color-principal)' } : false}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
              {showBrush && (
                <Brush
                  dataKey="etiqueta"
                  height={22}
                  stroke="var(--color-principal)"
                  endIndex={Math.min(chartData.length - 1, 59)}
                />
              )}
            </ComposedChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="simGradFv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-acento)" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="var(--color-acento)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="simGradBess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-menta)" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="var(--color-menta)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-linea)" />
              <XAxis
                dataKey="etiqueta"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-texto-suave)', fontSize: 11 }}
                minTickGap={20}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={88}
                tick={{ fill: 'var(--color-texto-suave)', fontSize: 11 }}
                tickFormatter={(val: number) => fmtNum(val, 0)}
              />
              <Tooltip content={<ChartTooltipContent tab="energia" moneda={moneda} />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area
                type="monotone"
                dataKey="energia_fv_kwh"
                name="Solar FV (kWh)"
                stackId="energia"
                stroke="var(--color-acento-hover)"
                strokeWidth={2}
                fill="url(#simGradFv)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="energia_bess_kwh"
                name="Energía BESS (kWh)"
                stackId="energia"
                stroke="var(--color-menta)"
                strokeWidth={2}
                fill="url(#simGradBess)"
                isAnimationActive={false}
              />
              {showBrush && (
                <Brush
                  dataKey="etiqueta"
                  height={22}
                  stroke="var(--color-principal)"
                  endIndex={Math.min(chartData.length - 1, 59)}
                />
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default ProyeccionesChart
