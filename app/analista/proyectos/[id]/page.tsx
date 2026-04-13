'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import DetalleProyecto from '@/components/DetalleProyecto'
import type { Proyecto, Comentario, Archivo, Profile, Sitio, ProyectoSitioProducto } from '@/lib/types'

export default function DetalleAnalistaPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient()
  const [data, setData] = useState<{
    proyecto: Proyecto
    comentarios: Comentario[]
    archivos: Archivo[]
    currentUser: Profile
    sitios: Sitio[]
    productos: ProyectoSitioProducto[]
  } | null>(null)
  const [notFound404, setNotFound404] = useState(false)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const [{ data: proyecto }, { data: comentarios }, { data: archivos }, { data: profile }, { data: ps }, { data: prods }] =
        await Promise.all([
          supabase.from('proyectos').select('*, profiles(*)').eq('id', id).single(),
          supabase.from('comentarios').select('*, profiles(*)').eq('proyecto_id', id).order('created_at', { ascending: true }),
          supabase.from('archivos').select('*, profiles(*)').eq('proyecto_id', id).order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').eq('id', session.user.id).single(),
          supabase.from('proyecto_sitios').select('*, sitios(*)').eq('proyecto_id', id),
          supabase.from('proyecto_sitio_productos').select('*, sitios(nombre)').eq('proyecto_id', id),
        ])

      if (!proyecto || !profile) { setNotFound404(true); return }

      const sitios = (ps ?? []).map((r: { sitios: Sitio }) => r.sitios).filter(Boolean) as Sitio[]

      setData({
        proyecto: proyecto as Proyecto,
        comentarios: (comentarios ?? []) as Comentario[],
        archivos: (archivos ?? []) as Archivo[],
        currentUser: profile as Profile,
        sitios,
        productos: (prods ?? []) as ProyectoSitioProducto[],
      })
    }
    load()
  }, [])

  if (notFound404) return notFound()
  if (!data) return null

  return <DetalleProyecto {...data} productos={data.productos} />
}
