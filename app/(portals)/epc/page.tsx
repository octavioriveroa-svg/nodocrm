import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EpcistaDashboardClient from './EpcistaDashboardClient'
import type { Proyecto } from '@/lib/types'
import { parseNum } from '@/lib/format'

export default async function EpcistaDashboard() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/login')

  const { data } = await supabase
    .from('proyectos')
    .select('*')
    .eq('epcista_id', session.user.id)
    .order('created_at', { ascending: false })

  const proyectos = (data ?? []) as Proyecto[]

  // Portafolio técnico
  let bess_kw = 0, bess_kwh = 0, bess_capex = 0, fv_kwp = 0, fv_capex = 0
  if (proyectos.length > 0) {
    const proyIds = proyectos.map(p => p.id)
    const { data: productos } = await supabase
      .from('proyecto_sitio_productos')
      .select('tipo, datos')
      .in('proyecto_id', proyIds)

    for (const prod of productos ?? []) {
      const d = prod.datos as Record<string, unknown> | null
      if (!d) continue
      if (prod.tipo === 'bess') {
        bess_kw += parseNum(d.potencia_kw as string) || 0
        bess_kwh += parseNum(d.capacidad_kwh as string) || 0
        bess_capex += parseNum(d.capex as string) || 0
      } else if (prod.tipo === 'fv') {
        fv_kwp += ((parseNum(d.num_modulos as string) || 0) * (parseNum(d.potencia_modulos_w as string) || 0)) / 1000
        fv_capex += parseNum(d.capex as string) || 0
      }
    }
  }

  const portafolio = (bess_kw > 0 || fv_kwp > 0)
    ? { bess_kw, bess_kwh, bess_capex, fv_kwp, fv_capex }
    : null

  return (
    <EpcistaDashboardClient
      initialProyectos={proyectos}
      initialPortafolio={portafolio}
    />
  )
}
