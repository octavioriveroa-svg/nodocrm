import { createClient } from '@/lib/supabase/server'
import {
  ExcelParseLimitError,
  parseWorkbookWithExcelJs,
} from '@/lib/calculator/excel-mapper'
import { preflightValidateSpreadsheetBuffer } from '@/lib/calculator/zip-preflight'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    // 1. Explicit auth & role guard (proxy.ts excludes /api/*)
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json(
        { error: 'No autenticado. Inicia sesión para importar archivos.' },
        { status: 401 },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.rol !== 'nodo_admin') {
      return Response.json(
        { error: 'No autorizado. Solo nodo_admin puede importar modelos de Excel.' },
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

    const fileName = fileEntry.name || 'archivo.xlsx'
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

    return Response.json(parseResult, { status: 200 })
  } catch (err: unknown) {
    if (err instanceof ExcelParseLimitError) {
      return Response.json({ error: err.message }, { status: 422 })
    }
    const message = err instanceof Error ? err.message : 'Error al procesar el archivo Excel.'
    return Response.json(
      { error: `No se pudo leer el archivo de cálculo: ${message}` },
      { status: 422 },
    )
  }
}
