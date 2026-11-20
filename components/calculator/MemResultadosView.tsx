'use client'

import { Download } from 'lucide-react'
import type { MemSimulatorInputs, MemYear1Results, Moneda } from '@/lib/types'
import { buildMemResultsCsv, downloadCsvContent } from '@/lib/calculator/csv-export'
import { fmtCurrency, fmtNum, fmtPct } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface MemResultadosViewProps {
  inputs: MemSimulatorInputs
  year1: MemYear1Results
  moneda: Moneda
}

export function MemResultadosView({ inputs, year1, moneda }: MemResultadosViewProps) {
  const fx = inputs.tc_mxn_usd > 0 ? inputs.tc_mxn_usd : 18.7
  const toCurr = (mxn: number) => (moneda === 'USD' ? mxn / fx : mxn)

  function handleExportCsv() {
    const csv = buildMemResultsCsv(year1, inputs.cliente)
    downloadCsvContent(
      csv,
      `resultados-ano1-${(inputs.cliente || 'mem').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.csv`,
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-principal">
            Resultados — Simulación Horaria Año 1 (8,760 h + 100 HC)
          </h4>
          <p className="text-xs text-texto-suave">
            Las 4 tablas canónicas del Excel base mostradas en {moneda} (TC {fmtNum(fx, 2)} MXN/USD).
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
          <Download size={14} />
          Exportar Resultados CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Tabla 1: Balance de Energía */}
        <div className="bg-white border border-borde rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-principal text-white px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">
              1. Balance de energía (Año 1)
            </span>
            <Badge variant="default" className="!bg-white/15 !text-white !border-white/20">
              MWh / año
            </Badge>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-fondo/80 text-texto-suave border-b border-linea">
                <th className="text-left px-4 py-2 font-semibold">Concepto</th>
                <th className="text-right px-4 py-2 font-semibold">Valor</th>
                <th className="text-right px-4 py-2 font-semibold">Ref.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              <tr>
                <td className="px-4 py-2 text-principal">Consumo real (sin proyecto)</td>
                <td className="num px-4 py-2 text-right font-bold text-principal">
                  {fmtNum(year1.res_consumo_mwh, 2)} MWh
                </td>
                <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_Consumo</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-principal">Generación FV</td>
                <td className="num px-4 py-2 text-right font-semibold text-principal">
                  {fmtNum(year1.res_gen_fv_mwh, 2)} MWh
                </td>
                <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_GenFV</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-principal">FV autoconsumida directamente</td>
                <td className="num px-4 py-2 text-right font-semibold text-principal">
                  {fmtNum(year1.res_fv_auto_mwh, 2)} MWh
                </td>
                <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_FVAuto</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-principal">Excedente FV cargado a BESS</td>
                <td className="num px-4 py-2 text-right font-semibold text-principal">
                  {fmtNum(year1.res_fv_a_bess_mwh, 2)} MWh
                </td>
                <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_FVaBESS</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-principal">Excedente FV no aprovechado</td>
                <td className="num px-4 py-2 text-right font-semibold text-texto-suave">
                  {fmtNum(year1.res_fv_perdida_mwh, 2)} MWh
                </td>
                <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_FVPerdida</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-principal">Carga BESS desde la red</td>
                <td className="num px-4 py-2 text-right font-semibold text-principal">
                  {fmtNum(year1.res_carga_red_mwh, 2)} MWh
                </td>
                <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_CargaRed</td>
              </tr>
              <tr className="bg-menta/5">
                <td className="px-4 py-2 font-semibold text-principal">Descarga BESS</td>
                <td className="num px-4 py-2 text-right font-bold text-menta">
                  {fmtNum(year1.res_descarga_mwh, 2)} MWh
                </td>
                <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_Descarga</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-principal">Ciclos equivalentes BESS</td>
                <td className="num px-4 py-2 text-right font-bold text-principal">
                  {fmtNum(year1.res_ciclos, 2)} / año
                </td>
                <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_Ciclos</td>
              </tr>
              <tr className="bg-fondo/60">
                <td className="px-4 py-2 font-semibold text-principal">Consumo de red con proyecto</td>
                <td className="num px-4 py-2 text-right font-bold text-principal">
                  {fmtNum(year1.res_consumo_red_mwh, 2)} MWh
                </td>
                <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_ConsumoRed</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabla 2 & Tabla 4 stacked */}
        <div className="space-y-5">
          {/* Tabla 2: Energía (PML) */}
          <div className="bg-white border border-borde rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-principal text-white px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">
                2. Energía (PML)
              </span>
              <Badge variant="default" className="!bg-white/15 !text-white !border-white/20">
                {moneda} / año
              </Badge>
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody className="divide-y divide-linea">
                <tr>
                  <td className="px-4 py-2.5 text-principal">Costo energía sin proyecto</td>
                  <td className="num px-4 py-2.5 text-right font-semibold text-principal">
                    {fmtCurrency(toCurr(year1.res_costo_e_base_mxn), moneda)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[10px] text-texto-suave">Res_CostoE_Base</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-principal">Costo energía con proyecto</td>
                  <td className="num px-4 py-2.5 text-right font-semibold text-principal">
                    {fmtCurrency(toCurr(year1.res_costo_e_proy_mxn), moneda)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[10px] text-texto-suave">Res_CostoE_Proy</td>
                </tr>
                <tr className="bg-menta/10">
                  <td className="px-4 py-2.5 font-extrabold text-principal">Ahorro de energía</td>
                  <td className="num px-4 py-2.5 text-right font-black text-menta">
                    {fmtCurrency(toCurr(year1.ahorro_e_total_mxn), moneda)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[10px] text-texto-suave">Ahorro_E_Total</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-texto-suave">PML promedio horario</td>
                  <td className="num px-4 py-2 text-right font-semibold text-principal">
                    {fmtCurrency(toCurr(year1.pml_promedio_mxn_mwh), moneda)}/MWh
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Datos PML</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tabla 3: Potencia (100 HC) */}
          <div className="bg-white border border-borde rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-principal text-white px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">
                3. Potencia — 100 Horas Críticas (CENACE)
              </span>
              <Badge variant="default" className="!bg-white/15 !text-white !border-white/20">
                MW · {moneda}
              </Badge>
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody className="divide-y divide-linea">
                <tr>
                  <td className="px-4 py-2 text-principal">Demanda promedio 100 HC (base → proy)</td>
                  <td className="num px-4 py-2 text-right font-semibold text-principal">
                    {fmtNum(year1.prom_100hc_base_mw, 3)} → {fmtNum(year1.prom_100hc_proy_mw, 3)} MW
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">100HC Prom</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-principal">RAP sin FV ni BESS (× {fmtNum(inputs.rap_factor, 4)})</td>
                  <td className="num px-4 py-2 text-right font-semibold text-principal">
                    {fmtNum(year1.res_rap_base_mw, 3)} MW
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_RAP_Base</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-principal">RAP con FV + BESS (× {fmtNum(inputs.rap_factor, 4)})</td>
                  <td className="num px-4 py-2 text-right font-semibold text-principal">
                    {fmtNum(year1.res_rap_proy_mw, 3)} MW
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_RAP_Proy</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-semibold text-principal">Reducción de RAP</td>
                  <td className="num px-4 py-2 text-right font-bold text-principal">
                    {fmtNum(year1.res_rap_reduccion_mw, 3)} MW
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_RAP_Reduccion</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-principal">Costo potencia sin proyecto</td>
                  <td className="num px-4 py-2 text-right font-semibold text-principal">
                    {fmtCurrency(toCurr(year1.res_costo_c_base_mxn), moneda)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_CostoC_Base</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-principal">Costo potencia con proyecto</td>
                  <td className="num px-4 py-2 text-right font-semibold text-principal">
                    {fmtCurrency(toCurr(year1.res_costo_c_proy_mxn), moneda)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[10px] text-texto-suave">Res_CostoC_Proy</td>
                </tr>
                <tr className="bg-menta/10">
                  <td className="px-4 py-2.5 font-extrabold text-principal">Ahorro de potencia</td>
                  <td className="num px-4 py-2.5 text-right font-black text-menta">
                    {fmtCurrency(toCurr(year1.ahorro_c_total_mxn), moneda)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[10px] text-texto-suave">Ahorro_C_Total</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tabla 4: Resumen Año 1 */}
      <div className="bg-white border border-borde rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-principal text-white px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider">
            4. Resumen consolidado Año 1
          </span>
          <Badge variant="default" className="!bg-acento !text-principal">
            Base de proyección años 1–25
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-linea">
          <div className="p-4">
            <span className="block text-[11px] font-bold uppercase text-texto-suave">
              Ahorro total Año 1 (Ahorro_Total)
            </span>
            <span className="num text-lg font-black text-principal mt-1 block">
              {fmtCurrency(toCurr(year1.ahorro_total_mxn), moneda)}
            </span>
          </div>
          <div className="p-4">
            <span className="block text-[11px] font-bold uppercase text-texto-suave">
              Participación energía (Res_PctEnergia)
            </span>
            <span className="num text-lg font-extrabold text-menta mt-1 block">
              {fmtPct(year1.res_pct_energia * 100, 2)}
            </span>
          </div>
          <div className="p-4">
            <span className="block text-[11px] font-bold uppercase text-texto-suave">
              Participación potencia (Res_PctCapacidad)
            </span>
            <span className="num text-lg font-extrabold text-principal mt-1 block">
              {fmtPct(year1.res_pct_capacidad * 100, 2)}
            </span>
          </div>
          <div className="p-4 bg-acento/15">
            <span className="block text-[11px] font-bold uppercase text-principal">
              Reducción costo eléctrico (Res_PctReduccion)
            </span>
            <span className="num text-lg font-black text-principal mt-1 block">
              {fmtPct(year1.res_pct_reduccion * 100, 2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MemResultadosView
