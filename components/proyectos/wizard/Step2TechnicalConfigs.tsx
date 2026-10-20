'use client'

import React from 'react'
import { Plus, X, Zap, Battery } from 'lucide-react'
import { formatNumberInput } from '@/lib/format'
import type { Moneda, Sitio } from '@/lib/types'
import type { CreationConfig, FVForm, BESSForm } from './types'
import { ProductoCard, CalcField } from './ProductoCard'
import { calcFV, calcBESS } from './calculations'
import { inp } from './constants'

interface Step2TechnicalConfigsProps {
  configs: CreationConfig[]
  setConfigs: React.Dispatch<React.SetStateAction<CreationConfig[]>>
  activeConfigId: string
  setActiveConfigId: (id: string) => void
  selectedSiteIds: string[]
  sitiosCliente: Sitio[]
  activeConfig: CreationConfig
  addingToSitioId: string | null
  setAddingToSitioId: (id: string | null) => void
  productTipo: 'fv' | 'bess' | null
  setProductTipo: (t: 'fv' | 'bess' | null) => void
  fvForm: FVForm
  setFvForm: React.Dispatch<React.SetStateAction<FVForm>>
  bessForm: BESSForm
  setBessForm: React.Dispatch<React.SetStateAction<BESSForm>>
  addProductError: string
  guardarProducto: (sitioId: string) => void
  removeProduct: (sitioId: string, tempId: string) => void
  activeConfigCapex: number
  activeConfigMoneda: Moneda
  startAddingProduct: (sitioId: string) => void
}

