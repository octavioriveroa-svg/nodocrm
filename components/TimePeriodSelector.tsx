'use client'

import type { RawProject, RawProduct, RawFinancingOption } from '@/lib/dashboard-data'
import { parseNum } from '@/lib/format'

export type TimePeriod = 'all' | 'last_year' | 'ytd' | 'last_quarter' | 'qtd' | 'last_month' | 'mtd'

const PERIOD_LABELS: Record<TimePeriod, string> = {
  all: 'Todo', last_year: 'Último año', ytd: 'Año actual',
  last_quarter: 'Último trimestre', qtd: 'Trimestre actual',
  last_month: 'Último mes', mtd: 'Mes actual',
}

export function TimePeriodButtons({ value, onChange }: { value: TimePeriod; onChange: (v: TimePeriod) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map(p => (
        <button key={p} onClick={() => onChange(p)}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-colors ${value === p ? 'bg-principal text-acento border-principal' : 'bg-white text-gray-500 border-borde hover:bg-gray-50'}`}>
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  )
}

export function getDateRange(period: TimePeriod): { start: Date; end: Date } {
  const now = new Date()
  const end = now
  let start: Date

  switch (period) {
    case 'last_year': start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break
    case 'ytd': start = new Date(now.getFullYear(), 0, 1); break
    case 'last_quarter': {
      const q = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), (q - 1) * 3, 1)
      if (q === 0) start = new Date(now.getFullYear() - 1, 9, 1)
      break
    }
    case 'qtd': { const q = Math.floor(now.getMonth() / 3); start = new Date(now.getFullYear(), q * 3, 1); break }
    case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break
    case 'mtd': start = new Date(now.getFullYear(), now.getMonth(), 1); break
    default: start = new Date(2000, 0, 1)
  }
  return { start, end }
}

export function filterProjects(projects: RawProject[], period: TimePeriod): RawProject[] {
  if (period === 'all') return projects
  const { start, end } = getDateRange(period)
  return projects.filter(p => { const d = new Date(p.created_at); return d >= start && d <= end })
}

const STAGE_ORDER = [
  'recibido','en_analisis','propuesta_lista','enviada',
  'cliente_interesado','negociacion','aprobado',
  'en_construccion','operativo','completado'
]
const STAGE_LABELS: Record<string, string> = {
  recibido:'Lead', en_analisis:'En análisis', propuesta_lista:'Propuesta lista',
  enviada:'Propuesta enviada', cliente_interesado:'Cliente interesado',
  negociacion:'Negociación', aprobado:'Cierre', en_construccion:'En construcción',
  operativo:'Operativo', completado:'Completado',
}
const TERMINAL = ['aprobado','en_construccion','operativo','completado']

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export function computePipeline(prs: RawProject[]) {
  const total = prs.length
  const byStage: Record<string, number> = {}
  for (const e of STAGE_ORDER) byStage[e] = 0
  for (const p of prs) byStage[p.estado] = (byStage[p.estado] ?? 0) + 1

  const reached: Record<string, number> = {}
  for (const e of STAGE_ORDER) reached[e] = 0
  for (const p of prs) {
    const h = p.historial_estados
    if (!h) { const idx = STAGE_ORDER.indexOf(p.estado); for (let i = 0; i <= idx; i++) reached[STAGE_ORDER[i]]++; continue }
    for (const s of STAGE_ORDER) { if (h[s]) reached[s]++ }
    const ci = STAGE_ORDER.indexOf(p.estado)
    for (let i = 0; i <= ci; i++) { if (!h[STAGE_ORDER[i]]) reached[STAGE_ORDER[i]]++ }
  }

  const funnel = STAGE_ORDER.map(s => ({ stage: s, label: STAGE_LABELS[s], pct: total > 0 ? Math.round((reached[s]/total)*100) : 0, count: reached[s] }))

  const transitions = [
    ['recibido','en_analisis'],['en_analisis','propuesta_lista'],['propuesta_lista','enviada'],
    ['enviada','cliente_interesado'],['cliente_interesado','negociacion'],['negociacion','aprobado'],
    ['aprobado','en_construccion'],['en_construccion','operativo'],
  ]
  const velocity = transitions.map(([from, to]) => {
    const deltas: number[] = []
    for (const p of prs) { const h = p.historial_estados; if (h && h[from] && h[to]) { const d = daysBetween(h[from], h[to]); if (d >= 0) deltas.push(d) } }
    return { from, to, fromLabel: STAGE_LABELS[from], toLabel: STAGE_LABELS[to], avgDays: deltas.length > 0 ? Math.round(deltas.reduce((a,b)=>a+b,0)/deltas.length) : null, count: deltas.length }
  })

  const winRate = total > 0 ? (prs.filter(p => TERMINAL.includes(p.estado)).length / total) * 100 : 0

  return { byStage, funnel, velocity, winRate, total }
}

export function computeFinancial(prs: RawProject[], prods: RawProduct[], opts: RawFinancingOption[] = []) {
  const ids = new Set(prs.map(p => p.id))
  const filtered = prods.filter(p => ids.has(p.proyecto_id))
  const filteredOpts = opts.filter(o => ids.has(o.proyecto_id))
  let fv = 0, bess = 0, savings = 0
  const pCapex: Record<string, number> = {}, pSav: Record<string, number> = {}

  for (const prod of filtered) {
    const d = prod.datos; if (!d) continue
    const c = parseNum(d.capex as any) || 0
    if (prod.tipo === 'fv') fv += c; else if (prod.tipo === 'bess') bess += c
    pCapex[prod.proyecto_id] = (pCapex[prod.proyecto_id]||0) + c
  }
  for (const opt of filteredOpts) {
    if (opt.seleccionada) {
      const s = Number(opt.ahorro_estimado_mensual) || 0
      pSav[opt.proyecto_id] = (pSav[opt.proyecto_id]||0) + s
      savings += s
    }
  }
  const total = fv + bess
  const paybacks: number[] = []
  for (const pid of Object.keys(pCapex)) { if (pCapex[pid] > 0 && pSav[pid] > 0) paybacks.push(pCapex[pid] / pSav[pid]) }

  return {
    totalCapex: total, fvCapex: fv, bessCapex: bess,
    avgCapexPerProject: prs.length > 0 ? total / prs.length : 0,
    totalSavingsMonthly: savings,
    avgPaybackMonths: paybacks.length > 0 ? Math.round(paybacks.reduce((a,b)=>a+b,0)/paybacks.length) : null,
  }
}
