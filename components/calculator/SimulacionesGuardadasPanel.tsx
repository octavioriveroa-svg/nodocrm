'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  GitCompare,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import type { Rol, SimulacionAhorro } from '@/lib/types'
import { fmtCurrency, fmtNum, fmtPct } from '@/lib/format'
import {
  eliminarSimulacion,
  recalcularSimulacion,
  renombrarSimulacion,
} from '@/app/actions/simulaciones'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface SimulacionesGuardadasPanelProps {
  simulaciones: SimulacionAhorro[]
  activeSimulacionId: string | null
  isGated: boolean
  currentUserId: string
  userRole: Rol
  proyectoEpcistaId: string | null
  readOnlyMode?: boolean
  onLoad: (sim: SimulacionAhorro) => void
  onDuplicate: (sim: SimulacionAhorro) => void
  onRenamed: (updated: SimulacionAhorro) => void
  onRecalculated: (updated: SimulacionAhorro) => void
  onDeleted: (id: string) => void
}

function formatPaybackShort(sim: SimulacionAhorro): string {
  if (sim.payback_estado === 'inmediato') return 'Inmediato'
  if (sim.payback_estado === 'en_horizonte' && sim.payback_simple_anios != null) {
    return `${fmtNum(sim.payback_simple_anios, 2)} años`
  }
  if (sim.payback_estado === 'fuera_horizonte') return 'Fuera de horizonte'
  return 'No recuperable'
}

