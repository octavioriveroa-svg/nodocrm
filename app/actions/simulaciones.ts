'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  CalculadoraTemplate,
  ConfiguracionTecnica,
  GranularidadProyeccion,
  Moneda,
  OfertaMem,
  OpcionFinanciamiento,
  Proyecto,
  ProyectoSitioProducto,
  Rol,
  SimulacionAhorro,
  SimulacionOverrides,
  Sitio,
  VistaFinanciamiento,
} from '@/lib/types'
import {
  extractTemplateDefaults,
  validateOverridesAgainstTemplate,
} from '@/lib/calculator/template-schema'
import { evaluateSimulation, runSimulation } from '@/lib/calculator/engine'

const DENIED_ROLES = new Set<Rol>(['pendiente', 'suministrador'])

const guardarSimulacionSchema = z.object({
  proyecto_id: z.string().uuid('proyecto_id debe ser un UUID válido.'),
  configuracion_id: z.string().uuid().nullable().optional(),
  opcion_financiamiento_id: z.string().uuid().nullable().optional(),
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre de la simulación es obligatorio.')
    .max(160, 'El nombre no puede exceder 160 caracteres.'),
  descripcion: z.string().trim().max(1000).nullable().optional(),
  moneda_calculo: z.enum(['MXN', 'USD']),
  horizonte_anios: z.number().int().min(1).max(30),
  vista_financiamiento: z.enum(['bruto', 'neto']),
  granularidad_default: z.enum(['mensual', 'trimestral', 'anual']).optional().default('anual'),
  parametros_override: z.record(z.string(), z.unknown()).optional().default({}),
})

const renombrarSimulacionSchema = z.object({
  id: z.string().uuid('Identificador de simulación inválido.'),
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre de la simulación es obligatorio.')
    .max(160, 'El nombre no puede exceder 160 caracteres.'),
  descripcion: z.string().trim().max(1000).nullable().optional(),
})

export interface GuardarSimulacionInput {
  proyecto_id: string
  configuracion_id?: string | null
  opcion_financiamiento_id?: string | null
  nombre: string
  descripcion?: string | null
  moneda_calculo: Moneda
  horizonte_anios: number
  vista_financiamiento: VistaFinanciamiento
  granularidad_default?: GranularidadProyeccion
  parametros_override?: SimulacionOverrides | Record<string, unknown>
}

export interface SimulacionActionResult<T = SimulacionAhorro> {
  data?: T
  error?: string
  status?: number
  fieldErrors?: Record<string, string>
}

function roundTo(val: number | null, decimals: number): number | null {
  if (val === null || !Number.isFinite(val)) return null
  const factor = Math.pow(10, decimals)
  return Math.round(val * factor) / factor
}

function revalidateProjectSimulationPaths(proyectoId: string): void {
  revalidatePath(`/admin/proyectos/${proyectoId}`)
  revalidatePath(`/analista/proyectos/${proyectoId}`)
  revalidatePath(`/epc/proyectos/${proyectoId}`)
  revalidatePath(`/finder/proyectos/${proyectoId}`)
  revalidatePath(`/financiero/proyectos/${proyectoId}`)
  revalidatePath(`/cliente/proyectos/${proyectoId}`)
}

