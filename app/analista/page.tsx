import { createClient } from '@/lib/supabase/server'
import AnalistaDashboardClient from './AnalistaDashboardClient'
import type { EstadoProyecto, TipoProyecto } from '@/lib/types'

interface ProyectoRow {
  id: string
  nombre_proyecto: string
  tipo: TipoProyecto
  estado: EstadoProyecto
  epcista_id: string
  epcista_nombre: string
  created_at: string
}

export default async function AnalistaDashboard() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('proyectos')
    .select('id, nombre_proyecto, tipo, estado, epcista_id, created_at')
    .order('created_at', { ascending: false })

  const prs = (data ?? []) as Omit<ProyectoRow, 'epcista_nombre'>[]

  let proyectos: ProyectoRow[] = []
  if (prs.length > 0) {
    const ids = [...new Set(prs.map(p => p.epcista_id))]
    const { data: profilesData } = await supabase.from('profiles').select('id, nombre').in('id', ids)
    const nameMap: Record<string, string> = {}
    for (const pf of profilesData ?? []) {
      nameMap[(pf as { id: string; nombre: string }).id] = (pf as { id: string; nombre: string }).nombre
    }
    proyectos = prs.map(p => ({ ...p, epcista_nombre: nameMap[p.epcista_id] ?? '—' }))
  }

  return <AnalistaDashboardClient initialProyectos={proyectos} />
}
