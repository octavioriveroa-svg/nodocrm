'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DetalleProyecto from '@/components/DetalleProyecto'
import type { Proyecto, Comentario, Archivo, Profile, Sitio, ProyectoSitioProducto } from '@/lib/types'

export default function DetalleEpcistaPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient()
  const [data, setData] = useState<{
    proyecto: Proyecto
    comentarios: Comentario[]
    archivos: Archivo[]
    currentUser: Profile
    sitios: Sitio[]
    productos: ProyectoSitioProducto[]
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
        ] = await Promise.all([
          supabase.from('proyectos').select('*, profiles(*)').eq('id', id).single(),
          supabase.from('comentarios').select('*, profiles(*)').eq('proyecto_id', id).order('created_at', { ascending: true }),
          supabase.from('archivos').select('*, profiles(*)').eq('proyecto_id', id).order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').eq('id', session.user.id).single(),
          supabase.from('proyecto_sitios').select('*, sitios(*)').eq('proyecto_id', id),
          supabase.from('proyecto_sitio_productos').select('*, sitios(nombre)').eq('proyecto_id', id),
        ])

        if (pErr || !proyecto) { setNotFound(true); return }
        if (!profile) { setNotFound(true); return }

        const sitios = (ps ?? []).map((r: { sitios: Sitio }) => r.sitios).filter(Boolean) as Sitio[]

        setData({
          proyecto: proyecto as Proyecto,
          comentarios: (comentarios ?? []) as Comentario[],
          archivos: (archivos ?? []) as Archivo[],
          currentUser: profile as Profile,
          sitios,
          productos: (prods ?? []) as ProyectoSitioProducto[],
        })
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Error al cargar el proyecto')
      }
    }
    load()
  }, [])

  if (loadError) return (
    <div className="max-w-xl mx-auto mt-16 p-6 border" style={{ borderColor: '#CFCFCF' }}>
      <p className="font-bold mb-1">Error al cargar</p>
      <p className="text-sm" style={{ color: '#666' }}>{loadError}</p>
    </div>
  )
  if (notFound) return (
    <div className="max-w-xl mx-auto mt-16 p-6 border" style={{ borderColor: '#CFCFCF' }}>
      <p className="font-bold mb-1">Proyecto no encontrado</p>
      <p className="text-sm" style={{ color: '#666' }}>No tienes acceso a este proyecto o no existe.</p>
    </div>
  )
  if (!data) return null

  return <DetalleProyecto {...data} productos={data.productos} />
}
