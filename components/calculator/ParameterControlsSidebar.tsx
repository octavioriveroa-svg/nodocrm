'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Info, RotateCcw } from 'lucide-react'
import type {
  MemSimulatorInputs,
  Moneda,
  OpcionFinanciamiento,
  VistaFinanciamiento,
} from '@/lib/types'
import { computeBessDurationHours } from '@/lib/calculator/mem-hourly-engine'
import { fmtNum, formatNumberInput, formatSignedNumberInput, parseNum, parseSignedNum } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

export interface ParameterControlsSidebarProps {
  inputs: MemSimulatorInputs
  errors: Record<string, string>
  warnings: readonly string[]
  moneda: Moneda
  vistaFinanciamiento: VistaFinanciamiento
  hasApplicableFinancing: boolean
  activeFinancing: OpcionFinanciamiento | null
  onChangeInput: <K extends keyof MemSimulatorInputs>(key: K, value: MemSimulatorInputs[K]) => void
  onChangeMoneda: (m: Moneda) => void
  onChangeVista: (v: VistaFinanciamiento) => void
  onResetDefaults: () => void
  disabled?: boolean
}

type SectionKey =
  | 'cliente'
  | 'bess'
  | 'operacion'
  | 'fv'
  | 'mercado'
  | 'costos'
  | 'financiamiento'

interface NumericFieldProps {
  id: string
  label: string
  unit: string
  value: number
  isPercentage?: boolean
  isInteger?: boolean
  allowNegative?: boolean
  min?: number
  max?: number
  error?: string
  disabled?: boolean
  drafts: Record<string, string>
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onCommit: (nextVal: number) => void
}

function formatInputDisplay(
  value: number,
  isPercentage: boolean,
  allowNegative: boolean,
): string {
  if (!Number.isFinite(value)) return ''
  const scaled = isPercentage ? Math.round(value * 100 * 1e6) / 1e6 : Math.round(value * 1e6) / 1e6
  const raw = String(scaled)
  return allowNegative ? formatSignedNumberInput(raw) : formatNumberInput(raw)
}

function NumericParamField({
  id,
  label,
  unit,
  value,
  isPercentage = false,
  isInteger = false,
  allowNegative = false,
  error,
  disabled,
  drafts,
  setDrafts,
  onCommit,
}: NumericFieldProps) {
  const display =
    id in drafts ? drafts[id] : formatInputDisplay(value, isPercentage, allowNegative)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`mem-in-${id}`} className="text-[11px] font-semibold text-principal leading-tight">
          {label}
        </label>
        <span className="text-[10px] font-medium text-texto-suave shrink-0">{unit}</span>
      </div>
      <input
        id={`mem-in-${id}`}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={display}
        onChange={(e) => {
          const raw = e.target.value
          const formatted = allowNegative
            ? formatSignedNumberInput(raw)
            : formatNumberInput(raw)
          setDrafts((prev) => ({ ...prev, [id]: formatted }))
          const parsed = allowNegative ? parseSignedNum(formatted) : parseNum(formatted)
          if (parsed !== null && Number.isFinite(parsed)) {
            const finalNum = isInteger
              ? Math.round(parsed)
              : isPercentage
                ? parsed / 100
                : parsed
            onCommit(finalNum)
          }
        }}
        onBlur={() => {
          setDrafts((prev) => {
            if (!(id in prev)) return prev
            const next = { ...prev }
            delete next[id]
            return next
          })
        }}
        className={`num w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-principal bg-fondo/50 focus:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-acento ${
          error ? 'border-red-400 bg-red-50/40' : 'border-borde'
        }`}
      />
      {error && <p className="text-[10px] font-semibold text-red-600">{error}</p>}
    </div>
  )
}

