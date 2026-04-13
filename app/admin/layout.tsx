'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
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

      const { data: profiles } = await supabase.rpc('get_my_profile')
      const p = profiles?.[0] as { id: string; nombre: string; empresa: string; rol: string; created_at: string } | undefined

      const rol = p?.rol ?? session.user.user_metadata?.rol ?? 'epcista'
      if (rol !== 'admin') {
        router.replace(rol === 'analista' ? '/analista' : '/epcista')
        return
      }

      setProfile({
        id: session.user.id,
        nombre: p?.nombre ?? session.user.user_metadata?.nombre ?? session.user.email ?? '',
        empresa: p?.empresa ?? session.user.user_metadata?.empresa ?? '',
        rol: 'admin',
        created_at: session.user.created_at,
      })
      setLoading(false)
    }
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F9F6EF' }}>
        <div className="text-sm" style={{ color: '#888' }}>Cargando…</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar rol={profile!.rol} nombre={profile!.nombre} />
      <main className="flex-1 p-8" style={{ backgroundColor: '#F9F6EF' }}>
        {children}
      </main>
    </div>
  )
}
