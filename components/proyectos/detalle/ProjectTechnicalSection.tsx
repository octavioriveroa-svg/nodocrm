'use client'

import React, { useState } from 'react'
import { Pencil, AlertTriangle, MapPin, Zap, Battery } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Seccion, Campo } from './common'
import type { Proyecto, Profile, ConfiguracionTecnica, ProyectoSitioProducto } from '@/lib/types'
import { fmtNum, fmtCurrency, fmtUnit } from '@/lib/format'
import { parseNum } from '@/lib/domains/proyectos/schemas'
import { canEditTechnicalSolution, canSelectWinningOption } from '@/lib/domains/auth/permissions'

interface Props {
  proyecto: Proyecto
  currentUser: Profile
  configsList: ConfiguracionTecnica[]
  productos: ProyectoSitioProducto[]
  onOpenEditTecnica: () => void
  onSelectConfig: (configId: string) => Promise<void>
  seleccionandoConfig: boolean
}

const usoLabel: Record<string, string> = {
  load_shifting: 'Load Shifting',
  ups: 'UPS',
  load_shifting_ups: 'Load Shifting + UPS',
}

export default function ProjectTechnicalSection({
  proyecto,
  currentUser,
  configsList,
  productos,
  onOpenEditTecnica,
  onSelectConfig,
  seleccionandoConfig,
}: Props) {
  const canEditTecnica = canEditTechnicalSolution(currentUser.rol, {
    created_by: proyecto.epcista_id,
    currentUserId: currentUser.id,
  })

  const canSelectConfig = canSelectWinningOption(currentUser.rol, {
    created_by: proyecto.epcista_id,
    currentUserId: currentUser.id,
  })

  // Normalize configs list
  const configsToUse: ConfiguracionTecnica[] =
    configsList.length > 0
      ? configsList
      : [
          {
            id: 'legacy',
            proyecto_id: proyecto.id,
            nombre: 'Solución Base',
            descripcion: 'Configuración importada del proyecto original',
            inversion_total: proyecto.capex_estimado,
            moneda: proyecto.moneda,
            ahorro_estimado_mensual: null,
            ahorro_moneda: proyecto.moneda,
            seleccionada: true,
            created_at: '',
            updated_at: '',
          },
        ]

  const [selectedConfigId, setSelectedConfigId] = useState<string>(
    () => configsToUse.find((c) => c.seleccionada)?.id || configsToUse[0]?.id
  )

  const activeConfig =
    configsToUse.find((c) => c.id === selectedConfigId) || configsToUse[0]

  const activeProducts = productos.filter(
    (p) =>
      p.configuracion_id === activeConfig.id ||
      (activeConfig.id === 'legacy' && !p.configuracion_id)
  )

  const bySitio: Record<string, { nombre: string; items: ProyectoSitioProducto[] }> = {}
  for (const p of activeProducts) {
    if (!bySitio[p.sitio_id]) {
      bySitio[p.sitio_id] = { nombre: p.sitios?.nombre ?? 'Sitio', items: [] }
    }
    bySitio[p.sitio_id].items.push(p)
  }

  let totalKwp = 0
  let totalKwh = 0
  let totalFvCapex = 0
  let totalBessCapex = 0

  for (const p of activeProducts) {
    const d = (p.datos ?? {}) as Record<string, unknown>
    if (p.tipo === 'fv') {
      const nm = parseNum(d.num_modulos)
      const pw = parseNum(d.potencia_modulos_w)
      totalKwp += nm > 0 && pw > 0 ? (nm * pw) / 1000 : 0
      totalFvCapex += parseNum(d.capex)
    } else if (p.tipo === 'bess') {
      totalKwh += parseNum(d.capacidad_kwh)
      totalBessCapex += parseNum(d.capex)
    }
  }

  const rawAhorroBrutoAnual =
    activeConfig.ahorro_estimado_anual ??
    (activeConfig.ahorro_estimado_mensual != null ? activeConfig.ahorro_estimado_mensual * 12 : null)
  const ahorroBrutoAnual = rawAhorroBrutoAnual != null ? Number(rawAhorroBrutoAnual) : null

  return (
    <Seccion
      title="Solución técnica"
      action={
        canEditTecnica ? (
          <Button size="sm" variant="outline" onClick={onOpenEditTecnica} className="flex items-center gap-1.5">
            <Pencil size={12} /> Modificar Solución Técnica
          </Button>
        ) : undefined
      }
    >
      {/* Warning if no config selected in later stages */}
      {!configsList.some((c) => c.seleccionada) &&
        ['negociacion', 'aprobado', 'en_construccion', 'operativo', 'completado'].includes(
          proyecto.estado
        ) && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2.5 text-amber-800 text-xs font-semibold">
            <AlertTriangle className="shrink-0 text-amber-500 mt-0.5" size={16} />
            <div>
              <p className="font-bold text-amber-900">Configuración técnica requerida</p>
              <p className="font-medium text-amber-800 mt-0.5">
                Se debe seleccionar una configuración técnica ganadora antes de poder avanzar en el pipeline del proyecto.
              </p>
            </div>
          </div>
        )}

      {/* Comparativa de Alternativas Técnicas */}
      {configsToUse.length > 1 && (
        <div className="mb-6 bg-white border border-borde rounded-xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-principal">
                Comparativa de Alternativas Técnicas
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Las configuraciones son alternativas mutuamente excluyentes. Solo la alternativa marcada como{' '}
                <strong className="text-emerald-700">Ganadora</strong> se computa en el CAPEX y ahorros oficiales del proyecto y portafolio.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Alternativa</th>
                  <th className="py-2.5 px-3">Inversión (CAPEX)</th>
                  <th className="py-2.5 px-3">Ahorro Bruto Anual</th>
                  <th className="py-2.5 px-3">Payback Estimado</th>
                  <th className="py-2.5 px-3">Capacidad</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {configsToUse.map((c) => {
                  const isWin = !!c.seleccionada
                  const isActive = activeConfig.id === c.id
                  const confProds = productos.filter(
                    (p) => p.configuracion_id === c.id || (c.id === 'legacy' && !p.configuracion_id)
                  )
                  let confKwp = 0
                  let confKwh = 0
                  for (const prod of confProds) {
                    const d = (prod.datos ?? {}) as Record<string, unknown>
                    if (prod.tipo === 'fv') {
                      const nm = parseNum(d.num_modulos)
                      const pw = parseNum(d.potencia_modulos_w)
                      confKwp += nm > 0 && pw > 0 ? (nm * pw) / 1000 : 0
                    } else if (prod.tipo === 'bess') {
                      confKwh += parseNum(d.capacidad_kwh)
                    }
                  }
                  const cAhorroAnual =
                    c.ahorro_estimado_anual != null
                      ? Number(c.ahorro_estimado_anual)
                      : c.ahorro_estimado_mensual != null
                        ? Number(c.ahorro_estimado_mensual) * 12
                        : null
                  const cPayback =
                    c.inversion_total && cAhorroAnual && cAhorroAnual > 0
                      ? Number(c.inversion_total) / cAhorroAnual
                      : null

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        isActive ? 'bg-amber-50/30' : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-principal flex items-center gap-1.5">
                          {c.nombre}
                          {isActive && (
                            <span className="text-[9px] bg-principal/10 text-principal px-1.5 py-0.5 rounded font-medium">
                              Viendo
                            </span>
                          )}
                        </div>
                        {c.descripcion && (
                          <div className="text-[10px] text-gray-400 truncate max-w-xs">
                            {c.descripcion}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-principal">
                        {c.inversion_total ? fmtCurrency(c.inversion_total, c.moneda) : '—'}
                      </td>
                      <td className="py-3 px-3 font-semibold text-emerald-600">
                        {cAhorroAnual && cAhorroAnual > 0
                          ? fmtCurrency(cAhorroAnual, c.ahorro_moneda || c.moneda || 'MXN')
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {cPayback ? `${fmtNum(cPayback, 1)} años` : '—'}
                      </td>
                      <td className="py-3 px-3 text-gray-500">
                        {[
                          confKwp > 0 ? `${fmtNum(confKwp, 1)} kWp FV` : null,
                          confKwh > 0 ? `${fmtNum(confKwh, 1)} kWh BESS` : null,
                        ]
                          .filter(Boolean)
                          .join(' + ') || '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isWin ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            ✓ Ganadora
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            Alternativa
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => setSelectedConfigId(c.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-gray-600 hover:text-principal underline"
                            >
                              Ver desglose
                            </button>
                          )}
                          {canSelectConfig && !isWin && c.id !== 'legacy' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={seleccionandoConfig}
                              onClick={() => onSelectConfig(c.id)}
                              className="text-[11px] py-1 px-2.5 h-auto"
                            >
                              {seleccionandoConfig ? '...' : 'Elegir ganadora'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Config Tabs */}
      {configsToUse.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4 border-b border-borde pb-3">
          {configsToUse.map((c) => {
            const isActive = activeConfig.id === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedConfigId(c.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                  isActive
                    ? 'bg-principal text-acento border-principal shadow-sm'
                    : 'border-borde bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <span>{c.nombre}</span>
                {c.seleccionada && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Seleccionada como ganadora" />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Active Config Overview */}
      <div className="bg-gray-50/50 border border-borde rounded-xl p-5 mb-5">
        <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
          <div>
            <h4 className="text-sm font-bold text-principal flex items-center gap-2">
              {activeConfig.nombre}
              {activeConfig.seleccionada && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Ganadora
                </span>
              )}
            </h4>
            {activeConfig.descripcion && (
              <p className="text-xs text-gray-500 mt-1">{activeConfig.descripcion}</p>
            )}
          </div>
          {canSelectConfig && !activeConfig.seleccionada && activeConfig.id !== 'legacy' && (
            <Button
              size="sm"
              variant="primary"
              disabled={seleccionandoConfig}
              onClick={() => onSelectConfig(activeConfig.id)}
            >
              {seleccionandoConfig ? 'Seleccionando...' : 'Seleccionar como ganadora'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white p-4 rounded-lg border border-borde shadow-sm flex justify-between items-center">
            <div>
              <div className="text-xs uppercase font-bold text-gray-400">Inversión total</div>
              <div className="text-xl font-black text-principal mt-1">
                {fmtCurrency(activeConfig.inversion_total, activeConfig.moneda)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase font-bold text-gray-400">Moneda</div>
              <div className="text-sm font-bold text-gray-600 mt-1">{activeConfig.moneda}</div>
            </div>
          </div>

          {ahorroBrutoAnual != null && ahorroBrutoAnual > 0 && (
            <div className="bg-white p-4 rounded-lg border border-borde shadow-sm flex justify-between items-center">
              <div>
                <div className="text-xs uppercase font-bold text-gray-400">Ahorro bruto anual</div>
                <div className="text-xl font-black text-green-600 mt-1">
                  {fmtCurrency(ahorroBrutoAnual, activeConfig.ahorro_moneda || 'MXN')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Technical metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {totalKwp > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-emerald-900">{fmtNum(totalKwp, 1)}</div>
            <div className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">kWp total FV</div>
          </div>
        )}
        {totalKwh > 0 && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-sky-900">{fmtNum(totalKwh, 1)}</div>
            <div className="text-[10px] font-bold uppercase text-sky-700 tracking-wider">kWh total BESS</div>
          </div>
        )}
        {totalFvCapex > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
            <div className="text-lg font-black">{fmtCurrency(totalFvCapex, activeConfig.moneda)}</div>
            <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">CAPEX FV</div>
          </div>
        )}
        {totalBessCapex > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
            <div className="text-lg font-black">{fmtCurrency(totalBessCapex, activeConfig.moneda)}</div>
            <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">CAPEX BESS</div>
          </div>
        )}
      </div>

      {/* Sites & Products Breakdown */}
      <div className="flex flex-col gap-6">
        {Object.entries(bySitio).map(([sitioId, { nombre, items }]) => (
          <div key={sitioId}>
            <p className="text-sm font-bold mb-3 flex items-center gap-2">
              <MapPin size={13} className="text-gray-400" /> {nombre}
            </p>
            <div className="flex flex-col gap-3">
              {items.map((p) => {
                const d = (p.datos ?? {}) as Record<string, unknown>
                if (p.tipo === 'fv') {
                  const hasHybridBess = items.some(
                    (other) =>
                      other.tipo === 'bess' &&
                      Boolean((other.datos as Record<string, unknown> | null)?.inversores_hibridos)
                  )
                  const nm = parseNum(d.num_modulos)
                  const pw = parseNum(d.potencia_modulos_w)
                  const ni = parseNum(d.num_inversores)
                  const pi = parseNum(d.potencia_inversores_kw)
                  const capex = parseNum(d.capex)
                  const kwpSistema = nm > 0 && pw > 0 ? (nm * pw) / 1000 : null
                  const kwpInv = ni > 0 && pi > 0 ? ni * pi : null
                  const precioWatt = capex > 0 && nm > 0 && pw > 0 ? capex / (nm * pw) : null

                  return (
                    <div
                      key={p.id}
                      className="border border-emerald-200/60 rounded-xl p-5 bg-emerald-50/70 shadow-sm"
                    >
                      <div className="flex items-center gap-2 font-bold text-sm mb-4 text-emerald-900">
                        <Zap size={16} className="text-emerald-700" /> Fotovoltaico
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-2">
                        <Campo label="Módulos" value={`${d.num_modulos} × ${d.potencia_modulos_w} W`} />
                        <Campo label="Marca módulos" value={d.marca_modulos as string} />
                        <Campo
                          label="kWp sistema"
                          value={kwpSistema !== null ? fmtUnit(kwpSistema, 'kWp', 1) : undefined}
                        />

                        {hasHybridBess && ni === 0 ? (
                          <Campo label="Inversores" value="Cubiertos por BESS híbrido" />
                        ) : (
                          <>
                            <Campo
                              label="Inversores"
                              value={`${d.num_inversores} × ${d.potencia_inversores_kw} kW`}
                            />
                            <Campo label="Marca inversores" value={d.marca_inversores as string} />
                            <Campo
                              label="kWp inversores"
                              value={kwpInv !== null ? fmtUnit(kwpInv, 'kW', 1) : undefined}
                            />
                          </>
                        )}

                        <Campo
                          label="Generación anual"
                          value={
                            parseNum(d.generacion_anual_kwh)
                              ? fmtUnit(parseNum(d.generacion_anual_kwh), 'kWh/año')
                              : undefined
                          }
                        />
                        <Campo
                          label="CAPEX"
                          value={fmtCurrency(capex, (d.capex_moneda as string) || 'USD')}
                        />
                        <Campo
                          label="Precio por Watt"
                          value={precioWatt !== null ? `$${fmtNum(precioWatt, 4)}/W` : undefined}
                        />
                      </div>
                    </div>
                  )
                }

                if (p.tipo === 'bess') {
                  const capacidad = parseNum(d.capacidad_kwh)
                  const capex = parseNum(d.capex)
                  const precioKwh = capacidad > 0 && capex > 0 ? capex / capacidad : null
                  const isHibrido = Boolean(d.inversores_hibridos)

                  return (
                    <div
                      key={p.id}
                      className="border border-sky-200/60 rounded-xl p-5 bg-sky-50/70 shadow-sm"
                    >
                      <div className="flex items-center gap-2 font-bold text-sm mb-4 text-sky-900">
                        <Battery size={16} className="text-sky-700" /> BESS
                        {isHibrido && (
                          <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2">
                            Híbrido
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-2">
                        <Campo label="Potencia" value={`${d.potencia_kw} kW`} />
                        <Campo label="Capacidad" value={`${d.capacidad_kwh} kWh`} />
                        <Campo label="Marca" value={d.marca as string} />
                        <Campo label="Uso" value={usoLabel[d.uso as string] ?? (d.uso as string)} />
                        <Campo
                          label="CAPEX"
                          value={fmtCurrency(capex, (d.capex_moneda as string) || 'USD')}
                        />
                        <Campo
                          label="Precio por kWh"
                          value={
                            precioKwh !== null
                              ? `${fmtCurrency(precioKwh, (d.capex_moneda as string) || 'USD')}/kWh`
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  )
                }
                return null
              })}
            </div>
          </div>
        ))}
      </div>
    </Seccion>
  )
}
