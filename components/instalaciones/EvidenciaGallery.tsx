'use client'

import React from 'react'
import { FileText, StickyNote, Eye, User, Maximize2 } from 'lucide-react'
import type { Profile, InstalacionEvidencia } from '@/lib/types'
import CommentThread from '@/components/plan/CommentThread'

export interface EvidenciaGalleryProps {
  items: InstalacionEvidencia[]
  proyectoId: string
  currentUser: Profile
  onSelectPhoto: (url: string) => void
  formatDate: (dateStr: string | null | undefined) => string
  renderActions?: (ev: InstalacionEvidencia) => React.ReactNode
}

/**
 * Reusable evidence gallery grid supporting photos, documents, notes, and inline comment threads.
 */
export function EvidenciaGallery({
  items,
  proyectoId,
  currentUser,
  onSelectPhoto,
  formatDate,
  renderActions,
}: EvidenciaGalleryProps) {
  if (!items || items.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 py-3">
      {items.map(ev => (
        <div
          key={ev.id}
          className="flex flex-col border border-gray-150 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow group relative"
        >
          {/* Media Content */}
          <div className="relative aspect-[4/3] bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden">
            {ev.tipo === 'foto' && ev.url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ev.url}
                  alt={ev.titulo}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <button
                  type="button"
                  onClick={() => onSelectPhoto(ev.url!)}
                  aria-label="Ampliar fotografía"
                  className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Maximize2 size={14} />
                </button>
              </>
            ) : ev.tipo === 'documento' && ev.url ? (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <FileText size={48} className="text-acento" />
                <a
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-acento hover:underline flex items-center gap-1.5"
                >
                  <Eye size={12} /> Ver documento
                </a>
              </div>
            ) : (
              <div className="p-4 w-full h-full flex flex-col justify-between bg-amber-50/30 text-amber-900">
                <StickyNote size={32} className="text-amber-500" />
                <p className="text-xs italic line-clamp-4 leading-relaxed font-medium">
                  &quot;{ev.descripcion}&quot;
                </p>
                <div />
              </div>
            )}

            {renderActions ? renderActions(ev) : null}
          </div>

          {/* Metadata & Title */}
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-principal line-clamp-1 mb-1" title={ev.titulo}>
                {ev.titulo}
              </h4>
              {ev.tipo !== 'nota' && ev.descripcion && (
                <p className="text-xs text-gray-600 line-clamp-2 mb-3 leading-relaxed">
                  {ev.descripcion}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between mt-auto">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <User size={12} />
                <span className="truncate max-w-[80px]" title={ev.autor?.nombre ?? 'Usuario'}>
                  {ev.autor?.nombre ?? 'Usuario'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-medium">
                  {formatDate(ev.created_at)}
                </span>

                <CommentThread
                  proyectoId={proyectoId}
                  targetType="evidencia"
                  targetId={ev.id}
                  currentUser={currentUser}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
