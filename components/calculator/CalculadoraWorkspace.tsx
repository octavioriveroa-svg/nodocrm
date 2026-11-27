'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowUpRight,
  Calculator,
  Check,
  FolderKanban,
  FolderPlus,
  Loader2,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchProyectosDirectory, type ProyectoConEpcista } from '@/lib/domains/proyectos/queries'
import {
  buildFallbackCalculatorTemplate,
  loadFullProjectSimulatorBundle,
  type FullProjectSimulatorBundle,
} from '@/lib/calculator/load-context'
import { evaluateMemEligibility } from '@/lib/calculator/mem-eligibility'
import { guardarSimulacion } from '@/app/actions/simulaciones'
import { fmtCurrency, fmtNum } from '@/lib/format'
import type { CalculadoraTemplate, Proyecto, Rol } from '@/lib/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  SimuladorAhorrosSeccion,
  type LinkManualSimulationPayload,
} from '@/components/calculator/SimuladorAhorrosSeccion'

export type CalculatorPortalPrefix = 'admin' | 'analista' | 'epc' | 'finder' | 'financiero'

const PORTAL_DEFAULT_ROLE: Record<CalculatorPortalPrefix, Rol> = {
  admin: 'nodo_admin',
  analista: 'nodo_analista',
  epc: 'epc',
  finder: 'finder',
  financiero: 'financiero',
}

function createInitialManualProyecto(): Proyecto {
  const now = new Date().toISOString()
  return {
    id: 'manual-sandbox',
    epcista_id: null,
    responsable_nodo_id: null,
    cliente_id: null,
    finder_id: null,
    financiero_id: null,
    tipo: 'FV+BESS',
    nombre_proyecto: 'Simulación Manual FV + BESS',
    estado: 'en_analisis',
    cliente_final_nombre: 'Cliente Prospecto',
    cliente_final_empresa: 'Simulación Manual',
    cliente_final_contacto: '',
    capacidad_mwh: 0.2,
    capacidad_mw: 0.25,
    tecnologia_bateria: 'LFP',
    duracion_descarga_hrs: 2,
    punto_interconexion: null,
    tipo_participacion_mem: null,
    volumen_energia_mwh_anual: 1200,
    capex_estimado: 3_500_000,
    moneda: 'MXN',
    ubicacion_estado: 'CDMX',
    modalidad_financiamiento: ['no_sabe'],
    notas_adicionales: null,
    tipo_instalacion: null,
    incluye_mem: false,
    demanda_kw: 450,
    tarifa_actual_cfe: 'GDMTH',
    consumo_anual_gwh: 1.2,
    codigo_postal: null,
    created_at: now,
    updated_at: now,
  }
}

