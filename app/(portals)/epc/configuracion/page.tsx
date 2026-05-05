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

      const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

      const profile: Profile = {
        id: session.user.id,
        nombre: profileRow?.nombre ?? session.user.user_metadata?.nombre ?? session.user.email ?? '',
        empresa: profileRow?.empresa ?? session.user.user_metadata?.empresa ?? '',
        rol: profileRow?.rol ?? session.user.user_metadata?.rol ?? 'epc',
        calendario_url: profileRow?.calendario_url ?? null,
        cliente_crm_id: profileRow?.cliente_crm_id ?? null,
        created_at: profileRow?.created_at ?? session.user.created_at,
      }

      setData({ profile, email: session.user.email ?? '' })
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!data) return null
  return <Configuracion profile={data.profile} email={data.email} />
}
