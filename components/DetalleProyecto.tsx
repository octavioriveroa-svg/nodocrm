'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  Proyecto, Comentario, Archivo, Profile, EstadoProyecto, ModalidadFinanciamiento,
  Sitio, ProyectoSitioProducto, ConfiguracionTecnica, Moneda, OpcionFinanciamiento,
  ConfigFinanciamiento, HitoConstruccion,
} from '@/lib/types'
import { getStageTransitionPayload } from '@/lib/domains/proyectos/lifecycle'
import { Seccion, buildDefaultHitos } from './proyectos/detalle/common'
import ProjectHeaderAndPipeline from './proyectos/detalle/ProjectHeaderAndPipeline'
import ProjectEditForm from './proyectos/detalle/ProjectEditForm'
import ProjectStakeholdersAndAccess from './proyectos/detalle/ProjectStakeholdersAndAccess'
import ProjectTechnicalSection from './proyectos/detalle/ProjectTechnicalSection'
import ProjectFinancingSection from './proyectos/detalle/ProjectFinancingSection'
import ProjectOverviewSections from './proyectos/detalle/ProjectOverviewSections'
import ProjectCommentsSection from './proyectos/detalle/ProjectCommentsSection'
import ModalHito from './gantt/ModalHito'
import EditarSolucionTecnicaModal from './EditarSolucionTecnicaModal'
import EditarFinanciamientoModal from './EditarFinanciamientoModal'

interface Props {
  proyecto: Proyecto; comentarios: Comentario[]; archivos: Archivo[]; currentUser: Profile
  sitios?: Sitio[]; productos?: ProyectoSitioProducto[]; configuraciones?: ConfiguracionTecnica[]
  hitos?: HitoConstruccion[]; opcionesFinanciamiento?: OpcionFinanciamiento[]; configFinanciamientoLinks?: ConfigFinanciamiento[]
}