async function authenticateAndVerifyProjectAccess(proyectoId: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false as const,
      status: 500,
      error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: 'No autenticado. Inicia sesión para guardar o administrar simulaciones.',
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, rol, cliente_crm_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return {
      ok: false as const,
      status: 403,
      error: 'No se encontró un perfil válido para el usuario.',
    }
  }

  const rol = profile.rol as Rol
  if (DENIED_ROLES.has(rol)) {
    return {
      ok: false as const,
      status: 403,
      error: 'Tu rol no tiene permisos para acceder al simulador de ahorros.',
    }
  }

  const adminClient = createAdminClient()
  const { data: proyecto, error: projError } = await adminClient
    .from('proyectos')
    .select('*')
    .eq('id', proyectoId)
    .single()

  if (projError || !proyecto) {
    return {
      ok: false as const,
      status: 404,
      error: 'Proyecto no encontrado.',
    }
  }

  const typedProject = proyecto as Proyecto
  let hasAccess = false

  if (rol === 'nodo_admin' || rol === 'nodo_analista') {
    hasAccess = true
  } else if (rol === 'epc' && typedProject.epcista_id === user.id) {
    hasAccess = true
  } else if (rol === 'finder' && typedProject.finder_id === user.id) {
    hasAccess = true
  } else if (rol === 'financiero' && typedProject.financiero_id === user.id) {
    hasAccess = true
  } else if (
    rol === 'cliente_final' &&
    typedProject.cliente_id !== null &&
    (typedProject.cliente_id === profile.cliente_crm_id ||
      typedProject.cliente_id === user.id)
  ) {
    hasAccess = true
  }

  if (!hasAccess) {
    return {
      ok: false as const,
      status: 403,
      error: 'No tienes acceso a este proyecto.',
    }
  }

  return {
    ok: true as const,
    supabase,
    adminClient,
    userId: user.id,
    rol,
    proyecto: typedProject,
  }
}

async function loadAuthoritativeSimulationContext(
  adminClient: ReturnType<typeof createAdminClient>,
  proyectoId: string,
  configuracionId: string | null | undefined,
  opcionFinanciamientoId: string | null | undefined,
) {
  const [configsRes, productsRes, optionsRes, sitesRes, offersRes, templateRes] =
    await Promise.all([
      adminClient
        .from('configuraciones_tecnicas')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: true }),
      adminClient
        .from('proyecto_sitio_productos')
        .select('*')
        .eq('proyecto_id', proyectoId),
      adminClient
        .from('opciones_financiamiento')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: true }),
      adminClient
        .from('proyecto_sitios')
        .select('sitios(demanda_contratada_kw)')
        .eq('proyecto_id', proyectoId),
      adminClient
        .from('ofertas_mem')
        .select('precio_kwh, estado')
        .eq('proyecto_id', proyectoId),
      adminClient
        .from('calculadora_templates')
        .select('*')
        .eq('is_active', true)
        .single(),
    ])

  if (templateRes.error || !templateRes.data) {
    return {
      ok: false as const,
      status: 500,
      error: 'No existe una plantilla activa en calculadora_templates.',
    }
  }

  const configs = (configsRes.data ?? []) as ConfiguracionTecnica[]
  const allProducts = (productsRes.data ?? []) as ProyectoSitioProducto[]
  const options = (optionsRes.data ?? []) as OpcionFinanciamiento[]
  const ofertasMem = (offersRes.data ?? []) as Pick<OfertaMem, 'precio_kwh' | 'estado'>[]
  const activeTemplate = templateRes.data as CalculadoraTemplate

  const sitios: Pick<Sitio, 'demanda_contratada_kw'>[] = []
  for (const row of sitesRes.data ?? []) {
    const s = (row as { sitios?: Pick<Sitio, 'demanda_contratada_kw'> | Pick<Sitio, 'demanda_contratada_kw'>[] | null }).sitios
    if (Array.isArray(s)) {
      for (const item of s) if (item) sitios.push(item)
    } else if (s) {
      sitios.push(s)
    }
  }

  // Validate explicit configuracion_id belongs to proyecto_id
  let activeConfig: ConfiguracionTecnica | null = null
  if (configuracionId) {
    const found = configs.find((c) => c.id === configuracionId)
    if (!found) {
      return {
        ok: false as const,
        status: 422,
        error: 'La configuración técnica seleccionada no pertenece a este proyecto.',
      }
    }
    activeConfig = found
  } else if (configs.length > 0) {
    activeConfig = configs.find((c) => c.seleccionada) ?? configs[0]
  }

  // Validate explicit opcion_financiamiento_id belongs to proyecto_id
  let activeFinancing: OpcionFinanciamiento | null = null
  if (opcionFinanciamientoId) {
    const found = options.find((o) => o.id === opcionFinanciamientoId)
    if (!found) {
      return {
        ok: false as const,
        status: 422,
        error: 'La opción de financiamiento seleccionada no pertenece a este proyecto.',
      }
    }
    activeFinancing = found
  } else if (options.length > 0) {
    activeFinancing = options.find((o) => o.seleccionada) ?? options[0]
  }

  const configProducts = activeConfig
    ? allProducts.filter(
        (p) => p.configuracion_id === activeConfig.id || p.configuracion_id === null,
      )
    : allProducts

  return {
    ok: true as const,
    activeConfig,
    configProducts,
    activeFinancing,
    sitios,
    ofertasMem,
    activeTemplate,
  }
}

