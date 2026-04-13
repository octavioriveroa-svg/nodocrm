'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Configuracion from '@/components/Configuracion'
import type { Profile } from '@/lib/types'

export default function ConfiguracionEpcistaPage() {
  const supabase = createClient()
  const [data, setData] = useState<{ profile: Profile; email: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: profiles } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!profiles) return
      setData({ profile: profiles as Profile, email: session.user.email ?? '' })
    }
    load()
  }, [])

  if (!data) return null
  return <Configuracion profile={data.profile} email={data.email} />
}
