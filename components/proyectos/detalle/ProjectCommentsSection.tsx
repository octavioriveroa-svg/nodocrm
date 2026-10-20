'use client'

import React, { useState } from 'react'
import { Send, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Seccion, formatDateTime } from './common'
import type { Comentario, Profile } from '@/lib/types'

interface Props {
  comentarios: Comentario[]
  onEnviarComentario: (contenido: string) => Promise<{ success: boolean; error?: string }>
}

export default function ProjectCommentsSection({
  comentarios,
  onEnviarComentario,
}: Props) {
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!nuevoComentario.trim() || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const res = await onEnviarComentario(nuevoComentario.trim())
      if (!res.success) {
        setError(res.error || 'Error al enviar comentario.')
      } else {
        setNuevoComentario('')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado al enviar comentario.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Seccion title="Comentarios internos">
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-4 max-h-80 overflow-y-auto">
        {comentarios.length === 0 && (
          <p className="text-sm text-gray-400">Sin comentarios aún.</p>
        )}
        {comentarios.map((c) => {
          const profile = c.profiles as Profile | undefined
          const nombre = profile?.nombre ?? 'Usuario'
          const initial = nombre.charAt(0).toUpperCase()

          return (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-principal text-acento">
                {initial}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-principal">{nombre}</span>
                  <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-gray-700">{c.contenido}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <textarea
          value={nuevoComentario}
          onChange={(e) => setNuevoComentario(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Escribe un comentario… (Enter para enviar)"
          rows={2}
          className="flex-1 rounded-xl border border-borde p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-principal bg-white"
        />
        <Button
          onClick={handleSend}
          disabled={enviando || !nuevoComentario.trim()}
          className="self-end"
        >
          <Send size={16} />
        </Button>
      </div>
    </Seccion>
  )
}