/**
 * Authoritatively evaluates and persists a slim savings simulation row (sparse overrides + KPIs;
 * zero serie_mensual JSONB) via createAdminClient() after auth, role, and project-membership checks.
 */
export async function guardarSimulacion(
  input: GuardarSimulacionInput,
): Promise<SimulacionActionResult<SimulacionAhorro>> {
  try {
    const parsed = guardarSimulacionSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join('.') || '_root'] = issue.message
      }
      return {
        error: 'Datos de simulación inválidos.',
        status: 422,
        fieldErrors,
      }
    }

    const req = parsed.data
    const auth = await authenticateAndVerifyProjectAccess(req.proyecto_id)
    if (!auth.ok) {
      return { error: auth.error, status: auth.status }
    }

    const ctx = await loadAuthoritativeSimulationContext(
      auth.adminClient,
      req.proyecto_id,
      req.configuracion_id,
      req.opcion_financiamiento_id,
    )
    if (!ctx.ok) {
      return { error: ctx.error, status: ctx.status }
    }

    const isMemMode = req.parametros_override?.modo_motor === 'mem_horaria'

    let insertPayload: Record<string, unknown>

    if (isMemMode) {
      const overrideCheck = validateOverridesAgainstTemplate(
        ctx.activeTemplate.campos,
        req.parametros_override as Record<string, unknown>,
      )
      if (!overrideCheck.valid) {
        return {
          error: 'Uno o más parámetros MEM son inválidos.',
          status: 422,
          fieldErrors: overrideCheck.errors,
        }
      }

      const memOutcome = runSimulation({
        mode: 'mem_horaria',
        proyecto: auth.proyecto,
        activeConfig: ctx.activeConfig,
        configProducts: ctx.configProducts,
        activeFinancing: ctx.activeFinancing,
        sitios: ctx.sitios,
        ofertasMem: ctx.ofertasMem,
        template: ctx.activeTemplate,
        monedaCalculo: req.moneda_calculo,
        horizonteAnios: req.horizonte_anios,
        vistaFinanciamiento: req.vista_financiamiento,
        overrides: overrideCheck.sanitized as Record<string, unknown>,
        ignoreProjectGating: true,
      })

      if (memOutcome.status === 'gated') {
        return {
          error:
            'No es posible calcular o guardar simulaciones sin cifras financieras válidas (CAPEX > 0).',
          status: 422,
        }
      }
      if (memOutcome.status === 'invalid_override') {
        return {
          error: 'Uno o más parámetros personalizados son inválidos.',
          status: 422,
          fieldErrors: memOutcome.errors,
        }
      }
      if (memOutcome.mode !== 'mem_horaria') {
        return { error: 'Modo MEM inesperado.', status: 500 }
      }

      const fin = memOutcome.financial
      if (fin.capex_total <= 0) {
        return {
          error:
            'No es posible guardar una simulación con CAPEX total igual a 0. Ajusta los costos o tamaños FV/BESS.',
          status: 422,
        }
      }

      const ahorroEnergiaY1Kwh =
        (memOutcome.year1.res_fv_auto_mwh + memOutcome.year1.res_descarga_mwh) * 1000
      const ahorroEnergiaTotalKwh = fin.serie_mensual.reduce(
        (acc, m) => acc + m.energia_total_kwh,
        0,
      )
      const paybackEstado =
        fin.payback_simple_estado === 'ok'
          ? fin.payback_simple_anios !== null && fin.payback_simple_anios <= 0
            ? 'inmediato'
            : 'en_horizonte'
          : fin.payback_simple_estado === 'fuera_horizonte'
            ? 'fuera_horizonte'
            : 'no_recuperable'

      insertPayload = {
        proyecto_id: req.proyecto_id,
        configuracion_id: ctx.activeConfig?.id ?? null,
        opcion_financiamiento_id: ctx.activeFinancing?.id ?? null,
        nombre: req.nombre,
        descripcion: req.descripcion ?? null,
        usa_parametros_base: memOutcome.usa_parametros_base,
        template_id: ctx.activeTemplate.id,
        template_version: ctx.activeTemplate.version,
        parametros_override: memOutcome.parametros_override_sparse,
        moneda_calculo: req.moneda_calculo,
        tipo_cambio_usado: roundTo(memOutcome.inputs.tc_mxn_usd, 4) ?? 18.7,
        horizonte_anios: req.horizonte_anios,
        granularidad_default: req.granularidad_default,
        vista_financiamiento: req.vista_financiamiento,
        fuente_calculo: 'fisico_tarifario',
        capex_snapshot: roundTo(fin.capex_total, 2),
        desembolso_inicial: roundTo(fin.desembolso_inicial, 2) ?? 0,
        payback_simple_meses:
          fin.payback_simple_anios !== null ? roundTo(fin.payback_simple_anios * 12, 2) : null,
        payback_simple_anios: roundTo(fin.payback_simple_anios, 2),
        payback_descontado_meses:
          fin.payback_descontado_anios !== null
            ? roundTo(fin.payback_descontado_anios * 12, 2)
            : null,
        payback_estado: paybackEstado,
        ahorro_energia_y1_kwh: roundTo(ahorroEnergiaY1Kwh, 2) ?? 0,
        ahorro_energia_total_kwh: roundTo(ahorroEnergiaTotalKwh, 2) ?? 0,
        ahorro_monetario_y1: roundTo(fin.ahorro_total_y1, 2) ?? 0,
        ahorro_monetario_total: roundTo(fin.ahorro_total_horizonte, 2) ?? 0,
        flujo_neto_total: roundTo(fin.flujo_neto_total, 2) ?? 0,
        roi_pct: roundTo(fin.roi_pct, 2),
        tir_pct: roundTo(fin.tir_pct, 4),
        van: roundTo(fin.vpn, 2),
        is_stale: false,
        created_by: auth.userId,
      }
    } else {
      const outcome = evaluateSimulation({
        proyecto: auth.proyecto,
        activeConfig: ctx.activeConfig,
        configProducts: ctx.configProducts,
        activeFinancing: ctx.activeFinancing,
        sitios: ctx.sitios,
        ofertasMem: ctx.ofertasMem,
        template: ctx.activeTemplate,
        monedaCalculo: req.moneda_calculo,
        horizonteAnios: req.horizonte_anios,
        vistaFinanciamiento: req.vista_financiamiento,
        overrides: req.parametros_override,
      })

      if (outcome.status === 'gated') {
        return {
          error:
            'No es posible calcular o guardar simulaciones sin cifras financieras válidas (CAPEX > 0).',
          status: 422,
        }
      }

      if (outcome.status === 'invalid_override') {
        return {
          error: 'Uno o más parámetros personalizados son inválidos.',
          status: 422,
          fieldErrors: outcome.errors,
        }
      }

      const templateDefaults = extractTemplateDefaults(ctx.activeTemplate.campos)
      const fxUsed =
        outcome.parametros_override_sparse.tipo_cambio_usd_mxn ??
        templateDefaults.tipo_cambio_usd_mxn

      insertPayload = {
        proyecto_id: req.proyecto_id,
        configuracion_id: ctx.activeConfig?.id ?? null,
        opcion_financiamiento_id: ctx.activeFinancing?.id ?? null,
        nombre: req.nombre,
        descripcion: req.descripcion ?? null,
        usa_parametros_base: outcome.usa_parametros_base,
        template_id: ctx.activeTemplate.id,
        template_version: ctx.activeTemplate.version,
        parametros_override: outcome.parametros_override_sparse,
        moneda_calculo: req.moneda_calculo,
        tipo_cambio_usado: roundTo(fxUsed, 4),
        horizonte_anios: req.horizonte_anios,
        granularidad_default: req.granularidad_default,
        vista_financiamiento: req.vista_financiamiento,
        fuente_calculo: outcome.fuente_calculo,
        capex_snapshot: roundTo(outcome.capex_total, 2),
        desembolso_inicial: roundTo(outcome.desembolso_inicial, 2),
        payback_simple_meses: roundTo(outcome.payback_simple_meses, 2),
        payback_simple_anios: roundTo(outcome.payback_simple_anios, 2),
        payback_descontado_meses: roundTo(outcome.payback_descontado_meses, 2),
        payback_estado: outcome.payback_estado,
        ahorro_energia_y1_kwh: roundTo(outcome.ahorro_energia_y1_kwh, 2) ?? 0,
        ahorro_energia_total_kwh: roundTo(outcome.ahorro_energia_total_kwh, 2) ?? 0,
        ahorro_monetario_y1: roundTo(outcome.ahorro_monetario_y1, 2) ?? 0,
        ahorro_monetario_total: roundTo(outcome.ahorro_monetario_total, 2) ?? 0,
        flujo_neto_total: roundTo(outcome.flujo_neto_total, 2) ?? 0,
        roi_pct: roundTo(outcome.roi_pct, 2),
        tir_pct: roundTo(outcome.tir_pct, 4),
        van: roundTo(outcome.van, 2),
        is_stale: false,
        created_by: auth.userId,
      }
    }

    const { data: inserted, error: insertError } = await auth.adminClient
      .from('simulaciones_ahorro')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError || !inserted) {
      return {
        error: `No se pudo guardar la simulación: ${insertError?.message || 'error desconocido'}`,
        status: 500,
      }
    }

    revalidateProjectSimulationPaths(req.proyecto_id)
    return { data: inserted as SimulacionAhorro, status: 200 }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `Error del servidor: ${message}`, status: 500 }
  }
}

