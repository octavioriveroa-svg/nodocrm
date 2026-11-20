import { handleSpreadsheetParseUpload } from '@/lib/calculator/spreadsheet-upload-route'
import type { Rol } from '@/lib/types'

export const runtime = 'nodejs'

const ALLOWED_EXCEL_IMPORT_ROLES = new Set<Rol>(['nodo_admin'])

export async function POST(request: Request) {
  return handleSpreadsheetParseUpload(request, {
    allowedRoles: ALLOWED_EXCEL_IMPORT_ROLES,
    defaultFileName: 'archivo.xlsx',
    unauthenticatedMessage: 'No autenticado. Inicia sesión para importar archivos.',
    unauthorizedMessage: 'No autorizado. Solo nodo_admin puede importar modelos de Excel.',
    parseErrorPrefix: 'No se pudo leer el archivo de cálculo',
    formatResponse: (parseResult) => parseResult,
  })
}
