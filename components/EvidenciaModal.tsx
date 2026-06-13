'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, FileText, Image as ImageIcon, FileCheck, Loader2 } from 'lucide-react'
import type { Profile, InstalacionEvidencia, TipoEvidencia } from '@/lib/types'

interface EvidenciaModalProps {
  isOpen: boolean
  onClose: () => void
  proyectoId: string
  targetType: 'fase' | 'actividad' | 'tarea'
  targetId: string
  targetName: string
  currentUser: Profile
  onSuccess: (evidencia: InstalacionEvidencia) => void
}

export default function EvidenciaModal({
  isOpen,
  onClose,
  proyectoId,
  targetType,
  targetId,
  targetName,
  currentUser,
  onSuccess,
}: EvidenciaModalProps) {
  const supabase = createClient()
  
  const [tipo, setTipo] = useState<TipoEvidencia>('foto')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  function handleDrag(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) {
      setError('El título es requerido')
      return
    }
    if (tipo !== 'nota' && !file) {
      setError('Debes seleccionar un archivo para evidencias de tipo foto o documento')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      let publicUrl: string | null = null

      if (file && tipo !== 'nota') {
        // Limit to 10MB
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('El tamaño del archivo supera el límite de 10MB')
        }

        const fileExt = file.name.split('.').pop()
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9]/g, '_')
        const path = `${proyectoId}/${targetId}/${Date.now()}_${cleanFileName}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('evidencias-instalacion')
          .upload(path, file)

        if (uploadError) {
          throw new Error(`Error al subir archivo: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage
          .from('evidencias-instalacion')
          .getPublicUrl(path)

        if (!urlData || !urlData.publicUrl) {
          throw new Error('No se pudo generar la URL pública del archivo')
        }

        publicUrl = urlData.publicUrl
      }

      const payload: Record<string, string | null | TipoEvidencia | undefined> = {
        proyecto_id: proyectoId,
        tipo,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        url: publicUrl,
        autor_id: currentUser.id,
        fase_id: targetType === 'fase' ? targetId : null,
        actividad_id: targetType === 'actividad' ? targetId : null,
        tarea_id: targetType === 'tarea' ? targetId : null,
      }

      const { data, error: dbError } = await supabase
        .from('instalacion_evidencias')
        .insert(payload)
        .select('*, autor:profiles(nombre)')
        .single()

      if (dbError) {
        throw dbError
      }

      onSuccess(data as InstalacionEvidencia)
      onClose()

      // Reset form
      setTitulo('')
      setDescripcion('')
      setFile(null)
      setTipo('foto')
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden bg-white border border-gray-100 shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-principal">Sube Evidencia</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Agrega avances a: <span className="font-bold text-acento">{targetName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={isUploading}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {/* Tipo de Evidencia */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Tipo de Avance
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['foto', 'documento', 'nota'] as TipoEvidencia[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTipo(t)
                    setFile(null)
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 px-3 border-2 rounded-xl transition-all ${
                    tipo === t
                      ? 'border-acento bg-acento/5 text-acento font-bold scale-[1.02]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  disabled={isUploading}
                >
                  {t === 'foto' && <ImageIcon size={20} className="mb-1" />}
                  {t === 'documento' && <FileText size={20} className="mb-1" />}
                  {t === 'nota' && <FileCheck size={20} className="mb-1" />}
                  <span className="text-xs capitalize">{t === 'foto' ? 'Fotografía' : t === 'documento' ? 'Documento' : 'Nota/Bitácora'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label htmlFor="evidencia-titulo" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Título del Avance
            </label>
            <input
              id="evidencia-titulo"
              type="text"
              required
              placeholder="Ej. Cimentaciones completadas, Estructuras recibidas, etc."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-acento focus:outline-none transition-all placeholder:text-gray-400 text-sm"
              disabled={isUploading}
            />
          </div>

          {/* Descripción */}
          <div>
            <label htmlFor="evidencia-descripcion" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Descripción / Notas de Obra (Opcional)
            </label>
            <textarea
              id="evidencia-descripcion"
              rows={3}
              placeholder="Describe detalladamente el trabajo realizado o las observaciones..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-acento focus:outline-none transition-all placeholder:text-gray-400 text-sm resize-none"
              disabled={isUploading}
            />
          </div>

          {/* Drag & Drop File Zone (only if not nota) */}
          {tipo !== 'nota' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Archivo de Evidencia
              </label>
              
              {file ? (
                <div className="flex items-center justify-between p-3 border-2 border-dashed border-acento/50 bg-acento/5 rounded-xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 bg-acento/10 text-acento rounded-lg shrink-0">
                      {tipo === 'foto' ? <ImageIcon size={18} /> : <FileText size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-principal truncate">{file.name}</p>
                      <p className="text-[10px] text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    disabled={isUploading}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    dragActive
                      ? 'border-acento bg-acento/5 scale-[0.99]'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={tipo === 'foto' ? 'image/*' : 'image/*,.pdf'}
                    onChange={handleFileSelect}
                    disabled={isUploading}
                  />
                  <div className="p-2.5 bg-gray-100 text-gray-400 rounded-full mb-2">
                    <Upload size={20} />
                  </div>
                  <p className="text-sm font-bold text-principal">Arrastra o haz clic para subir</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Formatos: {tipo === 'foto' ? 'Imágenes (JPG, PNG, WEBP)' : 'Imágenes o PDF'}. Máx: 10MB.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              disabled={isUploading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-acento rounded-xl hover:bg-acento-claro transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-acento/10"
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Subiendo...
                </>
              ) : (
                'Subir Evidencia'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
