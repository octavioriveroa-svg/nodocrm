'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type {
  CalculadoraCampoDef,
  CalculadoraTemplate,
  ExcelMapeoCampos,
  FormulaDefinicion,
  ModoFormulaConfig,
} from '@/lib/types'
import {
  FALLBACK_HORIZONTE_OPCIONES,
  validateCampoValue,
} from '@/lib/calculator/template-schema'
import {
  compileAndSortFormulas,
  findUnresolvedCellRefs,
  FormulaError,
  parseExcelFormula,
} from '@/lib/calculator/formula-engine'
import { previewFormulaRewrite } from '@/lib/calculator/excel-mapper'
import { evaluateSimulation } from '@/lib/calculator/engine'

const campoValidationRulesSchema = z
  .object({
    required: z.boolean().optional(),
    allowNegative: z.boolean().optional(),
    integer: z.boolean().optional(),
    exclusiveMin: z.number().finite().optional(),
    exclusiveMax: z.number().finite().optional(),
    overrideMin: z.number().finite().optional(),
    overrideMax: z.number().finite().optional(),
    options: z.array(z.string()).optional(),
    arrayLength: z.number().int().positive().optional(),
    sumEquals: z.number().finite().optional(),
    sumTolerance: z.number().finite().positive().optional(),
    overrideKey: z.string().min(1).max(80).optional(),
  })
  .strict()
  .optional()

const campoDefSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(160),
  unit: z.string().max(40),
  type: z.enum(['number', 'percentage', 'integer', 'select', 'number_array']),
  group: z.enum([
    'moneda',
    'tarifas',
    'fv',
    'bess',
    'macro',
    'financiamiento',
    'horizontes',
  ]),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  step: z.number().finite().positive().optional(),
  defaultValue: z.union([
    z.number().finite(),
    z.string(),
    z.array(z.number().finite()),
  ]),
  validationRules: campoValidationRulesSchema,
  editableByUser: z.boolean(),
  order: z.number().int().min(0),
})

const formulaDefSchema = z.object({
  key: z.enum([
    'fv_kwh_mes',
    'bess_kwh_mes',
    'energia_ahorrada_kwh_mes',
    'ahorro_bruto_mes',
    'om_mes',
    'cuota_financiamiento_mes',
    'flujo_neto_mes',
  ]),
  label: z.string().min(1).max(160),
  expression: z.string().min(1).max(2000),
  unit: z.enum(['kWh', 'currency']),
  enabled: z.boolean(),
  source_cell: z.string().max(80).optional(),
  ast_validated: z.boolean().optional(),
})

const excelMapeoSchema = z
  .object({
    inputMappings: z.array(
      z.object({
        cellRef: z.string().min(1).max(80),
        sheetName: z.string().min(1).max(120),
        label: z.string().max(200),
        platformVar: z.string().min(1).max(80),
        sampleValue: z.union([z.number(), z.string(), z.null()]).optional(),
      }),
    ),
    outputMappings: z.array(
      z.object({
        cellRef: z.string().min(1).max(80),
        sheetName: z.string().min(1).max(120),
        outputKey: formulaDefSchema.shape.key,
        rawFormula: z.string().min(1).max(2000),
        rewrittenExpression: z.string().min(1).max(2000),
      }),
    ),
  })
  .nullable()
  .optional()

const saveTemplatePayloadSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre de la plantilla es obligatorio.').max(160),
  descripcion: z.string().trim().max(1000).nullable().optional(),
  modo: z.enum(['default', 'custom_formulas', 'excel_import']),
  campos: z.array(campoDefSchema).min(1, 'La plantilla debe incluir al menos un campo base.'),
  formulas: z.array(formulaDefSchema).min(1, 'La plantilla debe incluir al menos una fórmula.'),
  horizonte_opciones: z
    .array(z.number().int().min(1).max(30))
    .min(1)
    .max(30)
    .optional(),
  excel_archivo_nombre: z.string().max(255).nullable().optional(),
  excel_archivo_hash: z.string().max(128).nullable().optional(),
  excel_hoja_origen: z.string().max(120).nullable().optional(),
  excel_mapeo_campos: excelMapeoSchema,
  excel_preview_snapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  notas: z.string().max(2000).nullable().optional(),
})

