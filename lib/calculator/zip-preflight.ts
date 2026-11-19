export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024 // 50 MB
export const MIN_UNCOMPRESSED_RATIO_FLOOR = 1 * 1024 * 1024 // 1 MB floor before ratio check
export const MAX_COMPRESSION_RATIO = 100
export const MAX_WORKSHEETS = 20
export const MAX_XLSX_POPULATED_CELLS = 50_000
export const MAX_CSV_ROWS = 10_000

const ZIP_LOCAL_HEADER_SIG = 0x04034b50 // PK\x03\x04 in little-endian
const ZIP_CD_ENTRY_SIG = 0x02014b50 // PK\x01\x02
const ZIP_EOCD_SIG = 0x06054b50 // PK\x05\x06
const OLE2_XLS_SIG = 0xe011cfd0 // 0xD0 0xCF 0x11 0xE0 in little-endian

export const LEGACY_XLS_ERROR_MESSAGE =
  'El formato binario .xls (Excel 97-2003) no es compatible por seguridad. Guárdalo como Libro de Excel (.xlsx) o .csv e inténtalo de nuevo.'

export interface ZipInspectionStats {
  entryCount: number
  totalCompressedBytes: number
  totalUncompressedBytes: number
  compressionRatio: number
}

export type PreflightResult =
  | {
      ok: true
      extension: 'xlsx' | 'csv'
      zipStats?: ZipInspectionStats
    }
  | {
      ok: false
      status: 413 | 422
      error: string
      code:
        | 'empty_file'
        | 'file_too_large'
        | 'legacy_xls'
        | 'unsupported_extension'
        | 'invalid_magic_bytes'
        | 'corrupt_zip'
        | 'zip_uncompressed_limit'
        | 'zip_bomb_ratio'
        | 'csv_binary_content'
    }

function getLowerExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  if (idx < 0) return ''
  return fileName.slice(idx + 1).toLowerCase().trim()
}

function hasOle2Magic(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.readUInt32LE(0) === OLE2_XLS_SIG
}

function hasZipLocalMagic(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.readUInt32LE(0) === ZIP_LOCAL_HEADER_SIG
}

/**
 * Pure Node.js ZIP End-of-Central-Directory (0x06054b50) -> Central Directory (0x02014b50) scanner.
 * Avoids Local File Header zero-size ambiguity when Excel writes bit-3 data descriptors.
 */
export function inspectZipCentralDirectory(
  buffer: Buffer,
): { ok: true; stats: ZipInspectionStats } | { ok: false; status: 413 | 422; error: string; code: 'corrupt_zip' | 'zip_uncompressed_limit' | 'zip_bomb_ratio' } {
  if (buffer.length < 22) {
    return {
      ok: false,
      status: 422,
      code: 'corrupt_zip',
      error: 'Archivo .xlsx inválido o corrupto (cabecera ZIP incompleta).',
    }
  }

  // Locate EOCD record (signature 0x06054b50) scanning backwards (max comment 65535 bytes)
  const minOffset = Math.max(0, buffer.length - 22 - 65535)
  let eocdOffset = -1
  for (let pos = buffer.length - 22; pos >= minOffset; pos--) {
    if (buffer.readUInt32LE(pos) === ZIP_EOCD_SIG) {
      const commentLen = buffer.readUInt16LE(pos + 20)
      if (pos + 22 + commentLen === buffer.length) {
        eocdOffset = pos
        break
      }
    }
  }

  if (eocdOffset < 0) {
    return {
      ok: false,
      status: 422,
      code: 'corrupt_zip',
      error: 'Archivo .xlsx inválido: no se encontró el directorio central ZIP (EOCD).',
    }
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10)
  const cdSize = buffer.readUInt32LE(eocdOffset + 12)
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16)

  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    return {
      ok: false,
      status: 413,
      code: 'zip_uncompressed_limit',
      error: 'El archivo .xlsx excede el tamaño descomprimido máximo permitido (50 MB).',
    }
  }

  if (cdOffset + cdSize > eocdOffset || cdOffset > buffer.length) {
    return {
      ok: false,
      status: 422,
      code: 'corrupt_zip',
      error: 'Archivo .xlsx corrupto: límites del directorio central ZIP inválidos.',
    }
  }

  let pos = cdOffset
  const cdEnd = cdOffset + cdSize
  let parsedEntries = 0
  let totalCompressed = 0
  let totalUncompressed = 0

  while (pos < cdEnd) {
    if (pos + 46 > cdEnd || buffer.readUInt32LE(pos) !== ZIP_CD_ENTRY_SIG) {
      return {
        ok: false,
        status: 422,
        code: 'corrupt_zip',
        error: 'Archivo .xlsx corrupto: entrada inválida en el directorio central ZIP.',
      }
    }

    let compressedSize = buffer.readUInt32LE(pos + 20)
    let uncompressedSize = buffer.readUInt32LE(pos + 24)
    const fileNameLen = buffer.readUInt16LE(pos + 28)
    const extraLen = buffer.readUInt16LE(pos + 30)
    const commentLen = buffer.readUInt16LE(pos + 32)
    const nextPos = pos + 46 + fileNameLen + extraLen + commentLen

    if (nextPos > cdEnd) {
      return {
        ok: false,
        status: 422,
        code: 'corrupt_zip',
        error: 'Archivo .xlsx corrupto: entrada truncada en el directorio central ZIP.',
      }
    }

    // Parse ZIP64 extra field if either size is 0xFFFFFFFF
    if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff) {
      let extraPos = pos + 46 + fileNameLen
      const extraEnd = extraPos + extraLen
      let foundZip64 = false
      while (extraPos + 4 <= extraEnd) {
        const headerId = buffer.readUInt16LE(extraPos)
        const dataSize = buffer.readUInt16LE(extraPos + 2)
        extraPos += 4
        if (headerId === 0x0001 && extraPos + dataSize <= extraEnd) {
          let fieldOff = extraPos
          if (uncompressedSize === 0xffffffff && fieldOff + 8 <= extraPos + dataSize) {
            const bigVal = buffer.readBigUInt64LE(fieldOff)
            uncompressedSize = bigVal > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(bigVal)
            fieldOff += 8
          }
          if (compressedSize === 0xffffffff && fieldOff + 8 <= extraPos + dataSize) {
            const bigVal = buffer.readBigUInt64LE(fieldOff)
            compressedSize = bigVal > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(bigVal)
          }
          foundZip64 = true
          break
        }
        extraPos += dataSize
      }
      if (!foundZip64) {
        return {
          ok: false,
          status: 413,
          code: 'zip_uncompressed_limit',
          error: 'El archivo .xlsx excede el tamaño descomprimido máximo permitido (50 MB).',
        }
      }
    }

    totalCompressed += compressedSize
    totalUncompressed += uncompressedSize
    parsedEntries++

    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      return {
        ok: false,
        status: 413,
        code: 'zip_uncompressed_limit',
        error: `El archivo .xlsx supera el límite máximo descomprimido de 50 MB (${(totalUncompressed / (1024 * 1024)).toFixed(1)} MB).`,
      }
    }

    pos = nextPos
  }

  if (parsedEntries === 0 || (totalEntries !== 0xffff && parsedEntries !== totalEntries)) {
    return {
      ok: false,
      status: 422,
      code: 'corrupt_zip',
      error: 'Archivo .xlsx inválido: el conteo de entradas ZIP no coincide.',
    }
  }

  const effectiveCompressed = Math.max(totalCompressed, 1)
  const compressionRatio = totalUncompressed / effectiveCompressed

  // Only enforce the > 100:1 compression ratio bomb guard once total uncompressed size > 1 MB
  if (totalUncompressed > MIN_UNCOMPRESSED_RATIO_FLOOR && compressionRatio > MAX_COMPRESSION_RATIO) {
    return {
      ok: false,
      status: 413,
      code: 'zip_bomb_ratio',
      error: `Archivo rechazado por seguridad: razón de compresión excesiva (${Math.round(compressionRatio)}:1, máximo 100:1).`,
    }
  }

  return {
    ok: true,
    stats: {
      entryCount: parsedEntries,
      totalCompressedBytes: totalCompressed,
      totalUncompressedBytes: totalUncompressed,
      compressionRatio,
    },
  }
}