/**
 * Recalculates an existing saved simulation against current project data and the currently active
 * calculadora_templates version, re-validating stored overrides against the active template's
 * strict 24-key allowlist and gating cleanly (422) if project CAPEX was cleared to 0/null.
 */
export async function recalcularSimulacion(
  simulacionId: string,
): Promise<SimulacionActionResult<SimulacionAhorro>> {
  try {
    if (!z.string().uuid().safeParse(simulacionId).success) {
      return { error: 'Identificador de simulación inválido.', status: 422 }
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.',
        status: 500,
      }
    }

    const adminClient = createAdminClient()
    const { data: existing, error: fetchError } = await adminClient
      .from('simulaciones_ahorro')
      .select('*')
      .eq('id', simulacionId)
      .single()

    if (fetchError || !existing) {
      return { error: 'Simulación no encontrada.', status: 404 }
    }

    const sim = existing as SimulacionAhorro
    const auth = await authenticateAndVerifyProjectAccess(sim.proyecto_id)
    if (!auth.ok) {
      return { error: auth.error, status: auth.status }
    }

    const ctx = await loadAuthoritativeSimulationContext(
      auth.adminClient,
      sim.proyecto_id,
      sim.configuracion_id,
      sim.opcion_financiamiento_id,
    )
    if (!ctx.ok) {
      return { error: ctx.error, status: ctx.status }
    }

    // Re-validate stored overrides against the upgraded active template's strict allowlist & bounds
    const storedOverrides = (sim.parametros_override ?? {}) as Record<string, unknown>
    const overrideCheck = validateOverridesAgainstTemplate(
      ctx.activeTemplate.campos,
      storedOverrides,
    )
    if (!overrideCheck.valid) {
      return {
        error:
          'Los parámetros guardados en esta simulación no son compatibles con la plantilla activa de la calculadora.',
        status: 422,
        fieldErrors: overrideCheck.errors,
      }
    }

    const isMemMode = storedOverrides.modo_motor === 'mem_horaria'
    let updatePayload: Record<string, unknown>

    if (isMemMode) {
      const memOutcome = runSimulation({
        mode: 'mem_horaria',
        proyecto: auth.proyecto,
        activeConfig: ctx.activeConfig,
        configProducts: ctx.configProducts,
        activeFinancing: ctx.activeFinancing,
        sitios: ctx.sitios,
        ofertasMem: ctx.ofertasMem,
        template: ctx.activeTemplate,
        monedaCalculo: sim.moneda_calculo,
        horizonteAnios: sim.horizonte_anios,
        vistaFinanciamiento: sim.vista_financiamiento,
        overrides: overrideCheck.sanitized as Record<string, unknown>,
        ignoreProjectGating: true,
      })

      if (memOutcome.status === 'gated') {
        return {
          error:
            'No es posible recalcular la simulación sin cifras financieras válidas (CAPEX > 0).',
          status: 422,
        }
      }
      if (memOutcome.status === 'invalid_override') {
        return {
          error: 'Uno o más parámetros de la simulación resultan inválidos con la plantilla activa.',
          status: 422,
          fieldErrors: memOutcome.errors,
        }
      }
      if (memOutcome.mode !== 'mem_horaria') {
        return { error: 'Modo MEM inesperado.', status: 500 }
      }

      const fin = memOutcome.financial
      if (fin.capex_total <= 0) {
        return {
          error: 'No es posible recalcular la simulación con CAPEX total igual a 0.',
          status: 422,
        }
      }

      const ahorroEnergiaY1Kwh =
        (memOutcome.year1.res_fv_auto_mwh + memOutcome.year1.res_descarga_mwh) * 1000
      const ahorroEnergiaTotalKwh = fin.serie_mensual.reduce(
        (acc, m) => acc + m.energia_total_kwh,
        0,
      )
      const paybackEstado =
        fin.payback_simple_estado === 'ok'
          ? fin.payback_simple_anios !== null && fin.payback_simple_anios <= 0
            ? 'inmediato'
            : 'en_horizonte'
          : fin.payback_simple_estado === 'fuera_horizonte'
            ? 'fuera_horizonte'
            : 'no_recuperable'

      updatePayload = {
        template_id: ctx.activeTemplate.id,
        template_version: ctx.activeTemplate.version,
        usa_parametros_base: memOutcome.usa_parametros_base,
        parametros_override: memOutcome.parametros_override_sparse,
        tipo_cambio_usado: roundTo(memOutcome.inputs.tc_mxn_usd, 4) ?? 18.7,
        fuente_calculo: 'fisico_tarifario',
        capex_snapshot: roundTo(fin.capex_total, 2),
        desembolso_inicial: roundTo(fin.desembolso_inicial, 2) ?? 0,
        payback_simple_meses:
          fin.payback_simple_anios !== null ? roundTo(fin.payback_simple_anios * 12, 2) : null,
        payback_simple_anios: roundTo(fin.payback_simple_anios, 2),
        payback_descontado_meses:
          fin.payback_descontado_anios !== null
            ? roundTo(fin.payback_descontado_anios * 12, 2)
            : null,
        payback_estado: paybackEstado,
        ahorro_energia_y1_kwh: roundTo(ahorroEnergiaY1Kwh, 2) ?? 0,
        ahorro_energia_total_kwh: roundTo(ahorroEnergiaTotalKwh, 2) ?? 0,
        ahorro_monetario_y1: roundTo(fin.ahorro_total_y1, 2) ?? 0,
        ahorro_monetario_total: roundTo(fin.ahorro_total_horizonte, 2) ?? 0,
        flujo_neto_total: roundTo(fin.flujo_neto_total, 2) ?? 0,
        roi_pct: roundTo(fin.roi_pct, 2),
        tir_pct: roundTo(fin.tir_pct, 4),
        van: roundTo(fin.vpn, 2),
        is_stale: false,
      }
    } else {
      const outcome = evaluateSimulation({
        proyecto: auth.proyecto,
        activeConfig: ctx.activeConfig,
        configProducts: ctx.configProducts,
        activeFinancing: ctx.activeFinancing,
        sitios: ctx.sitios,
        ofertasMem: ctx.ofertasMem,
        template: ctx.activeTemplate,
        monedaCalculo: sim.moneda_calculo,
        horizonteAnios: sim.horizonte_anios,
        vistaFinanciamiento: sim.vista_financiamiento,
        overrides: overrideCheck.sanitized as Record<string, unknown>,
      })

      if (outcome.status === 'gated') {
        return {
          error:
            'No es posible recalcular la simulación sin cifras financieras válidas (CAPEX > 0).',
          status: 422,
        }
      }

      if (outcome.status === 'invalid_override') {
        return {
          error: 'Uno o más parámetros de la simulación resultan inválidos con la plantilla activa.',
          status: 422,
          fieldErrors: outcome.errors,
        }
      }

      const templateDefaults = extractTemplateDefaults(ctx.activeTemplate.campos)
      const fxUsed =
        outcome.parametros_override_sparse.tipo_cambio_usd_mxn ??
        templateDefaults.tipo_cambio_usd_mxn

      updatePayload = {
        template_id: ctx.activeTemplate.id,
        template_version: ctx.activeTemplate.version,
        usa_parametros_base: outcome.usa_parametros_base,
        parametros_override: outcome.parametros_override_sparse,
        tipo_cambio_usado: roundTo(fxUsed, 4),
        fuente_calculo: outcome.fuente_calculo,
        capex_snapshot: roundTo(outcome.capex_total, 2),
        desembolso_inicial: roundTo(outcome.desembolso_inicial, 2),
        payback_simple_meses: roundTo(outcome.payback_simple_meses, 2),
        payback_simple_anios: roundTo(outcome.payback_simple_anios, 2),
        payback_descontado_meses: roundTo(outcome.payback_descontado_meses, 2),
        payback_estado: outcome.payback_estado,
        ahorro_energia_y1_kwh: roundTo(outcome.ahorro_energia_y1_kwh, 2) ?? 0,
        ahorro_energia_total_kwh: roundTo(outcome.ahorro_energia_total_kwh, 2) ?? 0,
        ahorro_monetario_y1: roundTo(outcome.ahorro_monetario_y1, 2) ?? 0,
        ahorro_monetario_total: roundTo(outcome.ahorro_monetario_total, 2) ?? 0,
        flujo_neto_total: roundTo(outcome.flujo_neto_total, 2) ?? 0,
        roi_pct: roundTo(outcome.roi_pct, 2),
        tir_pct: roundTo(outcome.tir_pct, 4),
        van: roundTo(outcome.van, 2),
        is_stale: false,
      }
    }

    const { data: updated, error: updateError } = await auth.adminClient
      .from('simulaciones_ahorro')
      .update(updatePayload)
      .eq('id', simulacionId)
      .select('*')
      .single()

    if (updateError || !updated) {
      return {
        error: `No se pudo recalcular la simulación: ${updateError?.message || 'error desconocido'}`,
        status: 500,
      }
    }

    revalidateProjectSimulationPaths(sim.proyecto_id)
    return { data: updated as SimulacionAhorro, status: 200 }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `Error del servidor: ${message}`, status: 500 }
  }
}

