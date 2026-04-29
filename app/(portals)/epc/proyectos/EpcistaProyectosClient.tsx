'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Search, MapPin, Building2, Calendar, ArrowRight, SlidersHorizontal } from 'lucide-react'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import type { Proyecto, EstadoProyecto } from '@/lib/types'

const MODALIDAD_LABELS: Record<string, string> = {
  credito: 'Crédito',
  arrendamiento: 'Arrendamiento',
  ensaas: 'EnSaaS',
  mem: 'Mercado Eléctrico Mayorista',
  no_sabe: 'Analista define modalidad',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

/** Segment tabs configuration */
type Segment = 'todos' | EstadoProyecto
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'recibido', label: 'Recibido' },
  { key: 'en_analisis', label: 'En análisis' },
  { key: 'propuesta_lista', label: 'Propuesta lista' },
  { key: 'enviada', label: 'Enviada' },
  { key: 'cliente_interesado', label: 'Cliente interesado' },
]

/** Type filter options */
const TYPE_OPTIONS = ['BESS', 'MEM', 'BESS+MEM', 'FV', 'FV+BESS'] as const

interface Props {
  initialProyectos: Proyecto[]
}

export default function EpcistaProyectosClient({ initialProyectos }: Props) {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<Proyecto[]>(initialProyectos)

  // Filters
  const [segment, setSegment] = useState<Segment>('todos')
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Realtime: sync changes from admin/analista
  useEffect(() => {
    const channel = supabase
      .channel('proyectos-epcista')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'proyectos' }, payload => {
        setProyectos(prev => prev.filter(p => p.id !== (payload.old as { id: string }).id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'proyectos' }, payload => {
        setProyectos(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } as Proyecto : p))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Filtered & searched projects */
  const filtered = useMemo(() => {
    let result = proyectos
    // Segment filter
    if (segment !== 'todos') {
      result = result.filter(p => p.estado === segment)
    }
    // Type filter
    if (tipoFilter) {
      result = result.filter(p => p.tipo === tipoFilter)
    }
    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.nombre_proyecto.toLowerCase().includes(q) ||
        p.cliente_final_empresa?.toLowerCase().includes(q) ||
        p.cliente_final_nombre?.toLowerCase().includes(q) ||
        p.ubicacion_estado?.toLowerCase().includes(q)
      )
    }
    return result
  }, [proyectos, segment, search, tipoFilter])

  /** Segment counts */
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: proyectos.length }
    for (const s of SEGMENTS) {
      if (s.key !== 'todos') {
        c[s.key] = proyectos.filter(p => p.estado === s.key).length
      }
    }
    return c
  }, [proyectos])

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Proyectos</h1>
          <p className="text-sm text-gray-500 mt-1">Busca y gestiona tu cartera de proyectos</p>
        </div>
        <Link
          href="/epc/nuevo"
          className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm bg-acento text-principal rounded-lg shadow-sm hover:shadow-md hover:bg-acento-hover transition-all active:scale-[0.97]"
        >
          <Plus size={16} />
          Nuevo proyecto
        </Link>
      </div>

      {/* Segment Tabs + Search Bar */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 glass-card border-none rounded-xl p-1 shadow-sm overflow-x-auto">
            {SEGMENTS.map(s => {
              const count = counts[s.key] ?? 0
              const active = segment === s.key
              // Hide tabs with 0 count (except "todos")
              if (s.key !== 'todos' && count === 0) return null
              return (
                <button
                  key={s.key}
                  onClick={() => setSegment(s.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-principal text-acento shadow-sm'
                      : 'text-gray-500 hover:text-principal hover:bg-gray-50'
                  }`}
                >
                  {s.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    active ? 'bg-acento text-principal' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search + Filter Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar proyecto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 w-56 text-xs rounded-lg border border-borde bg-white focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all placeholder:text-gray-400"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                showFilters || tipoFilter
                  ? 'border-acento bg-acento/10 text-principal'
                  : 'border-borde bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <SlidersHorizontal size={13} />
              Filtros
              {tipoFilter && (
                <span className="w-1.5 h-1.5 rounded-full bg-acento" />
              )}
            </button>
          </div>
        </div>

        {/* Filter Dropdown */}
        {showFilters && (
          <div className="flex items-center gap-2 px-1 mb-4 animate-in fade-in slide-in-from-top-1">
            <span className="text-xs text-gray-400 font-medium mr-1">Tipo:</span>
            <button
              onClick={() => setTipoFilter(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                !tipoFilter ? 'bg-principal text-acento' : 'glass-card border-none text-gray-500 hover:border-gray-300'
              }`}
            >
              Todos
            </button>
            {TYPE_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => setTipoFilter(tipoFilter === t ? null : t)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  tipoFilter === t ? 'bg-principal text-acento' : 'glass-card border-none text-gray-500 hover:border-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Projects Grid */}
      {proyectos.length === 0 ? (
        <div className="rounded-xl glass-panel border-dashed border-white/50 p-16 flex flex-col items-center text-center">
          <p className="font-semibold text-lg">Aún no tienes proyectos</p>
          <p className="text-sm mt-2 mb-6 text-gray-400">Crea tu primer proyecto para comenzar</p>
          <Link href="/epc/nuevo" className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm bg-acento text-principal rounded-lg shadow-sm hover:shadow-md transition-all">
            <Plus size={16} />
            Nuevo proyecto
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">No se encontraron proyectos con los filtros aplicados.</p>
          <button
            onClick={() => { setSegment('todos'); setSearch(''); setTipoFilter(null) }}
            className="mt-3 text-xs font-semibold text-principal underline underline-offset-4 hover:text-acento-hover transition-colors"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const modalidades = p.modalidad_financiamiento ?? []
            const noSabe = modalidades.includes('no_sabe')
            return (
              <Link
                key={p.id}
                href={`/epc/proyectos/${p.id}`}
                className="glass-card p-5 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all group flex flex-col h-full"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-principal truncate" title={p.nombre_proyecto}>
                      {p.nombre_proyecto}
                    </h3>
                    {p.cliente_final_empresa && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 truncate">
                        <Building2 size={12} className="text-gray-400 shrink-0" />
                        {p.cliente_final_empresa}
                      </p>
                    )}
                  </div>
                  <BadgeEstado estado={p.estado} />
                </div>

                {/* Card Body — Metadata */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <BadgeTipo tipo={p.tipo} />
                  {p.ubicacion_estado && (
                    <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                      <MapPin size={11} className="text-gray-400" />
                      {p.ubicacion_estado}
                    </span>
                  )}
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs flex-1">
                  {p.capex_estimado != null && (
                    <div>
                      <span className="text-gray-400 block">CAPEX</span>
                      <span className="font-semibold text-principal">{p.moneda} {p.capex_estimado.toLocaleString('es-MX')}</span>
                    </div>
                  )}
                  {modalidades.length > 0 && (
                    <div>
                      <span className="text-gray-400 block">Financiamiento</span>
                      <span className="font-semibold text-principal truncate">
                        {noSabe ? 'Analista define' : modalidades.map(m => MODALIDAD_LABELS[m] ?? m).join(', ')}
                      </span>
                    </div>
                  )}
                  {p.cliente_final_nombre && (
                    <div>
                      <span className="text-gray-400 block">Contacto</span>
                      <span className="font-semibold text-principal truncate">{p.cliente_final_nombre}</span>
                    </div>
                  )}
                  {p.tipo_instalacion && (
                    <div>
                      <span className="text-gray-400 block">Instalación</span>
                      <span className="font-semibold text-principal">{p.tipo_instalacion === 'nodo_busca' ? 'Nodo busca' : 'EPCista'}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="mt-auto pt-4 border-t border-borde flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                    <Calendar size={11} />
                    {formatDate(p.created_at)}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-principal group-hover:text-acento-hover transition-colors">
                    Ver detalle
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
