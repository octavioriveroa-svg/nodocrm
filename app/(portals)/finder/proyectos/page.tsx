import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FinderProyectosClient from './FinderProyectosClient'
import type { Proyecto } from '@/lib/types'

export default async function FinderProyectosPage() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/login')

  const { data } = await supabase
    .from('proyectos')
    .select('*')
    .eq('finder_id', session.user.id)
    .order('created_at', { ascending: false })

  const proyectos = (data ?? []) as Proyecto[]

  return (
    <FinderProyectosClient initialProyectos={proyectos} />
  )
}