export function CalculadoraWorkspace({
  portalPrefix,
}: {
  portalPrefix: CalculatorPortalPrefix
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const urlProyectoId = searchParams.get('proyectoId')
  const urlSimulacionId = searchParams.get('simulacionId')
  const urlModo = searchParams.get('modo')

  const [bootLoading, setBootLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [userRole, setUserRole] = useState<Rol>(PORTAL_DEFAULT_ROLE[portalPrefix])
  const [projects, setProjects] = useState<ProyectoConEpcista[]>([])
  const [siteDemandByProjectId, setSiteDemandByProjectId] = useState<Record<string, number>>({})
  const [activeTemplate, setActiveTemplate] = useState<CalculadoraTemplate>(() =>
    buildFallbackCalculatorTemplate(),
  )
  const [templatesById, setTemplatesById] = useState<Record<string, CalculadoraTemplate>>({})

  const [workspaceMode, setWorkspaceMode] = useState<'linked' | 'manual'>(() => {
    if (urlProyectoId) return 'linked'
    if (urlModo === 'manual') return 'manual'
    return 'linked'
  })
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(urlProyectoId)
  const [projectSearch, setProjectSearch] = useState('')
  const [bundleLoading, setBundleLoading] = useState(false)
  const [projectBundle, setProjectBundle] = useState<FullProjectSimulatorBundle | null>(null)

  const [manualProyecto, setManualProyecto] = useState<Proyecto>(() =>
    createInitialManualProyecto(),
  )

  // Modal state for linking & saving a manual simulation to an existing project
  const [pendingManualPayload, setPendingManualPayload] =
    useState<LinkManualSimulationPayload | null>(null)
  const [linkTargetProjectId, setLinkTargetProjectId] = useState<string>('')
  const [linkProjectSearch, setLinkProjectSearch] = useState('')
  const [linkSimName, setLinkSimName] = useState('')
  const [linkSimDesc, setLinkSimDesc] = useState('')
  const [linkingSaving, setLinkingSaving] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [linkSuccessInfo, setLinkSuccessInfo] = useState<{
    projectId: string
    projectName: string
    simId: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        router.replace('/login')
        return
      }

      const [{ data: profileRow }, templatesRes] = await Promise.all([
        supabase.from('profiles').select('id, rol').eq('id', session.user.id).maybeSingle(),
        supabase.from('calculadora_templates').select('*').order('version', { ascending: false }),
      ])

      if (cancelled) return

      const resolvedRole = (profileRow?.rol as Rol | undefined) ?? PORTAL_DEFAULT_ROLE[portalPrefix]
      setUserId(session.user.id)
      setUserRole(resolvedRole)

      const templateRows = (!templatesRes.error && Array.isArray(templatesRes.data)
        ? templatesRes.data
        : []) as CalculadoraTemplate[]
      const fallback = buildFallbackCalculatorTemplate()
      const active = templateRows.find((t) => t.is_active) ?? templateRows[0] ?? fallback
      const tMap: Record<string, CalculadoraTemplate> = { [active.id]: active }
      for (const t of templateRows) tMap[t.id] = t
      setActiveTemplate(active)
      setTemplatesById(tMap)

      const list = await fetchProyectosDirectory(supabase, {
        role: resolvedRole,
        userId: session.user.id,
      })
      if (cancelled) return
      setProjects(list)

      if (list.length > 0) {
        const projectIds = list.map((p) => p.id)
        const { data: siteLinks } = await supabase
          .from('proyecto_sitios')
          .select('proyecto_id, sitios(demanda_contratada_kw)')
          .in('proyecto_id', projectIds)

        if (!cancelled && Array.isArray(siteLinks)) {
          const demandMap: Record<string, number> = {}
          for (const row of siteLinks) {
            const pid = (row as { proyecto_id?: string | null }).proyecto_id
            if (!pid) continue
            const rawSitios = (
              row as {
                sitios?:
                  | { demanda_contratada_kw?: number | null }
                  | { demanda_contratada_kw?: number | null }[]
                  | null
              }
            ).sitios
            const siteList = Array.isArray(rawSitios)
              ? rawSitios
              : rawSitios
                ? [rawSitios]
                : []
            for (const s of siteList) {
              const kw = s?.demanda_contratada_kw
              if (kw != null && Number.isFinite(kw) && kw > 0) {
                demandMap[pid] = (demandMap[pid] ?? 0) + kw
              }
            }
          }
          setSiteDemandByProjectId(demandMap)
        }
      }

      if (urlProyectoId && list.some((p) => p.id === urlProyectoId)) {
        setSelectedProjectId(urlProyectoId)
        setWorkspaceMode('linked')
      } else if (urlModo === 'manual') {
        setWorkspaceMode('manual')
      } else if (list.length > 0) {
        setSelectedProjectId((curr) => curr ?? list[0].id)
        setWorkspaceMode('linked')
      } else {
        setWorkspaceMode('manual')
      }

      setBootLoading(false)
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [portalPrefix, router, supabase, urlModo, urlProyectoId])

  useEffect(() => {
    if (workspaceMode !== 'linked' || !selectedProjectId) {
      return
    }
    let cancelled = false
    async function loadSelected() {
      setBundleLoading(true)
      const bundle = await loadFullProjectSimulatorBundle(supabase, selectedProjectId!)
      if (cancelled) return
      setProjectBundle(bundle)
      setBundleLoading(false)
    }
    void loadSelected()
    return () => {
      cancelled = true
    }
  }, [workspaceMode, selectedProjectId, supabase])

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.nombre_proyecto.toLowerCase().includes(q) ||
        (p.cliente_final_empresa || '').toLowerCase().includes(q) ||
        (p.cliente_final_nombre || '').toLowerCase().includes(q) ||
        p.tipo.toLowerCase().includes(q),
    )
  }, [projects, projectSearch])

  const filteredModalProjects = useMemo(() => {
    const q = linkProjectSearch.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.nombre_proyecto.toLowerCase().includes(q) ||
        (p.cliente_final_empresa || '').toLowerCase().includes(q),
    )
  }, [projects, linkProjectSearch])

  function handleOpenLinkManualModal(payload: LinkManualSimulationPayload) {
    setPendingManualPayload(payload)
    setLinkTargetProjectId(selectedProjectId || projects[0]?.id || '')
    setLinkProjectSearch('')
    setLinkSimName(
      `${manualProyecto.nombre_proyecto || 'Simulación Manual'} (${payload.horizonteAnios}a)`,
    )
    setLinkSimDesc('')
    setLinkError('')
  }

  async function handleConfirmLinkManual(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingManualPayload) return
    if (!linkTargetProjectId) {
      setLinkError('Selecciona un proyecto existente para vincular la simulación.')
      return
    }
    const trimmed = linkSimName.trim()
    if (!trimmed) {
      setLinkError('Ingresa un nombre para el escenario vinculado.')
      return
    }

    setLinkingSaving(true)
    setLinkError('')
    const res = await guardarSimulacion({
      proyecto_id: linkTargetProjectId,
      nombre: trimmed,
      descripcion: linkSimDesc.trim() || null,
      moneda_calculo: pendingManualPayload.monedaCalculo,
      horizonte_anios: pendingManualPayload.horizonteAnios,
      vista_financiamiento: pendingManualPayload.vistaFinanciamiento,
      granularidad_default: pendingManualPayload.granularidad,
      parametros_override: pendingManualPayload.parametrosOverride,
    })
    setLinkingSaving(false)

    if (res.error || !res.data) {
      setLinkError(res.error || 'No se pudo vincular la simulación al proyecto.')
      return
    }

    const targetProj = projects.find((p) => p.id === linkTargetProjectId)
    setPendingManualPayload(null)
    setLinkSuccessInfo({
      projectId: linkTargetProjectId,
      projectName: targetProj?.nombre_proyecto || 'Proyecto',
      simId: res.data.id,
    })
  }

  if (bootLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
        <span className="text-sm text-texto-suave">Cargando simulador y proyectos…</span>
      </div>
    )
  }

  const effectiveBundle = projectBundle ?? {
    sitios: [],
    productos: [],
    configuraciones: [],
    opcionesFinanciamiento: [],
    configFinanciamientoLinks: [],
    ofertasMem: [],
    activeTemplate,
    templatesById,
    initialSimulaciones: [],
  }

  return (
    <div className="portal-content-fluid space-y-5 pb-12">
      {/* Top Workspace Control Strip */}
      <div className="glass-surface p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-principal text-acento flex items-center justify-center shrink-0 shadow-sm">
              <Calculator size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-principal tracking-tight">
                Simulador FV + BESS (MEM y CFE Tarifario)
              </h1>
              <p className="text-xs text-texto-suave mt-0.5">
                Vincula un proyecto existente para reflejar resultados en su ficha, o ejecuta simulaciones manuales independientes con descarga directa en PDF.
              </p>
            </div>
          </div>

          <div className="inline-flex flex-wrap sm:flex-nowrap rounded-xl border border-borde bg-fondo/80 p-1 gap-1 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => setWorkspaceMode('linked')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                workspaceMode === 'linked'
                  ? 'bg-principal text-acento shadow-sm'
                  : 'text-texto-suave hover:text-principal'
              }`}
            >
              <FolderKanban size={14} />
              Vincular proyecto existente
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceMode('manual')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                workspaceMode === 'manual'
                  ? 'bg-principal text-acento shadow-sm'
                  : 'text-texto-suave hover:text-principal'
              }`}
            >
              <Sparkles size={14} />
              Simulación manual (PDF)
            </button>
          </div>
        </div>

        {linkSuccessInfo && (
          <div className="rounded-xl bg-acento/25 border border-acento px-4 py-3 text-xs text-principal flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-bold">
              <Check size={15} className="text-principal" />
              Simulación vinculada y guardada en &ldquo;{linkSuccessInfo.projectName}&rdquo;.
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedProjectId(linkSuccessInfo.projectId)
                  setWorkspaceMode('linked')
                  setLinkSuccessInfo(null)
                }}
              >
                Abrir en vista vinculada
              </Button>
              <Link
                href={`/${portalPrefix}/proyectos/${linkSuccessInfo.projectId}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-principal text-acento text-xs font-bold hover:opacity-95"
              >
                Ver proyecto
                <ArrowUpRight size={13} />
              </Link>
              <button
                type="button"
                onClick={() => setLinkSuccessInfo(null)}
                aria-label="Cerrar notificación"
                className="p-1 text-texto-suave hover:text-principal"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Linked Project Selector */}
        {workspaceMode === 'linked' && (
          <div className="pt-2 border-t border-linea space-y-3">
            {projects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-linea bg-white/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-texto-suave">
                  No tienes proyectos asignados actualmente. Puedes ejecutar una simulación manual libre y generar tu PDF al instante.
                </span>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setWorkspaceMode('manual')}
                >
                  Ir a simulación manual
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                <div className="lg:col-span-4 relative">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave"
                  />
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Filtrar proyectos por nombre, cliente o tipo…"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-borde bg-white text-principal"
                  />
                </div>

                <div className="lg:col-span-5">
                  <select
                    aria-label="Seleccionar proyecto vinculado"
                    value={selectedProjectId ?? ''}
                    onChange={(e) => setSelectedProjectId(e.target.value || null)}
                    className="w-full rounded-xl border border-borde bg-white px-3 py-2 text-xs font-semibold text-principal"
                  >
                    {filteredProjects.map((p) => {
                      const elig = evaluateMemEligibility({
                        proyecto: p,
                        overrideDemandaKw: siteDemandByProjectId[p.id],
                      })
                      return (
                        <option key={p.id} value={p.id}>
                          {p.nombre_proyecto} · {p.cliente_final_empresa || p.cliente_final_nombre} ({p.tipo} ·{' '}
                          {elig.isEligible ? 'MEM' : 'CFE'})
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="lg:col-span-3 flex items-center justify-start lg:justify-end gap-2">
                  {selectedProject && (() => {
                    const selectedEligibility = evaluateMemEligibility({
                      proyecto: selectedProject,
                      sitios: effectiveBundle.sitios,
                      overrideDemandaKw:
                        effectiveBundle.sitios.length === 0
                          ? siteDemandByProjectId[selectedProject.id]
                          : undefined,
                    })
                    return (
                      <>
                        <Badge variant={selectedEligibility.isEligible ? 'info' : 'neutral'}>
                          {selectedEligibility.isEligible ? 'Elegible MEM' : 'CFE Tarifario'}
                        </Badge>
                        <Link
                          href={`/${portalPrefix}/proyectos/${selectedProject.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-borde bg-white text-xs font-bold text-principal hover:bg-fondo transition-colors whitespace-nowrap"
                        >
                          Ver proyecto
                          <ArrowUpRight size={13} />
                        </Link>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Simulator Workspace */}
      {workspaceMode === 'linked' ? (
        selectedProject ? (
          bundleLoading ? (
            <div className="glass-surface p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin text-principal" />
              <span className="text-xs font-semibold text-texto-suave">
                Cargando configuración técnica, sitios y simulaciones de {selectedProject.nombre_proyecto}…
              </span>
            </div>
          ) : (
            <SimuladorAhorrosSeccion
              key={`${selectedProject.id}-${urlSimulacionId ?? ''}`}
              workspaceMode="linked"
              initialSimulationId={
                urlProyectoId === selectedProject.id ? urlSimulacionId : null
              }
              proyecto={selectedProject}
              sitios={effectiveBundle.sitios}
              productos={effectiveBundle.productos}
              configuraciones={effectiveBundle.configuraciones}
              opcionesFinanciamiento={effectiveBundle.opcionesFinanciamiento}
              configFinanciamiento={effectiveBundle.configFinanciamientoLinks}
              ofertasMem={effectiveBundle.ofertasMem}
              activeTemplate={effectiveBundle.activeTemplate}
              templatesById={effectiveBundle.templatesById}
              initialSimulaciones={effectiveBundle.initialSimulaciones}
              userRole={userRole}
              currentUserId={userId}
              activeConfigId={
                effectiveBundle.configuraciones.find((c) => c.seleccionada)?.id ??
                effectiveBundle.configuraciones[0]?.id ??
                null
              }
              readOnlyMode={false}
            />
          )
        ) : null
      ) : (
        <SimuladorAhorrosSeccion
          key="manual-workspace"
          workspaceMode="manual"
          proyecto={manualProyecto}
          sitios={[]}
          productos={[]}
          configuraciones={[]}
          opcionesFinanciamiento={[]}
          configFinanciamiento={[]}
          ofertasMem={[]}
          activeTemplate={activeTemplate}
          templatesById={templatesById}
          initialSimulaciones={[]}
          userRole={userRole}
          currentUserId={userId}
          onManualProyectoChange={(patch) =>
            setManualProyecto((prev) => ({ ...prev, ...patch }))
          }
          onRequestLinkManualToProject={handleOpenLinkManualModal}
          readOnlyMode={false}
        />
      )}

      {/* Portaled Modal: Link & Save Manual Simulation to an Existing Project */}
      <Modal
        isOpen={pendingManualPayload !== null}
        onClose={() => {
          if (!linkingSaving) setPendingManualPayload(null)
        }}
        maxWidth="md"
        showCloseButton={false}
        closeOnBackdrop={!linkingSaving}
        closeOnEscape={!linkingSaving}
      >
        <form onSubmit={handleConfirmLinkManual} className="bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-linea bg-fondo/50">
            <div>
              <h4 className="text-base font-black text-principal flex items-center gap-2">
                <FolderPlus size={16} className="text-menta" />
                Vincular Simulación a Proyecto
              </h4>
              <p className="text-xs text-texto-suave">
                Guarda los parámetros actuales en un proyecto existente para reflejarlos en su vista ejecutiva.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPendingManualPayload(null)}
              disabled={linkingSaving}
              className="p-1.5 rounded-lg text-texto-suave hover:text-principal hover:bg-fondo"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {linkError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                {linkError}
              </div>
            )}

            {projects.length === 0 ? (
              <p className="text-xs text-texto-suave">
                No tienes proyectos existentes disponibles para vincular. Puedes descargar el reporte PDF desde el modo manual.
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-principal mb-1">
                    Buscar proyecto *
                  </label>
                  <input
                    type="text"
                    value={linkProjectSearch}
                    onChange={(e) => setLinkProjectSearch(e.target.value)}
                    placeholder="Filtrar por nombre o cliente…"
                    className="w-full rounded-xl border border-borde px-3 py-1.5 text-xs text-principal bg-white mb-2"
                  />
                  <select
                    required
                    value={linkTargetProjectId}
                    onChange={(e) => setLinkTargetProjectId(e.target.value)}
                    className="w-full rounded-xl border border-borde px-3 py-2 text-xs font-semibold text-principal bg-white"
                  >
                    {filteredModalProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre_proyecto} · {p.cliente_final_empresa || p.cliente_final_nombre} (
                        {p.capex_estimado != null ? fmtCurrency(p.capex_estimado, p.moneda) : 'Sin CAPEX'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-principal mb-1">
                    Nombre del escenario *
                  </label>
                  <input
                    type="text"
                    required
                    value={linkSimName}
                    onChange={(e) => setLinkSimName(e.target.value)}
                    className="w-full rounded-xl border border-borde px-3.5 py-2 text-sm text-principal bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-principal mb-1">
                    Descripción / notas (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={linkSimDesc}
                    onChange={(e) => setLinkSimDesc(e.target.value)}
                    placeholder="Contexto de esta simulación…"
                    className="w-full rounded-xl border border-borde px-3.5 py-2 text-sm text-principal bg-white resize-none"
                  />
                </div>

                {pendingManualPayload && (
                  <div className="rounded-xl bg-fondo/70 border border-linea px-3 py-2 text-[11px] text-texto-suave flex flex-wrap gap-2">
                    <span>
                      Motor:{' '}
                      <strong className="text-principal">
                        {pendingManualPayload.calcMode === 'mem_horaria'
                          ? 'MEM Horario'
                          : 'CFE Tarifario'}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Horizonte:{' '}
                      <strong className="num text-principal">
                        {fmtNum(pendingManualPayload.horizonteAnios, 0)} años
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Moneda: <strong className="text-principal">{pendingManualPayload.monedaCalculo}</strong>
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-5 py-4 border-t border-linea bg-fondo/50 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={linkingSaving}
              onClick={() => setPendingManualPayload(null)}
            >
              Cancelar
            </Button>
            {projects.length > 0 && (
              <Button
                type="submit"
                variant="primary"
                disabled={linkingSaving || !linkTargetProjectId || !linkSimName.trim()}
              >
                {linkingSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FolderPlus size={14} />
                )}
                Guardar en proyecto
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default CalculadoraWorkspace
