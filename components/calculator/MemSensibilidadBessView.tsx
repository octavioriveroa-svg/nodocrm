'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, Award, Download, Sliders } from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  MemAnnualAssumptions,
  MemCriticalHourEntry,
  MemHourlyDataset,
  MemSensitivitySweepConfig,
  MemSimulatorInputs,
  Moneda,
  VistaFinanciamiento,
} from '@/lib/types'
import { DEFAULT_MEM_SENSITIVITY_CONFIG } from '@/lib/calculator/datasets/mem-baseline'
import {
  computeBessDurationHours,
  runMemBessSensitivity,
  type MemFinancingTerms,
} from '@/lib/calculator/mem-hourly-engine'
import {
  buildMemSensitivityCsv,
  downloadCsvContent,
} from '@/lib/calculator/csv-export'
import { fmtCurrency, fmtCurrencyCompact, fmtNum, fmtPct, formatNumberInput, parseNum } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

export interface MemSensibilidadBessViewProps {
  inputs: MemSimulatorInputs
  assumptions: MemAnnualAssumptions
  hourly: MemHourlyDataset
  criticalHours100HC: readonly MemCriticalHourEntry[]
  moneda: Moneda
  vistaFinanciamiento: VistaFinanciamiento
  financingTerms: MemFinancingTerms
  onApplyBessSize: (potenciaMw: number, capacidadMwh: number) => void
}

interface SensitivityTooltipItem {
  name?: string
  value?: number
  dataKey?: string
  color?: string
}

