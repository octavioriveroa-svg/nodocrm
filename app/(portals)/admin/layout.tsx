'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import type { Profile } from '@/lib/types'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
   
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.replace('/login'); return }

      const { data: profileRow } = await supabase
        .from('profiles').select('*').eq('id', session.user.id).single()

      const rol = profileRow?.rol ?? session.user.user_metadata?.rol
      if (!rol) { router.replace('/login'); return }
      if (rol === 'pendiente') { router.replace('/pendiente'); return }
      if (rol !== 'nodo_admin') {
        router.replace('/login')
        return
      }

      setProfile({
        id: session.user.id,
        nombre: profileRow?.nombre ?? session.user.user_metadata?.nombre ?? session.user.email ?? '',
        empresa: profileRow?.empresa ?? session.user.user_metadata?.empresa ?? '',
        rol: 'nodo_admin',
        calendario_url: profileRow?.calendario_url ?? null,
        created_at: profileRow?.created_at ?? session.user.created_at,
      })
      setLoading(false)
    }
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fondo">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
          <span className="text-sm text-gray-400">Cargando…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar rol={profile!.rol} nombre={profile!.nombre} />
      <div className="flex-1 flex flex-col">
        <TopBar nombre={profile!.nombre} />
        <main className="flex-1 p-8 bg-fondo">
          {children}
        </main>
      </div>
    </div>
  )
}
