import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EpcistaProyectosClient from './EpcistaProyectosClient'
import type { Proyecto } from '@/lib/types'

export default async function EpcistaProyectosPage() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/login')

  const { data } = await supabase
    .from('proyectos')
    .select('*')
    .eq('epcista_id', session.user.id)
    .order('created_at', { ascending: false })

  const proyectos = (data ?? []) as Proyecto[]

  return (
    <EpcistaProyectosClient initialProyectos={proyectos} />
  )
}
