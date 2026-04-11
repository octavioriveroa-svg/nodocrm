'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import type { Profile } from '@/lib/types'

export default function EpcistaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!data) { router.replace('/login'); return }
      if (data.rol === 'analista') { router.replace('/analista'); return }

      setProfile(data as Profile)
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
