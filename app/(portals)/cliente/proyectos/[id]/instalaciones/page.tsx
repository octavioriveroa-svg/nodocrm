import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SharedProjectInstalacionesView from '@/components/proyectos/SharedProjectInstalacionesView'

export default async function ClienteInstalacionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('cliente_crm_id, rol')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.rol !== 'cliente_final') redirect('/login')

  if (!profile.cliente_crm_id) redirect('/cliente')

  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, nombre_proyecto')
    .eq('id', id)
    .eq('cliente_id', profile.cliente_crm_id)
    .single()

  if (!proyecto) redirect('/cliente')

  return (
    <SharedProjectInstalacionesView
      params={params}
      portal="cliente"
    />
  )
}
