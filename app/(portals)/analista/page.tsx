import { createClient } from '@/lib/supabase/server'
import AnalistaDashboardClient from './AnalistaDashboardClient'
import DashboardAnalytics from '@/components/DashboardAnalytics'
import { fetchDashboardData } from '@/lib/dashboard-data'
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

  // Fetch dashboard analytics data
  const dashboardData = await fetchDashboardData()

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
    proyecto_nombre: (Array.isArray(o.proyectos) ? (o.proyectos[0] as { nombre_proyecto?: string })?.nombre_proyecto : (o.proyectos as { nombre_proyecto?: string } | null)?.nombre_proyecto) || '—',
    suministrador_id: o.suministrador_id,
    suministrador_nombre: (Array.isArray(o.profiles) ? (o.profiles[0] as { nombre?: string })?.nombre : (o.profiles as { nombre?: string } | null)?.nombre) || '—',
    precio_kwh: o.precio_kwh,
    vigencia_meses: o.vigencia_meses,
    estado: o.estado,
    notas: o.notas,
    created_at: o.created_at
  }))

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-1">Panel de analista</p>
        <h1 className="text-2xl font-black tracking-tight">Visión global de la plataforma</h1>
      </div>

      <DashboardAnalytics data={dashboardData} />

      <div className="mt-8 pt-8 border-t border-borde">
        <AnalistaDashboardClient initialProyectos={proyectos} initialOfertas={initialOfertas} />
      </div>
    </div>
  )
}
