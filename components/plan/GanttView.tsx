/* eslint-disable */
'use client'

import { useCallback, useRef, useMemo } from 'react'
import type { PlanFase, PlanActividad, HitoFinanciero } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { cascadeDependencies, recalcPhaseDates } from '@/lib/cascade-scheduler'
import { Gantt, Willow } from '@svar-ui/react-gantt'
import '@svar-ui/react-gantt/all.css'

// ── Map our dependency types → SVAR link types ────────────────
const DEP_TYPE_MAP: Record<string, string> = {
  FS: 'e2s', // end-to-start (finish-to-start)
  SS: 's2s', // start-to-start
  FF: 'e2e', // end-to-end (finish-to-finish)
  SF: 's2e', // start-to-end
}

interface Props {
  fases: PlanFase[]
  actividades: PlanActividad[]
  hitosFinancieros: HitoFinanciero[]
  readOnly?: boolean
  onTaskDragged: (updates: { id: string; fecha_inicio_estimada: string; fecha_fin_estimada: string }[]) => void
}

function toDate(s: string | null): Date {
  return s ? new Date(s + 'T00:00:00') : new Date()
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
}

function dateToISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function GanttView({ fases, actividades, hitosFinancieros, readOnly, onTaskDragged }: Props) {
  const supabase = createClient()
  const apiRef = useRef<any>(null)

  // ── Convert our data → SVAR format ──────────────────────────
  const { tasks, links } = useMemo(() => {
    const ganttTasks: any[] = []
    const ganttLinks: any[] = []
    let linkId = 1

    // Phases as summary rows
    const sortedFases = [...fases].sort((a, b) => a.orden - b.orden)
    for (const fase of sortedFases) {
      const faseStart = toDate(fase.fecha_inicio_estimada)
      const faseEnd = toDate(fase.fecha_fin_estimada)

      ganttTasks.push({
        id: fase.id,
        text: fase.nombre,
        start: faseStart,
        end: faseEnd,
        duration: daysBetween(faseStart, faseEnd),
        progress: (fase.porcentaje_completado || 0) / 100,
        type: 'summary',
        open: true,
        // Store extra data for color
        $color: fase.color,
      })
    }

    // Activities as task bars (children of phases)
    const sortedActs = [...actividades].sort((a, b) => a.orden - b.orden)
    for (const act of sortedActs) {
      const actStart = toDate(act.fecha_inicio_estimada)
      const actEnd = toDate(act.fecha_fin_estimada)

      ganttTasks.push({
        id: act.id,
        text: act.nombre,
        start: actStart,
        end: actEnd,
        duration: act.duracion_dias || daysBetween(actStart, actEnd),
        progress: (act.porcentaje_completado || 0) / 100,
        parent: act.fase_id,
        type: 'task',
      })

      // Dependencies → links
      if (act.dependencia_id) {
        ganttLinks.push({
          id: linkId++,
          source: act.dependencia_id,
          target: act.id,
          type: DEP_TYPE_MAP[act.tipo_dependencia] || 'e2s',
        })
      }
    }

    // Financial milestones as milestone markers
    for (const hito of hitosFinancieros) {
      if (hito.fecha_estimada) {
        const hitoDate = toDate(hito.fecha_estimada)
        ganttTasks.push({
          id: `hf-${hito.id}`,
          text: `💰 ${hito.nombre}`,
          start: hitoDate,
          end: hitoDate,
          duration: 0,
          progress: hito.estado === 'pagado' ? 1 : 0,
          parent: hito.fase_id || 0,
          type: 'milestone',
        })
      }
    }

    return { tasks: ganttTasks, links: ganttLinks }
  }, [fases, actividades, hitosFinancieros])

  // ── Scales config ───────────────────────────────────────────
  const scales = useMemo(() => [
    { unit: 'month' as const, step: 1, format: '%F %Y' },
    { unit: 'week' as const, step: 1, format: 'Sem %W' },
  ], [])

  // ── Custom columns ─────────────────────────────────────────
  const columns = useMemo(() => [
    { id: 'text', header: 'Actividad', flexgrow: 1 },
    { id: 'start', header: 'Inicio', width: 100, align: 'center' as const },
    { id: 'duration', header: 'Días', width: 60, align: 'center' as const },
  ], [])

  // ── Handle drag events → cascade + persist ─────────────────
  const handleInit = useCallback((api: any) => {
    apiRef.current = api

    if (readOnly) {
      // Block all modifications in read-only mode
      api.intercept('drag-task', () => false)
      api.intercept('update-task', () => false)
      api.intercept('add-task', () => false)
      api.intercept('delete-task', () => false)
      api.intercept('add-link', () => false)
      api.intercept('delete-link', () => false)
      return
    }

    // When drag finishes (inProgress=false), run cascade
    api.on('drag-task', (ev: any) => {
      if (ev.inProgress) return // Still dragging, skip

      const task = api.getTask(ev.id)
      if (!task || task.type === 'summary' || task.type === 'milestone') return

      const newStart = task.start instanceof Date ? task.start : new Date(task.start)
      const newEnd = task.end instanceof Date ? task.end : new Date(task.end)

      // Run cascade scheduler
      const updates = cascadeDependencies(actividades, ev.id, newStart, newEnd)

      // Update SVAR tasks in-place for immediate visual feedback
      for (const u of updates) {
        if (u.id !== ev.id) {
          api.exec('update-task', {
            id: u.id,
            task: {
              start: new Date(u.fecha_inicio_estimada + 'T00:00:00'),
              end: new Date(u.fecha_fin_estimada + 'T00:00:00'),
            }
          })
        }
      }

      // Persist all changes
      onTaskDragged(updates)
    })

    // Block adding/editing summary tasks (phases) from Gantt
    api.intercept('update-task', (ev: any) => {
      const task = api.getTask(ev.id)
      if (task && task.type === 'summary') return false
    })
  }, [readOnly, actividades, onTaskDragged])

  // ── Markers: "today" line ──────────────────────────────────
  const markers = useMemo(() => [{
    start: new Date(),
    text: 'Hoy',
    css: 'today-marker',
  }], [])

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
        <p className="text-sm text-gray-500 font-medium">
          Agrega fases y actividades con fechas para ver el diagrama de Gantt.
        </p>
      </div>
    )
  }

  return (
    <div className="gantt-container border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <style>{`
        .gantt-container {
          --wx-gantt-bar-fill: #000;
          --wx-gantt-bar-color: #D7FF2F;
          --wx-gantt-milestone-color: #10B981;
          --wx-gantt-link-color: #9CA3AF;
          height: 500px;
        }
        .today-marker {
          background-color: #EF4444;
          opacity: 0.4;
        }
      `}</style>
      <Willow>
        <Gantt
          tasks={tasks}
          links={links}
          scales={scales}
          columns={columns}
          cellHeight={38}
          cellWidth={40}
          init={handleInit}
          readonly={readOnly}
          zoom
        />
      </Willow>
    </div>
  )
}
