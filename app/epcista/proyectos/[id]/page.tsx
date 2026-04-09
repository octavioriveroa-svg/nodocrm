import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import DetalleProyecto from '@/components/DetalleProyecto'

export default async function DetalleEpcistaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('*, profiles(*)')
    .eq('id', id)
    .single()

  if (!proyecto) notFound()

  const { data: comentarios } = await supabase
    .from('comentarios')
    .select('*, profiles(*)')
    .eq('proyecto_id', id)
    .order('created_at', { ascending: true })

  const { data: archivos } = await supabase
    .from('archivos')
    .select('*, profiles(*)')
    .eq('proyecto_id', id)
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  return (
    <DetalleProyecto
      proyecto={proyecto}
      comentarios={comentarios ?? []}
      archivos={archivos ?? []}
      currentUser={profile}
    />
  )
}
