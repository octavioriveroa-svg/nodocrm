import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstalacionesListClient from '@/components/InstalacionesListClient'
import type { Proyecto } from '@/lib/types'

const QUALIFYING = ['aprobado', 'en_construccion', 'operativo', 'completado']

export default async function ClienteInstalacionesListPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.rol !== 'cliente_final') redirect('/login')

  // Cliente sees only their own projects
  const { data: proyectos } = await supabase
    .from('proyectos')
    .select('*')
    .eq('cliente_id', session.user.id)
    .in('estado', QUALIFYING)
    .order('updated_at', { ascending: false })

  return (
    <InstalacionesListClient
      portalPrefix="/cliente"
      initialProyectos={(proyectos ?? []) as Proyecto[]}
    />
  )
}
