 
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanBuilder from '@/components/plan/PlanBuilder'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile) redirect('/login')

  // Verify access: EPC must own this project, or Nodo user
  const isEpc = profile.rol === 'epc'
  const isNodo = profile.rol === 'nodo_admin' || profile.rol === 'nodo_analista'

  if (isEpc) {
    const { data: proyecto } = await supabase
      .from('proyectos')
      .select('id')
      .eq('id', id)
      .eq('epcista_id', session.user.id)
      .single()
    if (!proyecto) redirect('/epc')
  } else if (!isNodo) {
    redirect('/login')
  }

  // Get project name for the header
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('nombre_proyecto, estado')
    .eq('id', id)
    .single()

  const readOnly = !isEpc

  return (
    <div className="py-6 px-4">
      <div className="max-w-4xl mx-auto mb-6">
        <Link
          href={isEpc ? `/epc/proyectos/${id}` : isNodo ? `/admin/proyectos/${id}` : '/'}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-principal transition-colors mb-2"
        >
          <ChevronLeft size={14} /> Volver al proyecto
        </Link>
        {proyecto && (
          <h1 className="text-2xl font-black text-principal">{proyecto.nombre_proyecto}</h1>
        )}
      </div>
      <PlanBuilder
        proyectoId={id}
        currentUser={profile}
        readOnly={readOnly}
        proyectoEstado={proyecto?.estado}
      />
    </div>
  )
}
