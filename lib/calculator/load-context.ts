import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CalculadoraTemplate,
  ConfigFinanciamiento,
  ConfiguracionTecnica,
  OfertaMem,
  OpcionFinanciamiento,
  ProyectoSitioProducto,
  SimulacionAhorro,
  Sitio,
} from '@/lib/types'
import {
  FALLBACK_HORIZONTE_OPCIONES,
  FALLBACK_TEMPLATE_CAMPOS,
  FALLBACK_TEMPLATE_FORMULAS,
  MEM_TEMPLATE_CAMPOS,
} from '@/lib/calculator/template-schema'

export interface ProjectSimulatorContext {
  ofertasMem: OfertaMem[]
  activeTemplate: CalculadoraTemplate
  templatesById: Record<string, CalculadoraTemplate>
  initialSimulaciones: SimulacionAhorro[]
}

export interface FullProjectSimulatorBundle extends ProjectSimulatorContext {
  sitios: Sitio[]
  productos: ProyectoSitioProducto[]
  configuraciones: ConfiguracionTecnica[]
  opcionesFinanciamiento: OpcionFinanciamiento[]
  configFinanciamientoLinks: ConfigFinanciamiento[]
}

export function buildFallbackCalculatorTemplate(): CalculadoraTemplate {
  const now = new Date().toISOString()
  return {
    id: 'fallback-v2',
    version: 2,
    nombre: 'Plantilla Racional FV + BESS MEM v2',
    descripcion: 'Plantilla racional MEM 8,760h + 100HC con respaldo tarifario CFE.',
    modo: 'default',
    is_active: true,
    campos: [...MEM_TEMPLATE_CAMPOS, ...FALLBACK_TEMPLATE_CAMPOS],
    formulas: FALLBACK_TEMPLATE_FORMULAS,
    horizonte_opciones: [...FALLBACK_HORIZONTE_OPCIONES],
    excel_archivo_nombre: null,
    excel_archivo_hash: null,
    excel_hoja_origen: null,
    excel_mapeo_campos: null,
    excel_preview_snapshot: null,
    validation_status: 'valid',
    validation_errors: [],
    notas: null,
    created_by: null,
    created_at: now,
    updated_at: now,
  }
}

export async function loadProjectSimulatorContext(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<ProjectSimulatorContext> {
  const [ofertasRes, templatesRes, simsRes] = await Promise.all([
    supabase
      .from('ofertas_mem')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('created_at', { ascending: false }),
    supabase
      .from('calculadora_templates')
      .select('*')
      .order('version', { ascending: false }),
    supabase
      .from('simulaciones_ahorro')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('usa_parametros_base', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  const ofertasMem = (!ofertasRes.error && Array.isArray(ofertasRes.data)
    ? ofertasRes.data
    : []) as OfertaMem[]

  const templateRows = (!templatesRes.error && Array.isArray(templatesRes.data)
    ? templatesRes.data
    : []) as CalculadoraTemplate[]

  const fallback = buildFallbackCalculatorTemplate()
  const activeTemplate =
    templateRows.find((t) => t.is_active) ?? templateRows[0] ?? fallback

  const templatesById: Record<string, CalculadoraTemplate> = {
    [activeTemplate.id]: activeTemplate,
  }
  for (const tpl of templateRows) {
    templatesById[tpl.id] = tpl
  }

  const initialSimulaciones = (!simsRes.error && Array.isArray(simsRes.data)
    ? simsRes.data
    : []) as SimulacionAhorro[]

  return {
    ofertasMem,
    activeTemplate,
    templatesById,
    initialSimulaciones,
  }
}

export async function loadFullProjectSimulatorBundle(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<FullProjectSimulatorBundle> {
  const [simCtx, psRes, prodRes, cfgRes, opcRes, linkRes] = await Promise.all([
    loadProjectSimulatorContext(supabase, proyectoId),
    supabase.from('proyecto_sitios').select('*, sitios(*)').eq('proyecto_id', proyectoId),
    supabase.from('proyecto_sitio_productos').select('*, sitios(nombre)').eq('proyecto_id', proyectoId),
    supabase
      .from('configuraciones_tecnicas')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('created_at', { ascending: true }),
    supabase
      .from('opciones_financiamiento')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('created_at', { ascending: true }),
    supabase.from('config_financiamiento').select('*'),
  ])

  let sitios = (psRes.data ?? [])
    .map((row) => (row as { sitios?: Sitio | null }).sitios ?? null)
    .filter((s): s is Sitio => s !== null)

  if (psRes.error) {
    const { data: psLinks } = await supabase
      .from('proyecto_sitios')
      .select('sitio_id')
      .eq('proyecto_id', proyectoId)
    const sitioIds = (psLinks ?? [])
      .map((row) => (row as { sitio_id?: string | null }).sitio_id)
      .filter((id): id is string => Boolean(id))
    if (sitioIds.length > 0) {
      const { data: sitiosRows } = await supabase
        .from('sitios')
        .select('*')
        .in('id', sitioIds)
      if (Array.isArray(sitiosRows)) {
        sitios = sitiosRows as Sitio[]
      }
    }
  }

  return {
    ...simCtx,
    sitios,
    productos: (!prodRes.error && Array.isArray(prodRes.data)
      ? prodRes.data
      : []) as ProyectoSitioProducto[],
    configuraciones: (!cfgRes.error && Array.isArray(cfgRes.data)
      ? cfgRes.data
      : []) as ConfiguracionTecnica[],
    opcionesFinanciamiento: (!opcRes.error && Array.isArray(opcRes.data)
      ? opcRes.data
      : []) as OpcionFinanciamiento[],
    configFinanciamientoLinks: (!linkRes.error && Array.isArray(linkRes.data)
      ? linkRes.data
      : []) as ConfigFinanciamiento[],
  }
}
