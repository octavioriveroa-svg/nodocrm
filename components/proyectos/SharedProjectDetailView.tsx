'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DetalleProyecto from '@/components/DetalleProyecto'
import { fetchProyectoDetalleCompleto } from '@/lib/domains/proyectos/queries'
import type { ProyectoDetalleData } from '@/lib/domains/proyectos/queries'

interface Props {
  params: Promise<{ id: string }>
}

export default function SharedProjectDetailView({ params }: Props) {
  const supabase = createClient()
  const [data, setData] = useState<ProyectoDetalleData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { id } = await params
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.user) return

        const result = await fetchProyectoDetalleCompleto(supabase, id, session.user.id)
        if (!result) {
          setNotFound(true)
          return
        }
        setData(result)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Error al cargar')
      }
    }
    load()
  }, [params, supabase])

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 border border-borde rounded-xl bg-white shadow-sm">
        <p className="font-bold mb-1 text-red-600">Error al cargar</p>
        <p className="text-sm text-gray-600">{loadError}</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center">
        <p className="text-gray-500 mb-4">Proyecto no encontrado</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-acento hover:underline"
        >
          <ChevronLeft size={16} /> Volver
        </Link>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
          <span className="text-sm text-gray-400">Cargando proyecto…</span>
        </div>
      </div>
    )
  }

  return (
    <DetalleProyecto
      proyecto={data.proyecto}
      comentarios={data.comentarios}
      archivos={data.archivos}
      currentUser={data.currentUser}
      sitios={data.sitios}
      productos={data.productos}
      configuraciones={data.configuraciones}
      hitos={data.hitos}
      opcionesFinanciamiento={data.opcionesFinanciamiento}
      configFinanciamientoLinks={data.configFinanciamientoLinks}
    />
  )
}
