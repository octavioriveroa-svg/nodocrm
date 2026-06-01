'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DetalleProyecto from '@/components/DetalleProyecto'
import type { Proyecto, Comentario, Archivo, Profile, Sitio, ProyectoSitioProducto, ConfiguracionTecnica, OpcionFinanciamiento, ConfigFinanciamiento } from '@/lib/types'

export default function DetalleEpcistaPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient()
  const [data, setData] = useState<{
    proyecto: Proyecto
    comentarios: Comentario[]
    archivos: Archivo[]
    currentUser: Profile
    sitios: Sitio[]
    productos: ProyectoSitioProducto[]
    configuraciones: ConfiguracionTecnica[]
    hitos: import('@/lib/types').HitoConstruccion[]
    opcionesFinanciamiento: OpcionFinanciamiento[]
    configFinanciamientoLinks: ConfigFinanciamiento[]
  } | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { id } = await params
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return

        const [
          { data: proyecto, error: pErr },
          { data: comentarios },
          { data: archivos },
          { data: profile },
          { data: ps },
          { data: prods },
          { data: configs },
          { data: hitos },
          { data: options },
        ] = await Promise.all([
          supabase.from('proyectos').select('*').eq('id', id).single(),
          supabase.from('comentarios').select('*, profiles(*)').eq('proyecto_id', id).order('created_at', { ascending: true }),
          supabase.from('archivos').select('*, profiles(*)').eq('proyecto_id', id).order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').eq('id', session.user.id).single(),
          supabase.from('proyecto_sitios').select('*, sitios(*)').eq('proyecto_id', id),
          supabase.from('proyecto_sitio_productos').select('*, sitios(nombre)').eq('proyecto_id', id),
          supabase.from('configuraciones_tecnicas').select('*').eq('proyecto_id', id).order('created_at', { ascending: true }),
          supabase.from('hitos_construccion').select('*').eq('proyecto_id', id).order('orden', { ascending: true }),
          supabase.from('opciones_financiamiento').select('*').eq('proyecto_id', id).order('created_at', { ascending: true }),
        ])

        if (pErr || !proyecto) { setNotFound(true); return }
        if (!profile) { setNotFound(true); return }

        const configIds = (configs ?? []).map(c => c.id)
        const { data: configFinLinks } = configIds.length > 0
          ? await supabase.from('config_financiamiento').select('*').in('configuracion_id', configIds)
          : { data: [] }

        const sitios = (ps ?? []).map((r: { sitios: Sitio }) => r.sitios).filter(Boolean) as Sitio[]

        setData({
          proyecto: proyecto as Proyecto,
          comentarios: (comentarios ?? []) as Comentario[],
          archivos: (archivos ?? []) as Archivo[],
          currentUser: profile as Profile,
          sitios,
          productos: (prods ?? []) as ProyectoSitioProducto[],
          configuraciones: (configs ?? []) as ConfiguracionTecnica[],
          hitos: (hitos ?? []) as import('@/lib/types').HitoConstruccion[],
          opcionesFinanciamiento: (options ?? []) as OpcionFinanciamiento[],
          configFinanciamientoLinks: (configFinLinks ?? []) as ConfigFinanciamiento[],
        })
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Error al cargar el proyecto')
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loadError) return (
    <div className="max-w-xl mx-auto mt-16 p-6 border border-borde rounded-xl">
      <p className="font-bold mb-1">Error al cargar</p>
      <p className="text-sm text-muted">{loadError}</p>
    </div>
  )
  if (notFound) return (
    <div className="max-w-xl mx-auto mt-16 p-6 border border-borde rounded-xl">
      <p className="font-bold mb-1">Proyecto no encontrado</p>
      <p className="text-sm text-muted">No tienes acceso a este proyecto o no existe.</p>
    </div>
  )
  if (!data) return null

  return <DetalleProyecto {...data} productos={data.productos} hitos={data.hitos} opcionesFinanciamiento={data.opcionesFinanciamiento} configFinanciamientoLinks={data.configFinanciamientoLinks} />
}
