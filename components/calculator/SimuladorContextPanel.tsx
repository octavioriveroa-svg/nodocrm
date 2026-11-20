'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal } from 'lucide-react'
import type {
  CalculadoraCampoDef,
  CalculadoraCampoGrupo,
  Moneda,
} from '@/lib/types'
import {
  ALLOWED_OVERRIDE_KEYS,
  type AllowedOverrideKey,
  FALLBACK_TEMPLATE_CAMPOS,
} from '@/lib/calculator/template-schema'
import {
  formatNumberInput,
  formatSignedNumberInput,
  parseNum,
  parseSignedNum,
} from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface SimuladorContextPanelProps {
  campos: readonly CalculadoraCampoDef[]
  monedaCalculo: Moneda
  tier2Defaults: Readonly<Record<AllowedOverrideKey, number>>
  overrides: Record<string, unknown>
  fieldErrors?: Record<string, string>
  usaParametrosBase: boolean
  resetKey?: string | number
  onChangeOverride: (key: AllowedOverrideKey, value: number | undefined) => void
  onResetAll: () => void
}

interface OverrideFieldItem {
  key: AllowedOverrideKey
  label: string
  unit: string
  group: CalculadoraCampoGrupo
  isPercentage: boolean
  allowNegative: boolean
  isInteger: boolean
  order: number
}

const GROUP_ORDER: readonly CalculadoraCampoGrupo[] = [
  'moneda',
  'tarifas',
  'fv',
  'bess',
  'macro',
  'financiamiento',
]

const ALLOWED_OVERRIDE_KEY_SET = new Set<string>(ALLOWED_OVERRIDE_KEYS)

const GROUP_LABELS: Readonly<Record<CalculadoraCampoGrupo, string>> = {
  moneda: 'Moneda y Tipo de Cambio',
  tarifas: 'Tarifas CFE / MEM y Consumo',
  fv: 'Parámetros Técnicos FV',
  bess: 'Parámetros Técnicos BESS',
  macro: 'Macroeconomía y O&M',
  financiamiento: 'Financiamiento',
  horizontes: 'Horizontes',
  cliente: 'Cliente y Demanda',
  operacion: 'Operación BESS',
  mercado_tc: 'Mercado y Tipo de Cambio',
  costos: 'Costos CAPEX / OPEX',
  evaluacion_financiera: 'Evaluación Financiera',
}

function resolveDisplayUnit(rawUnit: string, overrideKey: AllowedOverrideKey, moneda: Moneda): string {
  if (
    overrideKey === 'tarifa_cfe_kwh' ||
    overrideKey === 'diferencial_punta_base_kwh' ||
    overrideKey === 'tarifa_mem_kwh'
  ) {
    return `${moneda}/kWh`
  }
  if (overrideKey === 'cargo_demanda_mensual_kw') {
    return `${moneda}/kW-mes`
  }
  return rawUnit
}

function formatValueForDisplay(
  val: number,
  isPercentage: boolean,
  allowNegative: boolean,
): string {
  if (!Number.isFinite(val)) return ''
  const scaled = isPercentage ? Math.round(val * 100 * 1e6) / 1e6 : Math.round(val * 1e6) / 1e6
  const rawStr = String(scaled)
  return allowNegative ? formatSignedNumberInput(rawStr) : formatNumberInput(rawStr)
}

