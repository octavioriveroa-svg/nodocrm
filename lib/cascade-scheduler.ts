/**
 * Cascade Dependency Scheduler
 *
 * When an activity is moved (dragged on the Gantt), this engine
 * propagates the date change through all dependent activities.
 *
 * Supports all 4 dependency types:
 * - FS (Finish-to-Start): B starts after A finishes  ← most common
 * - SS (Start-to-Start):  B starts when A starts
 * - FF (Finish-to-Finish): B finishes when A finishes
 * - SF (Start-to-Finish): B finishes when A starts
 */

import type { PlanActividad, TipoDependencia } from './types'

// ── Helpers ───────────────────────────────────────────────────

function toDate(s: string | null): Date | null {
  return s ? new Date(s + 'T00:00:00') : null
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Types ─────────────────────────────────────────────────────

export interface CascadeUpdate {
  id: string
  fecha_inicio_estimada: string
  fecha_fin_estimada: string
}

// ── Core Algorithm ────────────────────────────────────────────


/**
 * Topological sort using Kahn's algorithm.
 * Returns activities in dependency order (predecessors first).
 */
function topologicalSort(activities: PlanActividad[]): PlanActividad[] {
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()
  const actMap = new Map<string, PlanActividad>()

  for (const a of activities) {
    actMap.set(a.id, a)
    inDegree.set(a.id, 0)
    adjList.set(a.id, [])
  }

  for (const a of activities) {
    if (a.dependencia_id && actMap.has(a.dependencia_id)) {
      adjList.get(a.dependencia_id)!.push(a.id)
      inDegree.set(a.id, (inDegree.get(a.id) || 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const sorted: PlanActividad[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    sorted.push(actMap.get(id)!)
    for (const depId of adjList.get(id) || []) {
      const newDeg = (inDegree.get(depId) || 1) - 1
      inDegree.set(depId, newDeg)
      if (newDeg === 0) queue.push(depId)
    }
  }

  return sorted
}

/**
 * Given a dependency type and the predecessor's dates, compute the
 * earliest allowed start/end for the dependent activity.
 */
function computeConstraint(
  tipo: TipoDependencia,
  predStart: Date,
  predEnd: Date,
  depDuration: number
): { constrainedStart: Date; constrainedEnd: Date } {
  switch (tipo) {
    case 'FS': {
      // Dependent starts after predecessor finishes
      const constrainedStart = addDays(predEnd, 1)
      return { constrainedStart, constrainedEnd: addDays(constrainedStart, depDuration - 1) }
    }
    case 'SS': {
      // Dependent starts when predecessor starts
      return { constrainedStart: predStart, constrainedEnd: addDays(predStart, depDuration - 1) }
    }
    case 'FF': {
      // Dependent finishes when predecessor finishes
      const constrainedEnd = predEnd
      return { constrainedStart: addDays(constrainedEnd, -(depDuration - 1)), constrainedEnd }
    }
    case 'SF': {
      // Dependent finishes when predecessor starts
      const constrainedEnd = predStart
      return { constrainedStart: addDays(constrainedEnd, -(depDuration - 1)), constrainedEnd }
    }
    default:
      return { constrainedStart: predStart, constrainedEnd: addDays(predStart, depDuration - 1) }
  }
}

/**
 * Main cascade function.
 *
 * Given all activities and one that was moved, propagate changes
 * through all dependents. Returns the list of activities that
 * need to be updated in the database.
 */
export function cascadeDependencies(
  activities: PlanActividad[],
  movedId: string,
  newStart: Date,
  newEnd: Date
): CascadeUpdate[] {
  // Create a mutable copy of dates keyed by ID
  const dateMap = new Map<string, { start: Date; end: Date; duration: number }>()

  for (const a of activities) {
    const s = toDate(a.fecha_inicio_estimada)
    const e = toDate(a.fecha_fin_estimada)
    if (s && e) {
      dateMap.set(a.id, { start: s, end: e, duration: Math.max(1, daysBetween(s, e) + 1) })
    } else {
      // Activity without dates — give it 1 day duration starting today
      const now = new Date()
      dateMap.set(a.id, { start: now, end: now, duration: 1 })
    }
  }

  // Apply the moved activity's new dates
  const movedDuration = Math.max(1, daysBetween(newStart, newEnd) + 1)
  dateMap.set(movedId, { start: newStart, end: newEnd, duration: movedDuration })

  // Topological sort to process in dependency order
  const sorted = topologicalSort(activities)
  const actMap = new Map(activities.map(a => [a.id, a]))

  // Track which activities got changed
  const updates: CascadeUpdate[] = []

  // Always include the moved activity
  updates.push({
    id: movedId,
    fecha_inicio_estimada: toISO(newStart),
    fecha_fin_estimada: toISO(newEnd),
  })

  // Walk in topological order, enforcing constraints
  for (const act of sorted) {
    if (act.id === movedId) continue // Already handled
    if (!act.dependencia_id) continue // No dependency
    if (!actMap.has(act.dependencia_id)) continue // Predecessor not in set

    const pred = dateMap.get(act.dependencia_id)
    const current = dateMap.get(act.id)
    if (!pred || !current) continue

    const { constrainedStart, constrainedEnd } = computeConstraint(
      act.tipo_dependencia,
      pred.start,
      pred.end,
      current.duration
    )

    // Only shift if the constraint pushes the activity later
    if (constrainedStart.getTime() > current.start.getTime()) {
      dateMap.set(act.id, {
        start: constrainedStart,
        end: constrainedEnd,
        duration: current.duration,
      })

      updates.push({
        id: act.id,
        fecha_inicio_estimada: toISO(constrainedStart),
        fecha_fin_estimada: toISO(constrainedEnd),
      })
    }
  }

  return updates
}

/**
 * Recalculate a phase's date range based on its child activities.
 */
export function recalcPhaseDates(
  activities: PlanActividad[],
  faseId: string
): { fecha_inicio_estimada: string | null; fecha_fin_estimada: string | null } {
  const children = activities.filter(a => a.fase_id === faseId)
  if (children.length === 0) return { fecha_inicio_estimada: null, fecha_fin_estimada: null }

  let minStart: Date | null = null
  let maxEnd: Date | null = null

  for (const c of children) {
    const s = toDate(c.fecha_inicio_estimada)
    const e = toDate(c.fecha_fin_estimada)
    if (s && (!minStart || s < minStart)) minStart = s
    if (e && (!maxEnd || e > maxEnd)) maxEnd = e
  }

  return {
    fecha_inicio_estimada: minStart ? toISO(minStart) : null,
    fecha_fin_estimada: maxEnd ? toISO(maxEnd) : null,
  }
}

/**
 * Recalculate a phase's completion percentage from child activities.
 */
export function recalcPhaseProgress(activities: PlanActividad[], faseId: string): number {
  const children = activities.filter(a => a.fase_id === faseId)
  if (children.length === 0) return 0
  const total = children.reduce((sum, a) => sum + (a.porcentaje_completado || 0), 0)
  return Math.round((total / children.length) * 100) / 100
}
