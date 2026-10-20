'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Pencil, Trash2, CalendarDays, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import type { Proyecto, Profile, EstadoProyecto } from '@/lib/types'
import { SALES_CYCLE, STAGE_ORDER, isStageApprovalOrBeyond } from '@/lib/domains/proyectos/lifecycle'
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
  const userCanEdit = isAdmin || isAnalista || (isEpcista && proyecto.epcista_id === currentUser.id) || (isFinder && proyecto.finder_id === currentUser.id)

  const currentStageIndex = STAGE_ORDER.indexOf(proyecto.estado)

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
              <> • Empresa: <span className="font-semibold text-principal">{proyecto.cliente_final_empresa}</span></>
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
    </div>
  )
}
