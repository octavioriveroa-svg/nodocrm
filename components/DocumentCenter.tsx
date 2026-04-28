'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from './ui/Button'
import type { Archivo, Profile, TipoArchivo } from '@/lib/types'
import { Paperclip, Upload, Trash2, Search, Filter, FileText, ChevronDown, ChevronRight, FileSignature, X, Plus } from 'lucide-react'

interface DocumentCenterProps {
  archivos: Archivo[]
  proyectoId: string
  currentUser: Profile
  onUploadSuccess: (archivo: Archivo) => void
  onDeleteSuccess: (id: string) => void
}

// These are just suggestions — users can always type their own custom tags
const SUGGESTED_TAGS = ['Factura', 'Plano', 'Legal', 'Técnico', 'Financiero', 'RFC', 'Contrato', 'Propuesta']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function DocumentCenter({ archivos, proyectoId, currentUser, onUploadSuccess, onDeleteSuccess }: DocumentCenterProps) {
  const supabase = createClient()
  
  // State for the upload modal
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadTags, setUploadTags] = useState<string[]>([])
  const [uploadTipo, setUploadTipo] = useState<TipoArchivo>('documento_general')
  const [isUploading, setIsUploading] = useState(false)
  const [customTagInput, setCustomTagInput] = useState('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State for filtering
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // State for Proposal/Contract history expansion
  const [showProposalHistory, setShowProposalHistory] = useState(false)
  const [showContractHistory, setShowContractHistory] = useState(false)

  const isAdmin = currentUser.rol === 'nodo_admin'
  const isAnalista = currentUser.rol === 'nodo_analista'
  const isEpcista = currentUser.rol === 'epc'

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este archivo? Esta acción no se puede deshacer.')) return
    const { error } = await supabase.from('archivos').delete().eq('id', id)
    if (error) {
      console.error('Delete error:', error)
      alert('Error al eliminar: ' + error.message)
    } else {
      onDeleteSuccess(id)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0])
      setShowUpload(true)
    }
  }

  function triggerSpecialUpload(tipo: TipoArchivo) {
    setUploadTipo(tipo)
    fileInputRef.current?.click()
  }

  function triggerGeneralUpload() {
    setUploadTipo('documento_general')
    fileInputRef.current?.click()
  }

  function toggleTagSelection(tag: string) {
    if (uploadTags.includes(tag)) {
      setUploadTags(uploadTags.filter(t => t !== tag))
    } else {
      setUploadTags([...uploadTags, tag])
    }
  }

  function addCustomTag() {
    const tag = customTagInput.trim()
    if (tag && !uploadTags.includes(tag)) {
      setUploadTags([...uploadTags, tag])
    }
    setCustomTagInput('')
  }

  function removeTag(tag: string) {
    setUploadTags(uploadTags.filter(t => t !== tag))
  }

  async function uploadSelectedFile() {
    if (!uploadFile) return
    setIsUploading(true)

    const ext = uploadFile.name.split('.').pop()
    const path = `${proyectoId}/${Date.now()}.${ext}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('archivos-proyectos')
      .upload(path, uploadFile)

    if (uploadError || !uploadData) {
      alert('Error al subir archivo: ' + uploadError?.message)
      setIsUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('archivos-proyectos').getPublicUrl(path)

    const { data: archivoData, error: dbError } = await supabase.from('archivos').insert({
      proyecto_id: proyectoId,
      autor_id: currentUser.id,
      nombre: uploadFile.name,
      url: publicUrl,
      tipo: uploadTipo,
      descripcion: uploadDesc.trim() || null,
      tags: uploadTags,
    }).select('*, profiles(*)').single()

    if (dbError) {
      alert('Error al guardar en base de datos: ' + dbError.message)
    } else if (archivoData) {
      onUploadSuccess(archivoData as Archivo)
      setShowUpload(false)
      setUploadFile(null)
      setUploadDesc('')
      setUploadTags([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    
    setIsUploading(false)
  }

  // Derived datasets
  const propuestas = archivos.filter(a => a.tipo === 'propuesta' || a.tipo === 'propuesta_analista').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const contratos = archivos.filter(a => a.tipo === 'machote_contrato').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  
  const activeProposal = propuestas.length > 0 ? propuestas[0] : null
  const proposalHistory = propuestas.length > 1 ? propuestas.slice(1) : []

  const activeContract = contratos.length > 0 ? contratos[0] : null
  const contractHistory = contratos.length > 1 ? contratos.slice(1) : []

  const generalFiles = archivos.filter(a => a.tipo !== 'propuesta' && a.tipo !== 'propuesta_analista' && a.tipo !== 'machote_contrato')
  
  const filteredFiles = generalFiles.filter(a => {
    if (search && !a.nombre.toLowerCase().includes(search.toLowerCase()) && !(a.descripcion || '').toLowerCase().includes(search.toLowerCase())) return false
    if (selectedTag && !(a.tags || []).includes(selectedTag)) return false
    return true
  })

  // Extract all unique tags used in general files for filtering
  const allUsedTags = Array.from(new Set(generalFiles.flatMap(a => a.tags || [])))

  function ArchivoRow({ a }: { a: Archivo }) {
    const canDelete = isAdmin || a.autor_id === currentUser.id
    return (
      <div className="flex items-start gap-4 p-4 border-b border-borde/50 hover:bg-gray-50/50 transition-colors group">
        <div className="p-2 bg-gray-100 text-gray-500 rounded-lg mt-1">
          <Paperclip size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-bold text-principal hover:underline truncate">
              {a.nombre}
            </a>
            {(a.tags || []).map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[10px] font-bold uppercase rounded-md">
                {tag}
              </span>
            ))}
          </div>
          {a.descripcion && (
            <p className="text-sm text-gray-600 mb-2">{a.descripcion}</p>
          )}
          <div className="text-xs text-gray-400 font-medium">
            Subido el {formatDate(a.created_at)} por {(a.profiles as Profile | undefined)?.nombre ?? 'Usuario'}
          </div>
        </div>
        {canDelete && (
          <button onClick={() => handleDelete(a.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    )
  }

  function SpecialFileCard({ a, title, icon: Icon, onUploadNew, canUpload }: { a: Archivo | null, title: string, icon: any, onUploadNew: () => void, canUpload: boolean }) {
    return (
      <div className="border border-borde rounded-xl overflow-hidden bg-white shadow-sm flex flex-col h-full">
        <div className="bg-gray-50 border-b border-borde px-4 py-3 flex items-center justify-between">
          <h3 className="font-bold text-sm text-principal flex items-center gap-2">
            <Icon size={16} className="text-acento" /> {title}
          </h3>
          {canUpload && (
            <Button variant="outline" size="sm" onClick={onUploadNew} className="h-7 text-xs px-2">
              <Upload size={12} className="mr-1" /> Nueva versión
            </Button>
          )}
        </div>
        <div className="p-5 flex-1 flex flex-col justify-center">
          {a ? (
            <div>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-bold text-lg text-principal hover:underline line-clamp-2 mb-2">
                {a.nombre}
              </a>
              {a.descripcion && <p className="text-sm text-gray-600 mb-4 line-clamp-2">{a.descripcion}</p>}
              
              <div className="flex items-center justify-between mt-auto">
                <div className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">V. Actual</span> • {formatDate(a.created_at)}
                </div>
                {(isAdmin || a.autor_id === currentUser.id) && (
                  <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700 p-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400">
              <p className="text-sm">Aún no hay {title.toLowerCase()}.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />

      {/* Featured Documents Section */}
      <div>
        <h2 className="text-lg font-black mb-4">Documentos Oficiales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SpecialFileCard 
            title="Propuesta Comercial" 
            icon={FileText} 
            a={activeProposal} 
            canUpload={isAnalista || isAdmin}
            onUploadNew={() => triggerSpecialUpload('propuesta')}
          />
          <SpecialFileCard 
            title="Contrato (Machote)" 
            icon={FileSignature} 
            a={activeContract} 
            canUpload={isAnalista || isAdmin}
            onUploadNew={() => triggerSpecialUpload('machote_contrato')}
          />
        </div>

        {/* History Toggles */}
        <div className="flex gap-4 mt-3">
          {proposalHistory.length > 0 && (
            <button onClick={() => setShowProposalHistory(!showProposalHistory)} className="text-xs font-semibold text-gray-500 hover:text-principal flex items-center gap-1">
              {showProposalHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />} 
              Historial Propuestas ({proposalHistory.length})
            </button>
          )}
          {contractHistory.length > 0 && (
            <button onClick={() => setShowContractHistory(!showContractHistory)} className="text-xs font-semibold text-gray-500 hover:text-principal flex items-center gap-1">
              {showContractHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />} 
              Historial Contratos ({contractHistory.length})
            </button>
          )}
        </div>

        {/* History Lists */}
        {showProposalHistory && proposalHistory.length > 0 && (
          <div className="mt-3 bg-gray-50 border border-borde rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-100 border-b border-borde text-xs font-bold text-gray-600">Versiones Anteriores - Propuesta</div>
            {proposalHistory.map(a => <ArchivoRow key={a.id} a={a} />)}
          </div>
        )}
        {showContractHistory && contractHistory.length > 0 && (
          <div className="mt-3 bg-gray-50 border border-borde rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-100 border-b border-borde text-xs font-bold text-gray-600">Versiones Anteriores - Contrato</div>
            {contractHistory.map(a => <ArchivoRow key={a.id} a={a} />)}
          </div>
        )}
      </div>

      {/* General Document Center */}
      <div className="bg-white border border-borde rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-borde flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-principal">Centro de Documentos</h2>
            <p className="text-sm text-gray-500">Recibos CFE, evidencias, planos y anexos.</p>
          </div>
          <Button onClick={triggerGeneralUpload}>
            <Upload size={16} className="mr-2" /> Subir archivo
          </Button>
        </div>
        
        <div className="p-4 border-b border-borde bg-gray-50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o descripción..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-borde rounded-lg focus:ring-2 focus:ring-acento/30 focus:border-acento transition-all outline-none"
            />
          </div>
          {allUsedTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Filter size={14} className="text-gray-400 shrink-0" />
              <button 
                onClick={() => setSelectedTag(null)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md shrink-0 transition-colors ${!selectedTag ? 'bg-principal text-acento' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >
                Todos
              </button>
              {allUsedTags.map(tag => (
                <button 
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md shrink-0 transition-colors uppercase ${selectedTag === tag ? 'bg-principal text-acento' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {filteredFiles.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <FileText size={32} className="mx-auto mb-3 opacity-20" />
              <p>No se encontraron documentos.</p>
            </div>
          ) : (
            filteredFiles.map(a => <ArchivoRow key={a.id} a={a} />)
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && uploadFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-borde">
              <h3 className="font-bold text-lg text-principal">Subir Documento</h3>
              <p className="text-sm text-gray-500 mt-1">{uploadFile.name}</p>
            </div>
            
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-bold mb-1.5 text-gray-700">Descripción (Opcional)</label>
                <textarea 
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  placeholder="Ej. Recibo CFE de Planta Monterrey - Mes Agosto"
                  rows={3}
                  className="w-full border border-borde rounded-lg p-3 text-sm focus:ring-2 focus:ring-acento/30 focus:border-acento transition-all outline-none resize-none"
                />
              </div>

              {uploadTipo === 'documento_general' && (
                <div>
                  <label className="block text-sm font-bold mb-1.5 text-gray-700">Etiquetas / Tags</label>
                  
                  {/* Selected tags */}
                  {uploadTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {uploadTags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-principal text-acento text-xs font-bold rounded-md">
                          {tag}
                          <button onClick={() => removeTag(tag)} className="hover:opacity-70 transition-opacity">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Custom tag input */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={customTagInput}
                      onChange={e => setCustomTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
                      placeholder="Escribe una etiqueta y presiona Enter…"
                      className="flex-1 border border-borde rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-acento/30 focus:border-acento transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={addCustomTag}
                      disabled={!customTagInput.trim()}
                      className="px-3 py-2 bg-gray-100 border border-borde rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Suggestions */}
                  {(() => {
                    // Merge preset suggestions with tags already used in this project
                    const projectTags = Array.from(new Set(archivos.flatMap(a => a.tags || [])))
                    const allSuggestions = Array.from(new Set([...SUGGESTED_TAGS, ...projectTags]))
                    const available = allSuggestions.filter(t => !uploadTags.includes(t))
                    if (available.length === 0) return null
                    return (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Sugerencias</p>
                        <div className="flex flex-wrap gap-1.5">
                          {available.map(tag => (
                            <button
                              key={tag}
                              onClick={() => toggleTagSelection(tag)}
                              className="px-2.5 py-1 text-xs font-medium rounded-md transition-colors border border-dashed border-gray-300 text-gray-500 hover:border-principal hover:text-principal hover:bg-gray-50"
                            >
                              + {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-borde bg-gray-50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowUpload(false); setUploadFile(null) }} disabled={isUploading}>
                Cancelar
              </Button>
              <Button onClick={uploadSelectedFile} disabled={isUploading}>
                {isUploading ? 'Subiendo...' : 'Guardar Documento'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