export function Step2TechnicalConfigs({
  configs,
  setConfigs,
  activeConfigId,
  setActiveConfigId,
  selectedSiteIds,
  sitiosCliente,
  activeConfig,
  addingToSitioId,
  setAddingToSitioId,
  productTipo,
  setProductTipo,
  fvForm,
  setFvForm,
  bessForm,
  setBessForm,
  addProductError,
  guardarProducto,
  removeProduct,
  activeConfigCapex,
  activeConfigMoneda,
  startAddingProduct,
}: Step2TechnicalConfigsProps) {
  const fvCalc = calcFV(fvForm)
  const bessCalc = calcBESS(bessForm)
  const sitiosSeleccionados = activeConfig.sitiosSeleccionados
  const productosMap = activeConfig.productosMap

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-bold text-lg">2. Alternativas Técnicas / Technical Alternatives</h2>
        <p className="text-xs text-muted">
          Define una o varias propuestas técnicas para los sitios seleccionados (relación 1:n).
          <br />
          <span className="text-[11px] text-gray-400">
            Define one or more technical proposals for the selected sites (1:n relationship).
          </span>
        </p>
      </div>

      {/* Configurations Tab Bar */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-borde">
        {configs.map((c, idx) => (
          <button
            key={c.tempId}
            type="button"
            onClick={() => {
              setActiveConfigId(c.tempId)
              setAddingToSitioId(null)
            }}
            className="px-4 py-2 text-sm font-semibold rounded-lg border transition-all flex items-center gap-2"
            style={{
              backgroundColor: activeConfigId === c.tempId ? 'var(--color-principal)' : 'var(--color-white)',
              color: activeConfigId === c.tempId ? 'var(--color-acento)' : 'var(--color-texto-suave)',
              borderColor: activeConfigId === c.tempId ? 'var(--color-principal)' : 'var(--color-neutral-200)',
            }}
          >
            <span>{c.nombre || `Alternativa ${idx + 1}`}</span>
            {configs.length > 1 && (
              <X
                size={14}
                onClick={e => {
                  e.stopPropagation()
                  setConfigs(prev => {
                    const next = prev.filter(item => item.tempId !== c.tempId)
                    if (activeConfigId === c.tempId && next.length > 0) {
                      setActiveConfigId(next[0].tempId)
                    }
                    return next
                  })
                }}
                className="hover:text-red-500 transition-colors"
              />
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const newId = `config-${Date.now()}`
            setConfigs(prev => [
              ...prev,
              {
                tempId: newId,
                nombre: `Alternativa ${String.fromCharCode(65 + prev.length)}`,
                descripcion: '',
                sitiosSeleccionados: selectedSiteIds,
                productosMap: Object.fromEntries(selectedSiteIds.map(sId => [sId, []])),
                ahorro_estimado_anual: '',
                ahorro_moneda: 'MXN',
              },
            ])
            setActiveConfigId(newId)
          }}
          className="px-4 py-2 text-sm font-semibold rounded-lg border border-dashed border-borde bg-white hover:border-black transition-all flex items-center gap-1"
        >
          <Plus size={14} /> Nueva alternativa / New Alternative
        </button>
      </div>

      {/* Active Configuration Details Form */}
      <div className="bg-fondo/35 p-4 rounded-xl border border-borde flex flex-col gap-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Detalles de esta alternativa / Alternative Details
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Nombre de la alternativa / Name *</label>
            <input
              type="text"
              value={activeConfig.nombre}
              onChange={e => {
                setConfigs(prev =>
                  prev.map(c => (c.tempId === activeConfigId ? { ...c, nombre: e.target.value } : c))
                )
              }}
              className={inp}
              placeholder="Ej: Alternativa A - Solo FV 100 kWp"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Descripción / Description <span className="text-muted text-[10px]">(opcional)</span>
            </label>
            <input
              type="text"
              value={activeConfig.descripcion}
              onChange={e => {
                setConfigs(prev =>
                  prev.map(c => (c.tempId === activeConfigId ? { ...c, descripcion: e.target.value } : c))
                )
              }}
              className={inp}
              placeholder="Ej: Opción con 150 kWp y sin baterías"
            />
          </div>
        </div>

        <div className="text-xs text-muted flex justify-between items-center mt-1 pt-2 border-t border-borde">
          <span>Inversión total estimada (CAPEX acumulado):</span>
          <span className="font-bold text-sm text-principal">
            ${activeConfigCapex.toLocaleString('es-MX')} {activeConfigMoneda}
          </span>
        </div>

        <div className="text-xs text-muted flex justify-between items-center mt-1 pt-2 border-t border-borde">
          <span>Ahorro bruto estimado anual / Estimated Gross Annual Savings:</span>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={activeConfig.ahorro_estimado_anual}
              onChange={e => {
                setConfigs(prev =>
                  prev.map(c =>
                    c.tempId === activeConfigId
                      ? { ...c, ahorro_estimado_anual: formatNumberInput(e.target.value) }
                      : c
                  )
                )
              }}
              className={inp}
              style={{ width: '140px' }}
              placeholder="0"
            />
            <select
              value={activeConfig.ahorro_moneda}
              onChange={e => {
                setConfigs(prev =>
                  prev.map(c =>
                    c.tempId === activeConfigId
                      ? { ...c, ahorro_moneda: e.target.value as Moneda }
                      : c
                  )
                )
              }}
              className={inp}
              style={{ width: '90px' }}
            >
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sites & Products under active alternative */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Productos por Sitio / Products per Site
        </label>

        <div className="flex flex-col gap-4">
          {(selectedSiteIds.length > 0 ? selectedSiteIds : sitiosSeleccionados).map(sId => {
            const s = sitiosCliente.find(site => site.id === sId)
            if (!s) return null
            const productos = productosMap[sId] ?? []
            const isAdding = addingToSitioId === sId

            return (
              <div key={sId} className="border border-borde rounded-xl p-4 bg-white shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-borde">
                  <div>
                    <span className="font-bold text-sm text-principal">{s.nombre}</span>
                    {(s.ciudad || s.ubicacion_estado) && (
                      <span className="text-xs text-muted ml-2">
                        {[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {s.demanda_contratada_kw && (
                      <span className="text-xs font-semibold text-gray-500 ml-2">
                        · {s.demanda_contratada_kw.toLocaleString('es-MX')} kW
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted font-medium">
                    {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
                  </span>
                </div>

                {/* Lista de productos para este sitio */}
                {productos.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {productos.map(p => (
                      <ProductoCard
                        key={p.tempId}
                        p={p}
                        onRemove={() => removeProduct(sId, p.tempId)}
                      />
                    ))}
                  </div>
                )}

                {/* Botón / Formulario agregar producto */}
                {!isAdding ? (
                  <button
                    type="button"
                    onClick={() => startAddingProduct(sId)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-borde rounded-xl text-xs font-medium text-muted hover:border-principal hover:text-principal transition-colors bg-gray-50/50"
                  >
                    <Plus size={13} />
                    {productos.length === 0
                      ? 'Agregar primer producto (FV o BESS) / Add product'
                      : 'Agregar otro producto / Add another product'}
                  </button>
                ) : (
                  <div
                    className="border p-4 rounded-xl"
                    style={{ borderColor: 'var(--color-principal)', backgroundColor: 'var(--color-white)' }}
                  >
                    {/* Selector de tipo */}
                    {!productTipo ? (
                      <div>
                        <p className="text-xs font-bold mb-3">¿Qué tipo de producto? / Product type</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setProductTipo('fv')}
                            className="border p-4 flex flex-col items-center gap-2 transition-colors hover:border-black border-borde rounded-xl"
                          >
                            <Zap size={20} />
                            <span className="text-sm font-bold">Fotovoltaico</span>
                            <span className="text-xs text-center text-muted">Paneles solares e inversores</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductTipo('bess')}
                            className="border p-4 flex flex-col items-center gap-2 transition-colors hover:border-black border-borde rounded-xl"
                          >
                            <Battery size={20} />
                            <span className="text-sm font-bold">BESS</span>
                            <span className="text-xs text-center text-muted">Sistema de almacenamiento</span>
                          </button>
                        </div>
                        <div className="flex justify-end mt-3">
                          <button
                            type="button"
                            onClick={() => setAddingToSitioId(null)}
                            className="px-3 py-1.5 text-xs border border-borde rounded-xl"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : productTipo === 'fv' ? (
                      /* Formulario FV */
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-bold flex items-center gap-2">
                            <Zap size={14} /> Fotovoltaico / Solar PV
                          </p>
                          <button
                            type="button"
                            onClick={() => setProductTipo(null)}
                            className="text-xs underline text-muted"
                          >
                            ← Cambiar tipo
                          </button>
                        </div>
                        <div className="flex flex-col gap-3">
                          {/* Módulos */}
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Módulos</p>
                          <div className="grid grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-xs font-medium mb-1">No. Módulos *</label>
                              <input
                                type="text"
                                value={fvForm.num_modulos}
                                onChange={e =>
                                  setFvForm(f => ({ ...f, num_modulos: formatNumberInput(e.target.value) }))
                                }
                                className={inp}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Potencia (W) *</label>
                              <input
                                type="text"
                                value={fvForm.potencia_modulos_w}
                                onChange={e =>
                                  setFvForm(f => ({ ...f, potencia_modulos_w: formatNumberInput(e.target.value) }))
                                }
                                className={inp}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Marca *</label>
                              <input
                                type="text"
                                value={fvForm.marca_modulos}
                                onChange={e => setFvForm(f => ({ ...f, marca_modulos: e.target.value }))}
                                className={inp}
                                placeholder="Jinko, LONGi…"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <CalcField label="kWp sistema" value={fvCalc.kwpSistema} unit="kWp" />
                          </div>

                          {/* Inversores */}
                          <p className="text-xs font-semibold uppercase tracking-wide mt-1 text-muted">Inversores</p>
                          {addingToSitioId &&
                            (productosMap[addingToSitioId] ?? []).some(
                              p => p.tipo === 'bess' && p.bess?.inversores_hibridos
                            ) && (
                              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded-lg mb-2">
                                Los inversores del BESS híbrido cubren este producto FV. Los campos de inversores son opcionales.
                              </div>
                            )}
                          <div className="grid grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-xs font-medium mb-1">No. Inversores *</label>
                              <input
                                type="text"
                                value={fvForm.num_inversores}
                                onChange={e =>
                                  setFvForm(f => ({ ...f, num_inversores: formatNumberInput(e.target.value) }))
                                }
                                className={inp}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Potencia (kW) *</label>
                              <input
                                type="text"
                                value={fvForm.potencia_inversores_kw}
                                onChange={e =>
                                  setFvForm(f => ({ ...f, potencia_inversores_kw: formatNumberInput(e.target.value) }))
                                }
                                className={inp}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Marca *</label>
                              <input
                                type="text"
                                value={fvForm.marca_inversores}
                                onChange={e => setFvForm(f => ({ ...f, marca_inversores: e.target.value }))}
                                className={inp}
                                placeholder="Huawei, SMA…"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <CalcField label="kWp inversores" value={fvCalc.kwpInversores} unit="kW" />
                          </div>

                          {/* Generación y CAPEX */}
                          <p className="text-xs font-semibold uppercase tracking-wide mt-1 text-muted">
                            Generación y CAPEX
                          </p>
                          <div>
                            <label className="block text-xs font-medium mb-1">Generación anual estimada (kWh) *</label>
                            <input
                              type="text"
                              value={fvForm.generacion_anual_kwh}
                              onChange={e =>
                                setFvForm(f => ({ ...f, generacion_anual_kwh: formatNumberInput(e.target.value) }))
                              }
                              className={inp}
                              placeholder="0"
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-xs font-medium mb-1">CAPEX *</label>
                              <input
                                type="text"
                                value={fvForm.capex}
                                onChange={e => setFvForm(f => ({ ...f, capex: formatNumberInput(e.target.value) }))}
                                className={inp}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Moneda</label>
                              <select
                                value={fvForm.capex_moneda}
                                onChange={e => setFvForm(f => ({ ...f, capex_moneda: e.target.value as Moneda }))}
                                className={inp}
                              >
                                <option value="USD">USD</option>
                                <option value="MXN">MXN</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <CalcField label="Precio / Watt" value={fvCalc.precioWatt} unit="USD/W" />
                          </div>

                          {addProductError && (
                            <p className="text-xs text-red-600 font-medium">{addProductError}</p>
                          )}

                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => setAddingToSitioId(null)}
                              className="px-3 py-1.5 text-xs border border-borde rounded-xl"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => guardarProducto(sId)}
                              className="px-4 py-1.5 text-xs font-bold bg-principal text-acento rounded-xl"
                            >
                              Guardar producto
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Formulario BESS */
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-bold flex items-center gap-2">
                            <Battery size={14} /> BESS / Energy Storage
                          </p>
                          <button
                            type="button"
                            onClick={() => setProductTipo(null)}
                            className="text-xs underline text-muted"
                          >
                            ← Cambiar tipo
                          </button>
                        </div>
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-xs font-medium mb-1">Potencia (kW) *</label>
                              <input
                                type="text"
                                value={bessForm.potencia_kw}
                                onChange={e =>
                                  setBessForm(f => ({ ...f, potencia_kw: formatNumberInput(e.target.value) }))
                                }
                                className={inp}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Capacidad (kWh) *</label>
                              <input
                                type="text"
                                value={bessForm.capacidad_kwh}
                                onChange={e =>
                                  setBessForm(f => ({ ...f, capacidad_kwh: formatNumberInput(e.target.value) }))
                                }
                                className={inp}
                                placeholder="0"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Marca *</label>
                            <input
                              type="text"
                              value={bessForm.marca}
                              onChange={e => setBessForm(f => ({ ...f, marca: e.target.value }))}
                              className={inp}
                              placeholder="Tesla, BYD, CATL…"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Uso *</label>
                            <select
                              value={bessForm.uso}
                              onChange={e => setBessForm(f => ({ ...f, uso: e.target.value }))}
                              className={inp}
                            >
                              <option value="load_shifting">Load shifting</option>
                              <option value="ups">Respaldo (UPS)</option>
                              <option value="load_shifting_ups">Load shifting + Respaldo</option>
                            </select>
                          </div>
                          <div className="pt-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={bessForm.inversores_hibridos}
                                onChange={e =>
                                  setBessForm(f => ({ ...f, inversores_hibridos: e.target.checked }))
                                }
                                className="w-4 h-4 rounded border-gray-300 text-principal focus:ring-acento"
                              />
                              <span className="text-xs font-medium text-principal">
                                Inversores híbridos (también manejan FV)
                              </span>
                            </label>
                            <p className="text-[11px] text-muted ml-6 mt-0.5">
                              Si se activa, los productos FV en este mismo sitio no requerirán especificar inversores adicionales.
                            </p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-xs font-medium mb-1">CAPEX *</label>
                              <input
                                type="text"
                                value={bessForm.capex}
                                onChange={e =>
                                  setBessForm(f => ({ ...f, capex: formatNumberInput(e.target.value) }))
                                }
                                className={inp}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Moneda</label>
                              <select
                                value={bessForm.capex_moneda}
                                onChange={e =>
                                  setBessForm(f => ({ ...f, capex_moneda: e.target.value as Moneda }))
                                }
                                className={inp}
                              >
                                <option value="USD">USD</option>
                                <option value="MXN">MXN</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <CalcField label="Precio / kWh" value={bessCalc.precioKwh} unit="USD/kWh" />
                          </div>

                          {addProductError && (
                            <p className="text-xs text-red-600 font-medium">{addProductError}</p>
                          )}

                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => setAddingToSitioId(null)}
                              className="px-3 py-1.5 text-xs border border-borde rounded-xl"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => guardarProducto(sId)}
                              className="px-4 py-1.5 text-xs font-bold bg-principal text-acento rounded-xl"
                            >
                              Guardar producto
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