export interface GuardarPlantillaInput {
  nombre: string
  descripcion?: string | null
  modo: ModoFormulaConfig
  campos: CalculadoraCampoDef[]
  formulas: FormulaDefinicion[]
  horizonte_opciones?: number[]
  excel_archivo_nombre?: string | null
  excel_archivo_hash?: string | null
  excel_hoja_origen?: string | null
  excel_mapeo_campos?: ExcelMapeoCampos | null
  excel_preview_snapshot?: Record<string, unknown> | null
  notas?: string | null
}

export interface CalculatorConfigActionResult<T = CalculadoraTemplate> {
  data?: T
  error?: string
  status?: number
  validationErrors?: string[]
}

async function requireNodoAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      supabase: null,
      user: null,
      error: 'No autenticado. Inicia sesión para continuar.',
      status: 401,
    } as const
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.rol !== 'nodo_admin') {
    return {
      supabase: null,
      user: null,
      error: 'No autorizado. Solo nodo_admin puede configurar la calculadora y sus fórmulas.',
      status: 403,
    } as const
  }

  return { supabase, user, error: null, status: 200 } as const
}

/**
 * Validates all campos, compiles & topologically sorts formulas (rejecting cycles, #NAME?,
 * and unresolved CellRef/RangeRef nodes), runs a synthetic FV+BESS dry-run, and atomically
 * creates + activates a new immutable calculadora_templates version via RPC.
 */
