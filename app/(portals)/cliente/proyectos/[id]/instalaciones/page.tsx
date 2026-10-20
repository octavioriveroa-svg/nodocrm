import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstalacionMonitor from '@/components/InstalacionMonitor'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function ClienteInstalacionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
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
    <div className="py-6 px-4">
      <div className="max-w-5xl mx-auto mb-6">
        <Link
          href="/cliente"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-principal transition-colors mb-2"
        >
          <ChevronLeft size={14} /> Volver al portal
        </Link>
        <h1 className="text-2xl font-black text-principal">{proyecto.nombre_proyecto}</h1>
        <p className="text-xs text-gray-500 mt-0.5">Avance de Instalación</p>
      </div>
      <div className="max-w-5xl mx-auto">
        <InstalacionMonitor
          proyectoId={id}
          currentUser={profile}
          readOnly={true}
        />
      </div>
    </div>
  )
}
