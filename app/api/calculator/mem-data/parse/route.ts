import { handleSpreadsheetParseUpload } from '@/lib/calculator/spreadsheet-upload-route'
import type { Rol } from '@/lib/types'

export const runtime = 'nodejs'

const ALLOWED_MEM_UPLOAD_ROLES = new Set<Rol>([
  'nodo_admin',
  'nodo_analista',
  'epc',
  'finder',
  'financiero',
])

export async function POST(request: Request) {
  return handleSpreadsheetParseUpload(request, {
    allowedRoles: ALLOWED_MEM_UPLOAD_ROLES,
    defaultFileName: 'datos.xlsx',
    unauthenticatedMessage: 'No autenticado. Inicia sesión para cargar series horarias.',
    unauthorizedMessage: 'No autorizado para cargar series horarias en el simulador.',
    parseErrorPrefix: 'No se pudo leer el archivo de series horarias',
    formatResponse: (parseResult) => ({
      fileName: parseResult.fileName,
      fileHash: parseResult.fileHash,
      memWorkbookPreview: parseResult.memWorkbookPreview,
    }),
  })
}
