'use client'

import { useState } from 'react'
import { ArrowRightFromLine, Info, RotateCcw } from 'lucide-react'
import type { MemAnnualAssumptions, MemAnnualAssumptionsRow } from '@/lib/types'
import { fmtCurrency, fmtNum, fmtPct, formatNumberInput, formatSignedNumberInput, parseNum, parseSignedNum } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface MemSupuestosAnualesViewProps {
  assumptions: MemAnnualAssumptions
  assumptionsRows: readonly MemAnnualAssumptionsRow[]
  onChangeAssumptions: (next: MemAnnualAssumptions) => void
  onResetDefaults: () => void
  disabled?: boolean
}

export function MemSupuestosAnualesView({
  assumptions,
  assumptionsRows,
  onChangeAssumptions,
  onResetDefaults,
  disabled = false,
}: MemSupuestosAnualesViewProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  function cloneAssumptions(): MemAnnualAssumptions {
    return {
      pct_mbp: [...assumptions.pct_mbp],
      fijo_mbp: [...assumptions.fijo_mbp],
      pct_pml: [...assumptions.pct_pml],
      deg_bess: [...assumptions.deg_bess],
    }
  }

  function updateArrayCell(
    field: 'pct_mbp' | 'pct_pml' | 'deg_bess',
    idx: number,
    rawPercent: string,
  ) {
    const key = `${field}_${idx}`
    const formatted = formatSignedNumberInput(rawPercent)
    setDrafts((prev) => ({ ...prev, [key]: formatted }))
    const parsed = parseSignedNum(formatted)
    if (parsed !== null && Number.isFinite(parsed)) {
      const next = cloneAssumptions()
      next[field][idx] = parsed / 100
      onChangeAssumptions(next)
    }
  }

  function updateFixedMbpCell(idx: number, raw: string) {
    const key = `fijo_mbp_${idx}`
    if (raw.trim() === '') {
      setDrafts((prev) => ({ ...prev, [key]: '' }))
      const next = cloneAssumptions()
      next.fijo_mbp[idx] = null
      onChangeAssumptions(next)
      return
    }
    const formatted = formatNumberInput(raw)
    setDrafts((prev) => ({ ...prev, [key]: formatted }))
    const parsed = parseNum(formatted)
    if (parsed !== null && Number.isFinite(parsed)) {
      const next = cloneAssumptions()
      next.fijo_mbp[idx] = parsed
      onChangeAssumptions(next)
    }
  }

  function handleFillRightFromYear2() {
    const next = cloneAssumptions()
    const y2Mbp = next.pct_mbp[1] ?? 0
    const y2Fijo = next.fijo_mbp[1] ?? null
    const y2Pml = next.pct_pml[1] ?? 0
    const y2Deg = next.deg_bess[1] ?? 0
    for (let i = 2; i < 25; i++) {
      next.pct_mbp[i] = y2Mbp
      next.fijo_mbp[i] = y2Fijo
      next.pct_pml[i] = y2Pml
      next.deg_bess[i] = y2Deg
    }
    setDrafts({})
    onChangeAssumptions(next)
  }

  function clearDraft(key: string) {
    setDrafts((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const rows = assumptionsRows

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-principal">
            Supuestos Anuales para la Proyección Financiera (Años 1–25)
          </h4>
          <p className="text-xs text-texto-suave">
            Año 1 toma los valores base de Inputs y Datos. Para MBP, un valor fijo opcional tiene prioridad sobre el %.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={handleFillRightFromYear2}
          >
            <ArrowRightFromLine size={14} />
            Rellenar Año 2 → 25
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              setDrafts({})
              onResetDefaults()
            }}
          >
            <RotateCcw size={14} />
            Restablecer defaults
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-fondo/70 border border-linea px-3.5 py-2.5 text-xs text-principal flex items-center gap-2">
        <Info size={14} className="text-menta shrink-0" />
        <span>
          Desplázate horizontalmente para editar cualquier año de <strong>Año 2</strong> a{' '}
          <strong>Año 25</strong>. Los índices (<code className="font-mono">Índice MBP</code>,{' '}
          <code className="font-mono">Índice PML</code> y{' '}
          <code className="font-mono">Capacidad BESS remanente</code>) se recalculan en tiempo real.
        </span>
      </div>

      <div className="bg-white border border-borde rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-principal text-white">
                <th className="sticky left-0 z-20 bg-principal text-left px-3 py-2.5 font-bold min-w-[230px] border-r border-white/15">
                  Concepto (Supuestos anuales)
                </th>
                <th className="text-left px-2.5 py-2.5 font-semibold min-w-[90px] border-r border-white/15">
                  Unidad
                </th>
                {rows.map((r) => (
                  <th
                    key={r.anio}
                    className={`num text-right px-2.5 py-2.5 font-bold min-w-[94px] ${
                      r.anio === 1 ? 'bg-white/10' : ''
                    }`}
                  >
                    Año {r.anio}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-linea">
              {/* Section 1: MBP */}
              <tr className="bg-fondo/80">
                <td colSpan={27} className="px-3 py-1.5 font-extrabold text-principal uppercase tracking-wider text-[10px]">
                  1. Precio de potencia (MBP)
                </td>
              </tr>

              <tr>
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-principal border-r border-linea">
                  % vs año anterior (captura)
                </td>
                <td className="px-2.5 py-2 text-texto-suave border-r border-linea">%/año</td>
                {rows.map((r, idx) => {
                  const key = `pct_mbp_${idx}`
                  const val = assumptions.pct_mbp[idx] ?? 0
                  const display =
                    key in drafts ? drafts[key] : String(Math.round(val * 100 * 1e4) / 1e4)
                  const overriddenByFixed = idx > 0 && assumptions.fijo_mbp[idx] !== null
                  return (
                    <td key={r.anio} className="px-1.5 py-1.5 text-right">
                      {idx === 0 ? (
                        <span className="num text-texto-suave px-1">Base</span>
                      ) : (
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={disabled}
                          value={display}
                          onChange={(e) => updateArrayCell('pct_mbp', idx, e.target.value)}
                          onBlur={() => clearDraft(key)}
                          className={`num w-full rounded border px-1.5 py-1 text-right font-semibold ${
                            overriddenByFixed
                              ? 'border-linea bg-fondo text-texto-suave line-through'
                              : 'border-borde bg-fondo/50 text-principal focus:bg-white'
                          }`}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>

              <tr>
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-principal border-r border-linea">
                  Valor fijo MBP (prioridad s/ %)
                </td>
                <td className="px-2.5 py-2 text-texto-suave border-r border-linea">MXN/MW-a</td>
                {rows.map((r, idx) => {
                  const key = `fijo_mbp_${idx}`
                  const fixed = assumptions.fijo_mbp[idx]
                  const display =
                    key in drafts
                      ? drafts[key]
                      : fixed !== null && fixed !== undefined
                        ? formatNumberInput(String(fixed))
                        : ''
                  return (
                    <td key={r.anio} className="px-1.5 py-1.5 text-right">
                      {idx === 0 ? (
                        <span className="num text-texto-suave px-1">—</span>
                      ) : (
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={disabled}
                          placeholder="—"
                          value={display}
                          onChange={(e) => updateFixedMbpCell(idx, e.target.value)}
                          onBlur={() => clearDraft(key)}
                          className={`num w-full rounded border px-1.5 py-1 text-right font-semibold ${
                            fixed !== null
                              ? 'border-menta bg-menta/10 text-principal'
                              : 'border-linea bg-white text-principal'
                          }`}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>

              <tr className="bg-fondo/30">
                <td className="sticky left-0 z-10 bg-fondo/30 px-3 py-1.5 text-principal border-r border-linea">
                  Precio MBP resultante
                </td>
                <td className="px-2.5 py-1.5 text-texto-suave border-r border-linea">MXN/MW-a</td>
                {rows.map((r) => (
                  <td key={r.anio} className="num px-2.5 py-1.5 text-right font-semibold text-principal">
                    {fmtCurrency(r.precio_mbp_mxn_mw_anio, 'MXN')}
                  </td>
                ))}
              </tr>

              <tr className="bg-fondo/30">
                <td className="sticky left-0 z-10 bg-fondo/30 px-3 py-1.5 text-texto-suave border-r border-linea">
                  % efectivo / Índice potencia
                </td>
                <td className="px-2.5 py-1.5 text-texto-suave border-r border-linea">factor</td>
                {rows.map((r) => (
                  <td key={r.anio} className="num px-2.5 py-1.5 text-right text-principal">
                    <span className="font-bold">{fmtNum(r.idx_potencia, 4)}</span>
                    {r.anio > 1 && (
                      <span className="block text-[9px] text-texto-suave">
                        {fmtPct((r.pct_mbp_efectivo ?? 0) * 100, 1)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Section 2: PML */}
              <tr className="bg-fondo/80">
                <td colSpan={27} className="px-3 py-1.5 font-extrabold text-principal uppercase tracking-wider text-[10px]">
                  2. Precio de energía (PML)
                </td>
              </tr>

              <tr>
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-principal border-r border-linea">
                  % vs año anterior (captura)
                </td>
                <td className="px-2.5 py-2 text-texto-suave border-r border-linea">%/año</td>
                {rows.map((r, idx) => {
                  const key = `pct_pml_${idx}`
                  const val = assumptions.pct_pml[idx] ?? 0
                  const display =
                    key in drafts ? drafts[key] : String(Math.round(val * 100 * 1e4) / 1e4)
                  return (
                    <td key={r.anio} className="px-1.5 py-1.5 text-right">
                      {idx === 0 ? (
                        <span className="num text-texto-suave px-1">Base</span>
                      ) : (
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={disabled}
                          value={display}
                          onChange={(e) => updateArrayCell('pct_pml', idx, e.target.value)}
                          onBlur={() => clearDraft(key)}
                          className="num w-full rounded border border-borde bg-fondo/50 focus:bg-white px-1.5 py-1 text-right font-semibold text-principal"
                        />
                      )}
                    </td>
                  )
                })}
              </tr>

              <tr className="bg-fondo/30">
                <td className="sticky left-0 z-10 bg-fondo/30 px-3 py-1.5 text-principal border-r border-linea">
                  Índice PML / PML prom resultante
                </td>
                <td className="px-2.5 py-1.5 text-texto-suave border-r border-linea">MXN/MWh</td>
                {rows.map((r) => (
                  <td key={r.anio} className="num px-2.5 py-1.5 text-right text-principal">
                    <span className="font-bold">{fmtNum(r.idx_pml, 4)}</span>
                    <span className="block text-[9px] text-texto-suave">
                      ${fmtNum(r.pml_promedio_mxn_mwh, 1)}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Section 3: Degradación BESS */}
              <tr className="bg-fondo/80">
                <td colSpan={27} className="px-3 py-1.5 font-extrabold text-principal uppercase tracking-wider text-[10px]">
                  3. Degradación BESS
                </td>
              </tr>

              <tr>
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-principal border-r border-linea">
                  Degradación vs año anterior
                </td>
                <td className="px-2.5 py-2 text-texto-suave border-r border-linea">%/año</td>
                {rows.map((r, idx) => {
                  const key = `deg_bess_${idx}`
                  const val = assumptions.deg_bess[idx] ?? 0
                  const display =
                    key in drafts ? drafts[key] : String(Math.round(val * 100 * 1e4) / 1e4)
                  return (
                    <td key={r.anio} className="px-1.5 py-1.5 text-right">
                      {idx === 0 ? (
                        <span className="num text-texto-suave px-1">Base</span>
                      ) : (
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={disabled}
                          value={display}
                          onChange={(e) => updateArrayCell('deg_bess', idx, e.target.value)}
                          onBlur={() => clearDraft(key)}
                          className="num w-full rounded border border-borde bg-fondo/50 focus:bg-white px-1.5 py-1 text-right font-semibold text-principal"
                        />
                      )}
                    </td>
                  )
                })}
              </tr>

              <tr className="bg-fondo/30">
                <td className="sticky left-0 z-10 bg-fondo/30 px-3 py-1.5 font-semibold text-principal border-r border-linea">
                  Capacidad BESS remanente
                </td>
                <td className="px-2.5 py-1.5 text-texto-suave border-r border-linea">MWh · factor</td>
                {rows.map((r) => (
                  <td key={r.anio} className="num px-2.5 py-1.5 text-right text-principal">
                    <span className="font-bold">{fmtNum(r.capacidad_remanente_mwh, 2)}</span>
                    <span className="block text-[9px] text-texto-suave">
                      <Badge variant="default" className="!px-1 !py-0 !text-[9px]">
                        {fmtNum(r.factor_deg_bess, 4)}
                      </Badge>
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default MemSupuestosAnualesView
