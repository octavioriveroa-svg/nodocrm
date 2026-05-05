import { createClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────
export interface DashboardData {
  kpis: KPIs
  pipeline: PipelineData
  velocity: VelocityData
  financial: FinancialData
  technical: TechnicalData
  activity: ActivityData
  epcLeaderboard: EpcLeader[]
  stalePipeline: StaleProject[]
  financingMix: Record<string, number>
  techMix: Record<string, number>
  geoCAPEX: Record<string, number>
  recentProjects: RecentProject[]
  rawProjects: RawProject[]
  rawProducts: RawProduct[]
}

export interface RawProject {
  id: string
  estado: string
  tipo: string
  historial_estados: Record<string, string> | null
  capex_estimado: number
  created_at: string
}

export interface RawProduct {
  proyecto_id: string
  tipo: string
  datos: Record<string, unknown> | null
}

export interface KPIs {
  totalProjects: number
  activePipelineCapex: number
  installedCapacityKwp: number
  winRate: number
  avgDaysToClose: number | null
  avgDaysToInstall: number | null
}

export interface PipelineData {
  byStage: Record<string, number>
  funnelPercents: { stage: string; label: string; pct: number; count: number }[]
}

export interface VelocityData {
  stages: { from: string; to: string; fromLabel: string; toLabel: string; avgDays: number | null; count: number }[]
}

export interface FinancialData {
  totalCapex: number
  fvCapex: number
  bessCapex: number
  avgCapexPerProject: number
  totalSavingsMonthly: number
  avgPaybackMonths: number | null
  projectCount: number
}

export interface TechnicalData {
  totalSolarKwh: number
  totalGridKwh: number
  totalBatteryDischargeKwh: number
  operativeProjects: number
  constructionProjects: { id: string; nombre: string; totalHitos: number; completedHitos: number; delayedHitos: number }[]
}

export interface ActivityData {
  newProjectsThisMonth: number
  newProjectsLastMonth: number
  docsThisMonth: number
  docsLastMonth: number
  commentsThisMonth: number
  commentsLastMonth: number
  newUsersThisMonth: number
  newUsersLastMonth: number
  newClientsThisMonth: number
  newClientsLastMonth: number
}

export interface EpcLeader {
  id: string
  nombre: string
  empresa: string
  totalProjects: number
  totalCapex: number
  closedProjects: number
}

export interface StaleProject {
  id: string
  nombre: string
  estado: string
  estadoLabel: string
  daysInStage: number
  epcistaNombre: string
  lastTransition: string
}

export interface RecentProject {
  id: string
  nombre_proyecto: string
  tipo: string
  estado: string
  historial_estados?: Record<string, string>
  created_at: string
  epcista_nombre: string
}

// ─── Stage config ───────────────────────────────────
const STAGE_ORDER = [
  'recibido', 'en_analisis', 'propuesta_lista', 'enviada',
  'cliente_interesado', 'negociacion', 'aprobado',
  'en_construccion', 'operativo', 'completado'
]

const STAGE_LABELS: Record<string, string> = {
  recibido: 'Lead',
  en_analisis: 'En análisis',
  propuesta_lista: 'Propuesta lista',
  enviada: 'Propuesta enviada',
  cliente_interesado: 'Cliente interesado',
  negociacion: 'Negociación',
  aprobado: 'Cierre',
  en_construccion: 'En construcción',
  operativo: 'Operativo',
  completado: 'Completado',
}

const TERMINAL_STAGES = ['aprobado', 'en_construccion', 'operativo', 'completado']

// ─── Helpers ──────────────────────────────────────────
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function startOfMonth(d: Date = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function startOfLastMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString()
}

function endOfLastMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59).toISOString()
}

