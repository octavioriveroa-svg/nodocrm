import { createClient } from '@/lib/supabase/server'
import {
  ExcelParseLimitError,
  parseWorkbookWithExcelJs,
} from '@/lib/calculator/excel-mapper'
import {
  MAX_UPLOAD_BYTES,
  preflightValidateSpreadsheetBuffer,
} from '@/lib/calculator/zip-preflight'
import type { ExcelParseResult, Rol } from '@/lib/types'

export interface SpreadsheetUploadRouteConfig<TResponse = ExcelParseResult> {
  allowedRoles: ReadonlySet<Rol>
  defaultFileName: string
  unauthenticatedMessage: string
  unauthorizedMessage: string
  parseErrorPrefix: string
  formatResponse: (parseResult: ExcelParseResult) => TResponse
  createSupabaseClient?: typeof createClient
}

/**
 * Shared server-side handler for authenticated, role-gated spreadsheet (.xlsx / .csv)
 * multipart upload parsing. Enforces Supabase auth + profile role check, multipart
 * FormData extraction, pre-flight ZIP/CSV security validation, in-memory ExcelJS parsing,
 * and consistent 400/401/403/413/422 error mapping with zero DB writes.
 */
export async function handleSpreadsheetParseUpload<TResponse = ExcelParseResult>(
  request: Request,
  config: SpreadsheetUploadRouteConfig<TResponse>,
): Promise<Response> {
  try {
    // 1. Explicit auth & role guard (proxy.ts excludes /api/*)
    const getClient = config.createSupabaseClient ?? createClient
    const supabase = await getClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json(
        { error: config.unauthenticatedMessage },
        { status: 401 },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !config.allowedRoles.has(profile.rol as Rol)) {
      return Response.json(
        { error: config.unauthorizedMessage },
        { status: 403 },
      )
    }

    // 2. Extract multipart file
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return Response.json(
        { error: 'Solicitud inválida: se esperaba multipart/form-data con el campo "file".' },
        { status: 400 },
      )
    }

    const fileEntry = formData.get('file')
    if (!fileEntry || typeof fileEntry === 'string') {
      return Response.json(
        { error: 'No se recibió ningún archivo en el campo "file".' },
        { status: 400 },
      )
    }

    const fileName = fileEntry.name || config.defaultFileName
    if (typeof fileEntry.size === 'number' && fileEntry.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          error: 'El archivo supera el tamaño máximo permitido de 10 MB.',
          code: 'file_too_large',
        },
        { status: 413 },
      )
    }

    const arrayBuffer = await fileEntry.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 3. Pre-flight security checks (magic bytes, .xls block, ZIP EOCD/CD bomb guard, CSV NUL guard)
    const preflight = preflightValidateSpreadsheetBuffer(buffer, fileName)
    if (!preflight.ok) {
      return Response.json(
        { error: preflight.error, code: preflight.code },
        { status: preflight.status },
      )
    }

    // 4. Parse workbook in-memory (strictly preview-only — zero DB writes)
    const parseResult = await parseWorkbookWithExcelJs(buffer, fileName, preflight.extension)

    return Response.json(config.formatResponse(parseResult), { status: 200 })
  } catch (err: unknown) {
    if (err instanceof ExcelParseLimitError) {
      return Response.json({ error: err.message }, { status: 422 })
    }
    const message = err instanceof Error ? err.message : 'Error al procesar el archivo.'
    return Response.json(
      { error: `${config.parseErrorPrefix}: ${message}` },
      { status: 422 },
    )
  }
}
