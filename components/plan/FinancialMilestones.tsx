 
'use client'

import { useState } from 'react'
import type { HitoFinanciero, PlanFase, EstadoHitoFinanciero, Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, Plus, Pencil, Trash2, ExternalLink, CheckCircle2, Clock, CircleDot, CreditCard } from 'lucide-react'
import FinancialMilestoneModal from './FinancialMilestoneModal'
import CommentThread from './CommentThread'
import { fmtCurrency } from '@/lib/format'

const ESTADO_CONFIG: Record<EstadoHitoFinanciero, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  pendiente: { color: '#9CA3AF', bg: '#F3F4F6', icon: <Clock size={12} />, label: 'Pendiente' },
  elegible: { color: '#3B82F6', bg: '#EFF6FF', icon: <CircleDot size={12} />, label: 'Elegible' },
  aprobado: { color: '#F59E0B', bg: '#FFFBEB', icon: <CreditCard size={12} />, label: 'Aprobado' },
  pagado: { color: '#10B981', bg: '#ECFDF5', icon: <CheckCircle2 size={12} />, label: 'Pagado' },
}

interface Props {
  hitos: HitoFinanciero[]
  fases: PlanFase[]
  proyectoId: string
  capexEstimado: number | null
  readOnly?: boolean
  isFinanciero?: boolean
  currentUser?: Profile
  commentCounts?: Record<string, number>
  onUpdate: (hitos: HitoFinanciero[]) => void
}

export default function FinancialMilestones({
  hitos, fases, proyectoId, capexEstimado, readOnly, isFinanciero, currentUser, commentCounts, onUpdate,
}: Props) {
  const supabase = createClient()
  const [editingHito, setEditingHito] = useState<HitoFinanciero | null>(null)
  const [showModal, setShowModal] = useState(false)

  const sorted = [...hitos].sort((a, b) => a.orden - b.orden)
  const totalMonto = sorted.reduce((s, h) => s + (h.monto || 0), 0)
  const totalPagado = sorted.filter(h => h.estado === 'pagado').reduce((s, h) => s + (h.monto || 0), 0)
  const pctPagado = totalMonto > 0 ? Math.round((totalPagado / totalMonto) * 100) : 0

  function handleSaved(saved: HitoFinanciero) {
    const exists = hitos.find(h => h.id === saved.id)
    if (exists) {
      onUpdate(hitos.map(h => h.id === saved.id ? saved : h))
    } else {
      onUpdate([...hitos, saved])
    }
    setShowModal(false)
    setEditingHito(null)
  }

  async function deleteHito(id: string) {
    if (!confirm('¿Eliminar este hito financiero?')) return
    await supabase.from('hitos_financieros').delete().eq('id', id)
    onUpdate(hitos.filter(h => h.id !== id))
  }

  const faseName = (faseId: string | null) => {
    if (!faseId) return null
    return fases.find(f => f.id === faseId)?.nombre || null
  }

  return (
    <div>
      {/* Summary header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-principal flex items-center gap-2">
            <DollarSign size={16} /> Hitos Financieros
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {sorted.length} hitos · {fmtCurrency(totalMonto, 'MXN')} total
          </p>
        </div>
        {!readOnly && !isFinanciero && (
          <button
            onClick={() => { setEditingHito(null); setShowModal(true) }}
            className="flex items-center gap-1.5 text-xs font-bold bg-principal text-acento px-3 py-1.5 rounded-lg hover:bg-gray-900 transition-colors"
          >
            <Plus size={12} /> Agregar hito
          </button>
        )}
      </div>

      {/* Disbursement progress bar */}
      <div className="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-500">Desembolso total</span>
          <span className="text-xs font-mono font-bold text-principal">
            {fmtCurrency(totalPagado, 'MXN')}
            <span className="text-gray-400"> / {fmtCurrency(totalMonto, 'MXN')}</span>
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
          {sorted.map(h => {
            const w = totalMonto > 0 ? (h.monto / totalMonto) * 100 : 0
            const cfg = ESTADO_CONFIG[h.estado as EstadoHitoFinanciero]
            return (
              <div
                key={h.id}
                className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${w}%`,
                  backgroundColor: cfg.color,
                  opacity: h.estado === 'pendiente' ? 0.3 : 1,
                }}
                title={`${h.nombre}: ${fmtCurrency(h.monto, 'MXN')} (${h.estado})`}
              />
            )
          })}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-gray-400">{pctPagado}% pagado</span>
          {capexEstimado && (
            <span className="text-[10px] text-gray-400">
              CAPEX: {fmtCurrency(capexEstimado, 'MXN')}
            </span>
          )}
        </div>
      </div>

      {/* Milestones list */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-200 rounded-xl">
          <DollarSign size={28} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 font-medium">Sin hitos financieros</p>
          <p className="text-xs text-gray-400 mt-1">Define los desembolsos del proyecto vinculados a fases de obra.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((h, i) => {
            const cfg = ESTADO_CONFIG[h.estado as EstadoHitoFinanciero]
            const linkedFase = faseName(h.fase_id)
            return (
              <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group bg-white">
                {/* Order badge */}
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                  {i + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900 truncate">{h.nombre}</h4>
                    {linkedFase && (
                      <span className="text-[10px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        {linkedFase}
                      </span>
                    )}
                  </div>
                  {h.condicion_desbloqueo && (
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{h.condicion_desbloqueo}</p>
                  )}
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black font-mono text-principal">
                    {fmtCurrency(h.monto, h.moneda || 'MXN')}
                  </p>
                  {h.porcentaje_del_total && (
                    <p className="text-[10px] text-gray-400">{h.porcentaje_del_total}%</p>
                  )}
                </div>

                {/* Status badge */}
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                  {cfg.icon} {cfg.label}
                </span>

                {/* Proof link */}
                {h.comprobante_url && (
                  <a href={h.comprobante_url} target="_blank" rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-800 flex-shrink-0">
                    <ExternalLink size={12} />
                  </a>
                )}

                {/* Comment thread */}
                {currentUser && (
                  <CommentThread
                    proyectoId={proyectoId}
                    targetType="hito"
                    targetId={h.id}
                    currentUser={currentUser}
                    commentCount={commentCounts?.[h.id] || 0}
                  />
                )}

                {/* Actions */}
                {(!readOnly || isFinanciero) && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                    <button onClick={() => { setEditingHito(h); setShowModal(true) }}
                      className="text-gray-400 hover:text-gray-700">
                      <Pencil size={12} />
                    </button>
                    {!isFinanciero && (
                      <button onClick={() => deleteHito(h.id)}
                        className="text-gray-400 hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <FinancialMilestoneModal
          hito={editingHito}
          proyectoId={proyectoId}
          fases={fases}
          isFinanciero={isFinanciero}
          onClose={() => { setShowModal(false); setEditingHito(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
