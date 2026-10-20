'use client'

import React from 'react'
import { X, Zap, Battery } from 'lucide-react'
import { parseNum, fmtNum, fmtCurrency } from '@/lib/format'
import type { Producto } from './types'
import { calcFV, calcBESS, n2 } from './calculations'

export function CalcField({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="border px-3 py-2 text-xs border-borde rounded-xl bg-fondo">
      <div className="text-muted">{label}</div>
      <div className="font-bold text-sm mt-0.5">
        {value !== null ? `${n2(value, 4)} ${unit}` : '—'}
      </div>
    </div>
  )
}

export function ProductoCard({ p, onRemove }: { p: Producto; onRemove: () => void }) {
  if (p.tipo === 'fv' && p.fv) {
    const { kwpSistema, kwpInversores, precioWatt } = calcFV(p.fv)
    return (
      <div className="border p-3 text-xs border-borde rounded-xl bg-white/60">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-sm mb-2">
            <Zap size={13} className="text-muted" />
            Fotovoltaico
          </div>
          <button type="button" onClick={onRemove} className="p-0.5 flex-shrink-0 text-muted hover:text-red-600 transition-colors">
            <X size={13} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: 'var(--color-texto-suave)' }}>
          <span><span className="text-muted">Módulos: </span>{p.fv.num_modulos} × {p.fv.potencia_modulos_w} W · {p.fv.marca_modulos}</span>
          <span><span className="text-muted">kWp sistema: </span>{n2(kwpSistema, 1)} kWp</span>
          {(!p.fv.num_inversores || p.fv.num_inversores === '0') ? (
            <span className="col-span-2"><span className="text-muted">Inversores: </span>Cubiertos por BESS híbrido</span>
          ) : (
            <>
              <span><span className="text-muted">Inversores: </span>{p.fv.num_inversores} × {p.fv.potencia_inversores_kw} kW · {p.fv.marca_inversores}</span>
              <span><span className="text-muted">kWp inversores: </span>{n2(kwpInversores, 1)} kW</span>
            </>
          )}
          <span><span className="text-muted">Generación: </span>{fmtNum(parseNum(p.fv.generacion_anual_kwh))} kWh/año</span>
          <span><span className="text-muted">CAPEX: </span>{fmtCurrency(parseNum(p.fv.capex), p.fv.capex_moneda || 'USD')}</span>
          <span className="col-span-2"><span className="text-muted">Precio/Wp: </span>${n2(precioWatt, 4)}/W</span>
        </div>
      </div>
    )
  }
  if (p.tipo === 'bess' && p.bess) {
    const { precioKwh } = calcBESS(p.bess)
    const usoLabel: Record<string, string> = {
      load_shifting: 'Load Shifting',
      ups: 'UPS',
      load_shifting_ups: 'Load Shifting + UPS',
    }
    return (
      <div className="border p-3 text-xs border-borde rounded-xl bg-white/60">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-sm mb-2">
            <Battery size={13} className="text-muted" />
            BESS
            {p.bess.inversores_hibridos && (
              <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2">
                Híbrido
              </span>
            )}
          </div>
          <button type="button" onClick={onRemove} className="p-0.5 flex-shrink-0 text-muted hover:text-red-600 transition-colors">
            <X size={13} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: 'var(--color-texto-suave)' }}>
          <span><span className="text-muted">Potencia: </span>{p.bess.potencia_kw} kW</span>
          <span><span className="text-muted">Capacidad: </span>{p.bess.capacidad_kwh} kWh</span>
          <span><span className="text-muted">Marca: </span>{p.bess.marca}</span>
          <span><span className="text-muted">Uso: </span>{usoLabel[p.bess.uso] ?? p.bess.uso}</span>
          <span><span className="text-muted">CAPEX: </span>{fmtCurrency(parseNum(p.bess.capex), p.bess.capex_moneda || 'USD')}</span>
          <span><span className="text-muted">Precio/kWh: </span>${n2(precioKwh, 2)}/kWh</span>
        </div>
      </div>
    )
  }
  return null
}
