'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  Download,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import type {
  CalculadoraTemplate,
  ConfigFinanciamiento,
  ConfiguracionTecnica,
  OfertaMem,
  OpcionFinanciamiento,
  Proyecto,
  ProyectoSitioProducto,
  Rol,
  SimulacionAhorro,
  Sitio,
} from '@/lib/types'
import { fmtCurrency, fmtNum, fmtPct, fmtUnit } from '@/lib/format'
import { evaluateMemEligibility } from '@/lib/calculator/mem-eligibility'
import { exportSimulationToPdf } from '@/lib/calculator/pdf-export'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

export interface ProyectoSimulacionesResumenProps {
  proyecto: Proyecto
  sitios: Sitio[]
  productos: ProyectoSitioProducto[]
  configuraciones: ConfiguracionTecnica[]
  opcionesFinanciamiento: OpcionFinanciamiento[]
  configFinanciamiento: ConfigFinanciamiento[]
  ofertasMem?: OfertaMem[]
  activeTemplate: CalculadoraTemplate
  templatesById?: Record<string, CalculadoraTemplate>
  simulaciones: SimulacionAhorro[]
  userRole: Rol
}

const ROLE_CALCULATOR_PREFIX: Partial<Record<Rol, string>> = {
  nodo_admin: 'admin',
  nodo_analista: 'analista',
  epc: 'epc',
  finder: 'finder',
  financiero: 'financiero',
}

function formatPaybackSummary(sim: SimulacionAhorro): string {
  if (sim.payback_estado === 'inmediato') return 'Inmediato'
  if (sim.payback_estado === 'en_horizonte' && sim.payback_simple_anios != null) {
    return `${fmtNum(sim.payback_simple_anios, 2)} años`
  }
  if (sim.payback_estado === 'fuera_horizonte') return 'Fuera de horizonte'
  return 'No recuperable'
}