export function ParameterControlsSidebar({
  inputs,
  errors,
  warnings,
  moneda,
  vistaFinanciamiento,
  hasApplicableFinancing,
  activeFinancing,
  onChangeInput,
  onChangeMoneda,
  onChangeVista,
  onResetDefaults,
  disabled = false,
}: ParameterControlsSidebarProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    cliente: true,
    bess: true,
    operacion: true,
    fv: true,
    mercado: true,
    costos: true,
    financiamiento: true,
  })

  const durationHours = computeBessDurationHours(inputs.bess_potencia_mw, inputs.bess_capacidad_mwh)

  function toggleSection(sec: SectionKey) {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }))
  }

  return (
    <aside className="bg-white border border-borde rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-principal text-white px-4 py-3 flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-acento">
            Inputs del Simulador MEM
          </h4>
          <p className="text-[10px] text-white/80">23 variables editables · paridad Excel</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => {
            setDrafts({})
            onResetDefaults()
          }}
          className="!text-white hover:!bg-white/10 !px-2 !py-1 text-[11px]"
          title="Restablecer Inputs del proyecto"
        >
          <RotateCcw size={13} />
          Restablecer
        </Button>
      </div>

      {/* Global CRM View & Currency Bar */}
      <div className="p-3 bg-fondo/60 border-b border-linea space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-texto-suave mb-1">
              Moneda
            </span>
            <div className="inline-flex w-full rounded-lg border border-borde bg-white p-0.5">
              {(['MXN', 'USD'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChangeMoneda(m)}
                  className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    moneda === m
                      ? 'bg-principal text-acento'
                      : 'text-texto-suave hover:text-principal'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-texto-suave mb-1">
              Vista
            </span>
            <div className="inline-flex w-full rounded-lg border border-borde bg-white p-0.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChangeVista('bruto')}
                className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  vistaFinanciamiento === 'bruto'
                    ? 'bg-principal text-acento'
                    : 'text-texto-suave hover:text-principal'
                }`}
              >
                Bruto
              </button>
              <button
                type="button"
                disabled={disabled || !hasApplicableFinancing}
                title={
                  hasApplicableFinancing
                    ? `Ver Neto (${activeFinancing?.vehiculo_inversion})`
                    : 'Requiere un vehículo de financiamiento configurado en el proyecto'
                }
                onClick={() => onChangeVista('neto')}
                className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  vistaFinanciamiento === 'neto'
                    ? 'bg-principal text-acento'
                    : 'text-texto-suave hover:text-principal disabled:opacity-40'
                }`}
              >
                Neto
              </button>
            </div>
          </div>
        </div>

        {vistaFinanciamiento === 'neto' && activeFinancing && (
          <div className="rounded-lg bg-menta/10 border border-menta/30 px-2.5 py-1.5 text-[10px] text-principal font-medium">
            Financiamiento activo:{' '}
            <strong className="uppercase">{activeFinancing.vehiculo_inversion}</strong>
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="px-3.5 py-2.5 bg-amber-50 border-b border-amber-200 space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-900 font-medium flex items-start gap-1.5">
              <AlertTriangle size={13} className="shrink-0 text-amber-600 mt-0.5" />
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      <div className="divide-y divide-linea max-h-[calc(100vh-220px)] overflow-y-auto">
        {/* Section 1: Cliente */}
        <div className="p-3.5 space-y-2.5">
          <button
            type="button"
            onClick={() => toggleSection('cliente')}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-principal">
              1. Cliente
            </span>
            {openSections.cliente ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {openSections.cliente && (
            <div className="space-y-2.5 pt-1">
              <div className="space-y-1">
                <label htmlFor="mem-in-cliente" className="text-[11px] font-semibold text-principal">
                  Cliente
                </label>
                <input
                  id="mem-in-cliente"
                  type="text"
                  disabled={disabled}
                  value={inputs.cliente}
                  onChange={(e) => onChangeInput('cliente', e.target.value)}
                  className="w-full rounded-lg border border-borde px-2.5 py-1.5 text-xs font-semibold text-principal bg-fondo/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-acento"
                />
                {errors.cliente && <p className="text-[10px] text-red-600 font-semibold">{errors.cliente}</p>}
              </div>
              <NumericParamField
                id="demanda_contratada_mw"
                label="Demanda contratada"
                unit="MW"
                value={inputs.demanda_contratada_mw}
                error={errors.demanda_contratada_mw}
                disabled={disabled}
                drafts={drafts}
                setDrafts={setDrafts}
                onCommit={(v) => onChangeInput('demanda_contratada_mw', v)}
              />
            </div>
          )}
        </div>

        {/* Section 2: Batería BESS */}
        <div className="p-3.5 space-y-2.5">
          <button
            type="button"
            onClick={() => toggleSection('bess')}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-principal">
              2. Batería (BESS)
            </span>
            {openSections.bess ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {openSections.bess && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <NumericParamField
                  id="bess_potencia_mw"
                  label="Potencia"
                  unit="MW"
                  value={inputs.bess_potencia_mw}
                  error={errors.bess_potencia_mw}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('bess_potencia_mw', v)}
                />
                <NumericParamField
                  id="bess_capacidad_mwh"
                  label="Capacidad"
                  unit="MWh"
                  value={inputs.bess_capacidad_mwh}
                  error={errors.bess_capacidad_mwh}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('bess_capacidad_mwh', v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-fondo/80 border border-linea px-2.5 py-1.5">
                <span className="text-[11px] font-semibold text-texto-suave">
                  Duración (Cap / Pot)
                </span>
                <Badge variant="default" className="num">
                  {fmtNum(durationHours, 2)} h
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <NumericParamField
                  id="bess_eficiencia_pct"
                  label="Eficiencia"
                  unit="%"
                  value={inputs.bess_eficiencia_pct}
                  isPercentage
                  error={errors.bess_eficiencia_pct}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('bess_eficiencia_pct', v)}
                />
                <NumericParamField
                  id="bess_soc_min_pct"
                  label="SOC mínimo"
                  unit="%"
                  value={inputs.bess_soc_min_pct}
                  isPercentage
                  error={errors.bess_soc_min_pct}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('bess_soc_min_pct', v)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Estrategia de Operación */}
        <div className="p-3.5 space-y-2.5">
          <button
            type="button"
            onClick={() => toggleSection('operacion')}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-principal">
              3. Estrategia de operación
            </span>
            {openSections.operacion ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {openSections.operacion && (
            <div className="space-y-2.5 pt-1">
              <NumericParamField
                id="op_horas_carga"
                label="Horas de carga diarias"
                unit="h/día"
                value={inputs.op_horas_carga}
                isInteger
                error={errors.op_horas_carga}
                disabled={disabled}
                drafts={drafts}
                setDrafts={setDrafts}
                onCommit={(v) => onChangeInput('op_horas_carga', v)}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <NumericParamField
                  id="op_ini_carga"
                  label="Inicio ventana carga"
                  unit="hora 1–24"
                  value={inputs.op_ini_carga}
                  isInteger
                  error={errors.op_ini_carga}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('op_ini_carga', v)}
                />
                <NumericParamField
                  id="op_fin_carga"
                  label="Fin ventana carga"
                  unit="hora 1–24"
                  value={inputs.op_fin_carga}
                  isInteger
                  error={errors.op_fin_carga}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('op_fin_carga', v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <NumericParamField
                  id="op_ini_descarga"
                  label="Inicio descarga"
                  unit="hora 1–24"
                  value={inputs.op_ini_descarga}
                  isInteger
                  error={errors.op_ini_descarga}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('op_ini_descarga', v)}
                />
                <NumericParamField
                  id="op_fin_descarga"
                  label="Fin descarga"
                  unit="hora 1–24"
                  value={inputs.op_fin_descarga}
                  isInteger
                  error={errors.op_fin_descarga}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('op_fin_descarga', v)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Fotovoltaico FV */}
        <div className="p-3.5 space-y-2.5">
          <button
            type="button"
            onClick={() => toggleSection('fv')}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-principal">
              4. Fotovoltaico (FV)
            </span>
            {openSections.fv ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {openSections.fv && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <NumericParamField
                  id="fv_potencia_mw"
                  label="Potencia FV"
                  unit="MW"
                  value={inputs.fv_potencia_mw}
                  error={errors.fv_potencia_mw}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('fv_potencia_mw', v)}
                />
                <NumericParamField
                  id="fv_degradacion_anual_pct"
                  label="Degradación anual"
                  unit="%"
                  value={inputs.fv_degradacion_anual_pct}
                  isPercentage
                  error={errors.fv_degradacion_anual_pct}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('fv_degradacion_anual_pct', v)}
                />
              </div>
              {inputs.fv_potencia_mw >= 0.7 && (
                <div className="rounded-lg bg-fondo border border-borde px-2.5 py-2 text-[10px] text-principal flex items-start gap-1.5">
                  <Info size={13} className="shrink-0 text-menta mt-0.5" />
                  <span>
                    FV ≥ 0.7 MWp requiere permiso de generación / interconexión de media-alta tensión (con FV = 0 MW opera BESS puro).
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 5: Mercado y Tipo de Cambio */}
        <div className="p-3.5 space-y-2.5">
          <button
            type="button"
            onClick={() => toggleSection('mercado')}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-principal">
              5. Mercado y Tipo de Cambio
            </span>
            {openSections.mercado ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {openSections.mercado && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <NumericParamField
                  id="tc_mxn_usd"
                  label="Tipo de cambio"
                  unit="MXN/USD"
                  value={inputs.tc_mxn_usd}
                  error={errors.tc_mxn_usd}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('tc_mxn_usd', v)}
                />
                <div className="space-y-1">
                  <label htmlFor="mem-in-tc_fecha" className="text-[11px] font-semibold text-principal">
                    Fecha del TC
                  </label>
                  <input
                    id="mem-in-tc_fecha"
                    type="date"
                    disabled={disabled}
                    value={inputs.tc_fecha}
                    onChange={(e) => onChangeInput('tc_fecha', e.target.value)}
                    className="w-full rounded-lg border border-borde px-2 py-1.5 text-xs font-semibold text-principal bg-fondo/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-acento"
                  />
                </div>
              </div>
              <NumericParamField
                id="mbp_precio_mxn_mw_anio"
                label="Precio de potencia (MBP)"
                unit="MXN/MW-año"
                value={inputs.mbp_precio_mxn_mw_anio}
                error={errors.mbp_precio_mxn_mw_anio}
                disabled={disabled}
                drafts={drafts}
                setDrafts={setDrafts}
                onCommit={(v) => onChangeInput('mbp_precio_mxn_mw_anio', v)}
              />
              <NumericParamField
                id="rap_factor"
                label="Factor RAP (CENACE)"
                unit="adim."
                value={inputs.rap_factor}
                error={errors.rap_factor}
                disabled={disabled}
                drafts={drafts}
                setDrafts={setDrafts}
                onCommit={(v) => onChangeInput('rap_factor', v)}
              />
            </div>
          )}
        </div>

        {/* Section 6: Costos */}
        <div className="p-3.5 space-y-2.5">
          <button
            type="button"
            onClick={() => toggleSection('costos')}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-principal">
              6. Costos (CAPEX / OPEX)
            </span>
            {openSections.costos ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {openSections.costos && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <NumericParamField
                  id="capex_bess_usd_kwh"
                  label="CAPEX BESS"
                  unit="USD/kWh"
                  value={inputs.capex_bess_usd_kwh}
                  error={errors.capex_bess_usd_kwh}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('capex_bess_usd_kwh', v)}
                />
                <NumericParamField
                  id="capex_fv_usd_kwp"
                  label="CAPEX FV"
                  unit="USD/kWp"
                  value={inputs.capex_fv_usd_kwp}
                  error={errors.capex_fv_usd_kwp}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('capex_fv_usd_kwp', v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <NumericParamField
                  id="opex_bess_mxn_mwh_anio"
                  label="OPEX BESS"
                  unit="MXN/MWh-a"
                  value={inputs.opex_bess_mxn_mwh_anio}
                  error={errors.opex_bess_mxn_mwh_anio}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('opex_bess_mxn_mwh_anio', v)}
                />
                <NumericParamField
                  id="opex_fv_mxn_mw_anio"
                  label="OPEX FV"
                  unit="MXN/MW-a"
                  value={inputs.opex_fv_mxn_mw_anio}
                  error={errors.opex_fv_mxn_mw_anio}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('opex_fv_mxn_mw_anio', v)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 7: Evaluación Financiera */}
        <div className="p-3.5 space-y-2.5">
          <button
            type="button"
            onClick={() => toggleSection('financiamiento')}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-principal">
              7. Evaluación financiera
            </span>
            {openSections.financiamiento ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {openSections.financiamiento && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <NumericParamField
                  id="fin_horizonte_anios"
                  label="Horizonte"
                  unit="años (1–25)"
                  value={inputs.fin_horizonte_anios}
                  isInteger
                  error={errors.fin_horizonte_anios}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('fin_horizonte_anios', v)}
                />
                <NumericParamField
                  id="fin_tasa_descuento_pct"
                  label="Tasa descuento"
                  unit="%"
                  value={inputs.fin_tasa_descuento_pct}
                  isPercentage
                  error={errors.fin_tasa_descuento_pct}
                  disabled={disabled}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onCommit={(v) => onChangeInput('fin_tasa_descuento_pct', v)}
                />
              </div>
              <NumericParamField
                id="fin_esc_opex_pct"
                label="Escalamiento anual OPEX"
                unit="%/año"
                value={inputs.fin_esc_opex_pct}
                isPercentage
                allowNegative
                error={errors.fin_esc_opex_pct}
                disabled={disabled}
                drafts={drafts}
                setDrafts={setDrafts}
                onCommit={(v) => onChangeInput('fin_esc_opex_pct', v)}
              />
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export default ParameterControlsSidebar