export function SimuladorContextPanel({
  campos,
  monedaCalculo,
  tier2Defaults,
  overrides,
  fieldErrors = {},
  usaParametrosBase,
  resetKey = 0,
  onChangeOverride,
  onResetAll,
}: SimuladorContextPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [draftState, setDraftState] = useState<{
    resetKey: string | number
    entries: Record<string, string>
  }>({ resetKey, entries: {} })

  const drafts = draftState.resetKey === resetKey ? draftState.entries : {}

  function setDrafts(updater: (prev: Record<string, string>) => Record<string, string>) {
    setDraftState((prev) => {
      const baseEntries = prev.resetKey === resetKey ? prev.entries : {}
      return { resetKey, entries: updater(baseEntries) }
    })
  }

  const groupedFields = useMemo(() => {
    const sourceCampos = campos.length > 0 ? campos : FALLBACK_TEMPLATE_CAMPOS
    const items: OverrideFieldItem[] = []

    for (const campo of sourceCampos) {
      if (!campo.editableByUser) continue
      const overrideKey = (campo.validationRules?.overrideKey ?? campo.key) as string
      if (overrideKey === 'moneda_calculo' || overrideKey === 'moneda_default') continue
      if (!ALLOWED_OVERRIDE_KEY_SET.has(overrideKey)) continue

      items.push({
        key: overrideKey as AllowedOverrideKey,
        label: campo.label,
        unit: resolveDisplayUnit(campo.unit, overrideKey as AllowedOverrideKey, monedaCalculo),
        group: campo.group,
        isPercentage: campo.type === 'percentage',
        allowNegative: campo.validationRules?.allowNegative === true,
        isInteger: campo.type === 'integer' || campo.validationRules?.integer === true,
        order: campo.order,
      })
    }

    // Add the 2 runtime engineering overrides (blueprint §6.3)
    items.push(
      {
        key: 'generacion_fv_y1_kwh',
        label: 'Generación FV estimada (Año 1)',
        unit: 'kWh/año',
        group: 'fv',
        isPercentage: false,
        allowNegative: false,
        isInteger: false,
        order: 6.5,
      },
      {
        key: 'consumo_anual_kwh',
        label: 'Consumo eléctrico anual del cliente',
        unit: 'kWh/año',
        group: 'tarifas',
        isPercentage: false,
        allowNegative: false,
        isInteger: false,
        order: 6.6,
      },
    )

    items.sort((a, b) => a.order - b.order)

    const map = new Map<CalculadoraCampoGrupo, OverrideFieldItem[]>()
    for (const g of GROUP_ORDER) map.set(g, [])
    for (const item of items) {
      const bucket = map.get(item.group)
      if (bucket) bucket.push(item)
      else map.set(item.group, [item])
    }
    return map
  }, [campos, monedaCalculo])

  const overrideCount = useMemo(() => {
    let count = 0
    for (const key of Object.keys(overrides)) {
      const val = overrides[key]
      if (val !== undefined) count++
    }
    return count
  }, [overrides])

  const errorCount = Object.keys(fieldErrors).length

  function handleInputChange(item: OverrideFieldItem, rawInput: string) {
    const formatted = item.allowNegative
      ? formatSignedNumberInput(rawInput)
      : formatNumberInput(rawInput)

    setDrafts((prev) => ({ ...prev, [item.key]: formatted }))

    if (
      formatted === '' ||
      formatted === '-' ||
      formatted === '.' ||
      formatted === '-.'
    ) {
      onChangeOverride(item.key, Number.NaN)
      return
    }

    const parsed = item.allowNegative ? parseSignedNum(formatted) : parseNum(formatted)
    const normalized = item.isPercentage
      ? Math.round((parsed / 100) * 1e8) / 1e8
      : item.isInteger
        ? Math.round(parsed)
        : parsed

    const baseVal = tier2Defaults[item.key]
    if (Number.isFinite(baseVal) && Math.abs(normalized - baseVal) <= 1e-9) {
      onChangeOverride(item.key, undefined)
    } else {
      onChangeOverride(item.key, normalized)
    }
  }

  function handleInputBlur(item: OverrideFieldItem) {
    const val = overrides[item.key]
    if (typeof val === 'number' && !Number.isFinite(val)) {
      // Keep draft visible so user sees invalid empty/partial field error
      return
    }
    setDrafts((prev) => {
      if (!(item.key in prev)) return prev
      const next = { ...prev }
      delete next[item.key]
      return next
    })
  }

  function handleResetField(key: AllowedOverrideKey) {
    setDrafts((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    onChangeOverride(key, undefined)
  }

  function handleResetAllFields() {
    setDraftState({ resetKey, entries: {} })
    onResetAll()
  }

  return (
    <div className="bg-white/80 backdrop-blur-md border border-borde rounded-2xl overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-fondo/50 border-b border-linea">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-8 h-8 rounded-xl bg-principal text-acento flex items-center justify-center shrink-0">
            <SlidersHorizontal size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-principal group-hover:underline">
                Parámetros y Supuestos del Simulador
              </span>
              {usaParametrosBase && errorCount === 0 ? (
                <Badge variant="info">Parámetros base Nodo</Badge>
              ) : (
                <Badge variant="neutral">
                  Personalizado{overrideCount > 0 ? ` (${overrideCount})` : ''}
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="warning">{errorCount} campo(s) por corregir</Badge>
              )}
            </div>
            <p className="text-xs text-texto-suave mt-0.5">
              Ajusta tarifas, parámetros técnicos FV/BESS, macroeconomía o condiciones de financiamiento en tiempo real.
            </p>
          </div>
          <span className="ml-2 text-texto-suave">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {(!usaParametrosBase || Object.keys(drafts).length > 0) && (
          <Button type="button" variant="outline" size="sm" onClick={handleResetAllFields}>
            <RotateCcw size={13} />
            Restablecer a base
          </Button>
        )}
      </div>

      {expanded && (
        <div className="p-5 space-y-6">
          {GROUP_ORDER.map((group) => {
            const fields = groupedFields.get(group) ?? []
            if (fields.length === 0) return null

            return (
              <div key={group} className="space-y-3">
                <h5 className="text-[11px] font-bold uppercase tracking-widest text-texto-suave border-b border-linea pb-1.5">
                  {GROUP_LABELS[group]}
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fields.map((item) => {
                    const baseVal = tier2Defaults[item.key] ?? 0
                    const rawOverride = overrides[item.key]
                    const hasOverride = rawOverride !== undefined
                    const isOverridden =
                      typeof rawOverride === 'number' &&
                      Number.isFinite(rawOverride) &&
                      Math.abs(rawOverride - baseVal) > 1e-9
                    const fieldError = fieldErrors[item.key]

                    const effectiveNum =
                      typeof rawOverride === 'number' && Number.isFinite(rawOverride)
                        ? rawOverride
                        : baseVal
                    const displayValue =
                      item.key in drafts
                        ? drafts[item.key]
                        : formatValueForDisplay(
                            effectiveNum,
                            item.isPercentage,
                            item.allowNegative,
                          )

                    return (
                      <div
                        key={item.key}
                        className={`rounded-xl border p-3 transition-colors ${
                          fieldError
                            ? 'border-red-400 bg-red-50/40'
                            : isOverridden
                              ? 'border-principal/40 bg-acento/10'
                              : 'border-borde bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <label
                            htmlFor={`sim-param-${item.key}`}
                            className="text-xs font-semibold text-principal leading-snug"
                          >
                            {item.label}
                          </label>
                          {(isOverridden || hasOverride || item.key in drafts) && (
                            <button
                              type="button"
                              onClick={() => handleResetField(item.key)}
                              className="text-[10px] font-bold text-principal underline hover:text-menta shrink-0"
                            >
                              Restablecer
                            </button>
                          )}
                        </div>

                        <div className="relative flex items-center">
                          <input
                            id={`sim-param-${item.key}`}
                            type="text"
                            inputMode="decimal"
                            value={displayValue}
                            onChange={(e) => handleInputChange(item, e.target.value)}
                            onBlur={() => handleInputBlur(item)}
                            className={`num w-full rounded-lg border bg-white px-3 py-2 pr-20 text-sm font-semibold text-principal ${
                              fieldError ? 'border-red-400' : 'border-borde'
                            }`}
                          />
                          <span className="absolute right-2.5 text-[11px] font-medium text-texto-suave pointer-events-none">
                            {item.unit}
                          </span>
                        </div>

                        {fieldError ? (
                          <p className="text-[11px] font-semibold text-red-600 mt-1">
                            {fieldError}
                          </p>
                        ) : (
                          <p className="text-[10px] text-texto-suave mt-1">
                            Base:{' '}
                            <span className="num font-semibold">
                              {formatValueForDisplay(
                                baseVal,
                                item.isPercentage,
                                item.allowNegative,
                              )}{' '}
                              {item.unit}
                            </span>
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SimuladorContextPanel
