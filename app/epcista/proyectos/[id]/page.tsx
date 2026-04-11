'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import DetalleProyecto from '@/components/DetalleProyecto'
import type { Proyecto, Comentario, Archivo, Profile } from '@/lib/types'

export default function DetalleEpcistaPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient()
  const [data, setData] = useState<{
    proyecto: Proyecto
    comentarios: Comentario[]
    archivos: Archivo[]
    currentUser: Profile
  } | null>(null)
  const [notFound404, setNotFound404] = useState(false)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const user = session.user

      const [{ data: proyecto }, { data: comentarios }, { data: archivos }, { data: profile }] =
        await Promise.all([
          supabase.from('proyectos').select('*, profiles(*)').eq('id', id).single(),
          supabase.from('comentarios').select('*, profiles(*)').eq('proyecto_id', id).order('created_at', { ascending: true }),
          supabase.from('archivos').select('*, profiles(*)').eq('proyecto_id', id).order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').eq('id', user.id).single(),
        ])

      if (!proyecto || !profile) { setNotFound404(true); return }

      setData({
        proyecto: proyecto as Proyecto,
        comentarios: (comentarios ?? []) as Comentario[],
        archivos: (archivos ?? []) as Archivo[],
        currentUser: profile as Profile,
      })
    }
    load()
  }, [])

  if (notFound404) return notFound()
  if (!data) return null

  return <DetalleProyecto {...data} />
}