function SensitivityTooltip({
  active,
  payload,
  label,
  moneda,
}: {
  active?: boolean
  payload?: SensitivityTooltipItem[]
  label?: string
  moneda: Moneda
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white/95 backdrop-blur-md border border-linea rounded-xl px-3.5 py-2.5 shadow-lg text-xs">
      <p className="font-bold text-principal mb-1">{label}</p>
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={p.dataKey ?? i} className="flex items-center justify-between gap-4">
            <span className="text-texto-suave">{p.name}</span>
            <span className="num font-bold text-principal">
              {p.dataKey === 'tir_pct'
                ? p.value != null
                  ? fmtPct(p.value, 2)
                  : 'N/A'
                : fmtCurrency(p.value ?? 0, moneda)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MemSensibilidadBessView({
  inputs,
  assumptions,
  hourly,
  criticalHours100HC,
  moneda,
  vistaFinanciamiento,
  financingTerms,
  onApplyBessSize,
}: MemSensibilidadBessViewProps) {
  const [config, setConfig] = useState<MemSensitivitySweepConfig>({
    ...DEFAULT_MEM_SENSITIVITY_CONFIG,
  })
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const suite = useMemo(
    () =>
      runMemBessSensitivity(inputs, assumptions, hourly, criticalHours100HC, config, {
        moneda,
        vistaFinanciamiento,
        financing: financingTerms,
      }),
    [
      inputs,
      assumptions,
      hourly,
      criticalHours100HC,
      config,
      moneda,
      vistaFinanciamiento,
      financingTerms,
    ],
  )

  const chartData = useMemo(
    () =>
      suite.cases.map((c, idx) => ({
        etiqueta: `${fmtNum(c.bess_potencia_mw, 1)} MW / ${fmtNum(c.bess_capacidad_mwh, 1)} MWh`,
        shortLabel: `${fmtNum(c.bess_potencia_mw, 1)} MW`,
        vpn: c.vpn,
        tir_pct: c.tir_pct ?? 0,
        isOptimal: idx === suite.bestVpnCaseIndex,
      })),
    [suite.cases, suite.bestVpnCaseIndex],
  )

  function handleNumChange(
    key: keyof MemSensitivitySweepConfig,
    raw: string,
    isInteger = false,
  ) {
    const formatted = formatNumberInput(raw)
    setDrafts((prev) => ({ ...prev, [key]: formatted }))
    const parsed = parseNum(formatted)
    if (parsed !== null && Number.isFinite(parsed)) {
      const val = isInteger ? Math.max(1, Math.min(20, Math.round(parsed))) : Math.max(0, parsed)
      setConfig((prev) => ({ ...prev, [key]: val }))
    }
  }

  function handleExportCsv() {
    const csv = buildMemSensitivityCsv(suite.cases, suite.currentInputCase, {
      moneda,
      cliente: inputs.cliente,
    })
    downloadCsvContent(csv, `sensibilidad-bess-${moneda.toLowerCase()}.csv`)
  }

  const allRows = [suite.currentInputCase, ...suite.cases]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-principal">
            Sensibilidad de Tamaño BESS (Barrido 1–20 casos · FV constante en {fmtNum(inputs.fv_potencia_mw, 2)} MW)
          </h4>
          <p className="text-xs text-texto-suave">
            Compara el Input actual frente a una escalera de tamaños BESS manteniendo constante la relación MWh/MW.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="default" className="num">
            {fmtNum(suite.elapsedMs, 1)} ms
          </Badge>
          <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
            <Download size={14} />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Sweep Controls */}
      <div className="bg-white border border-borde rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-principal">
            Duración fija (h)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={
              'duracion_fija_h' in drafts
                ? drafts.duracion_fija_h
                : String(config.duracion_fija_h)
            }
            onChange={(e) => handleNumChange('duracion_fija_h', e.target.value)}
            onBlur={() =>
              setDrafts((p) => {
                const n = { ...p }
                delete n.duracion_fija_h
                return n
              })
            }
            className="num w-full rounded-lg border border-borde bg-fondo/50 px-2.5 py-1.5 text-xs font-bold text-principal"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-principal">
            Potencia inicial (MW)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={
              'potencia_inicial_mw' in drafts
                ? drafts.potencia_inicial_mw
                : String(config.potencia_inicial_mw)
            }
            onChange={(e) => handleNumChange('potencia_inicial_mw', e.target.value)}
            onBlur={() =>
              setDrafts((p) => {
                const n = { ...p }
                delete n.potencia_inicial_mw
                return n
              })
            }
            className="num w-full rounded-lg border border-borde bg-fondo/50 px-2.5 py-1.5 text-xs font-bold text-principal"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-principal">
            Incremento (MW)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={
              'incremento_mw' in drafts ? drafts.incremento_mw : String(config.incremento_mw)
            }
            onChange={(e) => handleNumChange('incremento_mw', e.target.value)}
            onBlur={() =>
              setDrafts((p) => {
                const n = { ...p }
                delete n.incremento_mw
                return n
              })
            }
            className="num w-full rounded-lg border border-borde bg-fondo/50 px-2.5 py-1.5 text-xs font-bold text-principal"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-principal">
            Número de casos (1–20)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={'num_casos' in drafts ? drafts.num_casos : String(config.num_casos)}
            onChange={(e) => handleNumChange('num_casos', e.target.value, true)}
            onBlur={() =>
              setDrafts((p) => {
                const n = { ...p }
                delete n.num_casos
                return n
              })
            }
            className="num w-full rounded-lg border border-borde bg-fondo/50 px-2.5 py-1.5 text-xs font-bold text-principal"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const curDur = computeBessDurationHours(
              inputs.bess_potencia_mw,
              inputs.bess_capacidad_mwh,
            )
            if (curDur > 0) {
              setDrafts({})
              setConfig((prev) => ({
                ...prev,
                duracion_fija_h: Math.round(curDur * 100) / 100,
              }))
            }
          }}
        >
          <Sliders size={13} />
          Usar h de Input
        </Button>
      </div>

      {/* VPN + TIR Chart */}
      <div className="bg-white border border-borde rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h5 className="text-sm font-bold text-principal">
              Curva de Valor Presente Neto (VPN) y TIR por tamaño BESS
            </h5>
            <p className="text-xs text-texto-suave">
              La barra resaltada en lima marca el máximo VPN del barrido.
            </p>
          </div>
          {suite.bestVpnCaseIndex >= 0 && (
            <Badge variant="success">
              <Award size={12} className="mr-1" />
              Óptimo VPN: {fmtNum(suite.cases[suite.bestVpnCaseIndex].bess_potencia_mw, 1)} MW /{' '}
              {fmtNum(suite.cases[suite.bestVpnCaseIndex].bess_capacidad_mwh, 1)} MWh (
              {fmtCurrencyCompact(suite.cases[suite.bestVpnCaseIndex].vpn, moneda)})
            </Badge>
          )}
        </div>

        <div className="w-full h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 12, right: 16, left: 6, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-linea)" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fill: 'var(--color-texto-suave)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="vpn"
                tick={{ fill: 'var(--color-texto-suave)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={74}
                tickFormatter={(v: number) => fmtCurrencyCompact(v, moneda)}
              />
              <YAxis
                yAxisId="tir"
                orientation="right"
                tick={{ fill: 'var(--color-texto-suave)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v: number) => `${fmtNum(v, 0)}%`}
              />
              <Tooltip content={<SensitivityTooltip moneda={moneda} />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
              <ReferenceLine yAxisId="vpn" y={0} stroke="var(--color-linea)" />
              <Bar yAxisId="vpn" dataKey="vpn" name={`VPN (${moneda})`} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.etiqueta}
                    fill={entry.isOptimal ? 'var(--color-acento)' : 'var(--color-principal)'}
                  />
                ))}
              </Bar>
              <Line
                yAxisId="tir"
                type="monotone"
                dataKey="tir_pct"
                name="TIR (%)"
                stroke="var(--color-menta)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--color-menta)' }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 13-Column Sensitivity Table */}
      <div className="bg-white border border-borde rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-principal text-white">
                <th className="text-left px-3 py-2.5 font-bold whitespace-nowrap">Caso</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Pot (MW)</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Cap (MWh)</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Ahorro E.</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Ahorro Pot.</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Ahorro Y1</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Red. RAP</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Ciclos/a</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">CAPEX</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">OPEX Y1</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">VPN</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">TIR</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">PB Simple</th>
                <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">PB Desc.</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {allRows.map((row, idx) => {
                const isBest = !row.isCurrentInput && idx - 1 === suite.bestVpnCaseIndex
                const sameAsCurrent =
                  !row.isCurrentInput &&
                  Math.abs(row.bess_potencia_mw - inputs.bess_potencia_mw) < 1e-6 &&
                  Math.abs(row.bess_capacidad_mwh - inputs.bess_capacidad_mwh) < 1e-6

                return (
                  <tr
                    key={String(row.caso)}
                    className={
                      row.isCurrentInput
                        ? 'bg-acento/15 font-semibold'
                        : isBest
                          ? 'bg-menta/10 font-semibold'
                          : 'hover:bg-fondo/50'
                    }
                  >
                    <td className="num px-3 py-2 font-bold text-principal whitespace-nowrap">
                      {row.isCurrentInput ? (
                        <Badge variant="info">Input actual</Badge>
                      ) : isBest ? (
                        <Badge variant="success">Caso {row.caso} ★</Badge>
                      ) : (
                        `Caso ${row.caso}`
                      )}
                    </td>
                    <td className="num px-2.5 py-2 text-right">{fmtNum(row.bess_potencia_mw, 2)}</td>
                    <td className="num px-2.5 py-2 text-right">{fmtNum(row.bess_capacidad_mwh, 2)}</td>
                    <td className="num px-2.5 py-2 text-right whitespace-nowrap">
                      {fmtCurrencyCompact(row.ahorro_energia_y1, moneda)}
                    </td>
                    <td className="num px-2.5 py-2 text-right whitespace-nowrap">
                      {fmtCurrencyCompact(row.ahorro_potencia_y1, moneda)}
                    </td>
                    <td className="num px-2.5 py-2 text-right font-bold text-principal whitespace-nowrap">
                      {fmtCurrencyCompact(row.ahorro_total_y1, moneda)}
                    </td>
                    <td className="num px-2.5 py-2 text-right">{fmtNum(row.rap_reduccion_mw, 3)} MW</td>
                    <td className="num px-2.5 py-2 text-right">{fmtNum(row.ciclos_anio, 1)}</td>
                    <td className="num px-2.5 py-2 text-right whitespace-nowrap">
                      {fmtCurrencyCompact(row.capex, moneda)}
                    </td>
                    <td className="num px-2.5 py-2 text-right whitespace-nowrap">
                      {fmtCurrencyCompact(row.opex_y1, moneda)}
                    </td>
                    <td
                      className={`num px-2.5 py-2 text-right font-extrabold whitespace-nowrap ${
                        row.vpn < 0 ? 'text-red-600' : 'text-menta'
                      }`}
                    >
                      {fmtCurrencyCompact(row.vpn, moneda)}
                    </td>
                    <td className="num px-2.5 py-2 text-right font-semibold">
                      {row.tir_pct !== null ? fmtPct(row.tir_pct, 2) : 'N/A'}
                    </td>
                    <td className="num px-2.5 py-2 text-right">
                      {row.payback_simple_anios !== null ? `${fmtNum(row.payback_simple_anios, 2)}a` : '—'}
                    </td>
                    <td className="num px-2.5 py-2 text-right">
                      {row.payback_descontado_anios !== null ? `${fmtNum(row.payback_descontado_anios, 2)}a` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {row.isCurrentInput || sameAsCurrent ? (
                        <span className="text-[10px] font-bold text-principal">Activo</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onApplyBessSize(row.bess_potencia_mw, row.bess_capacidad_mwh)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-principal text-acento hover:opacity-90 text-[10px] font-bold"
                        >
                          Aplicar
                          <ArrowUpRight size={11} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default MemSensibilidadBessView