export function SimulacionesGuardadasPanel({
  simulaciones,
  activeSimulacionId,
  isGated,
  currentUserId,
  userRole,
  proyectoEpcistaId,
  readOnlyMode = false,
  onLoad,
  onDuplicate,
  onRenamed,
  onRecalculated,
  onDeleted,
}: SimulacionesGuardadasPanelProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [savingRename, setSavingRename] = useState(false)

  const [compareIds, setCompareIds] = useState<string[]>([])
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function showBanner(type: 'ok' | 'err', text: string) {
    setActionMsg({ type, text })
    if (type === 'ok') {
      setTimeout(() => {
        setActionMsg((cur) => (cur?.text === text ? null : cur))
      }, 3000)
    }
  }

  function canMutateSimulation(sim: SimulacionAhorro): boolean {
    if (readOnlyMode) return false
    if (userRole === 'nodo_admin' || userRole === 'nodo_analista') return true
    if (userRole === 'epc' && proyectoEpcistaId === currentUserId) return true
    return sim.created_by === currentUserId
  }

  function toggleCompare(id: string) {
    if (isGated) return
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }

  function startRename(sim: SimulacionAhorro) {
    setEditingId(sim.id)
    setEditName(sim.nombre)
    setEditDesc(sim.descripcion ?? '')
    setConfirmDeleteId(null)
  }

  async function handleSaveRename(sim: SimulacionAhorro) {
    const trimmed = editName.trim()
    if (!trimmed) {
      showBanner('err', 'El nombre del escenario no puede estar vacío.')
      return
    }
    setSavingRename(true)
    const res = await renombrarSimulacion(sim.id, trimmed, editDesc.trim() || null)
    setSavingRename(false)
    if (res.error || !res.data) {
      showBanner('err', res.error || 'No se pudo renombrar la simulación.')
      return
    }
    onRenamed({ ...sim, ...res.data, creador: sim.creador, template: sim.template })
    setEditingId(null)
    showBanner('ok', 'Escenario renombrado correctamente.')
  }

  async function handleRecalculate(sim: SimulacionAhorro) {
    if (isGated || readOnlyMode) return
    setRecalculatingId(sim.id)
    const res = await recalcularSimulacion(sim.id)
    setRecalculatingId(null)
    if (res.error || !res.data) {
      showBanner('err', res.error || 'No se pudo recalcular la simulación.')
      return
    }
    onRecalculated({ ...sim, ...res.data, creador: sim.creador, template: sim.template })
    showBanner('ok', 'Simulación recalculada con los datos actuales del proyecto.')
  }

  async function handleDelete(sim: SimulacionAhorro) {
    setDeletingId(sim.id)
    const res = await eliminarSimulacion(sim.id)
    setDeletingId(null)
    if (res.error) {
      showBanner('err', res.error)
      return
    }
    setConfirmDeleteId(null)
    setCompareIds((prev) => prev.filter((x) => x !== sim.id))
    onDeleted(sim.id)
    showBanner('ok', 'Escenario eliminado.')
  }

  const comparedSimulations = compareIds
    .map((id) => simulaciones.find((s) => s.id === id))
    .filter((s): s is SimulacionAhorro => Boolean(s))

  return (
    <div className="bg-white/80 backdrop-blur-md border border-borde rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-principal">
            Escenarios Guardados ({simulaciones.length})
          </h4>
          <p className="text-xs text-texto-suave mt-0.5">
            {isGated
              ? 'Cifras suprimidas hasta capturar el CAPEX del proyecto.'
              : 'Carga, duplica o selecciona hasta 3 escenarios para comparar lado a lado.'}
          </p>
        </div>

        {!isGated && compareIds.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="info">
              <GitCompare size={12} className="mr-1" />
              {compareIds.length}/3 seleccionados
            </Badge>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs font-semibold text-texto-suave hover:text-principal underline"
            >
              Limpiar comparación
            </button>
          </div>
        )}
      </div>

      {actionMsg && (
        <div
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between ${
            actionMsg.type === 'ok'
              ? 'bg-acento text-principal'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button type="button" onClick={() => setActionMsg(null)} aria-label="Cerrar aviso">
            <X size={14} />
          </button>
        </div>
      )}

      {simulaciones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-linea p-6 text-center text-xs text-texto-suave">
          Aún no hay simulaciones guardadas para este proyecto. Ajusta los parámetros y guarda un escenario para consultarlo después.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {simulaciones.map((sim) => {
            const canEdit = canMutateSimulation(sim)
            const isLoaded = activeSimulacionId === sim.id
            const isComparing = compareIds.includes(sim.id)
            const isConfirmingDel = confirmDeleteId === sim.id
            const isEditing = editingId === sim.id

            return (
              <div
                key={sim.id}
                className={`rounded-xl border p-4 transition-all ${
                  isConfirmingDel
                    ? 'border-red-400 ring-2 ring-red-500/20 bg-red-50/20'
                    : isLoaded
                      ? 'border-principal bg-acento/10 shadow-sm'
                      : 'border-borde bg-white hover:border-principal/40'
                }`}
              >
                {isConfirmingDel ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <p className="text-xs text-principal">
                      ¿Eliminar escenario <strong>{sim.nombre}</strong>? Esta acción no se puede deshacer.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletingId === sim.id}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={deletingId === sim.id}
                        onClick={() => handleDelete(sim)}
                      >
                        {deletingId === sim.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          'Confirmar'
                        )}
                      </Button>
                    </div>
                  </div>
                ) : isEditing ? (
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-texto-suave mb-1">
                        Nombre del escenario *
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-borde px-3 py-1.5 text-sm text-principal bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-texto-suave mb-1">
                        Descripción (opcional)
                      </label>
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full rounded-lg border border-borde px-3 py-1.5 text-xs text-principal bg-white"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={savingRename}
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={savingRename}
                        onClick={() => handleSaveRename(sim)}
                      >
                        {savingRename ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <>
                            <Check size={13} /> Guardar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-sm font-bold text-principal truncate">
                            {sim.nombre}
                          </h5>
                          {sim.usa_parametros_base ? (
                            <Badge variant="info">Base Nodo</Badge>
                          ) : (
                            <Badge variant="neutral">Personalizada</Badge>
                          )}
                          {sim.is_stale && (
                            <Badge variant="warning">
                              <AlertTriangle size={11} className="mr-1" />
                              Datos del proyecto actualizados
                            </Badge>
                          )}
                        </div>
                        {sim.descripcion && (
                          <p className="text-xs text-texto-suave mt-1 line-clamp-2">
                            {sim.descripcion}
                          </p>
                        )}
                      </div>

                      <label
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0 ${
                          isGated ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer text-texto-suave'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isComparing}
                          disabled={isGated}
                          onChange={() => toggleCompare(sim.id)}
                          className="rounded border-borde text-principal"
                        />
                        Comparar
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-texto-suave">
                      <span>
                        Creado por:{' '}
                        <strong className="text-principal">
                          {sim.creador?.nombre || 'Usuario Nodo'}
                        </strong>
                      </span>
                      <span>·</span>
                      <span className="num">{sim.horizonte_anios} años</span>
                      <span>·</span>
                      <span>{sim.vista_financiamiento === 'neto' ? 'Vista Neta' : 'Vista Bruta'}</span>
                      <span>·</span>
                      <span>{sim.moneda_calculo}</span>
                      <span>·</span>
                      <span>
                        {new Date(sim.created_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-fondo/70 px-3 py-2 text-xs">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-texto-suave font-semibold">
                          Ahorro Año 1
                        </span>
                        <span className="num font-bold text-principal">
                          {isGated
                            ? '— (requiere CAPEX)'
                            : fmtCurrency(sim.ahorro_monetario_y1, sim.moneda_calculo)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-texto-suave font-semibold">
                          Payback Simple
                        </span>
                        <span className="num font-bold text-principal">
                          {isGated ? '— (requiere CAPEX)' : formatPaybackShort(sim)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant={isLoaded ? 'secondary' : 'outline'}
                          size="sm"
                          disabled={isGated}
                          onClick={() => onLoad(sim)}
                        >
                          <Play size={12} />
                          {isLoaded ? 'Cargada' : 'Cargar'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isGated}
                          onClick={() => onDuplicate(sim)}
                        >
                          <Copy size={12} />
                          Duplicar
                        </Button>
                        {sim.is_stale && !readOnlyMode && (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={isGated || recalculatingId === sim.id}
                            onClick={() => handleRecalculate(sim)}
                          >
                            {recalculatingId === sim.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RefreshCw size={12} />
                            )}
                            Recalcular con datos actuales
                          </Button>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startRename(sim)}
                            title="Renombrar"
                            className="p-1.5 rounded-lg border border-borde bg-white text-texto-suave hover:text-principal hover:border-principal/40 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(sim.id)}
                            title="Eliminar"
                            className="p-1.5 rounded-lg border border-borde bg-white text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!isGated && comparedSimulations.length >= 2 && (
        <div className="mt-4 border border-linea rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-principal text-white flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              <GitCompare size={14} className="text-acento" />
              Matriz Comparativa de Escenarios ({comparedSimulations.length})
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-fondo border-b border-linea">
                  <th className="text-left px-4 py-2.5 font-bold text-texto-suave">Métrica</th>
                  {comparedSimulations.map((s) => (
                    <th key={s.id} className="text-right px-4 py-2.5 font-bold text-principal">
                      {s.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-linea bg-white">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-texto-suave">CAPEX</td>
                  {comparedSimulations.map((s) => (
                    <td key={s.id} className="num px-4 py-2.5 text-right font-semibold text-principal">
                      {fmtCurrency(s.capex_snapshot, s.moneda_calculo)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-texto-suave">Parámetros</td>
                  {comparedSimulations.map((s) => (
                    <td key={s.id} className="px-4 py-2.5 text-right text-principal">
                      {s.usa_parametros_base ? 'Base Nodo' : 'Personalizada'} · {s.horizonte_anios}a ·{' '}
                      {s.vista_financiamiento === 'neto' ? 'Neto' : 'Bruto'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-texto-suave">Ahorro Año 1</td>
                  {comparedSimulations.map((s) => (
                    <td key={s.id} className="num px-4 py-2.5 text-right font-bold text-menta">
                      {fmtCurrency(s.ahorro_monetario_y1, s.moneda_calculo)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-texto-suave">Ahorro Total</td>
                  {comparedSimulations.map((s) => (
                    <td key={s.id} className="num px-4 py-2.5 text-right font-bold text-principal">
                      {fmtCurrency(s.ahorro_monetario_total, s.moneda_calculo)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-texto-suave">Payback Simple</td>
                  {comparedSimulations.map((s) => (
                    <td key={s.id} className="num px-4 py-2.5 text-right font-semibold text-principal">
                      {formatPaybackShort(s)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-texto-suave">VAN</td>
                  {comparedSimulations.map((s) => (
                    <td key={s.id} className="num px-4 py-2.5 text-right font-semibold text-principal">
                      {s.van != null ? fmtCurrency(s.van, s.moneda_calculo) : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-texto-suave">TIR</td>
                  {comparedSimulations.map((s) => (
                    <td key={s.id} className="num px-4 py-2.5 text-right font-semibold text-principal">
                      {s.tir_pct != null ? fmtPct(s.tir_pct, 2) : '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default SimulacionesGuardadasPanel