// ─── Main fetcher ─────────────────────────────────────
export async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()

  // Parallel fetches
  const [
    { data: proyectos },
    { data: productos },
    { data: profiles },
    { data: clientes },
    { data: telemetria },
    { data: hitos },
    { data: archivos },
    { data: comentarios },
  ] = await Promise.all([
    supabase.from('proyectos').select('id, nombre_proyecto, tipo, estado, historial_estados, capex_estimado, moneda, ubicacion_estado, modalidad_financiamiento, epcista_id, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('proyecto_sitio_productos').select('proyecto_id, tipo, datos'),
    supabase.from('profiles').select('id, nombre, empresa, rol, created_at'),
    supabase.from('clientes').select('id, industria, ubicacion_estado, created_at'),
    supabase.from('telemetria_egauge').select('proyecto_id, solar_produccion_kwh, consumo_red_kwh, bateria_descarga_kwh'),
    supabase.from('hitos_construccion').select('id, proyecto_id, estado, fecha_estimada_fin, fecha_real_fin'),
    supabase.from('archivos').select('id, created_at'),
    supabase.from('comentarios').select('id, created_at'),
  ])

  const prs = (proyectos ?? []) as Record<string, unknown>[]
  const prods = (productos ?? []) as Record<string, unknown>[]
  const profs = (profiles ?? []) as Record<string, unknown>[]
  const cls = (clientes ?? []) as Record<string, unknown>[]
  const telem = (telemetria ?? []) as Record<string, unknown>[]
  const hitosArr = (hitos ?? []) as Record<string, unknown>[]
  const archArr = (archivos ?? []) as Record<string, unknown>[]
  const commArr = (comentarios ?? []) as Record<string, unknown>[]

  // ─── Name map for EPCistas ───
  const nameMap: Record<string, { nombre: string; empresa: string }> = {}
  for (const p of profs) {
    nameMap[p.id as string] = { nombre: p.nombre as string, empresa: p.empresa as string }
  }

  // ─── KPIs ───
  const totalProjects = prs.length
  const activePipelineCapex = prs
    .filter(p => !['operativo', 'completado'].includes(p.estado as string))
    .reduce((s, p) => s + (Number(p.capex_estimado) || 0), 0)

  // Installed capacity from products of operativo/completado projects
  const operativeIds = new Set(prs.filter(p => ['operativo', 'completado'].includes(p.estado as string)).map(p => p.id as string))
  let installedKwp = 0
  for (const prod of prods) {
    if (!operativeIds.has(prod.proyecto_id as string)) continue
    const d = prod.datos as Record<string, unknown> | null
    if (!d) continue
    if (prod.tipo === 'fv') {
      installedKwp += ((Number(d.num_modulos) || 0) * (Number(d.potencia_modulos_w) || 0)) / 1000
    } else if (prod.tipo === 'bess') {
      installedKwp += Number(d.potencia_kw) || 0
    }
  }

  // Win rate: projects that reached 'aprobado' or beyond ÷ total
  const closedCount = prs.filter(p => TERMINAL_STAGES.includes(p.estado as string)).length
  const winRate = totalProjects > 0 ? (closedCount / totalProjects) * 100 : 0

  // Avg days to close (Lead → Cierre)
  const closeDeltas: number[] = []
  const installDeltas: number[] = []
  for (const p of prs) {
    const h = p.historial_estados as Record<string, string> | null
    if (!h) continue
    if (h.recibido && h.aprobado) {
      closeDeltas.push(daysBetween(h.recibido, h.aprobado))
    }
    if (h.aprobado && h.operativo) {
      installDeltas.push(daysBetween(h.aprobado, h.operativo))
    }
  }
  const avgDaysToClose = closeDeltas.length > 0 ? Math.round(closeDeltas.reduce((a, b) => a + b, 0) / closeDeltas.length) : null
  const avgDaysToInstall = installDeltas.length > 0 ? Math.round(installDeltas.reduce((a, b) => a + b, 0) / installDeltas.length) : null

  // ─── Pipeline ───
  const byStage: Record<string, number> = {}
  for (const e of STAGE_ORDER) byStage[e] = 0
  for (const p of prs) {
    const e = p.estado as string
    byStage[e] = (byStage[e] ?? 0) + 1
  }

  // Conversion funnel: what % of projects ever reached each stage?
  const reachedStage: Record<string, number> = {}
  for (const e of STAGE_ORDER) reachedStage[e] = 0
  for (const p of prs) {
    const h = p.historial_estados as Record<string, string> | null
    if (!h) {
      // If no historial, they at least reached their current stage and all before it
      const idx = STAGE_ORDER.indexOf(p.estado as string)
      for (let i = 0; i <= idx; i++) reachedStage[STAGE_ORDER[i]]++
      continue
    }
    for (const stage of STAGE_ORDER) {
      if (h[stage]) reachedStage[stage]++
    }
    // Also count current stage even if not in historial
    const curIdx = STAGE_ORDER.indexOf(p.estado as string)
    for (let i = 0; i <= curIdx; i++) {
      if (!h[STAGE_ORDER[i]]) reachedStage[STAGE_ORDER[i]]++
    }
  }

  const funnelPercents = STAGE_ORDER.map(stage => ({
    stage,
    label: STAGE_LABELS[stage],
    pct: totalProjects > 0 ? Math.round((reachedStage[stage] / totalProjects) * 100) : 0,
    count: reachedStage[stage],
  }))

  // ─── Velocity ───
  const transitions = [
    { from: 'recibido', to: 'en_analisis' },
    { from: 'en_analisis', to: 'propuesta_lista' },
    { from: 'propuesta_lista', to: 'enviada' },
    { from: 'enviada', to: 'cliente_interesado' },
    { from: 'cliente_interesado', to: 'negociacion' },
    { from: 'negociacion', to: 'aprobado' },
    { from: 'aprobado', to: 'en_construccion' },
    { from: 'en_construccion', to: 'operativo' },
  ]

  const velocityStages = transitions.map(({ from, to }) => {
    const deltas: number[] = []
    for (const p of prs) {
      const h = p.historial_estados as Record<string, string> | null
      if (h && h[from] && h[to]) {
        const d = daysBetween(h[from], h[to])
        if (d >= 0) deltas.push(d)
      }
    }
    return {
      from,
      to,
      fromLabel: STAGE_LABELS[from],
      toLabel: STAGE_LABELS[to],
      avgDays: deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : null,
      count: deltas.length,
    }
  })

  // ─── Financial ───
  let fvCapex = 0, bessCapex = 0, totalSavingsMonthly = 0
  const projectCapex: Record<string, number> = {}
  const projectSavings: Record<string, number> = {}
  for (const prod of prods) {
    const d = prod.datos as Record<string, unknown> | null
    if (!d) continue
    const pid = prod.proyecto_id as string
    const capex = Number(d.capex) || 0
    if (prod.tipo === 'fv') fvCapex += capex
    else if (prod.tipo === 'bess') bessCapex += capex
    projectCapex[pid] = (projectCapex[pid] || 0) + capex
    const savings = Number(d.ahorro_mensual_estimado) || 0
    projectSavings[pid] = (projectSavings[pid] || 0) + savings
    totalSavingsMonthly += savings
  }
  const totalCapex = fvCapex + bessCapex
  const avgCapexPerProject = totalProjects > 0 ? totalCapex / totalProjects : 0

  // Avg payback
  const paybacks: number[] = []
  for (const pid of Object.keys(projectCapex)) {
    if (projectCapex[pid] > 0 && projectSavings[pid] > 0) {
      paybacks.push(projectCapex[pid] / projectSavings[pid])
    }
  }
  const avgPaybackMonths = paybacks.length > 0 ? Math.round(paybacks.reduce((a, b) => a + b, 0) / paybacks.length) : null

  // ─── Technical ───
  let totalSolarKwh = 0, totalGridKwh = 0, totalBatteryDischargeKwh = 0
  for (const t of telem) {
    totalSolarKwh += Number(t.solar_produccion_kwh) || 0
    totalGridKwh += Number(t.consumo_red_kwh) || 0
    totalBatteryDischargeKwh += Number(t.bateria_descarga_kwh) || 0
  }

  const operativeProjects = prs.filter(p => p.estado === 'operativo').length
  const constructionIds = prs.filter(p => p.estado === 'en_construccion').map(p => p.id as string)
  const constructionProjects = constructionIds.map(pid => {
    const projectHitos = hitosArr.filter(h => h.proyecto_id === pid)
    const proj = prs.find(p => p.id === pid)
    return {
      id: pid,
      nombre: (proj?.nombre_proyecto as string) || '—',
      totalHitos: projectHitos.length,
      completedHitos: projectHitos.filter(h => h.estado === 'completado').length,
      delayedHitos: projectHitos.filter(h => h.estado === 'retrasado').length,
    }
  })

  // ─── Activity ───
  const thisMonthStart = startOfMonth()
  const lastMonthStart = startOfLastMonth()
  const lastMonthEnd = endOfLastMonth()

  const countInRange = (arr: Record<string, unknown>[], start: string, end?: string) =>
    arr.filter(x => {
      const d = x.created_at as string
      return d >= start && (!end || d <= end)
    }).length

  const activity: ActivityData = {
    newProjectsThisMonth: countInRange(prs, thisMonthStart),
    newProjectsLastMonth: countInRange(prs, lastMonthStart, lastMonthEnd),
    docsThisMonth: countInRange(archArr, thisMonthStart),
    docsLastMonth: countInRange(archArr, lastMonthStart, lastMonthEnd),
    commentsThisMonth: countInRange(commArr, thisMonthStart),
    commentsLastMonth: countInRange(commArr, lastMonthStart, lastMonthEnd),
    newUsersThisMonth: countInRange(profs, thisMonthStart),
    newUsersLastMonth: countInRange(profs, lastMonthStart, lastMonthEnd),
    newClientsThisMonth: countInRange(cls, thisMonthStart),
    newClientsLastMonth: countInRange(cls, lastMonthStart, lastMonthEnd),
  }

  // ─── EPC Leaderboard ───
  const epcProfs = profs.filter(p => p.rol === 'epc')
  const epcLeaderboard: EpcLeader[] = epcProfs.map(ep => {
    const epId = ep.id as string
    const epProjects = prs.filter(p => p.epcista_id === epId)
    const totalEpCapex = epProjects.reduce((s, p) => s + (Number(p.capex_estimado) || 0), 0)
    const closed = epProjects.filter(p => TERMINAL_STAGES.includes(p.estado as string)).length
    return {
      id: epId,
      nombre: ep.nombre as string,
      empresa: ep.empresa as string,
      totalProjects: epProjects.length,
      totalCapex: totalEpCapex,
      closedProjects: closed,
    }
  }).sort((a, b) => b.totalProjects - a.totalProjects).slice(0, 10)

  // ─── Stale Pipeline ───
  const now = Date.now()
  const stalePipeline: StaleProject[] = []
  for (const p of prs) {
    if (['operativo', 'completado'].includes(p.estado as string)) continue
    const h = p.historial_estados as Record<string, string> | null
    const estado = p.estado as string
    let lastDate = p.updated_at as string
    if (h && h[estado]) lastDate = h[estado]
    const days = Math.round((now - new Date(lastDate).getTime()) / 86400000)
    const epInfo = nameMap[p.epcista_id as string]
    stalePipeline.push({
      id: p.id as string,
      nombre: p.nombre_proyecto as string,
      estado,
      estadoLabel: STAGE_LABELS[estado] || estado,
      daysInStage: days,
      epcistaNombre: epInfo?.nombre || '—',
      lastTransition: lastDate,
    })
  }
  stalePipeline.sort((a, b) => b.daysInStage - a.daysInStage)

  // ─── Financing Mix ───
  const financingMix: Record<string, number> = {}
  for (const p of prs) {
    const mods = p.modalidad_financiamiento as string[] | null
    if (mods) {
      for (const m of mods) {
        financingMix[m] = (financingMix[m] || 0) + 1
      }
    }
  }

  // ─── Tech Mix ───
  const techMix: Record<string, number> = {}
  for (const p of prs) {
    const t = p.tipo as string
    techMix[t] = (techMix[t] || 0) + 1
  }

  // ─── Geo CAPEX ───
  const geoCAPEX: Record<string, number> = {}
  for (const p of prs) {
    const st = (p.ubicacion_estado as string) || 'Sin estado'
    geoCAPEX[st] = (geoCAPEX[st] || 0) + (Number(p.capex_estimado) || 0)
  }

  // ─── Recent projects ───
  const recentList = prs.slice(0, 8)
  const recentProjects: RecentProject[] = recentList.map(p => ({
    id: p.id as string,
    nombre_proyecto: p.nombre_proyecto as string,
    tipo: p.tipo as string,
    estado: p.estado as string,
    historial_estados: p.historial_estados as Record<string, string> | undefined,
    created_at: p.created_at as string,
    epcista_nombre: nameMap[p.epcista_id as string]?.nombre || '—',
  }))

  // ─── Raw data for client-side time filtering ───
  const rawProjects: RawProject[] = prs.map(p => ({
    id: p.id as string,
    estado: p.estado as string,
    tipo: p.tipo as string,
    historial_estados: p.historial_estados as Record<string, string> | null,
    capex_estimado: Number(p.capex_estimado) || 0,
    created_at: p.created_at as string,
  }))

  const rawProducts: RawProduct[] = prods.map(p => ({
    proyecto_id: p.proyecto_id as string,
    tipo: p.tipo as string,
    datos: p.datos as Record<string, unknown> | null,
  }))

  return {
    kpis: { totalProjects, activePipelineCapex, installedCapacityKwp: installedKwp, winRate, avgDaysToClose, avgDaysToInstall },
    pipeline: { byStage, funnelPercents },
    velocity: { stages: velocityStages },
    financial: { totalCapex, fvCapex, bessCapex, avgCapexPerProject, totalSavingsMonthly, avgPaybackMonths, projectCount: totalProjects },
    technical: { totalSolarKwh, totalGridKwh, totalBatteryDischargeKwh, operativeProjects, constructionProjects },
    activity,
    epcLeaderboard,
    stalePipeline,
    financingMix,
    techMix,
    geoCAPEX,
    recentProjects,
    rawProjects,
    rawProducts,
  }
}
