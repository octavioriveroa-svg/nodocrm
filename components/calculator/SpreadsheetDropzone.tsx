'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Loader2, Upload } from 'lucide-react'
import { validateSpreadsheetFileClient } from '@/lib/calculator/zip-preflight'

export interface SpreadsheetDropzoneProps {
  uploading?: boolean
  disabled?: boolean
  error?: string | null
  title: string
  uploadingLabel?: string
  description: string
  compact?: boolean
  onFileSelected: (file: File) => void
  onValidationError: (message: string) => void
}

export function SpreadsheetDropzone({
  uploading = false,
  disabled = false,
  error = null,
  title,
  uploadingLabel = 'Analizando archivo...',
  description,
  compact = false,
  onFileSelected,
  onValidationError,
}: SpreadsheetDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  function handleCandidate(file: File) {
    const err = validateSpreadsheetFileClient(file)
    if (err) {
      onValidationError(err)
      return
    }
    onFileSelected(file)
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading) {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!disabled && !uploading) setDragActive(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!disabled && !uploading) setDragActive(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(false)
          if (disabled || uploading) return
          const dropped = e.dataTransfer.files?.[0]
          if (dropped) handleCandidate(dropped)
        }}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-all ${
          compact ? 'p-6' : 'p-10'
        } ${
          disabled || uploading
            ? 'border-linea bg-fondo/30 opacity-70 cursor-not-allowed'
            : dragActive
              ? 'border-acento bg-acento/10 scale-[0.99] cursor-pointer'
              : 'border-linea bg-fondo/40 hover:border-principal/40 hover:bg-fondo cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const chosen = e.target.files?.[0]
            e.target.value = ''
            if (chosen) handleCandidate(chosen)
          }}
        />
        <div className="w-11 h-11 rounded-2xl bg-principal text-acento flex items-center justify-center mb-3 shadow-sm">
          {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
        </div>
        <p className="text-sm font-bold text-principal text-center">
          {uploading ? uploadingLabel : title}
        </p>
        <p className="text-xs text-texto-suave mt-1 text-center max-w-lg">
          {description}
        </p>
      </div>
    </div>
  )
}

export default SpreadsheetDropzone
