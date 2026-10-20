import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Proyecto,
  Comentario,
  Archivo,
  Profile,
  Sitio,
  ProyectoSitioProducto,
  ConfiguracionTecnica,
  HitoConstruccion,
  OpcionFinanciamiento,
  ConfigFinanciamiento,
  Rol,
} from '@/lib/types'

export interface ProyectoDetalleData {
  proyecto: Proyecto
  comentarios: Comentario[]
  archivos: Archivo[]
  currentUser: Profile
  sitios: Sitio[]
  productos: ProyectoSitioProducto[]
  configuraciones: ConfiguracionTecnica[]
  hitos: HitoConstruccion[]
  opcionesFinanciamiento: OpcionFinanciamiento[]
  configFinanciamientoLinks: ConfigFinanciamiento[]
}

export interface ProyectoConEpcista extends Proyecto {
  epcista_nombre: string
  epcista_empresa: string
  responsable_nombre: string
  finder_nombre: string
  finder_empresa: string
}

type RawJoinedProfile = { id: string; nombre: string; empresa: string } | null | undefined

interface RawProyecto extends Proyecto {
  epc?: RawJoinedProfile | RawJoinedProfile[]
  responsable?: RawJoinedProfile | RawJoinedProfile[]
  finder?: RawJoinedProfile | RawJoinedProfile[]
}

function extractProfile(val: unknown): { id: string; nombre: string; empresa: string } | null {
  if (!val) return null
  if (Array.isArray(val)) return val.length > 0 ? (val[0] as { id: string; nombre: string; empresa: string }) : null
  if (typeof val === 'object' && val !== null && 'nombre' in val) {
    return val as { id: string; nombre: string; empresa: string }
  }
  return null
}

export async function fetchProyectoDetalleCompleto(
  supabase: SupabaseClient,
  proyectoId: string,
  currentUserId: string
): Promise<ProyectoDetalleData | null> {
  const [
    { data: proyecto, error: pErr },
    { data: comentarios },
    { data: archivos },
    { data: currentUser },
    { data: ps },
    { data: prods },
    { data: configs },
    { data: hitos },
    { data: options },
  ] = await Promise.all([
    supabase.from('proyectos').select('*').eq('id', proyectoId).single(),
    supabase.from('comentarios').select('*, profiles(*)').eq('proyecto_id', proyectoId).order('created_at', { ascending: true }),
    supabase.from('archivos').select('*, profiles(*)').eq('proyecto_id', proyectoId).order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', currentUserId).single(),
    supabase.from('proyecto_sitios').select('*, sitios(*)').eq('proyecto_id', proyectoId),
    supabase.from('proyecto_sitio_productos').select('*, sitios(nombre)').eq('proyecto_id', proyectoId),
    supabase.from('configuraciones_tecnicas').select('*').eq('proyecto_id', proyectoId).order('created_at', { ascending: true }),
    supabase.from('hitos_construccion').select('*').eq('proyecto_id', proyectoId).order('orden', { ascending: true }),
    supabase.from('opciones_financiamiento').select('*').eq('proyecto_id', proyectoId).order('created_at', { ascending: true }),
  ])

  if (pErr || !proyecto || !currentUser) {
    return null
  }

  const configIds = (configs ?? []).map((c: { id: string }) => c.id)
  const { data: configFinLinks } =
    configIds.length > 0
      ? await supabase.from('config_financiamiento').select('*').in('configuracion_id', configIds)
      : { data: [] }

  const sitios: Sitio[] = (ps ?? [])
    .map((p: { sitios?: Sitio | null }) => p.sitios)
    .filter(Boolean) as Sitio[]

  return {
    proyecto: proyecto as Proyecto,
    comentarios: (comentarios as Comentario[]) ?? [],
    archivos: (archivos as Archivo[]) ?? [],
    currentUser: currentUser as Profile,
    sitios,
    productos: (prods as ProyectoSitioProducto[]) ?? [],
    configuraciones: (configs as ConfiguracionTecnica[]) ?? [],
    hitos: (hitos as HitoConstruccion[]) ?? [],
    opcionesFinanciamiento: (options as OpcionFinanciamiento[]) ?? [],
    configFinanciamientoLinks: (configFinLinks as ConfigFinanciamiento[]) ?? [],
  }
}