export async function guardarPlantillaCalculadora(
  payload: GuardarPlantillaInput,
): Promise<CalculatorConfigActionResult<CalculadoraTemplate>> {
  try {
    const auth = await requireNodoAdmin()
    if (!auth.supabase) {
      return { error: auth.error, status: auth.status }
    }

    const parsed = saveTemplatePayloadSchema.safeParse(payload)
    if (!parsed.success) {
      const issues = parsed.error.issues.map(
        (i) => `${i.path.join('.') || 'payload'}: ${i.message}`,
      )
      return {
        error: 'Datos de plantilla inválidos.',
        status: 422,
        validationErrors: issues,
      }
    }

    const validData = parsed.data
    const validationErrors: string[] = []

    // 1. Validate every declarative campo default value (including 12-month seasonal weights sum = 1)
    const seenCampoKeys = new Set<string>()
    for (const campo of validData.campos) {
      if (seenCampoKeys.has(campo.key)) {
        validationErrors.push(`Campo duplicado: "${campo.key}".`)
        continue
      }
      seenCampoKeys.add(campo.key)
      const err = validateCampoValue(campo, campo.defaultValue, { useOverrideBounds: false })
      if (err) {
        validationErrors.push(err)
      }
    }

    if (validationErrors.length > 0) {
      return {
        error: validationErrors[0],
        status: 422,
        validationErrors,
      }
    }

    // 2. Rewrite mapped Excel cell refs if supplied & verify ZERO unresolved CellRef/RangeRef remain
    const excelMapeo = validData.excel_mapeo_campos ?? null
    const finalFormulas: FormulaDefinicion[] = []

    for (const f of validData.formulas) {
      let expr = f.expression.trim()
      if (validData.modo === 'excel_import' && excelMapeo && excelMapeo.inputMappings.length > 0) {
        try {
          const rewrite = previewFormulaRewrite(
            expr,
            excelMapeo.inputMappings,
            validData.excel_hoja_origen ?? undefined,
          )
          expr = rewrite.rewritten
          if (rewrite.unresolvedRefs.length > 0) {
            validationErrors.push(
              `Fórmula "${f.key}": celdas sin mapear (${rewrite.unresolvedRefs.join(', ')}).`,
            )
          }
        } catch (err) {
          validationErrors.push(
            `Fórmula "${f.key}": ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }

      if (f.enabled) {
        try {
          const ast = parseExcelFormula(expr)
          const unresolved = findUnresolvedCellRefs(ast)
          if (unresolved.length > 0) {
            validationErrors.push(
              `Fórmula "${f.key}": contiene referencias de celda sin mapear (${unresolved.join(', ')}).`,
            )
          }
        } catch (err) {
          validationErrors.push(
            `Fórmula "${f.key}": ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }

      finalFormulas.push({
        ...f,
        expression: expr,
        ast_validated: true,
      })
    }

    if (validationErrors.length > 0) {
      return {
        error: validationErrors[0],
        status: 422,
        validationErrors,
      }
    }

    // 3. Server-side AST compilation + Kahn cycle check + function/identifier validation
    try {
      compileAndSortFormulas(finalFormulas, {
        allowCellRefs: false,
        validateIdentifiers: true,
      })
    } catch (err) {
      const msg = err instanceof FormulaError ? err.message : String(err)
      return {
        error: msg,
        status: 422,
        validationErrors: [msg],
      }
    }

    // 4. Deterministic dry-run against synthetic FV+BESS fixture (capex = 1,500,000, gen = 120,000)
    const dryRunOutcome = evaluateSimulation({
      proyecto: {
        tipo: 'FV+BESS',
        capex_estimado: 1_500_000,
        moneda: 'MXN',
        incluye_mem: false,
        demanda_kw: 250,
        capacidad_mw: 0.1,
        capacidad_mwh: 0.2,
        consumo_anual_gwh: null,
        volumen_energia_mwh_anual: null,
        tarifa_actual_cfe: 3.2,
      },
      activeConfig: {
        id: 'dry-run-config',
        proyecto_id: 'dry-run-proj',
        nombre: 'Dry-run',
        descripcion: null,
        inversion_total: 1_500_000,
        moneda: 'MXN',
        ahorro_estimado_anual: null,
        ahorro_estimado_mensual: null,
        ahorro_moneda: 'MXN',
        seleccionada: true,
        created_at: '',
        updated_at: '',
      },
      configProducts: [
        {
          id: 'dry-fv',
          proyecto_id: 'dry-run-proj',
          sitio_id: 'dry-site',
          configuracion_id: 'dry-run-config',
          tipo: 'fv',
          datos: {
            num_modulos: 160,
            potencia_modulos_w: 500,
            generacion_anual_kwh: 120_000,
            capex: 1_000_000,
            capex_moneda: 'MXN',
          },
          created_at: '',
        },
        {
          id: 'dry-bess',
          proyecto_id: 'dry-run-proj',
          sitio_id: 'dry-site',
          configuracion_id: 'dry-run-config',
          tipo: 'bess',
          datos: {
            potencia_kw: 100,
            capacidad_kwh: 200,
            uso: 'load_shifting',
            capex: 500_000,
            capex_moneda: 'MXN',
          },
          created_at: '',
        },
      ],
      activeFinancing: null,
      template: {
        id: '', // uncached dry-run
        modo: validData.modo === 'default' ? 'custom_formulas' : validData.modo,
        campos: validData.campos,
        formulas: finalFormulas,
      },
      monedaCalculo: 'MXN',
      horizonteAnios: 10,
      vistaFinanciamiento: 'bruto',
      overrides: {},
    })

    if (dryRunOutcome.status !== 'ok') {
      const msg =
        dryRunOutcome.status === 'invalid_override'
          ? Object.values(dryRunOutcome.errors).join('; ')
          : dryRunOutcome.message
      return {
        error: `Error en prueba de ejecución (dry-run) de fórmulas: ${msg}`,
        status: 422,
        validationErrors: [msg],
      }
    }

    // 5. Atomic creation & activation via SECURITY DEFINER RPC
    const horizonteOpciones = Array.from(
      new Set(validData.horizonte_opciones ?? [...FALLBACK_HORIZONTE_OPCIONES]),
    ).sort((a, b) => a - b)

    const { data: createdTemplate, error: rpcError } = await auth.supabase.rpc(
      'crear_y_activar_calculadora_template',
      {
        p_nombre: validData.nombre,
        p_descripcion: validData.descripcion ?? null,
        p_modo: validData.modo,
        p_campos: validData.campos,
        p_formulas: finalFormulas,
        p_horizonte_opciones: horizonteOpciones,
        p_excel_archivo_nombre: validData.excel_archivo_nombre ?? null,
        p_excel_archivo_hash: validData.excel_archivo_hash ?? null,
        p_excel_hoja_origen: validData.excel_hoja_origen ?? null,
        p_excel_mapeo_campos: excelMapeo,
        p_excel_preview_snapshot: validData.excel_preview_snapshot ?? null,
        p_notas: validData.notas ?? null,
      },
    )

    if (rpcError || !createdTemplate) {
      return {
        error: `No se pudo guardar la plantilla: ${rpcError?.message || 'error desconocido'}`,
        status: 500,
      }
    }

    revalidatePath('/admin/configuracion/calculadora')
    revalidatePath('/admin/configuracion')

    return { data: createdTemplate as CalculadoraTemplate, status: 200 }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `Error del servidor: ${message}`, status: 500 }
  }
}

/**
 * Blueprint §5.4 alias for guardarPlantillaCalculadora.
 */
export async function saveCalculadoraTemplate(
  payload: GuardarPlantillaInput,
): Promise<CalculatorConfigActionResult<CalculadoraTemplate>> {
  return guardarPlantillaCalculadora(payload)
}

/**
 * Atomically activates an existing immutable template version (instant rollback) via RPC.
 */
export async function activarPlantillaCalculadora(
  templateId: string,
): Promise<CalculatorConfigActionResult<CalculadoraTemplate>> {
  try {
    const auth = await requireNodoAdmin()
    if (!auth.supabase) {
      return { error: auth.error, status: auth.status }
    }

    const uuidCheck = z.string().uuid().safeParse(templateId)
    if (!uuidCheck.success) {
      return { error: 'Identificador de plantilla inválido.', status: 422 }
    }

    const { data: activated, error: rpcError } = await auth.supabase.rpc(
      'activar_calculadora_template',
      { p_template_id: templateId },
    )

    if (rpcError || !activated) {
      return {
        error: `No se pudo activar la versión seleccionada: ${rpcError?.message || 'error desconocido'}`,
        status: 422,
      }
    }

    revalidatePath('/admin/configuracion/calculadora')
    revalidatePath('/admin/configuracion')

    return { data: activated as CalculadoraTemplate, status: 200 }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `Error del servidor: ${message}`, status: 500 }
  }
}

/**
 * Blueprint §5.4 alias for activarPlantillaCalculadora.
 */
export async function activateTemplateVersion(
  templateId: string,
): Promise<CalculatorConfigActionResult<CalculadoraTemplate>> {
  return activarPlantillaCalculadora(templateId)
}

/**
 * Lists all immutable calculadora_templates versions (newest first) for nodo_admin.
 */
export async function obtenerPlantillasCalculadora(): Promise<
  CalculatorConfigActionResult<CalculadoraTemplate[]>
> {
  try {
    const auth = await requireNodoAdmin()
    if (!auth.supabase) {
      return { error: auth.error, status: auth.status }
    }

    const { data, error } = await auth.supabase
      .from('calculadora_templates')
      .select('*')
      .order('version', { ascending: false })

    if (error) {
      return {
        error: `No se pudieron cargar las plantillas: ${error.message}`,
        status: 500,
      }
    }

    return { data: (data ?? []) as CalculadoraTemplate[], status: 200 }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `Error del servidor: ${message}`, status: 500 }
  }
}