/**
 * Renames a saved simulation (updates only nombre/descripcion) after verifying project membership
 * and creator/Nodo/EPC ownership.
 */
export async function renombrarSimulacion(
  simulacionId: string,
  nombre: string,
  descripcion?: string | null,
): Promise<SimulacionActionResult<SimulacionAhorro>> {
  try {
    const parsed = renombrarSimulacionSchema.safeParse({
      id: simulacionId,
      nombre,
      descripcion,
    })
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || 'Datos inválidos.',
        status: 422,
      }
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.',
        status: 500,
      }
    }

    const adminClient = createAdminClient()
    const { data: existing, error: fetchError } = await adminClient
      .from('simulaciones_ahorro')
      .select('id, proyecto_id, created_by')
      .eq('id', parsed.data.id)
      .single()

    if (fetchError || !existing) {
      return { error: 'Simulación no encontrada.', status: 404 }
    }

    const auth = await authenticateAndVerifyProjectAccess(existing.proyecto_id as string)
    if (!auth.ok) {
      return { error: auth.error, status: auth.status }
    }

    const canRename =
      auth.rol === 'nodo_admin' ||
      auth.rol === 'nodo_analista' ||
      (auth.rol === 'epc' && auth.proyecto.epcista_id === auth.userId) ||
      existing.created_by === auth.userId

    if (!canRename) {
      return {
        error: 'Solo el creador de la simulación, Nodo o el EPC responsable pueden renombrarla.',
        status: 403,
      }
    }

    const updateFields: { nombre: string; descripcion?: string | null } = {
      nombre: parsed.data.nombre,
    }
    if (descripcion !== undefined) {
      updateFields.descripcion = parsed.data.descripcion ?? null
    }

    const { data: updated, error: updateError } = await auth.adminClient
      .from('simulaciones_ahorro')
      .update(updateFields)
      .eq('id', parsed.data.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return {
        error: `No se pudo renombrar la simulación: ${updateError?.message || 'error desconocido'}`,
        status: 500,
      }
    }

    revalidateProjectSimulationPaths(existing.proyecto_id as string)
    return { data: updated as SimulacionAhorro, status: 200 }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `Error del servidor: ${message}`, status: 500 }
  }
}

/**
 * Deletes a saved simulation via createClient() governed by PostgreSQL DELETE RLS
 * (requires active project access + creator/Nodo/EPC authorization).
 */
export async function eliminarSimulacion(
  simulacionId: string,
): Promise<SimulacionActionResult<{ id: string }>> {
  try {
    if (!z.string().uuid().safeParse(simulacionId).success) {
      return { error: 'Identificador de simulación inválido.', status: 422 }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: 'No autenticado.', status: 401 }
    }

    const { data: target } = await supabase
      .from('simulaciones_ahorro')
      .select('id, proyecto_id')
      .eq('id', simulacionId)
      .single()

    if (!target) {
      return {
        error: 'Simulación no encontrada o sin permisos para eliminarla.',
        status: 404,
      }
    }

    const { error: deleteError } = await supabase
      .from('simulaciones_ahorro')
      .delete()
      .eq('id', simulacionId)

    if (deleteError) {
      return {
        error: `No se pudo eliminar la simulación: ${deleteError.message}`,
        status: 403,
      }
    }

    revalidateProjectSimulationPaths(target.proyecto_id as string)
    return { data: { id: simulacionId }, status: 200 }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `Error del servidor: ${message}`, status: 500 }
  }
}
