import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FinderDashboardClient from './FinderDashboardClient'
import type { Proyecto } from '@/lib/types'

export default async function FinderDashboard() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/login')

  // Fetch projects originated by this finder
  const { data: proyectosData } = await supabase
    .from('proyectos')
    .select('*')
    .eq('finder_id', session.user.id)
    .order('created_at', { ascending: false })

  const proyectos = (proyectosData ?? []) as Proyecto[]

  // Fetch clients created by this finder
  const { count: clientsCount } = await supabase
    .from('clientes')
    .select('*', { count: 'exact', head: true })
    .eq('finder_id', session.user.id)

  return (
    <FinderDashboardClient
      initialProyectos={proyectos}
      initialClientesCount={clientsCount ?? 0}
    />
  )
}
