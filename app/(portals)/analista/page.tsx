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

interface OfertaRow {
  id: string
  proyecto_id: string
  proyecto_nombre: string
  suministrador_id: string
  suministrador_nombre: string
  precio_kwh: number
  vigencia_meses: number
  estado: string
  notas: string | null
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

  // Fetch Ofertas MEM
  const { data: ofertasData } = await supabase
    .from('ofertas_mem')
    .select(`
      id, proyecto_id, suministrador_id, precio_kwh, vigencia_meses, estado, notas, created_at,
      proyectos(nombre_proyecto),
      profiles!ofertas_mem_suministrador_id_fkey(nombre)
    `)
    .order('created_at', { ascending: false })

  const initialOfertas: OfertaRow[] = (ofertasData ?? []).map(o => ({
    id: o.id,
    proyecto_id: o.proyecto_id,
    proyecto_nombre: Array.isArray(o.proyectos) ? (o.proyectos as any)[0]?.nombre_proyecto : (o.proyectos as any)?.nombre_proyecto || '—',
    suministrador_id: o.suministrador_id,
    suministrador_nombre: Array.isArray(o.profiles) ? (o.profiles as any)[0]?.nombre : (o.profiles as any)?.nombre || '—',
    precio_kwh: o.precio_kwh,
    vigencia_meses: o.vigencia_meses,
    estado: o.estado,
    notas: o.notas,
    created_at: o.created_at
  }))

  return <AnalistaDashboardClient initialProyectos={proyectos} initialOfertas={initialOfertas} />
}
