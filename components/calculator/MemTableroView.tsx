'use client'

import { useMemo } from 'react'
import {
  AlertTriangle,
  BatteryCharging,
  CalendarClock,
  CheckCircle2,
  Coins,
  Flame,
  Percent,
  Printer,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  MemFinancialEvaluation,
  MemSimulatorInputs,
  MemYear1Results,
  Moneda,
  VistaFinanciamiento,
} from '@/lib/types'
import { fmtCurrency, fmtCurrencyCompact, fmtNum, fmtPct } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

export interface MemTableroViewProps {
  inputs: MemSimulatorInputs
  year1: MemYear1Results
  financial: MemFinancialEvaluation
  datasetLabel: string
  solarZeroEnergy: boolean
  moneda: Moneda
  vistaFinanciamiento: VistaFinanciamiento
}

interface TooltipItem {
  name?: string
  value?: number
  color?: string
  dataKey?: string
}

function MemChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: TooltipItem[]
  label?: string | number
  formatter: (val: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white/95 backdrop-blur-md border border-linea rounded-xl px-3.5 py-2.5 shadow-lg text-xs">
      <p className="font-bold text-principal mb-1.5">{String(label ?? '')}</p>
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={entry.dataKey ?? idx} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-texto-suave">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || 'var(--color-principal)' }}
              />
              {entry.name}
            </span>
            <span className="num font-bold text-principal">
              {formatter(typeof entry.value === 'number' ? entry.value : 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MemTableroView({
  inputs,
  year1,
  financial,
  datasetLabel,
  solarZeroEnergy,
  moneda,
  vistaFinanciamiento,
}: MemTableroViewProps) {
  const fx = inputs.tc_mxn_usd > 0 ? inputs.tc_mxn_usd : 18.7
  const toDisplayCurrency = useMemo(
    () => (mxnVal: number) => (moneda === 'USD' ? mxnVal / fx : mxnVal),
    [moneda, fx],
  )

  // Chart 1 & Chart 2: 24h average profile (MW) + BESS average SOC (MWh)
  const hourlyChartData = useMemo(
    () =>
      year1.hourly_profile.map((p) => ({
        horaLabel: `${String(p.hora).padStart(2, '0')}h`,
        consumo_real_mw: p.consumo_real_mw,
        gen_fv_mw: p.gen_fv_mw,
        consumo_red_proy_mw: p.consumo_red_proy_mw,
        carga_bess_mw: p.carga_bess_mw,
        descarga_bess_mw: -p.descarga_bess_mw,
        soc_promedio_mwh: p.soc_promedio_mwh,
      })),
    [year1.hourly_profile],
  )

  // Chart 3: Monthly energy savings Year 1
  const monthlyChartData = useMemo(
    () =>
      year1.monthly_savings.map((m) => ({
        etiqueta: m.etiqueta,
        costo_base: toDisplayCurrency(m.costo_base_mxn),
        costo_proy: toDisplayCurrency(m.costo_proy_mxn),
        ahorro_energia: toDisplayCurrency(m.ahorro_energia_mxn),
      })),
    [year1.monthly_savings, toDisplayCurrency],
  )

  // Chart 4: Cashflows 0..25 (already in financial.moneda)
  const cashflowChartData = useMemo(
    () =>
      financial.rows.map((r) => ({
        anioLabel: `Año ${r.anio}`,
        flujo_neto: r.flujo_neto,
        flujo_acumulado: r.flujo_acumulado,
        flujo_descontado_acumulado: r.flujo_descontado_acumulado,
      })),
    [financial.rows],
  )

  // Chart 5: Savings share (Energy vs Capacity)
  const shareChartData = useMemo(() => {
    const ePct = Math.round(year1.res_pct_energia * 10000) / 100
    const cPct = Math.round(year1.res_pct_capacidad * 10000) / 100
    return [
      {
        name: 'Energía (PML)',
        pct: ePct,
        piePct: Math.max(0, ePct),
        monto: financial.ahorro_energia_y1,
        fillVar: 'var(--color-menta)',
      },
      {
        name: 'Potencia (100 HC)',
        pct: cPct,
        piePct: Math.max(0, cPct),
        monto: financial.ahorro_potencia_y1,
        fillVar: 'var(--color-principal)',
      },
    ]
  }, [year1.res_pct_energia, year1.res_pct_capacidad, financial.ahorro_energia_y1, financial.ahorro_potencia_y1])

  const positiveShareSlices = useMemo(
    () => shareChartData.filter((d) => d.piePct > 0),
    [shareChartData],
  )
  const hasNegativeShareSlice = shareChartData.some((d) => d.pct < 0)

  // Chart 6 (CRM value-add): Annual electricity bill Base vs Project
  const costCompareData = useMemo(
    () => [
      {
        concepto: 'Energía (PML)',
        sinProyecto: toDisplayCurrency(year1.res_costo_e_base_mxn),
        conProyecto: toDisplayCurrency(year1.res_costo_e_proy_mxn),
      },
      {
        concepto: 'Potencia (MBP)',
        sinProyecto: toDisplayCurrency(year1.res_costo_c_base_mxn),
        conProyecto: toDisplayCurrency(year1.res_costo_c_proy_mxn),
      },
      {
        concepto: 'Costo Total Año 1',
        sinProyecto: toDisplayCurrency(year1.res_costo_e_base_mxn + year1.res_costo_c_base_mxn),
        conProyecto: toDisplayCurrency(year1.res_costo_e_proy_mxn + year1.res_costo_c_proy_mxn),
      },
    ],
    [year1, toDisplayCurrency],
  )

  const socMinMwh = inputs.bess_capacidad_mwh * inputs.bess_soc_min_pct
  const socUpperDomain =
    inputs.bess_capacidad_mwh > 0
      ? Math.ceil(inputs.bess_capacidad_mwh * 1.1 * 10) / 10
      : undefined

  const baseBillTotal = toDisplayCurrency(
    year1.res_costo_e_base_mxn + year1.res_costo_c_base_mxn,
  )
  const proyBillTotal = toDisplayCurrency(
    year1.res_costo_e_proy_mxn + year1.res_costo_c_proy_mxn,
  )

  const paybackSimpleStr =
    financial.payback_simple_anios !== null
      ? `${fmtNum(financial.payback_simple_anios, 2)} años`
      : financial.payback_simple_estado === 'fuera_horizonte'
        ? `> ${inputs.fin_horizonte_anios} años`
        : 'N/A'

  const paybackDescStr =
    financial.payback_descontado_anios !== null
      ? `${fmtNum(financial.payback_descontado_anios, 2)} años`
      : financial.payback_descontado_estado === 'fuera_horizonte'
        ? `> ${inputs.fin_horizonte_anios} años`
        : 'N/A'

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="bg-principal text-white rounded-2xl p-5 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-acento text-principal uppercase tracking-wide">
              Tablero Ejecutivo MEM
            </span>
            <Badge variant="default" className="!bg-white/15 !text-white !border-white/20">
              {vistaFinanciamiento === 'neto'
                ? `Neto Financiado · ${financial.vehiculo_inversion}`
                : 'Bruto / Contado'}
            </Badge>
            <Badge variant="default" className="!bg-white/10 !text-white/90 !border-white/15">
              {datasetLabel}
            </Badge>
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
            {inputs.cliente || 'Proyecto MEM'} — FV {fmtNum(inputs.fv_potencia_mw, 2)} MW + BESS{' '}
            {fmtNum(inputs.bess_potencia_mw, 2)} MW / {fmtNum(inputs.bess_capacidad_mwh, 1)} MWh
          </h3>
          <p className="text-xs text-white/80">
            Demanda contratada:{' '}
            <strong className="num text-white">{fmtNum(inputs.demanda_contratada_mw, 2)} MW</strong> ·
            Duración BESS: <strong className="num text-white">{fmtNum(year1.bess_duracion_h, 2)} h</strong> ·
            Horizonte:{' '}
            <strong className="num text-white">{inputs.fin_horizonte_anios} años</strong> · TC:{' '}
            <strong className="num text-white">{fmtNum(inputs.tc_mxn_usd, 2)} MXN/USD</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="!bg-white/10 !text-white !border-white/25 hover:!bg-white/20"
          >
            <Printer size={14} />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Warning when FV MW > 0 yet loaded Curva Solar is all zero */}
      {inputs.fv_potencia_mw > 0 && solarZeroEnergy && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold">
              Potencia FV = {fmtNum(inputs.fv_potencia_mw, 2)} MWp configurada con Curva Solar en 0 MW
            </p>
            <p className="mt-0.5">
              La hoja base <code className="font-mono">Curva Solar</code> tiene 0 MWh/MW generados.
              Puedes cargar un perfil solar horario (.xlsx / .csv) en la pestaña{' '}
              <strong>Datos y 100 HC</strong> para simular autoconsumo directo y carga FV a BESS.
            </p>
          </div>
        </div>
      )}

      {/* KPI Group A — Operación y Ahorro Año 1 */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-principal">
            Grupo A · Operación y Ahorro Año 1 (8,760 h + 100 HC)
          </h4>
          <span className="text-[11px] text-texto-suave">Moneda: {moneda}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="glass-card p-4 border-l-4 border-l-menta">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>Ahorro Total Año 1</span>
              <Zap size={14} className="text-menta" />
            </div>
            <div className="num text-xl font-black text-principal">
              {fmtCurrency(financial.ahorro_total_y1, moneda)}
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              Energía {fmtPct(year1.res_pct_energia * 100, 1)} + Potencia {fmtPct(year1.res_pct_capacidad * 100, 1)}
            </p>
          </div>

          <div className="glass-card p-4 border-l-4 border-l-menta">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>Ahorro Energía (PML)</span>
              <Flame size={14} className="text-menta" />
            </div>
            <div className="num text-xl font-black text-principal">
              {fmtCurrency(financial.ahorro_energia_y1, moneda)}
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              Base <span className="num font-semibold">{fmtCurrencyCompact(toDisplayCurrency(year1.res_costo_e_base_mxn), moneda)}</span>{' '}
              → <span className="num font-semibold">{fmtCurrencyCompact(toDisplayCurrency(year1.res_costo_e_proy_mxn), moneda)}</span>
            </p>
          </div>

          <div className="glass-card p-4 border-l-4 border-l-principal">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>Ahorro Potencia (100HC)</span>
              <ShieldCheck size={14} className="text-principal" />
            </div>
            <div className="num text-xl font-black text-principal">
              {fmtCurrency(financial.ahorro_potencia_y1, moneda)}
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              Base <span className="num font-semibold">{fmtCurrencyCompact(toDisplayCurrency(year1.res_costo_c_base_mxn), moneda)}</span>{' '}
              → <span className="num font-semibold">{fmtCurrencyCompact(toDisplayCurrency(year1.res_costo_c_proy_mxn), moneda)}</span>
            </p>
          </div>

          <div className="glass-card p-4 border-l-4 border-l-acento">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>Reducción Costo Eléctrico</span>
              <Percent size={14} className="text-principal" />
            </div>
            <div className="num text-xl font-black text-principal">
              {fmtPct(year1.res_pct_reduccion * 100, 2)}
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              Factura <span className="num font-semibold">{fmtCurrencyCompact(baseBillTotal, moneda)}</span>{' '}
              → <span className="num font-semibold">{fmtCurrencyCompact(proyBillTotal, moneda)}</span>
            </p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>Reducción Demanda 100 HC (RAP)</span>
              <CheckCircle2 size={14} className="text-menta" />
            </div>
            <div className="num text-lg font-extrabold text-principal">
              {fmtNum(year1.res_rap_reduccion_mw, 3)} MW
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              RAP Base <span className="num font-semibold">{fmtNum(year1.res_rap_base_mw, 3)}</span> →{' '}
              <span className="num font-semibold">{fmtNum(year1.res_rap_proy_mw, 3)} MW</span>
            </p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>Descarga BESS Año 1</span>
              <BatteryCharging size={14} className="text-menta" />
            </div>
            <div className="num text-lg font-extrabold text-principal">
              {fmtNum(year1.res_descarga_mwh, 2)} MWh
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              Carga red: <span className="num font-semibold">{fmtNum(year1.res_carga_red_mwh, 2)} MWh</span>
              {year1.res_fv_a_bess_mwh > 0 && (
                <> · FV→BESS: <span className="num font-semibold">{fmtNum(year1.res_fv_a_bess_mwh, 2)} MWh</span></>
              )}
            </p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>Ciclos Equivalentes / Año</span>
              <BatteryCharging size={14} className="text-principal" />
            </div>
            <div className="num text-lg font-extrabold text-principal">
              {fmtNum(year1.res_ciclos, 2)} ciclos
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              Capacidad nominal: <span className="num font-semibold">{fmtNum(inputs.bess_capacidad_mwh, 1)} MWh</span>
            </p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>Consumo Red c/ Proyecto</span>
              <Zap size={14} className="text-texto-suave" />
            </div>
            <div className="num text-lg font-extrabold text-principal">
              {fmtNum(year1.res_consumo_red_mwh, 2)} MWh
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              Sin proyecto: <span className="num font-semibold">{fmtNum(year1.res_consumo_mwh, 2)} MWh</span>
              {year1.res_gen_fv_mwh > 0 && (
                <> · Gen FV: <span className="num font-semibold">{fmtNum(year1.res_gen_fv_mwh, 1)} MWh</span></>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Group B — Evaluación Financiera */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-principal">
            Grupo B · Evaluación Financiera ({inputs.fin_horizonte_anios} años)
          </h4>
          <span className="text-[11px] text-texto-suave">
            {vistaFinanciamiento === 'neto' ? 'Incluye servicio de deuda' : 'Flujos de proyecto sin apalancamiento'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>CAPEX Total</span>
              <Coins size={14} className="text-principal" />
            </div>
            <div className="num text-xl font-black text-principal">
              {fmtCurrency(financial.capex_total, moneda)}
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              {moneda === 'MXN'
                ? `USD eq: ${fmtCurrency(financial.capex_total_usd, 'USD')}`
                : `MXN eq: ${fmtCurrency(financial.capex_total_mxn, 'MXN')}`}
              {vistaFinanciamiento === 'neto' && (
                <> · Desembolso: <span className="num font-semibold">{fmtCurrencyCompact(financial.desembolso_inicial, moneda)}</span></>
              )}
            </p>
          </div>

          <div className="glass-card p-4 border-l-4 border-l-menta">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>VPN (Tasa {fmtPct(inputs.fin_tasa_descuento_pct * 100, 1)})</span>
              <TrendingUp size={14} className="text-menta" />
            </div>
            <div className={`num text-xl font-black ${financial.vpn >= 0 ? 'text-menta' : 'text-red-600'}`}>
              {fmtCurrency(financial.vpn, moneda)}
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              Flujo neto acum.: <span className="num font-semibold">{fmtCurrencyCompact(financial.flujo_neto_total - financial.desembolso_inicial, moneda)}</span>
            </p>
          </div>

          <div className="glass-card p-4 border-l-4 border-l-acento">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>TIR</span>
              <TrendingUp size={14} className="text-principal" />
            </div>
            <div className="num text-xl font-black text-principal">
              {financial.tir_pct !== null ? fmtPct(financial.tir_pct, 2) : 'N/A'}
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              Sobre horizonte de {inputs.fin_horizonte_anios} años
            </p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>Recuperación (Payback)</span>
              <CalendarClock size={14} className="text-principal" />
            </div>
            <div className="num text-lg font-extrabold text-principal">
              {paybackSimpleStr}
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              Descontada: <span className="num font-semibold text-principal">{paybackDescStr}</span>
            </p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>ROI s/ CAPEX</span>
              <Percent size={14} className="text-menta" />
            </div>
            <div className="num text-lg font-extrabold text-principal">
              {financial.roi_pct !== null ? fmtPct(financial.roi_pct, 1) : 'N/A'}
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              {vistaFinanciamiento === 'neto' && financial.roi_desembolso_pct !== null
                ? `Cash-on-Cash: ${fmtPct(financial.roi_desembolso_pct, 1)}`
                : `Ahorro total horizonte: ${fmtCurrencyCompact(financial.ahorro_total_horizonte, moneda)}`}
            </p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between text-texto-suave text-[11px] font-bold uppercase mb-1">
              <span>OPEX Año 1</span>
              <Coins size={14} className="text-texto-suave" />
            </div>
            <div className="num text-lg font-extrabold text-principal">
              {fmtCurrency(financial.opex_y1, moneda)}
            </div>
            <p className="text-[11px] text-texto-suave mt-1">
              Escalamiento anual: <span className="num font-semibold">{fmtPct(inputs.fin_esc_opex_pct * 100, 1)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 6 Tablero Charts Grid (5 Excel Tablero Charts + 1 Value-Add Cost Comparison) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Chart 1: Perfil horario promedio (24h) */}
        <div className="bg-white border border-borde rounded-2xl p-5 shadow-sm xl:col-span-2">
          <div className="mb-3">
            <h5 className="text-sm font-bold text-principal">
              1. Perfil horario promedio (24 horas)
            </h5>
            <p className="text-xs text-texto-suave">
              Consumo base, consumo red proyecto, generación FV y despacho BESS (MW promedio anual).
            </p>
          </div>
          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hourlyChartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-linea)" />
                <XAxis
                  dataKey="horaLabel"
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => `${fmtNum(v, 1)}`}
                />
                <Tooltip content={<MemChartTooltip formatter={(v) => `${fmtNum(v, 2)} MW`} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <ReferenceLine y={0} stroke="var(--color-linea)" />
                <Bar
                  dataKey="carga_bess_mw"
                  name="Carga BESS (+MW)"
                  fill="var(--color-etapa-1)"
                  isAnimationActive={false}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="descarga_bess_mw"
                  name="Descarga BESS (-MW)"
                  fill="var(--color-menta)"
                  isAnimationActive={false}
                  radius={[0, 0, 3, 3]}
                />
                <Area
                  type="monotone"
                  dataKey="gen_fv_mw"
                  name="Generación FV (MW)"
                  fill="var(--color-acento)"
                  fillOpacity={0.25}
                  stroke="var(--color-acento)"
                  strokeWidth={1.8}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="consumo_real_mw"
                  name="Consumo real (MW)"
                  stroke="var(--color-texto-suave)"
                  strokeDasharray="4 3"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="consumo_red_proy_mw"
                  name="Red con proyecto (MW)"
                  stroke="var(--color-principal)"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Estado de carga promedio del BESS por hora (horas 1–24, MWh) */}
        <div className="bg-white border border-borde rounded-2xl p-5 shadow-sm">
          <div className="mb-3">
            <h5 className="text-sm font-bold text-principal">
              2. Estado de carga promedio del BESS por hora (horas 1–24, MWh)
            </h5>
            <p className="text-xs text-texto-suave">
              {inputs.bess_capacidad_mwh > 0
                ? `MWh almacenados promedio por hora · Rango operativo: ${fmtNum(socMinMwh, 2)}–${fmtNum(inputs.bess_capacidad_mwh, 1)} MWh.`
                : 'Sin capacidad BESS configurada (0.0 MWh).'}
            </p>
          </div>
          <div className="w-full h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyChartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="memSocGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-menta)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--color-menta)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-linea)" />
                <XAxis
                  dataKey="horaLabel"
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={12}
                />
                <YAxis
                  domain={socUpperDomain ? [0, socUpperDomain] : [0, 1]}
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  tickFormatter={(v: number) => `${fmtNum(v, 1)}`}
                />
                <Tooltip content={<MemChartTooltip formatter={(v) => `${fmtNum(v, 2)} MWh`} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                {inputs.bess_capacidad_mwh > 0 && (
                  <ReferenceLine
                    y={inputs.bess_capacidad_mwh}
                    stroke="var(--color-principal)"
                    strokeDasharray="4 4"
                    label={{
                      value: `Cap. ${fmtNum(inputs.bess_capacidad_mwh, 1)} MWh`,
                      position: 'insideTopRight',
                      fill: 'var(--color-principal)',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                )}
                {inputs.bess_capacidad_mwh > 0 && socMinMwh > 0 && (
                  <ReferenceLine
                    y={socMinMwh}
                    stroke="var(--color-alerta)"
                    strokeDasharray="3 3"
                    label={{
                      value: `SOC mín. ${fmtNum(socMinMwh, 2)} MWh`,
                      position: 'insideBottomRight',
                      fill: 'var(--color-alerta)',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="soc_promedio_mwh"
                  name="SOC promedio BESS (MWh)"
                  stroke="var(--color-menta)"
                  strokeWidth={2.5}
                  fill="url(#memSocGradient)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Ahorro energético mensual Año 1 */}
        <div className="bg-white border border-borde rounded-2xl p-5 shadow-sm">
          <div className="mb-3">
            <h5 className="text-sm font-bold text-principal">
              3. Ahorro energético mensual Año 1 ({moneda})
            </h5>
            <p className="text-xs text-texto-suave">
              Arbitraje y autoconsumo mes a mes contra PML horario CENACE.
            </p>
          </div>
          <div className="w-full h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-linea)" />
                <XAxis
                  dataKey="etiqueta"
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                  tickFormatter={(v: number) => fmtCurrencyCompact(v, moneda)}
                />
                <Tooltip content={<MemChartTooltip formatter={(v) => fmtCurrency(v, moneda)} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <ReferenceLine y={0} stroke="var(--color-linea)" />
                <Bar
                  dataKey="ahorro_energia"
                  name="Ahorro Energía"
                  fill="var(--color-menta)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Flujos anuales y flujo acumulado (Años 0–25) */}
        <div className="bg-white border border-borde rounded-2xl p-5 shadow-sm xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h5 className="text-sm font-bold text-principal">
                4. Flujos anuales y flujo acumulado (Años 0–25 · {moneda})
              </h5>
              <p className="text-xs text-texto-suave">
                Flujo neto anual, flujo acumulado simple y flujo descontado acumulado sobre todo el ciclo de vida.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-fondo/80 border border-linea text-principal font-semibold">
                Payback simple: <strong className="num">{paybackSimpleStr}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-fondo/80 border border-linea text-principal font-semibold">
                Payback desc.: <strong className="num">{paybackDescStr}</strong>
              </span>
            </div>
          </div>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cashflowChartData} margin={{ top: 12, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-linea)" />
                <XAxis
                  dataKey="anioLabel"
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={76}
                  tickFormatter={(v: number) => fmtCurrencyCompact(v, moneda)}
                />
                <Tooltip content={<MemChartTooltip formatter={(v) => fmtCurrency(v, moneda)} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <ReferenceLine y={0} stroke="var(--color-texto-suave)" strokeDasharray="4 4" />
                <Bar
                  dataKey="flujo_neto"
                  name="Flujo neto anual"
                  fill="var(--color-acento)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="flujo_acumulado"
                  name="Flujo acumulado"
                  stroke="var(--color-principal)"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="flujo_descontado_acumulado"
                  name="Flujo desc. acumulado"
                  stroke="var(--color-menta)"
                  strokeDasharray="5 3"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Participación en ahorro Año 1 (%) */}
        <div className="bg-white border border-borde rounded-2xl p-5 shadow-sm">
          <div className="mb-3">
            <h5 className="text-sm font-bold text-principal">
              5. Participación en el ahorro Año 1 (%)
            </h5>
            <p className="text-xs text-texto-suave">
              Contribución de Energía (PML) vs Potencia (100 Horas Críticas).
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
            <div className="w-full h-[220px]">
              {positiveShareSlices.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={positiveShareSlices}
                      dataKey="piePct"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={positiveShareSlices.length > 1 ? 2 : 0}
                      isAnimationActive={false}
                    >
                      {positiveShareSlices.map((entry) => (
                        <Cell key={entry.name} fill={entry.fillVar} />
                      ))}
                    </Pie>
                    <Tooltip content={<MemChartTooltip formatter={(v) => fmtPct(v, 2)} />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-linea bg-fondo/50 px-4 text-center text-xs text-texto-suave">
                  Sin ahorros positivos para graficar en Año 1.
                </div>
              )}
            </div>
            <div className="space-y-3">
              {shareChartData.map((item) => (
                <div key={item.name} className="rounded-xl bg-fondo/70 border border-linea p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-principal">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.fillVar }}
                      />
                      {item.name}
                    </span>
                    <span className="num">{fmtPct(item.pct, 2)}</span>
                  </div>
                  <p className="num text-xs text-texto-suave mt-1">
                    {fmtCurrency(item.monto, moneda)} / año
                  </p>
                </div>
              ))}
              {hasNegativeShareSlice && (
                <p className="text-[11px] text-texto-suave">
                  Nota: el gráfico circular solo traza participaciones positivas; el desglose completo se conserva arriba.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Chart 6 (CRM Value-Add): Costo eléctrico anual sin vs con proyecto */}
        <div className="bg-white border border-borde rounded-2xl p-5 shadow-sm">
          <div className="mb-3">
            <h5 className="text-sm font-bold text-principal">
              6. Costo eléctrico anual sin proyecto vs con proyecto ({moneda})
            </h5>
            <p className="text-xs text-texto-suave">
              Reducción total de factura eléctrica en Año 1: {fmtPct(year1.res_pct_reduccion * 100, 2)}.
            </p>
          </div>
          <div className="w-full h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costCompareData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-linea)" />
                <XAxis
                  dataKey="concepto"
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--color-texto-suave)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                  tickFormatter={(v: number) => fmtCurrencyCompact(v, moneda)}
                />
                <Tooltip content={<MemChartTooltip formatter={(v) => fmtCurrency(v, moneda)} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Bar
                  dataKey="sinProyecto"
                  name="Sin proyecto (Base)"
                  fill="var(--color-etapa-1)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="conProyecto"
                  name="Con FV + BESS"
                  fill="var(--color-principal)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MemTableroView
