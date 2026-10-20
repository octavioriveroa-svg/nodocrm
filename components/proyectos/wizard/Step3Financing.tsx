'use client'

import React from 'react'
import { formatNumberInput } from '@/lib/format'
import type { ModalidadFinanciamiento, Moneda } from '@/lib/types'
import type { CreationConfig, CreationFinancingOption, WizardFormData } from './types'
import { VEHICULOS_FINANCIAMIENTO, inp } from './constants'

interface Step3FinancingProps {
  anyHighDemanda: boolean
  form: WizardFormData
  setF: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void
  financingOptions: CreationFinancingOption[]
  setFinancingOptions: React.Dispatch<React.SetStateAction<CreationFinancingOption[]>>
  toggleVehiculo: (vehiculoId: ModalidadFinanciamiento, nombreEs: string, nombreEn: string) => void
  configs: CreationConfig[]
  foldedCharacteristics: Record<string, boolean>
  setFoldedCharacteristics: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}

export function Step3Financing({
  anyHighDemanda,
  form,
  setF,
  financingOptions,
  setFinancingOptions,
  toggleVehiculo,
  configs,
  foldedCharacteristics,
  setFoldedCharacteristics,
}: Step3FinancingProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-bold text-lg">3. Esquemas de Financiamiento / Financing Schemes</h2>
        <p className="text-xs text-muted">
          Selecciona los esquemas de financiamiento a cotizar para las alternativas técnicas (relación n:n).
          <br />
          <span className="text-[11px] text-gray-400">
            Select the financing schemes to quote for the technical alternatives (n:n relationship).
          </span>
        </p>
      </div>

      {anyHighDemanda && (
        <div
          className="border p-4 rounded-xl"
          style={{ borderColor: 'var(--color-acento)', backgroundColor: 'var(--color-yellow-50)' }}
        >
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.incluye_mem}
              onChange={e => setF('incluye_mem', e.target.checked)}
              className="w-4 h-4 flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold">
                Considerar alternativa de Mercado Eléctrico Mayorista (MEM)
              </p>
              <p className="text-xs mt-0.5 text-muted">
                Uno o más sitios seleccionados tienen más de 1,000 kW de demanda contratada. El analista evaluará si conviene migrar al MEM.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Selector de esquemas predefinidos */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Selecciona los esquemas de financiamiento / Select financing schemes *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {VEHICULOS_FINANCIAMIENTO.map(v => {
            const isSelected = financingOptions.some(o => o.vehiculo_inversion === v.id)
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggleVehiculo(v.id, v.nombreEs, v.nombreEn)}
                className="border rounded-xl p-3.5 text-left transition-all flex items-start gap-3"
                style={{
                  borderColor: isSelected ? 'var(--color-principal)' : 'var(--color-neutral-200)',
                  backgroundColor: isSelected ? 'var(--color-green-50)' : 'var(--color-white)',
                }}
              >
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center mt-0.5 shrink-0 border font-bold text-xs ${
                    isSelected
                      ? 'bg-principal text-acento border-principal'
                      : 'border-gray-300'
                  }`}
                >
                  {isSelected ? '✓' : ''}
                </div>
                <div>
                  <p className="font-bold text-sm text-principal">{v.nombreEs}</p>
                  <p className="text-xs text-muted">{v.nombreEn}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{v.descEs}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Lista de esquemas seleccionados */}
      <div className="flex flex-col gap-3">
        <label className="block text-sm font-semibold">
          Esquemas Seleccionados / Selected Schemes ({financingOptions.length})
        </label>

        {financingOptions.map(opt => {
          const isFolded = foldedCharacteristics[opt.tempId] !== false // folded by default
          return (
            <div
              key={opt.tempId}
              className="border border-borde rounded-xl p-4 bg-white shadow-sm flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-principal" />
                  <span className="font-bold text-sm text-principal">{opt.nombre}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFoldedCharacteristics(prev => ({ ...prev, [opt.tempId]: !isFolded }))
                  }
                  className="text-xs font-semibold text-principal px-3 py-1.5 rounded-lg border border-borde hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                >
                  {isFolded ? (
                    <>
                      <span>▸</span>
                      <span>Características de Financiamiento (Opcional) / Financing Characteristics (Optional)</span>
                    </>
                  ) : (
                    <>
                      <span>▾</span>
                      <span>Ocultar Características / Hide Characteristics</span>
                    </>
                  )}
                </button>
              </div>

              {/* Contenido desplegable */}
              {!isFolded && (
                <div className="pt-3 border-t border-borde flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Plazo (meses) / Term (months) <span className="text-muted text-[10px]">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={opt.plazo_meses}
                        onChange={e =>
                          setFinancingOptions(prev =>
                            prev.map(o =>
                              o.tempId === opt.tempId
                                ? { ...o, plazo_meses: formatNumberInput(e.target.value) }
                                : o
                            )
                          )
                        }
                        className={inp}
                        placeholder="60"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium mb-1">
                        Ahorro neto anual estimado / Estimated Net Annual Savings{' '}
                        <span className="text-muted text-[10px]">(opcional)</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={opt.ahorro_estimado_anual}
                          onChange={e =>
                            setFinancingOptions(prev =>
                              prev.map(o =>
                                o.tempId === opt.tempId
                                ? { ...o, ahorro_estimado_anual: formatNumberInput(e.target.value) }
                                : o
                              )
                            )
                          }
                          className={inp}
                          placeholder="0"
                        />
                        <select
                          value={opt.ahorro_moneda || 'MXN'}
                          onChange={e =>
                            setFinancingOptions(prev =>
                              prev.map(o =>
                                o.tempId === opt.tempId
                                  ? { ...o, ahorro_moneda: e.target.value as Moneda }
                                  : o
                              )
                            )
                          }
                          className={inp}
                          style={{ width: '90px' }}
                        >
                          <option value="MXN">MXN</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Notas y condiciones / Notes & Terms{' '}
                      <span className="text-muted text-[10px]">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={opt.notas}
                      onChange={e =>
                        setFinancingOptions(prev =>
                          prev.map(o => (o.tempId === opt.tempId ? { ...o, notas: e.target.value } : o))
                        )
                      }
                      className={inp}
                      placeholder="Tasa, enganche, condiciones de compra..."
                    />
                  </div>

                  <div>
                    <span className="block text-xs font-semibold mb-1.5 text-muted uppercase tracking-wider">
                      Vincular a Alternativas Técnicas / Link to Technical Alternatives (n:n)
                    </span>
                    <div className="flex flex-wrap gap-3 bg-gray-50 p-2.5 rounded-lg border border-borde">
                      {configs.map(c => {
                        const isLinked = opt.linkedConfigIds.includes(c.tempId)
                        return (
                          <label key={c.tempId} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isLinked}
                              onChange={() => {
                                setFinancingOptions(prev =>
                                  prev.map(o => {
                                    if (o.tempId === opt.tempId) {
                                      const next = o.linkedConfigIds.includes(c.tempId)
                                        ? o.linkedConfigIds.filter(id => id !== c.tempId)
                                        : [...o.linkedConfigIds, c.tempId]
                                      return { ...o, linkedConfigIds: next }
                                    }
                                    return o
                                  })
                                )
                              }}
                              className="w-3.5 h-3.5"
                            />
                            <span>{c.nombre}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Notas adicionales / Additional Notes <span className="text-muted text-[10px]">(opcional)</span>
        </label>
        <textarea
          value={form.notas_adicionales}
          onChange={e => setF('notas_adicionales', e.target.value)}
          rows={3}
          className={inp}
          placeholder="Cualquier información adicional relevante para el analista de Nodo…"
        />
      </div>
    </div>
  )
}