export default function DetalleProyecto({
  proyecto: initial, comentarios: initialComentarios, archivos: initialArchivos, currentUser,
  sitios = [], productos: initialProductos = [], configuraciones: initialConfigs = [],
  hitos = [], opcionesFinanciamiento: initialOpciones = [], configFinanciamientoLinks: initialConfigFinLinks = [],
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [proyecto, setProyecto] = useState<Proyecto>(initial)
  const [comentarios, setComentarios] = useState<Comentario[]>(initialComentarios), [archivos, setArchivos] = useState<Archivo[]>(initialArchivos)
  const [productos, setProductos] = useState<ProyectoSitioProducto[]>(initialProductos), [configsList, setConfigsList] = useState<ConfiguracionTecnica[]>(initialConfigs)
  const [opcionesFin, setOpcionesFin] = useState<OpcionFinanciamiento[]>(initialOpciones), [configFinLinks, setConfigFinLinks] = useState<ConfigFinanciamiento[]>(initialConfigFinLinks)
  const [hitosLocales, setHitosLocales] = useState<HitoConstruccion[]>(hitos), [hitoSeleccionado, setHitoSeleccionado] = useState<HitoConstruccion | null>(null)
  const [editando, setEditando] = useState(false), [errorEstado, setErrorEstado] = useState<string | null>(null)
  const [generandoCronograma, setGenerandoCronograma] = useState(false), [seleccionandoConfig, setSeleccionandoConfig] = useState(false), [seleccionandoFinancing, setSeleccionandoFinancing] = useState(false)
  const [showEditTecnica, setShowEditTecnica] = useState(false), [showEditFinanciamiento, setShowEditFinanciamiento] = useState(false)
  const [responsableProfile, setResponsableProfile] = useState<{ nombre: string; empresa: string; calendario_url: string | null } | null>(null)
  const [finderProfile, setFinderProfile] = useState<{ nombre: string; empresa: string } | null>(null)

  const isAdmin = currentUser.rol === 'nodo_admin', isAnalista = currentUser.rol === 'nodo_analista', isEpcista = currentUser.rol === 'epc', isFinder = currentUser.rol === 'finder'
  const backHref = isAdmin ? '/admin/proyectos' : isAnalista ? '/analista' : isFinder ? '/finder' : '/epc'

  useEffect(() => {
    if (initial.responsable_nodo_id) {
      supabase.from('profiles').select('nombre, empresa, calendario_url').eq('id', initial.responsable_nodo_id).single().then(({ data }) => { if (data) setResponsableProfile(data) })
    }
    if (initial.finder_id) {
      supabase.from('profiles').select('nombre, empresa').eq('id', initial.finder_id).single().then(({ data }) => { if (data) setFinderProfile(data) })
    }
  }, [initial.responsable_nodo_id, initial.finder_id, supabase])

  const handleRefresh = useCallback(async () => {
    const [{ data: p }, { data: c }, { data: pr }, { data: o }, { data: cl }] = await Promise.all([
      supabase.from('proyectos').select('*').eq('id', initial.id).single(),
      supabase.from('configuraciones_tecnicas').select('*').eq('proyecto_id', initial.id).order('created_at', { ascending: true }),
      supabase.from('proyecto_sitio_productos').select('*, sitios(nombre)').eq('proyecto_id', initial.id),
      supabase.from('opciones_financiamiento').select('*').eq('proyecto_id', initial.id).order('created_at', { ascending: true }),
      supabase.from('config_financiamiento').select('*'),
    ])
    if (p) setProyecto(p as Proyecto)
    if (c) setConfigsList(c as ConfiguracionTecnica[]); if (pr) setProductos(pr as ProyectoSitioProducto[])
    if (o) setOpcionesFin(o as OpcionFinanciamiento[]); if (cl) setConfigFinLinks(cl as ConfigFinanciamiento[])
    router.refresh()
  }, [initial.id, router, supabase])

  async function handleSelectConfig(configId: string) {
    if (configId === 'legacy') return
    setSeleccionandoConfig(true); setErrorEstado(null)
    const prevSelectedId = configsList.find(c => c.seleccionada)?.id
    try {
      const { error: rpcErr } = await supabase.rpc('seleccionar_configuracion_tecnica', { p_proyecto_id: proyecto.id, p_config_id: configId })
      if (!rpcErr) {
        const updatedList = configsList.map(c => ({ ...c, seleccionada: c.id === configId }))
        setConfigsList(updatedList)
        const target = updatedList.find(c => c.id === configId)
        if (target) setProyecto(prev => ({ ...prev, capex_estimado: target.inversion_total, moneda: (target.moneda || 'MXN') as Moneda }))
        router.refresh(); return
      }
      if (!rpcErr.message.includes('seleccionar_configuracion_tecnica')) throw rpcErr
      const { error: err1 } = await supabase.from('configuraciones_tecnicas').update({ seleccionada: false }).eq('proyecto_id', proyecto.id)
      if (err1) throw err1
      const { error: err2 } = await supabase.from('configuraciones_tecnicas').update({ seleccionada: true }).eq('id', configId)
      if (err2) {
        if (prevSelectedId) {
          await supabase.from('configuraciones_tecnicas').update({ seleccionada: true }).eq('id', prevSelectedId)
        }
        throw err2
      }
      const updatedList = configsList.map(c => ({ ...c, seleccionada: c.id === configId }))
      setConfigsList(updatedList)
      const target = updatedList.find(c => c.id === configId)
      if (target) {
        await supabase.from('proyectos').update({ capex_estimado: target.inversion_total, moneda: target.moneda }).eq('id', proyecto.id)
        setProyecto(prev => ({ ...prev, capex_estimado: target.inversion_total, moneda: (target.moneda || 'MXN') as Moneda }))
      }
      router.refresh()
    } catch (err: unknown) {
      if (prevSelectedId) setConfigsList(prev => prev.map(c => ({ ...c, seleccionada: c.id === prevSelectedId })))
      setErrorEstado(err instanceof Error ? err.message : 'Error al seleccionar configuración')
    } finally {
      setSeleccionandoConfig(false)
    }
  }

  async function handleSelectFinancing(optionId: string) {
    setSeleccionandoFinancing(true); setErrorEstado(null)
    const prevSelectedOptionId = opcionesFin.find(o => o.seleccionada)?.id
    try {
      const { error: rpcErr } = await supabase.rpc('seleccionar_opcion_financiamiento', { p_proyecto_id: proyecto.id, p_opcion_id: optionId })
      if (!rpcErr) {
        const updatedList = opcionesFin.map(o => ({ ...o, seleccionada: o.id === optionId }))
        setOpcionesFin(updatedList)
        const target = updatedList.find(o => o.id === optionId)
        if (target) setProyecto(prev => ({ ...prev, modalidad_financiamiento: [target.vehiculo_inversion as ModalidadFinanciamiento] }))
        router.refresh(); return
      }
      if (!rpcErr.message.includes('seleccionar_opcion_financiamiento')) throw rpcErr
      const { error: err1 } = await supabase.from('opciones_financiamiento').update({ seleccionada: false }).eq('proyecto_id', proyecto.id)
      if (err1) throw err1
      const { error: err2 } = await supabase.from('opciones_financiamiento').update({ seleccionada: true }).eq('id', optionId)
      if (err2) {
        if (prevSelectedOptionId) {
          await supabase.from('opciones_financiamiento').update({ seleccionada: true }).eq('id', prevSelectedOptionId)
        }
        throw err2
      }
      const updatedList = opcionesFin.map(o => ({ ...o, seleccionada: o.id === optionId }))
      setOpcionesFin(updatedList)
      const target = updatedList.find(o => o.id === optionId)
      if (target) {
        await supabase.from('proyectos').update({ modalidad_financiamiento: [target.vehiculo_inversion as ModalidadFinanciamiento] }).eq('id', proyecto.id)
        setProyecto(prev => ({ ...prev, modalidad_financiamiento: [target.vehiculo_inversion as ModalidadFinanciamiento] }))
      }
      router.refresh()
    } catch (err: unknown) {
      if (prevSelectedOptionId) setOpcionesFin(prev => prev.map(o => ({ ...o, seleccionada: o.id === prevSelectedOptionId })))
      setErrorEstado(err instanceof Error ? err.message : 'Error al seleccionar opción de financiamiento')
    } finally {
      setSeleccionandoFinancing(false)
    }
  }

  async function cambiarEstado(estado: EstadoProyecto) {
    setErrorEstado(null)
    if (['aprobado', 'en_construccion', 'operativo', 'completado'].includes(estado) && (!configsList.some(c => c.seleccionada) || !opcionesFin.some(o => o.seleccionada))) {
      setErrorEstado('Se deben seleccionar una configuración técnica ganadora Y una opción de financiamiento ganadora antes de aprobar el proyecto o avanzar en el pipeline.')
      return
    }
    const payload = getStageTransitionPayload(estado, proyecto.historial_estados)
    const { data, error } = await supabase.from('proyectos').update(payload).eq('id', proyecto.id).select().single()
    if (error) { setErrorEstado('Error al cambiar de estado: ' + error.message) }
    else if (data) { setProyecto(data as Proyecto); router.refresh() }
  }

  async function generarCronograma() {
    setGenerandoCronograma(true)
    const { data } = await supabase.from('hitos_construccion').insert(buildDefaultHitos(proyecto.id)).select()
    if (data) setHitosLocales(data as HitoConstruccion[])
    setGenerandoCronograma(false)
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <ProjectHeaderAndPipeline
        proyecto={proyecto} currentUser={currentUser} backHref={backHref} hitosCount={hitosLocales.length}
        generandoCronograma={generandoCronograma} onGenerarCronograma={generarCronograma} editando={editando}
        onToggleEdit={() => setEditando(!editando)}
        onEliminarProyecto={async () => { await supabase.from('proyectos').delete().eq('id', proyecto.id); router.push(backHref) }}
        onCambiarEstado={cambiarEstado} errorEstado={errorEstado} configsList={configsList} opcionesFin={opcionesFin}
      />

      {editando ? (
        <ProjectEditForm
          proyecto={proyecto}
          currentUser={currentUser}
          onSaveSuccess={(u) => {
            setProyecto(u)
            setEditando(false)
            if (u.responsable_nodo_id) {
              supabase.from('profiles').select('nombre, empresa, calendario_url').eq('id', u.responsable_nodo_id).single().then(({ data: rp }) => setResponsableProfile(rp as { nombre: string; empresa: string; calendario_url: string | null } | null))
            } else setResponsableProfile(null)
            if (u.finder_id) {
              supabase.from('profiles').select('nombre, empresa').eq('id', u.finder_id).single().then(({ data: fp }) => setFinderProfile(fp as { nombre: string; empresa: string } | null))
            } else setFinderProfile(null)
            router.refresh()
          }}
          onCancelar={() => setEditando(false)}
          onOpenEditTecnica={() => setShowEditTecnica(true)}
          onOpenEditFinanciamiento={() => setShowEditFinanciamiento(true)}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <ProjectStakeholdersAndAccess
            proyecto={proyecto} currentUser={currentUser} responsableProfile={responsableProfile} finderProfile={finderProfile}
            onAssignResponsable={() => setEditando(true)} onRefresh={handleRefresh}
          />
          <ProjectTechnicalSection
            proyecto={proyecto} currentUser={currentUser} configsList={configsList} productos={productos}
            onOpenEditTecnica={() => setShowEditTecnica(true)} onSelectConfig={handleSelectConfig} seleccionandoConfig={seleccionandoConfig}
          />
          <ProjectFinancingSection
            proyecto={proyecto} currentUser={currentUser} configsList={configsList} opcionesFin={opcionesFin}
            configFinLinks={configFinLinks} onOpenEditFinanciamiento={() => setShowEditFinanciamiento(true)}
            onSelectFinancing={(optId) => handleSelectFinancing(optId)} seleccionandoFinancing={seleccionandoFinancing}
          />
          <ProjectOverviewSections
            proyecto={proyecto} currentUser={currentUser} sitios={sitios} archivos={archivos} setArchivos={setArchivos}
            hitosLocales={hitosLocales} generandoCronograma={generandoCronograma} onGenerarCronograma={generarCronograma}
            onSelectHito={(h) => setHitoSeleccionado(h)} hasProducts={productos.length > 0} configsList={configsList} opcionesFin={opcionesFin}
          />

          {/* Plan EPC — new project management tool */}
          {currentUser.rol !== 'cliente_final' && (
            <Seccion title="Plan de Proyecto EPC">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    Plan detallado de ingeniería, procurement y construcción con fases, actividades, tareas y hitos financieros.
                  </p>
                </div>
                <Link
                  href={`${
                    isEpcista
                      ? '/epc'
                      : isAdmin
                        ? '/admin'
                        : isAnalista
                          ? '/analista'
                          : isFinder
                        ? '/finder'
                        : '/financiero'
                  }/proyectos/${proyecto.id}/plan`}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all hover:scale-105 active:scale-95 shadow-md bg-principal text-acento whitespace-nowrap"
                >
                  <CalendarDays size={16} />
                  {isEpcista ? 'Gestionar Plan' : 'Ver Plan'}
                </Link>
              </div>
            </Seccion>
          )}

          {/* Monitor de Instalación — only visible after project approval */}
          {['aprobado', 'en_construccion', 'operativo', 'completado'].includes(proyecto.estado) && (
            <Seccion title="Monitor de Instalación">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    Seguimiento en tiempo real de la instalación con evidencia fotográfica, avance por fase y actividad.
                  </p>
                </div>
                <Link
                  href={`${
                    isEpcista
                      ? '/epc'
                      : isAdmin
                        ? '/admin'
                        : isAnalista
                          ? '/analista'
                          : isFinder
                        ? '/finder'
                        : currentUser.rol === 'cliente_final'
                          ? '/cliente'
                          : '/financiero'
                  }/proyectos/${proyecto.id}/instalaciones`}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all hover:scale-105 active:scale-95 shadow-md bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                >
                  <Wrench size={16} />
                  {isEpcista ? 'Gestionar Instalación' : 'Ver Instalación'}
                </Link>
              </div>
            </Seccion>
          )}

          <ProjectCommentsSection
            comentarios={comentarios}
            onEnviarComentario={async (contenido) => {
              const { data, error } = await supabase.from('comentarios').insert({ proyecto_id: proyecto.id, user_id: currentUser.id, contenido }).select('*, profiles(*)').single()
              if (error) return { success: false, error: error.message }
              if (data) setComentarios(prev => [...prev, data as Comentario])
              return { success: true }
            }}
          />
        </div>
      )}

      {hitoSeleccionado && (
        <ModalHito hito={hitoSeleccionado} onClose={() => setHitoSeleccionado(null)} onUpdate={(u) => setHitosLocales(prev => prev.map(h => h.id === u.id ? u : h))} />
      )}
      <EditarSolucionTecnicaModal
        isOpen={showEditTecnica} onClose={() => setShowEditTecnica(false)} proyecto={proyecto}
        configuraciones={configsList} productos={productos} sitios={sitios} onSave={async () => { setShowEditTecnica(false); await handleRefresh() }}
      />
      <EditarFinanciamientoModal
        isOpen={showEditFinanciamiento} onClose={() => setShowEditFinanciamiento(false)} proyecto={proyecto}
        configuraciones={configsList} opcionesFinanciamiento={opcionesFin} configFinanciamientoLinks={configFinLinks}
        onSave={async () => { setShowEditFinanciamiento(false); await handleRefresh() }}
      />
    </div>
  )
}