export function ProyectoSimulacionesResumen({
  proyecto,
  sitios,
  productos,
  configuraciones,
  opcionesFinanciamiento,
  ofertasMem = [],
  activeTemplate,
  templatesById = {},
  simulaciones,
  userRole,
}: ProyectoSimulacionesResumenProps) {
  const portalPrefix = ROLE_CALCULATOR_PREFIX[userRole]
  const canOpenCalculator = Boolean(portalPrefix)
  const eligibility = useMemo(
    () => evaluateMemEligibility({ proyecto, sitios }),
    [proyecto, sitios],
  )

  const [selectedSimId, setSelectedSimId] = useState<string | null>(
    () => simulaciones[0]?.id ?? null,
  )
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfNotice, setPdfNotice] = useState<string | null>(null)

  const activeSim = useMemo(() => {
    if (simulaciones.length === 0) return null
    return (
      (selectedSimId ? simulaciones.find((s) => s.id === selectedSimId) : undefined) ??
      simulaciones[0]
    )
  }, [simulaciones, selectedSimId])

  if (!activeSim) {
    if (userRole === 'cliente_final' || !portalPrefix) {
      return null
    }
    return (
      <section className="glass-surface p-5 mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-principal text-acento flex items-center justify-center shrink-0">
              <Calculator size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-principal">
                  Simulador de Ahorros y Viabilidad
                </h3>
                <Badge variant={eligibility.isEligible ? 'info' : 'neutral'}>
                  {eligibility.isEligible ? 'Elegible MEM' : 'CFE Tarifario recomendado'}
                </Badge>
              </div>
              <p className="text-xs text-texto-suave mt-1">
                Este proyecto aún no tiene simulaciones vinculadas. Abre el simulador dedicado para correr escenarios MEM o CFE Tarifario, vincularlos o descargar el reporte PDF.
              </p>
            </div>
          </div>
          <Link
            href={`/${portalPrefix}/calculadora?proyectoId=${proyecto.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-acento text-principal text-xs font-bold hover:bg-acento-hover transition-colors shadow-sm shrink-0 self-start sm:self-center"
          >
            Crear o vincular simulación
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
    )
  }

  const isMemSim = activeSim.parametros_override?.modo_motor === 'mem_horaria'
  const showMemWarning = isMemSim && !eligibility.isEligible

  async function handleDownloadPdf() {
    if (!activeSim) return
    setExportingPdf(true)
    setPdfNotice(null)
    try {
      const resolvedTemplate =
        activeSim.template ??
        templatesById[activeSim.template_id] ??
        activeTemplate
      const filename = await exportSimulationToPdf({
        kind: 'saved_snapshot',
        simulacion: activeSim,
        proyecto,
        sitios,
        productos,
        configuraciones,
        opcionesFinanciamiento,
        ofertasMem,
        template: resolvedTemplate,
        regulatoryWarning: showMemWarning ? eligibility.warningMessage : null,
      })
      setPdfNotice(`Reporte descargado: ${filename}`)
      setTimeout(() => setPdfNotice((cur) => (cur === `Reporte descargado: ${filename}` ? null : cur)), 3500)
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <section className="glass-surface p-5 mt-2 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-linea pb-3.5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-principal text-acento flex items-center justify-center shrink-0">
            <Calculator size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-principal">
                Resumen de Simulación Vinculada
              </h3>
              <Badge variant={isMemSim ? 'info' : 'neutral'}>
                {isMemSim ? 'MEM Horario' : 'CFE Tarifario'}
              </Badge>
              <Badge variant={activeSim.usa_parametros_base ? 'info' : 'neutral'}>
                {activeSim.usa_parametros_base ? 'Base Nodo' : 'Personalizada'}
              </Badge>
              <Badge variant="neutral">
                {activeSim.vista_financiamiento === 'neto' ? 'Vista Neta' : 'Vista Bruta'}
              </Badge>
              {activeSim.is_stale && (
                <Badge variant="warning">
                  <AlertTriangle size={11} className="mr-1" />
                  Datos del proyecto actualizados
                </Badge>
              )}
            </div>
            <p className="text-xs text-texto-suave mt-0.5 truncate">
              Escenario activo: <strong className="text-principal">{activeSim.nombre}</strong>
              {simulaciones.length > 1 ? ` · ${simulaciones.length} escenarios guardados` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {simulaciones.length > 1 && (
            <select
              aria-label="Seleccionar simulación guardada"
              value={activeSim.id}
              onChange={(e) => setSelectedSimId(e.target.value)}
              className="rounded-xl border border-borde bg-white px-3 py-1.5 text-xs font-semibold text-principal max-w-[240px]"
            >
              {simulaciones.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} ({s.horizonte_anios}a · {s.moneda_calculo})
                </option>
              ))}
            </select>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exportingPdf}
            onClick={() => {
              void handleDownloadPdf()
            }}
          >
            {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Descargar PDF
          </Button>

          {canOpenCalculator && portalPrefix && (
            <Link
              href={`/${portalPrefix}/calculadora?proyectoId=${proyecto.id}&simulacionId=${activeSim.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-principal text-acento text-xs font-bold hover:opacity-95 transition-opacity shadow-sm"
            >
              Abrir en Simulador
              <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {showMemWarning && eligibility.warningMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-900 flex items-start gap-2">
          <ShieldAlert size={15} className="text-amber-700 shrink-0 mt-0.5" />
          <span>{eligibility.warningMessage}</span>
        </div>
      )}

      {pdfNotice && (
        <div className="rounded-xl bg-acento/30 border border-acento px-3.5 py-2 text-xs font-bold text-principal">
          {pdfNotice}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl bg-white border border-borde p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-texto-suave">
            {activeSim.vista_financiamiento === 'neto' ? 'Desembolso Inicial' : 'CAPEX'}
          </span>
          <span className="num text-sm font-black text-principal mt-0.5 block">
            {fmtCurrency(
              activeSim.vista_financiamiento === 'neto'
                ? activeSim.desembolso_inicial
                : activeSim.capex_snapshot,
              activeSim.moneda_calculo,
            )}
          </span>
        </div>

        <div className="rounded-xl bg-principal text-white border border-principal p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-white/75">
            Ahorro Año 1
          </span>
          <span className="num text-sm font-black text-acento mt-0.5 block">
            {fmtCurrency(activeSim.ahorro_monetario_y1, activeSim.moneda_calculo)}
          </span>
          <span className="num text-[10px] text-white/70 block mt-0.5">
            {fmtUnit(activeSim.ahorro_energia_y1_kwh, 'kWh', 0)}
          </span>
        </div>

        <div className="rounded-xl bg-white border border-borde p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-texto-suave">
            Ahorro Total ({activeSim.horizonte_anios}a)
          </span>
          <span className="num text-sm font-black text-menta mt-0.5 block">
            {fmtCurrency(activeSim.ahorro_monetario_total, activeSim.moneda_calculo)}
          </span>
        </div>

        <div className="rounded-xl bg-white border border-borde p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-texto-suave">
            Payback Simple
          </span>
          <span className="num text-sm font-black text-principal mt-0.5 block">
            {formatPaybackSummary(activeSim)}
          </span>
        </div>

        <div className="rounded-xl bg-white border border-borde p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-texto-suave">
            VAN
          </span>
          <span className="num text-sm font-black text-principal mt-0.5 block">
            {activeSim.van != null ? fmtCurrency(activeSim.van, activeSim.moneda_calculo) : '—'}
          </span>
        </div>

        <div className="rounded-xl bg-white border border-borde p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-texto-suave">
            TIR / ROI
          </span>
          <span className="num text-sm font-black text-principal mt-0.5 block">
            {activeSim.tir_pct != null ? fmtPct(activeSim.tir_pct, 2) : '—'}
          </span>
          <span className="num text-[10px] text-texto-suave block mt-0.5">
            ROI: {activeSim.roi_pct != null ? fmtPct(activeSim.roi_pct, 1) : '—'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-texto-suave">
        <span className="truncate">
          {activeSim.descripcion ? activeSim.descripcion : 'Resultados ejecutivos vinculados al proyecto.'}
        </span>
        <span>
          Plantilla v<strong className="num text-principal">{activeSim.template_version}</strong> ·{' '}
          {activeSim.moneda_calculo} ·{' '}
          {new Date(activeSim.created_at).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>
    </section>
  )
}

export default ProyectoSimulacionesResumen
