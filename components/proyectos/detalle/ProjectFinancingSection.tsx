'use client'

import React from 'react'
import { Pencil, AlertTriangle, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Seccion } from './common'
import type {
  Proyecto,
  Profile,
  ConfiguracionTecnica,
  OpcionFinanciamiento,
  ConfigFinanciamiento,
  ModalidadFinanciamiento,
} from '@/lib/types'
import { fmtCurrency } from '@/lib/format'
import { MODALIDAD_LABELS } from '@/lib/domains/proyectos/lifecycle'
import { canEditTechnicalSolution, canSelectWinningOption } from '@/lib/domains/auth/permissions'

interface Props {
  proyecto: Proyecto
  currentUser: Profile
  configsList: ConfiguracionTecnica[]
  opcionesFin: OpcionFinanciamiento[]
  configFinLinks: ConfigFinanciamiento[]
  onOpenEditFinanciamiento: () => void
  onSelectFinancing: (optionId: string, vehiculo: ModalidadFinanciamiento) => Promise<void>
  seleccionandoFinancing: boolean
}

export default function ProjectFinancingSection({
  proyecto,
  currentUser,
  configsList,
  opcionesFin,
  configFinLinks,
  onOpenEditFinanciamiento,
  onSelectFinancing,
  seleccionandoFinancing,
}: Props) {
  const canEdit = canEditTechnicalSolution(currentUser.rol, {
    created_by: proyecto.epcista_id,
    currentUserId: currentUser.id,
  })

  const canSelect = canSelectWinningOption(currentUser.rol, {
    created_by: proyecto.epcista_id,
    currentUserId: currentUser.id,
  })

  return (
    <Seccion
      title="Opciones de financiamiento"
      action={
        canEdit ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenEditFinanciamiento}
            className="flex items-center gap-1.5"
          >
            <Pencil size={12} /> Modificar Financiamiento
          </Button>
        ) : undefined
      }
    >
      {opcionesFin.length === 0 ? (
        <p className="text-sm text-gray-400">
          Sin opciones de financiamiento configuradas para este proyecto.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-500">
            Las opciones de financiamiento representan escenarios alternativos independientes. Solo la opción seleccionada como{' '}
            <strong className="text-emerald-700">Ganadora</strong> se refleja en el ahorro neto y retorno oficial del proyecto.
          </p>

          {/* Warning if no financing selected and state is negociacion or beyond */}
          {!opcionesFin.some((o) => o.seleccionada) &&
            ['negociacion', 'aprobado', 'en_construccion', 'operativo', 'completado'].includes(
              proyecto.estado
            ) && (
              <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2.5 text-amber-800 text-xs font-semibold">
                <AlertTriangle className="shrink-0 text-amber-500 mt-0.5" size={16} />
                <div>
                  <p className="font-bold text-amber-900">Opción de financiamiento requerida</p>
                  <p className="font-medium text-amber-800 mt-0.5">
                    Se debe seleccionar una opción de financiamiento ganadora antes de poder avanzar en el pipeline del proyecto.
                  </p>
                </div>
              </div>
            )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {opcionesFin.map((o) => {
              const isSelected = o.seleccionada
              const linkedConfigs = configFinLinks
                .filter((link) => link.opcion_financiamiento_id === o.id)
                .map((link) => configsList.find((c) => c.id === link.configuracion_id)?.nombre)
                .filter(Boolean)

              const ahorroNetoAnual =
                o.ahorro_estimado_anual ??
                (o.ahorro_estimado_mensual !== null && o.ahorro_estimado_mensual !== undefined
                  ? o.ahorro_estimado_mensual * 12
                  : null)

              return (
                <div
                  key={o.id}
                  className={`border rounded-xl p-5 relative transition-all shadow-sm ${
                    isSelected ? 'border-emerald-500 bg-emerald-50/20' : 'border-borde bg-white'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-4 right-4 text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={12} /> Ganadora
                    </span>
                  )}

                  <h4 className="font-bold text-sm text-principal mb-2 pr-20">{o.nombre}</h4>

                  {o.vehiculo_inversion === 'no_sabe' ? (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg font-medium">
                      Nodo definirá las mejores alternativas de financiamiento para este proyecto.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                      <div>
                        <span className="text-muted block">Vehículo:</span>
                        <span className="font-bold text-principal">
                          {MODALIDAD_LABELS[o.vehiculo_inversion as ModalidadFinanciamiento] ||
                            o.vehiculo_inversion}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted block">Ahorro anual:</span>
                        <span className="font-bold text-emerald-600">
                          {ahorroNetoAnual !== null
                            ? fmtCurrency(ahorroNetoAnual, o.moneda || 'MXN')
                            : '—'}
                        </span>
                      </div>
                      {o.plazo_meses && (
                        <div>
                          <span className="text-muted block">Plazo:</span>
                          <span className="font-semibold text-principal">
                            {o.plazo_meses} meses
                          </span>
                        </div>
                      )}
                      {o.notas && (
                        <div className="col-span-2">
                          <span className="text-muted block">Notas:</span>
                          <span className="text-gray-600 break-words">{o.notas}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {o.vehiculo_inversion !== 'no_sabe' && linkedConfigs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5">
                        Alternativas compatibles:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {linkedConfigs.map((name) => (
                          <span
                            key={name}
                            className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-semibold border border-gray-200"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {canSelect && !isSelected && (
                    <div className="mt-4 flex justify-end">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={seleccionandoFinancing}
                        onClick={() =>
                          onSelectFinancing(o.id, o.vehiculo_inversion as ModalidadFinanciamiento)
                        }
                      >
                        {seleccionandoFinancing ? 'Seleccionando...' : 'Seleccionar como ganadora'}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Seccion>
  )
}
