'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Pencil, Trash2, CalendarDays, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import type {
  Proyecto,
  Profile,
  EstadoProyecto,
  ConfiguracionTecnica,
  OpcionFinanciamiento,
  ModalidadFinanciamiento,
} from '@/lib/types'
import { fmtNum, fmtCurrency } from '@/lib/format'
import {
  SALES_CYCLE,
  STAGE_ORDER,
  MODALIDAD_LABELS,
  isStageApprovalOrBeyond,
} from '@/lib/domains/proyectos/lifecycle'
import { canChangeProjectStage, canDeleteProject } from '@/lib/domains/auth/permissions'

interface Props {
  proyecto: Proyecto
  currentUser: Profile
  backHref: string
  hitosCount: number
  generandoCronograma: boolean
  onGenerarCronograma: () => Promise<void>
  editando: boolean
  onToggleEdit: () => void
  onEliminarProyecto: () => Promise<void>
  onCambiarEstado: (estado: EstadoProyecto) => Promise<void>
  errorEstado: string | null
  configsList?: ConfiguracionTecnica[]
  opcionesFin?: OpcionFinanciamiento[]
}

export default function ProjectHeaderAndPipeline({
  proyecto,
  currentUser,
  backHref,
  hitosCount,
  generandoCronograma,
  onGenerarCronograma,
  editando,
  onToggleEdit,
  onEliminarProyecto,
  onCambiarEstado,
  errorEstado,
  configsList = [],
  opcionesFin = [],
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  const isAdmin = currentUser.rol === 'nodo_admin'
  const isAnalista = currentUser.rol === 'nodo_analista'
  const isEpcista = currentUser.rol === 'epc'
  const isFinder = currentUser.rol === 'finder'

  const userCanDelete = canDeleteProject(currentUser, proyecto)
  const userCanChangeStage = canChangeProjectStage(currentUser.rol)
  const userCanEdit =
    isAdmin ||
    isAnalista ||
    (isEpcista && proyecto.epcista_id === currentUser.id) ||
    (isFinder && proyecto.finder_id === currentUser.id)

  const currentStageIndex = STAGE_ORDER.indexOf(proyecto.estado)

  // Derived Leading Alternative and Official Project Financials
  const leadingConfig = configsList.find((c) => c.seleccionada) || configsList[0]
  const leadingOpt = opcionesFin.find((o) => o.seleccionada) || opcionesFin[0]

  const leadingNetSavings = leadingOpt
    ? leadingOpt.ahorro_estimado_anual != null
      ? Number(leadingOpt.ahorro_estimado_anual)
      : leadingOpt.ahorro_estimado_mensual != null
        ? Number(leadingOpt.ahorro_estimado_mensual) * 12
        : null
    : null

  const leadingGrossSavings = leadingConfig
    ? leadingConfig.ahorro_estimado_anual != null
      ? Number(leadingConfig.ahorro_estimado_anual)
      : leadingConfig.ahorro_estimado_mensual != null
        ? Number(leadingConfig.ahorro_estimado_mensual) * 12
        : null
    : null

  const effectiveSavings =
    leadingNetSavings != null && leadingNetSavings > 0
      ? leadingNetSavings
      : leadingGrossSavings || null
  const isNetSavings = leadingNetSavings != null && leadingNetSavings > 0
  const effectiveSavingsMoneda = isNetSavings
    ? leadingOpt?.moneda || 'MXN'
    : leadingConfig?.ahorro_moneda || leadingConfig?.moneda || proyecto.moneda || 'MXN'

  const effectiveCapex = proyecto.capex_estimado || leadingConfig?.inversion_total || 0
  const effectiveCapexMoneda = proyecto.moneda || leadingConfig?.moneda || 'MXN'
  const effectivePaybackYears =
    effectiveCapex > 0 && effectiveSavings && effectiveSavings > 0
      ? effectiveCapex / effectiveSavings
      : null

  const leadingVehiculoLabel = leadingOpt
    ? MODALIDAD_LABELS[leadingOpt.vehiculo_inversion as ModalidadFinanciamiento] ||
      leadingOpt.vehiculo_inversion
    : Array.isArray(proyecto.modalidad_financiamiento)
      ? proyecto.modalidad_financiamiento.length > 0
        ? proyecto.modalidad_financiamiento
            .map((m) => MODALIDAD_LABELS[m as ModalidadFinanciamiento] || m)
            .join(', ')
        : 'Sin definir'
      : proyecto.modalidad_financiamiento
        ? MODALIDAD_LABELS[proyecto.modalidad_financiamiento as ModalidadFinanciamiento] ||
          String(proyecto.modalidad_financiamiento)
        : 'Sin definir'

  async function handleStageChange(targetStage: EstadoProyecto) {
    if (targetStage === proyecto.estado) return
    setCambiandoEstado(true)
    try {
      await onCambiarEstado(targetStage)
    } finally {
      setCambiandoEstado(false)
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-4">
      {/* Top Bar with Back Link and Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-principal transition-colors mb-2"
          >
            <ChevronLeft size={14} /> Volver a Proyectos
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-principal tracking-tight">
              {proyecto.nombre_proyecto}
            </h1>
            <BadgeTipo tipo={proyecto.tipo} />
            <BadgeEstado estado={proyecto.estado} />
          </div>
          <p className="text-xs text-muted mt-1">
            ID: <span className="font-mono text-gray-500">{proyecto.id}</span>
            {proyecto.cliente_final_empresa && (
              <>
                {' '}
                • Empresa:{' '}
                <span className="font-semibold text-principal">
                  {proyecto.cliente_final_empresa}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hitosCount === 0 && (isAdmin || isAnalista || isEpcista) && (
            <Button
              size="sm"
              variant="outline"
              disabled={generandoCronograma}
              onClick={onGenerarCronograma}
            >
              <CalendarDays size={14} className="mr-1.5" />
              {generandoCronograma ? 'Generando...' : 'Generar Cronograma'}
            </Button>
          )}

          {userCanEdit && (
            <Button
              size="sm"
              variant={editando ? 'secondary' : 'outline'}
              onClick={onToggleEdit}
            >
              <Pencil size={14} className="mr-1.5" />
              {editando ? 'Ver Resumen' : 'Editar Proyecto'}
            </Button>
          )}

          {userCanDelete && !confirmDelete && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} className="mr-1.5" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Banner */}
      {confirmDelete && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-red-800 font-semibold">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>¿Estás seguro de que deseas eliminar este proyecto de manera permanente?</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDelete(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={eliminando}
              onClick={async () => {
                setEliminando(true)
                await onEliminarProyecto()
              }}
            >
              {eliminando ? 'Eliminando...' : 'Sí, eliminar proyecto'}
            </Button>
          </div>
        </div>
      )}

      {/* Plan Bloqueado Banner */}
      {proyecto.plan_bloqueado && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-medium shadow-sm">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <div>
            <strong className="font-bold">Plan Bloqueado: </strong>
            El proyecto está en construcción o posterior; las modificaciones estructurales al cronograma y especificaciones técnicas están restringidas.
          </div>
        </div>
      )}

      {/* Stage Transition Error */}
      {errorEstado && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-semibold">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <span>{errorEstado}</span>
        </div>
      )}

      {/* Pipeline Sales Cycle Timeline */}
      <div className="bg-white border border-borde rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            Etapa del Pipeline Comercial
          </span>
          {userCanChangeStage && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted">Cambiar estado:</span>
              <select
                value={proyecto.estado}
                disabled={cambiandoEstado}
                onChange={(e) => handleStageChange(e.target.value as EstadoProyecto)}
                className="text-xs font-semibold border border-borde rounded-lg px-2.5 py-1.5 bg-fondo text-principal focus:outline-none focus:ring-1 focus:ring-principal"
              >
                {STAGE_ORDER.map((stage) => (
                  <option key={stage} value={stage}>
                    {SALES_CYCLE.find((s) => s.key === stage)?.label || stage}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Horizontal Timeline Steps */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center min-w-[700px] justify-between relative">
            <div className="absolute top-3 left-3 right-3 h-0.5 bg-neutral-200 -z-0" />
            {SALES_CYCLE.map((stage, idx) => {
              const isPassed = idx < currentStageIndex
              const isCurrent = idx === currentStageIndex
              const isTerminal = isStageApprovalOrBeyond(stage.key)

              return (
                <div
                  key={stage.key}
                  onClick={() => userCanChangeStage && handleStageChange(stage.key)}
                  className={`flex flex-col items-center gap-1.5 relative z-10 select-none ${
                    userCanChangeStage ? 'cursor-pointer group' : ''
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      isCurrent
                        ? 'bg-principal text-acento ring-4 ring-principal/20 scale-110 shadow-md'
                        : isPassed
                          ? 'bg-green-600 text-white'
                          : isTerminal
                            ? 'bg-white border-2 border-dashed border-neutral-300 text-neutral-400'
                            : 'bg-white border-2 border-neutral-300 text-neutral-400 group-hover:border-principal/50'
                    }`}
                  >
                    {isPassed ? <CheckCircle size={12} /> : idx + 1}
                  </div>
                  <span
                    className={`text-[10px] whitespace-nowrap font-medium ${
                      isCurrent
                        ? 'text-principal font-bold'
                        : isPassed
                          ? 'text-green-700 font-semibold'
                          : 'text-neutral-400'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Resumen Financiero del Proyecto — Alternativa Ganadora */}
      {!editando && (
        <Card className="bg-gradient-to-br from-white to-gray-50/50 border border-borde shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-principal">
                  Resumen Financiero Oficial
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  Alternativa Ganadora
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Cifras oficiales basadas en la alternativa seleccionada. Las alternativas técnicas y de financiamiento son mutuamente excluyentes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {leadingConfig && (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 border border-gray-200"
                  title="Configuración técnica considerada"
                >
                  ⚙️ {leadingConfig.nombre}
                </span>
              )}
              {leadingOpt && (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 border border-gray-200"
                  title="Opción de financiamiento considerada"
                >
                  💳 {leadingOpt.nombre}
                </span>
              )}
            </div>
          </div>

          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-borde shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Inversión Total (CAPEX)
              </span>
              <div className="text-xl font-black text-principal">
                {effectiveCapex > 0 ? fmtCurrency(effectiveCapex, effectiveCapexMoneda) : '—'}
              </div>
              <p
                className="text-[11px] text-gray-500 mt-1 truncate"
                title={leadingConfig ? leadingConfig.nombre : 'Estimación del proyecto'}
              >
                {leadingConfig ? leadingConfig.nombre : 'Estimación del proyecto'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-borde shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Ahorro Anual Estimado
              </span>
              <div className="text-xl font-black text-emerald-600">
                {effectiveSavings && effectiveSavings > 0
                  ? fmtCurrency(effectiveSavings, effectiveSavingsMoneda)
                  : '—'}
              </div>
              <p className="text-[11px] text-gray-500 mt-1 truncate">
                {isNetSavings
                  ? 'Ahorro neto (Financiamiento)'
                  : effectiveSavings
                    ? 'Ahorro bruto (Solución técnica)'
                    : 'Sin ahorro registrado'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-borde shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Retorno Simple (Payback)
              </span>
              <div className="text-xl font-black text-principal">
                {effectivePaybackYears ? `${fmtNum(effectivePaybackYears, 1)} años` : '—'}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {effectivePaybackYears
                  ? `~${Math.round(effectivePaybackYears * 12)} meses de retorno`
                  : 'Requiere CAPEX y ahorro'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-borde shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Vehículo Financiero
              </span>
              <div
                className="text-sm font-bold text-principal truncate mt-1.5"
                title={leadingVehiculoLabel}
              >
                {leadingVehiculoLabel}
              </div>
              <p
                className="text-[11px] text-gray-500 mt-1 truncate"
                title={
                  leadingOpt?.plazo_meses
                    ? `Plazo: ${leadingOpt.plazo_meses} meses`
                    : leadingOpt
                      ? leadingOpt.nombre
                      : 'Modalidad inicial'
                }
              >
                {leadingOpt?.plazo_meses
                  ? `Plazo: ${leadingOpt.plazo_meses} meses`
                  : leadingOpt
                    ? leadingOpt.nombre
                    : 'Modalidad inicial'}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
