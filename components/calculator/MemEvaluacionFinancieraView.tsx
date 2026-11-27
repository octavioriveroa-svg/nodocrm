'use client'

import { useMemo, useState } from 'react'
import { Download, Eye, EyeOff, Info } from 'lucide-react'
import type {
  GranularidadProyeccion,
  MemFinancialEvaluation,
  MemSimulatorInputs,
  Moneda,
  VistaFinanciamiento,
} from '@/lib/types'
import { aggregateSeries } from '@/lib/calculator/aggregate'
import {
  buildMemEvaluationCsv,
  buildProjectionCsv,
  downloadCsvContent,
} from '@/lib/calculator/csv-export'
import { fmtCurrency, fmtNum, fmtPct } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface MemEvaluacionFinancieraViewProps {
  inputs: MemSimulatorInputs
  financial: MemFinancialEvaluation
  moneda: Moneda
  vistaFinanciamiento: VistaFinanciamiento
}

export function MemEvaluacionFinancieraView({
  inputs,
  financial,
  moneda,
  vistaFinanciamiento,
}: MemEvaluacionFinancieraViewProps) {
  const [granularidad, setGranularidad] = useState<GranularidadProyeccion>('anual')
  const [showFactors, setShowFactors] = useState(false)

  const periodicRows = useMemo(() => {
    if (granularidad === 'anual') return []
    return aggregateSeries(financial.serie_mensual, granularidad)
  }, [financial.serie_mensual, granularidad])

  function handleExportCsv() {
    const csv =
      granularidad === 'anual'
        ? buildMemEvaluationCsv(financial.rows, {
            moneda,
            cliente: inputs.cliente,
            vista: vistaFinanciamiento,
          })
        : buildProjectionCsv(periodicRows, {
            moneda,
            proyectoNombre: inputs.cliente,
            granularidad,
          })
    downloadCsvContent(
      csv,
      `evaluacion-financiera-${granularidad}-${moneda.toLowerCase()}.csv`,
    )
  }

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-principal">
            Evaluación Financiera ({moneda} · {vistaFinanciamiento === 'neto' ? 'Neto Financiado' : 'Bruto / Contado'})
          </h4>
          <p className="text-xs text-texto-suave">
            Proyección completa años 0–25 (activos hasta Año {inputs.fin_horizonte_anios}) con VPN, TIR y periodos de recuperación.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-borde bg-white p-0.5">
            {(['anual', 'trimestral', 'mensual'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularidad(g)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                  granularidad === g
                    ? 'bg-principal text-acento'
                    : 'text-texto-suave hover:text-principal'
                }`}
              >
                {g === 'anual' ? 'Anual (0–25)' : g === 'trimestral' ? 'Trimestral' : 'Mensual'}
              </button>
            ))}
          </div>

          {granularidad === 'anual' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFactors((v) => !v)}
            >
              {showFactors ? <EyeOff size={14} /> : <Eye size={14} />}
              {showFactors ? 'Ocultar índices' : 'Ver índices y factores'}
            </Button>
          )}

          <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
            <Download size={14} />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Summary strip matching Excel C5:C14 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
        <div className="bg-white border border-borde rounded-xl p-3">
          <span className="block text-[10px] font-bold uppercase text-texto-suave">CAPEX BESS</span>
          <span className="num text-sm font-extrabold text-principal mt-0.5 block">
            {fmtCurrency(
              moneda === 'USD' ? financial.capex_bess_mxn / Math.max(inputs.tc_mxn_usd, 1) : financial.capex_bess_mxn,
              moneda,
            )}
          </span>
        </div>
        <div className="bg-white border border-borde rounded-xl p-3">
          <span className="block text-[10px] font-bold uppercase text-texto-suave">CAPEX FV</span>
          <span className="num text-sm font-extrabold text-principal mt-0.5 block">
            {fmtCurrency(
              moneda === 'USD' ? financial.capex_fv_mxn / Math.max(inputs.tc_mxn_usd, 1) : financial.capex_fv_mxn,
              moneda,
            )}
          </span>
        </div>
        <div className="bg-white border border-borde rounded-xl p-3">
          <span className="block text-[10px] font-bold uppercase text-texto-suave">
            {vistaFinanciamiento === 'neto' ? 'Desembolso Inicial' : 'CAPEX Total'}
          </span>
          <span className="num text-sm font-extrabold text-principal mt-0.5 block">
            {fmtCurrency(
              vistaFinanciamiento === 'neto' ? financial.desembolso_inicial : financial.capex_total,
              moneda,
            )}
          </span>
        </div>
        <div className="bg-white border border-borde rounded-xl p-3">
          <span className="block text-[10px] font-bold uppercase text-texto-suave">VPN ({inputs.fin_horizonte_anios}a)</span>
          <span className={`num text-sm font-black mt-0.5 block ${financial.vpn >= 0 ? 'text-menta' : 'text-red-600'}`}>
            {fmtCurrency(financial.vpn, moneda)}
          </span>
        </div>
        <div className="bg-white border border-borde rounded-xl p-3">
          <span className="block text-[10px] font-bold uppercase text-texto-suave">TIR</span>
          <span className="num text-sm font-black text-principal mt-0.5 block">
            {financial.tir_pct !== null ? fmtPct(financial.tir_pct, 2) : 'N/A'}
          </span>
        </div>
        <div className="bg-white border border-borde rounded-xl p-3">
          <span className="block text-[10px] font-bold uppercase text-texto-suave">Payback Simple / Desc.</span>
          <span className="num text-xs font-extrabold text-principal mt-1 block">
            {paybackSimpleStr} / {paybackDescStr}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-borde rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
          {granularidad === 'anual' ? (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-principal text-white">
                  <th className="text-left px-3 py-2.5 font-bold whitespace-nowrap">Año</th>
                  {showFactors && (
                    <>
                      <th className="text-center px-2 py-2.5 font-semibold whitespace-nowrap">Activo</th>
                      <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Idx PML</th>
                      <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Idx MBP</th>
                      <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Idx OPEX</th>
                      <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Deg FV</th>
                      <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Deg BESS</th>
                      <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Deg Comb.</th>
                    </>
                  )}
                  <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Ahorro Energía</th>
                  <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Ahorro Potencia</th>
                  <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Total Ahorros</th>
                  <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">CAPEX</th>
                  <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">OPEX</th>
                  {vistaFinanciamiento === 'neto' && (
                    <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Serv. Deuda</th>
                  )}
                  <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Flujo Neto</th>
                  <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Flujo Acum.</th>
                  {showFactors && (
                    <th className="text-right px-2.5 py-2.5 font-semibold whitespace-nowrap">Factor Desc.</th>
                  )}
                  <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Flujo Desc.</th>
                  <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Flujo Desc. Acum.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {financial.rows.map((r) => {
                  const inactive = r.anio > 0 && r.activo === 0
                  return (
                    <tr
                      key={r.anio}
                      className={
                        r.anio === 0
                          ? 'bg-fondo font-semibold'
                          : inactive
                            ? 'bg-fondo/30 text-texto-suave/65'
                            : 'hover:bg-fondo/50'
                      }
                    >
                      <td className="num px-3 py-2 font-bold text-principal whitespace-nowrap">
                        {r.anio}
                        {inactive && (
                          <Badge variant="default" className="ml-1.5 !px-1 !py-0 !text-[9px]">
                            Inactivo
                          </Badge>
                        )}
                      </td>
                      {showFactors && (
                        <>
                          <td className="num px-2 py-2 text-center">{r.activo}</td>
                          <td className="num px-2.5 py-2 text-right">{fmtNum(r.idx_energia, 4)}</td>
                          <td className="num px-2.5 py-2 text-right">{fmtNum(r.idx_potencia, 4)}</td>
                          <td className="num px-2.5 py-2 text-right">{fmtNum(r.idx_opex, 4)}</td>
                          <td className="num px-2.5 py-2 text-right">{fmtNum(r.factor_deg_fv, 4)}</td>
                          <td className="num px-2.5 py-2 text-right">{fmtNum(r.factor_deg_bess, 4)}</td>
                          <td className="num px-2.5 py-2 text-right font-semibold">{fmtNum(r.factor_deg_combinado, 4)}</td>
                        </>
                      )}
                      <td className="num px-3 py-2 text-right whitespace-nowrap">
                        {fmtCurrency(r.ahorro_energia, moneda)}
                      </td>
                      <td className="num px-3 py-2 text-right whitespace-nowrap">
                        {fmtCurrency(r.ahorro_potencia, moneda)}
                      </td>
                      <td className="num px-3 py-2 text-right font-semibold text-principal whitespace-nowrap">
                        {fmtCurrency(r.total_ahorros, moneda)}
                      </td>
                      <td className="num px-3 py-2 text-right whitespace-nowrap">
                        {r.capex !== 0 ? fmtCurrency(r.capex, moneda) : '—'}
                      </td>
                      <td className="num px-3 py-2 text-right whitespace-nowrap">
                        {r.opex !== 0 ? fmtCurrency(r.opex, moneda) : '—'}
                      </td>
                      {vistaFinanciamiento === 'neto' && (
                        <td className="num px-3 py-2 text-right whitespace-nowrap">
                          {r.cuota_financiamiento !== 0 ? fmtCurrency(r.cuota_financiamiento, moneda) : '—'}
                        </td>
                      )}
                      <td
                        className={`num px-3 py-2 text-right font-bold whitespace-nowrap ${
                          r.flujo_neto < 0 ? 'text-red-600' : 'text-menta'
                        }`}
                      >
                        {fmtCurrency(r.flujo_neto, moneda)}
                      </td>
                      <td
                        className={`num px-3 py-2 text-right font-semibold whitespace-nowrap ${
                          r.flujo_acumulado < 0 ? 'text-red-600' : 'text-principal'
                        }`}
                      >
                        {fmtCurrency(r.flujo_acumulado, moneda)}
                      </td>
                      {showFactors && (
                        <td className="num px-2.5 py-2 text-right">{fmtNum(r.factor_descuento, 4)}</td>
                      )}
                      <td className="num px-3 py-2 text-right whitespace-nowrap">
                        {fmtCurrency(r.flujo_descontado, moneda)}
                      </td>
                      <td
                        className={`num px-3 py-2 text-right font-semibold whitespace-nowrap ${
                          r.flujo_descontado_acumulado < 0 ? 'text-red-600' : 'text-principal'
                        }`}
                      >
                        {fmtCurrency(r.flujo_descontado_acumulado, moneda)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-principal text-white">
                  <th className="text-left px-3 py-2.5 font-bold">Periodo</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Energía FV (kWh)</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Descarga BESS (kWh)</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Ahorro Bruto</th>
                  <th className="text-right px-3 py-2.5 font-semibold">OPEX</th>
                  {vistaFinanciamiento === 'neto' && (
                    <th className="text-right px-3 py-2.5 font-semibold">Financiamiento</th>
                  )}
                  <th className="text-right px-3 py-2.5 font-semibold">Flujo Neto</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Flujo Acum.</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Flujo Desc. Acum.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {periodicRows.map((row) => (
                  <tr key={row.periodo} className="hover:bg-fondo/50">
                    <td className="px-3 py-2 font-semibold text-principal whitespace-nowrap">
                      {row.etiqueta}
                    </td>
                    <td className="num px-3 py-2 text-right">{fmtNum(row.energia_fv_kwh, 0)}</td>
                    <td className="num px-3 py-2 text-right">{fmtNum(row.energia_bess_kwh, 0)}</td>
                    <td className="num px-3 py-2 text-right font-semibold text-principal">
                      {fmtCurrency(row.ahorro_bruto, moneda)}
                    </td>
                    <td className="num px-3 py-2 text-right">{fmtCurrency(row.costo_om, moneda)}</td>
                    {vistaFinanciamiento === 'neto' && (
                      <td className="num px-3 py-2 text-right">
                        {fmtCurrency(row.cuota_financiamiento, moneda)}
                      </td>
                    )}
                    <td
                      className={`num px-3 py-2 text-right font-bold ${
                        row.flujo_neto < 0 ? 'text-red-600' : 'text-menta'
                      }`}
                    >
                      {fmtCurrency(row.flujo_neto, moneda)}
                    </td>
                    <td
                      className={`num px-3 py-2 text-right font-semibold ${
                        row.flujo_acumulado < 0 ? 'text-red-600' : 'text-principal'
                      }`}
                    >
                      {fmtCurrency(row.flujo_acumulado, moneda)}
                    </td>
                    <td className="num px-3 py-2 text-right">
                      {fmtCurrency(row.flujo_descontado_acumulado, moneda)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Transparent Excel engineering assumption note */}
      <div className="rounded-xl bg-fondo/60 border border-linea px-4 py-3 text-[11px] text-texto-suave flex items-start gap-2">
        <Info size={14} className="text-menta shrink-0 mt-0.5" />
        <p>
          <strong>Nota metodológica:</strong> Para proyectar años 1–25 sin re-simular 8,760 horas por cada año, el modelo aplica degradación combinada ponderada por energía de Año 1 (
          <span className="num font-semibold text-principal">
            peso FV = {fmtPct(financial.peso_fv * 100, 1)}
          </span>{' '}
          autoconsumida vs{' '}
          <span className="num font-semibold text-principal">
            BESS = {fmtPct((1 - financial.peso_fv) * 100, 1)}
          </span>
          ) escalada por los índices anuales de PML, MBP y OPEX.
        </p>
      </div>
    </div>
  )
}

export default MemEvaluacionFinancieraView
