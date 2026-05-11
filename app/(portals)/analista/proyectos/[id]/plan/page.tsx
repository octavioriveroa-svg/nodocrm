/* eslint-disable */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanBuilder from '@/components/plan/PlanBuilder'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function AnalistaPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile || !['nodo_admin', 'nodo_analista'].includes(profile.rol)) redirect('/login')

  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('nombre_proyecto')
    .eq('id', id)
    .single()

  if (!proyecto) redirect('/analista')

  return (
    <div className="py-6 px-4">
      <div className="max-w-4xl mx-auto mb-6">
        <Link
          href={`/analista/proyectos/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-principal transition-colors mb-2"
        >
          <ChevronLeft size={14} /> Volver al proyecto
        </Link>
        <h1 className="text-2xl font-black text-principal">{proyecto.nombre_proyecto}</h1>
      </div>
      <PlanBuilder
        proyectoId={id}
        currentUser={profile}
        readOnly={true}
      />
    </div>
  )
}
