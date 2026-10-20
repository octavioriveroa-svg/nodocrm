import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanBuilder from '@/components/plan/PlanBuilder'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Rol } from '@/lib/types'

export interface SharedProjectPlanViewProps {
  params: Promise<{ id: string }>
  portal: 'admin' | 'analista' | 'epc' | 'finder' | 'financiero'
  allowedRoles?: Rol[]
  backHref?: string
  fallbackRedirect?: string
  readOnly?: boolean
}

export default async function SharedProjectPlanView({
  params,
  portal,
  allowedRoles,
  backHref,
  fallbackRedirect,
  readOnly,
}: SharedProjectPlanViewProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile) redirect('/login')

  const isNodo = profile.rol === 'nodo_admin' || profile.rol === 'nodo_analista'
  const isEpc = profile.rol === 'epc'

  // Validate allowed roles
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(profile.rol as Rol)) redirect('/login')
  } else {
    if (portal === 'admin' || portal === 'analista') {
      if (!isNodo) redirect('/login')
    } else if (portal === 'epc') {
      if (!isEpc && !isNodo) redirect('/login')
    } else if (portal === 'financiero') {
      if (profile.rol !== 'financiero') redirect('/login')
    } else if (portal === 'finder') {
      if (profile.rol !== 'finder') redirect('/login')
    }
  }

  // Scoped project query based on portal/role
  let query = supabase
    .from('proyectos')
    .select('nombre_proyecto, estado')
    .eq('id', id)

  if (portal === 'epc' && isEpc) {
    query = query.eq('epcista_id', session.user.id)
  } else if (portal === 'financiero') {
    query = query.eq('financiero_id', session.user.id)
  } else if (portal === 'finder') {
    query = query.eq('finder_id', session.user.id)
  }

  const { data: proyecto } = await query.single()

  const defaultFallback = portal === 'finder' ? '/finder/proyectos' : `/${portal}`
  if (!proyecto) redirect(fallbackRedirect ?? defaultFallback)

  // Compute readOnly: EPC owner can edit, all others read-only unless overridden
  const resolvedReadOnly = readOnly !== undefined ? readOnly : (portal === 'epc' ? !isEpc : true)

  const resolvedBackHref =
    backHref ??
    (isNodo && portal === 'epc' ? `/admin/proyectos/${id}` : `/${portal}/proyectos/${id}`)

  return (
    <div className="py-6 px-4">
      <div className="max-w-4xl mx-auto mb-6">
        <Link
          href={resolvedBackHref}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-principal transition-colors mb-2"
        >
          <ChevronLeft size={14} /> Volver al proyecto
        </Link>
        <h1 className="text-2xl font-black text-principal">{proyecto.nombre_proyecto}</h1>
      </div>
      <PlanBuilder
        proyectoId={id}
        currentUser={profile}
        readOnly={resolvedReadOnly}
        proyectoEstado={proyecto.estado}
      />
    </div>
  )
}
