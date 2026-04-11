'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import type { Profile } from '@/lib/types'

export default function AnalistaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.replace('/login'); return }

      const { data: profiles } = await supabase.rpc('get_my_profile')
      const profile = profiles?.[0]

      const rol = profile?.rol ?? session.user.user_metadata?.rol ?? 'epcista'
      if (rol === 'epcista') { router.replace('/epcista'); return }

      setProfile({
        id: session.user.id,
        nombre: profile?.nombre ?? session.user.user_metadata?.nombre ?? session.user.email ?? '',
        empresa: profile?.empresa ?? session.user.user_metadata?.empresa ?? '',
        rol,
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
