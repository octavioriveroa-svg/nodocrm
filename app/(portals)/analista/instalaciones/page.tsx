import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstalacionesListClient from '@/components/InstalacionesListClient'
import type { Proyecto } from '@/lib/types'

const QUALIFYING = ['aprobado', 'en_construccion', 'operativo', 'completado']

export default async function AnalistaInstalacionesListPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.rol !== 'nodo_analista') redirect('/login')

  const { data: proyectos } = await supabase
    .from('proyectos')
    .select('*')
    .in('estado', QUALIFYING)
    .order('updated_at', { ascending: false })

  return (
    <InstalacionesListClient
      portalPrefix="/analista"
      initialProyectos={(proyectos ?? []) as Proyecto[]}
    />
  )
}