/**
 * Checks that a CSV buffer contains valid text without NUL (0x00) or non-text binary control bytes.
 */
export function validateCsvTextBuffer(buffer: Buffer): { ok: true } | { ok: false; error: string } {
  if (hasOle2Magic(buffer)) {
    return { ok: false, error: LEGACY_XLS_ERROR_MESSAGE }
  }
  if (hasZipLocalMagic(buffer)) {
    return {
      ok: false,
      error: 'El archivo tiene extensión .csv pero contiene datos binarios ZIP. Sube el archivo con extensión .xlsx.',
    }
  }

  // Skip optional UTF-8 BOM
  const start =
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? 3 : 0

  for (let i = start; i < buffer.length; i++) {
    const b = buffer[i]
    if (b === 0x00) {
      return {
        ok: false,
        error: 'El archivo .csv contiene bytes NUL o contenido binario no permitido.',
      }
    }
    // Reject non-text control bytes (allow \t=0x09, \n=0x0A, \r=0x0D)
    if (b < 0x09 || b === 0x0b || b === 0x0c || (b >= 0x0e && b <= 0x1f) || b === 0x7f) {
      return {
        ok: false,
        error: 'El archivo .csv contiene caracteres de control binarios no válidos.',
      }
    }
  }

  return { ok: true }
}

/**
 * Complete pre-flight validation before passing any uploaded buffer to ExcelJS.
 */
export function preflightValidateSpreadsheetBuffer(
  buffer: Buffer,
  fileName: string,
): PreflightResult {
  if (!buffer || buffer.length === 0) {
    return {
      ok: false,
      status: 422,
      code: 'empty_file',
      error: 'El archivo cargado está vacío.',
    }
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      code: 'file_too_large',
      error: 'El archivo supera el tamaño máximo permitido de 10 MB.',
    }
  }

  const ext = getLowerExtension(fileName)

  if (ext === 'xls' || hasOle2Magic(buffer)) {
    return {
      ok: false,
      status: 422,
      code: 'legacy_xls',
      error: LEGACY_XLS_ERROR_MESSAGE,
    }
  }

  if (ext !== 'xlsx' && ext !== 'csv') {
    return {
      ok: false,
      status: 422,
      code: 'unsupported_extension',
      error: 'Formato no soportado. Sube únicamente archivos .xlsx o .csv.',
    }
  }

  if (ext === 'xlsx') {
    if (!hasZipLocalMagic(buffer)) {
      return {
        ok: false,
        status: 422,
        code: 'invalid_magic_bytes',
        error: 'El archivo .xlsx no tiene una firma ZIP válida (PK). Verifica que no esté dañado ni renombrado.',
      }
    }

    const zipCheck = inspectZipCentralDirectory(buffer)
    if (!zipCheck.ok) {
      return zipCheck
    }

    return {
      ok: true,
      extension: 'xlsx',
      zipStats: zipCheck.stats,
    }
  }

  // CSV path
  const csvCheck = validateCsvTextBuffer(buffer)
  if (!csvCheck.ok) {
    return {
      ok: false,
      status: 422,
      code: 'csv_binary_content',
      error: csvCheck.error,
    }
  }

  return {
    ok: true,
    extension: 'csv',
  }
}
