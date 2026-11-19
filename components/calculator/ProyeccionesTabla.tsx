'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import type { GranularidadProyeccion, Moneda, PeriodoAgregadoSimulacion } from '@/lib/types'
import { fmtCurrency, fmtNum } from '@/lib/format'
import { buildProjectionCsv } from '@/lib/calculator/csv-export'
import { Button } from '@/components/ui/Button'

export interface ProyeccionesTablaProps {
  rows: readonly PeriodoAgregadoSimulacion[]
  granularidad: GranularidadProyeccion
  moneda: Moneda
  proyectoNombre?: string
  escenarioNombre?: string
}

const ROWS_PER_PAGE = 12

export function ProyeccionesTabla({
  rows,
  granularidad,
  moneda,
  proyectoNombre,
  escenarioNombre,
}: ProyeccionesTablaProps) {
  const [page, setPage] = useState(0)

  const shouldPaginate = granularidad === 'mensual' && rows.length > ROWS_PER_PAGE
  const totalPages = shouldPaginate ? Math.ceil(rows.length / ROWS_PER_PAGE) : 1
  const safePage = Math.min(page, Math.max(0, totalPages - 1))

  const visibleRows = useMemo(() => {
    if (!shouldPaginate) return rows
    const start = safePage * ROWS_PER_PAGE
    return rows.slice(start, start + ROWS_PER_PAGE)
  }, [rows, safePage, shouldPaginate])

  function handleExportCsv() {
    const csv = buildProjectionCsv(rows, {
      moneda,
      granularidad,
      proyectoNombre,
      escenarioNombre,
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const baseName = (proyectoNombre || 'proyecto')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_|_$/g, '')
    link.href = url
    link.download = `proyeccion_${baseName || 'nodo'}_${granularidad}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (rows.length === 0) return null

  return (
    <div className="bg-white/80 backdrop-blur-md border border-borde rounded-2xl overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-linea">
        <div>
          <h4 className="text-sm font-bold text-principal">
            Detalle Tabular de Proyecciones ({rows.length} periodos)
          </h4>
          <p className="text-xs text-texto-suave mt-0.5">
            Montos expresados en {moneda}. Valores negativos indican flujo neto de inversión o deuda.
          </p>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
          <Download size={14} />
          Exportar CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-principal text-white">
              <th className="text-left font-semibold px-2.5 lg:px-3 py-3 whitespace-nowrap">Periodo</th>
              <th className="text-right font-semibold px-2.5 lg:px-3 py-3 whitespace-nowrap">
                Ahorro Energía (kWh)
              </th>
              <th className="text-right font-semibold px-2.5 lg:px-3 py-3 whitespace-nowrap">Ahorro Bruto</th>
              <th className="text-right font-semibold px-2.5 lg:px-3 py-3 whitespace-nowrap">O&amp;M</th>
              <th className="text-right font-semibold px-2.5 lg:px-3 py-3 whitespace-nowrap">
                Financiamiento
              </th>
              <th className="text-right font-semibold px-2.5 lg:px-3 py-3 whitespace-nowrap">Flujo Neto</th>
              <th className="text-right font-semibold px-2.5 lg:px-3 py-3 whitespace-nowrap">
                Flujo Acumulado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {visibleRows.map((row, idx) => (
              <tr
                key={row.periodo}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-fondo/60'}
              >
                <td className="px-2.5 lg:px-3 py-2.5 font-semibold text-principal whitespace-nowrap">
                  {row.etiqueta}
                </td>
                <td className="num px-2.5 lg:px-3 py-2.5 text-right text-principal whitespace-nowrap">
                  {fmtNum(row.energia_total_kwh, 0)}
                </td>
                <td className="num px-2.5 lg:px-3 py-2.5 text-right text-principal whitespace-nowrap">
                  {fmtCurrency(Math.round(row.ahorro_bruto), moneda)}
                </td>
                <td className="num px-2.5 lg:px-3 py-2.5 text-right text-texto-suave whitespace-nowrap">
                  {fmtCurrency(Math.round(row.costo_om), moneda)}
                </td>
                <td className="num px-2.5 lg:px-3 py-2.5 text-right text-texto-suave whitespace-nowrap">
                  {fmtCurrency(Math.round(row.cuota_financiamiento), moneda)}
                </td>
                <td
                  className={`num px-2.5 lg:px-3 py-2.5 text-right font-bold whitespace-nowrap ${
                    row.flujo_neto < 0 ? 'text-red-600' : 'text-exito'
                  }`}
                >
                  {fmtCurrency(Math.round(row.flujo_neto), moneda)}
                </td>
                <td
                  className={`num px-2.5 lg:px-3 py-2.5 text-right font-bold whitespace-nowrap ${
                    row.flujo_acumulado < 0 ? 'text-red-600' : 'text-principal'
                  }`}
                >
                  {fmtCurrency(Math.round(row.flujo_acumulado), moneda)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shouldPaginate && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-linea bg-fondo/50 text-xs">
          <span className="text-texto-suave">
            Año <strong className="num text-principal">{safePage + 1}</strong> de{' '}
            <strong className="num text-principal">{totalPages}</strong> ({rows.length} meses)
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft size={14} />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Siguiente
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProyeccionesTabla
