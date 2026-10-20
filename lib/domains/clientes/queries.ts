import type { SupabaseClient } from '@supabase/supabase-js'
import type { Cliente, Sitio, Archivo, Profile } from '@/lib/types'

export interface ProyectoResumen {
  id: string
  nombre_proyecto: string
  estado: string
  historial_estados?: Record<string, string>
  created_at: string
}

export interface ClienteDetalleData {
  cliente: Cliente
  epcistaInfo: { nombre: string; empresa: string } | null
  linkedUsers: Profile[]
  sitios: Sitio[]
  proyectos: ProyectoResumen[]
  archivos: (Archivo & { proyecto_nombre: string })[]
}

export interface ClienteSummary extends Cliente {
  epcista_nombre?: string
  sitios_count?: number
  proyectos_count?: number
}

/**
 * Fetches complete details for a client card.
 * SECURITY & DATA ISOLATION:
 * Strictly filters projects by .eq('cliente_id', clienteId) and EPCista owner,
 * eliminating cross-client document and project exposure.
 */
export async function fetchClienteDetalleCompleto(
  supabase: SupabaseClient,
  clienteId: string,
  viewerProfile: Profile
): Promise<ClienteDetalleData | null> {
  const [
    { data: clienteData, error: cErr },
    { data: sitiosData },
    { data: linkedUsersData },
  ] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', clienteId).single(),
    supabase.from('sitios').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: true }),
    supabase.from('profiles').select('*').eq('cliente_crm_id', clienteId),
  ])

  if (cErr || !clienteData) {
    return null
  }

  const cliente = clienteData as Cliente

  // Fetch EPCista info if client has epcista_id
  let epcistaInfo: { nombre: string; empresa: string } | null = null
  if (cliente.epcista_id) {
    const { data: epcData } = await supabase
      .from('profiles')
      .select('nombre, empresa')
      .eq('id', cliente.epcista_id)
      .single()
    if (epcData) {
      epcistaInfo = epcData as { nombre: string; empresa: string }
    }
  }

  // Strictly query projects belonging to this client
  let proyectosQuery = supabase
    .from('proyectos')
    .select('id, nombre_proyecto, estado, created_at, historial_estados')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })

  // If viewer is EPC, scope to EPC's projects only
  if (viewerProfile.rol === 'epc') {
    proyectosQuery = proyectosQuery.eq('epcista_id', viewerProfile.id)
  } else if (viewerProfile.rol === 'finder') {
    proyectosQuery = proyectosQuery.eq('finder_id', viewerProfile.id)
  }

  const { data: proyectosData } = await proyectosQuery
  const proyectos: ProyectoResumen[] = (proyectosData ?? []) as ProyectoResumen[]

  // Fetch files strictly scoped to this client's projects
  let archivos: (Archivo & { proyecto_nombre: string })[] = []
  if (proyectos.length > 0) {
    const projectIds = proyectos.map((p) => p.id)
    const projNameMap: Record<string, string> = {}
    proyectos.forEach((p) => {
      projNameMap[p.id] = p.nombre_proyecto
    })

    const { data: archData } = await supabase
      .from('archivos')
      .select('*, profiles(*)')
      .in('proyecto_id', projectIds)
      .order('created_at', { ascending: false })

    if (archData) {
      archivos = archData.map((a: Archivo) => ({
        ...a,
        proyecto_nombre: projNameMap[a.proyecto_id] || 'Proyecto',
      }))
    }
  }

  return {
    cliente,
    epcistaInfo,
    linkedUsers: (linkedUsersData as Profile[]) ?? [],
    sitios: (sitiosData as Sitio[]) ?? [],
    proyectos,
    archivos,
  }
}

export async function fetchClientesDirectory(
  supabase: SupabaseClient,
  viewerProfile: Profile
): Promise<ClienteSummary[]> {
  let query = supabase.from('clientes').select('*').order('created_at', { ascending: false })

  if (viewerProfile.rol === 'epc') {
    query = query.eq('epcista_id', viewerProfile.id)
  } else if (viewerProfile.rol === 'finder') {
    query = query.eq('finder_id', viewerProfile.id)
  }

  const { data: cls, error } = await query
  if (error || !cls) return []

  const ids = [...new Set(cls.map((c: { epcista_id?: string | null }) => c.epcista_id).filter(Boolean) as string[])]
  const nameMap: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: perfiles } = await supabase.from('profiles').select('id, nombre').in('id', ids)
    for (const pf of perfiles ?? []) {
      const p = pf as { id: string; nombre: string }
      nameMap[p.id] = p.nombre
    }
  }

  return cls.map((c: Cliente) => ({
    ...c,
    epcista_nombre: c.epcista_id ? nameMap[c.epcista_id] ?? '—' : '—',
  }))
}