export async function fetchProyectosDirectory(
  supabase: SupabaseClient,
  options?: { role?: Rol; userId?: string }
): Promise<ProyectoConEpcista[]> {
  let query = supabase
    .from('proyectos')
    .select(`
      *,
      epc:profiles!proyectos_epcista_id_fkey(id, nombre, empresa),
      responsable:profiles!proyectos_responsable_nodo_id_fkey(id, nombre, empresa),
      finder:profiles!proyectos_finder_id_fkey(id, nombre, empresa)
    `)
    .order('created_at', { ascending: false })

  if (options?.role === 'epc' && options.userId) {
    query = query.eq('epcista_id', options.userId)
  } else if (options?.role === 'finder' && options.userId) {
    query = query.eq('finder_id', options.userId)
  } else if (options?.role === 'cliente_final' && options.userId) {
    query = query.eq('cliente_id', options.userId)
  } else if (options?.role === 'financiero' && options.userId) {
    query = query.eq('financiero_id', options.userId)
  }

  const { data: joinedData, error: joinError } = await query

  let prs: RawProyecto[] | null = null

  if (joinError) {
    console.warn('PostgREST relational join failed, falling back to manual resolution:', joinError.message)
    let fallbackQuery = supabase
      .from('proyectos')
      .select('*')
      .order('created_at', { ascending: false })

    if (options?.role === 'epc' && options.userId) {
      fallbackQuery = fallbackQuery.eq('epcista_id', options.userId)
    } else if (options?.role === 'finder' && options.userId) {
      fallbackQuery = fallbackQuery.eq('finder_id', options.userId)
    } else if (options?.role === 'cliente_final' && options.userId) {
      fallbackQuery = fallbackQuery.eq('cliente_id', options.userId)
    } else if (options?.role === 'financiero' && options.userId) {
      fallbackQuery = fallbackQuery.eq('financiero_id', options.userId)
    }

    const { data: fallbackData } = await fallbackQuery
    prs = (fallbackData as RawProyecto[]) || null
  } else {
    prs = (joinedData as unknown as RawProyecto[]) || null
  }

  if (!prs || prs.length === 0) {
    return []
  }

  const hasJoinedRelations = !joinError && prs.some((p) => p.epc || p.responsable || p.finder)
  const nameMap: Record<string, { nombre: string; empresa: string }> = {}

  if (!hasJoinedRelations) {
    const allIds = [
      ...new Set([
        ...prs.map((p) => p.epcista_id),
        ...(prs.map((p) => p.responsable_nodo_id).filter(Boolean) as string[]),
        ...(prs.map((p) => p.finder_id).filter(Boolean) as string[]),
      ]),
    ]
    if (allIds.length > 0) {
      const { data: perfiles } = await supabase.from('profiles').select('id, nombre, empresa').in('id', allIds)
      for (const pf of perfiles ?? []) {
        const p = pf as { id: string; nombre: string; empresa: string }
        nameMap[p.id] = { nombre: p.nombre, empresa: p.empresa }
      }
    }
  }

  return prs.map((p) => {
    const epc = extractProfile(p.epc)
    const resp = extractProfile(p.responsable)
    const fnd = extractProfile(p.finder)

    return {
      ...p,
      epcista_nombre: epc?.nombre || (p.epcista_id ? nameMap[p.epcista_id]?.nombre ?? '—' : '—'),
      epcista_empresa: epc?.empresa || (p.epcista_id ? nameMap[p.epcista_id]?.empresa ?? '—' : '—'),
      responsable_nombre: resp?.nombre || (p.responsable_nodo_id ? nameMap[p.responsable_nodo_id]?.nombre ?? '—' : '—'),
      finder_nombre: fnd?.nombre || (p.finder_id ? nameMap[p.finder_id]?.nombre ?? '—' : '—'),
      finder_empresa: fnd?.empresa || (p.finder_id ? nameMap[p.finder_id]?.empresa ?? '—' : '—'),
    }
  })
}
