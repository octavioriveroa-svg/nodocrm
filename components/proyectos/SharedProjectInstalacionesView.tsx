import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstalacionMonitor from '@/components/InstalacionMonitor'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Rol } from '@/lib/types'

export interface SharedProjectInstalacionesViewProps {
  params: Promise<{ id: string }>
  portal: 'admin' | 'analista' | 'epc' | 'finder' | 'financiero' | 'cliente'
  allowedRoles?: Rol[]
  subtitle?: string
  backHref?: string
  backLabel?: string
  fallbackRedirect?: string
  readOnly?: boolean
}

const DEFAULT_SUBTITLES: Record<string, string> = {
  admin: 'Seguimiento de Instalación (Administración)',
  analista: 'Seguimiento de Instalación (Analista)',
  epc: 'Seguimiento de Instalación',
  financiero: 'Seguimiento de Instalación (Financiamiento)',
  finder: 'Seguimiento de Instalación (Finder)',
  cliente: 'Avance de Instalación',
}

export default async function SharedProjectInstalacionesView({
  params,
  portal,
  allowedRoles,
  subtitle,
  backHref,
  backLabel,
  fallbackRedirect,
  readOnly,
}: SharedProjectInstalacionesViewProps) {
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

  // Validate allowed roles
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(profile.rol as Rol)) redirect('/login')
  } else {
    if (portal === 'admin' || portal === 'analista') {
      if (!isNodo) redirect('/login')
    } else if (portal === 'epc') {
      if (profile.rol !== 'epc') redirect('/login')
    } else if (portal === 'financiero') {
      if (profile.rol !== 'financiero') redirect('/login')
    } else if (portal === 'finder') {
      if (profile.rol !== 'finder') redirect('/login')
    } else if (portal === 'cliente') {
      if (profile.rol !== 'cliente_final') redirect('/login')
      if (!profile.cliente_crm_id) redirect('/cliente')
    }
  }

  // Scoped project query based on portal/role
  let query = supabase
    .from('proyectos')
    .select('id, nombre_proyecto')
    .eq('id', id)

  if (portal === 'epc') {
    query = query.eq('epcista_id', session.user.id)
  } else if (portal === 'financiero') {
    query = query.eq('financiero_id', session.user.id)
  } else if (portal === 'finder') {
    query = query.eq('finder_id', session.user.id)
  } else if (portal === 'cliente') {
    query = query.eq('cliente_id', profile.cliente_crm_id)
  }

  const { data: proyecto } = await query.single()

  const defaultFallback =
    portal === 'finder' ? '/finder/instalaciones' : portal === 'cliente' ? '/cliente' : `/${portal}`
  if (!proyecto) redirect(fallbackRedirect ?? defaultFallback)

  // Compute readOnly: admin, analista, epc can manage evidence; others read-only
  const resolvedReadOnly =
    readOnly !== undefined ? readOnly : !['nodo_admin', 'nodo_analista', 'epc'].includes(profile.rol)

  const resolvedSubtitle = subtitle ?? (DEFAULT_SUBTITLES[portal] || 'Seguimiento de Instalación')
  const resolvedBackHref = backHref ?? (portal === 'cliente' ? '/cliente' : `/${portal}/proyectos/${id}`)
  const resolvedBackLabel = backLabel ?? (portal === 'cliente' ? 'Volver al portal' : 'Volver al proyecto')

  return (
    <div className="py-6 px-4">
      <div className="max-w-5xl mx-auto mb-6">
        <Link
          href={resolvedBackHref}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-principal transition-colors mb-2"
        >
          <ChevronLeft size={14} /> {resolvedBackLabel}
        </Link>
        <h1 className="text-2xl font-black text-principal">{proyecto.nombre_proyecto}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{resolvedSubtitle}</p>
      </div>
      <div className="max-w-5xl mx-auto">
        <InstalacionMonitor
          proyectoId={id}
          currentUser={profile}
          readOnly={resolvedReadOnly}
        />
      </div>
    </div>
  )
}
