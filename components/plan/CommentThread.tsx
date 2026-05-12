/* eslint-disable */
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { PlanComentario, CommentTargetType, Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import {
  MessageCircle, X, Send, CheckCircle2, Trash2,
  ChevronDown, Reply, Loader2, CornerDownRight,
} from 'lucide-react'

// ── Role badge colors ─────────────────────────────────────────
const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  epc:            { bg: '#D7FF2F', text: '#000', label: 'EPC' },
  nodo_admin:     { bg: '#1a1a2e', text: '#fff', label: 'Admin' },
  nodo_analista:  { bg: '#4F46E5', text: '#fff', label: 'Analista' },
  financiero:     { bg: '#059669', text: '#fff', label: 'Financiero' },
  cliente_final:  { bg: '#0891B2', text: '#fff', label: 'Cliente' },
}

function roleBadge(rol: string) {
  const cfg = ROLE_COLORS[rol] || { bg: '#9CA3AF', text: '#fff', label: rol }
  return cfg
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `hace ${days}d`
  return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

// ── Target column mapping ─────────────────────────────────────
const TARGET_COLUMN: Record<CommentTargetType, string> = {
  fase: 'fase_id',
  actividad: 'actividad_id',
  tarea: 'tarea_id',
  subtarea: 'subtarea_id',
  hito: 'hito_id',
}

// ── Props ─────────────────────────────────────────────────────
interface Props {
  proyectoId: string
  targetType: CommentTargetType
  targetId: string
  currentUser: Profile
  commentCount?: number
}

export default function CommentThread({ proyectoId, targetType, targetId, currentUser, commentCount = 0 }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<PlanComentario[]>([])
  const [loading, setLoading] = useState(false)
  const [newText, setNewText] = useState('')
  const [sending, setSending] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [localCount, setLocalCount] = useState(commentCount)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── Fetch comments ──────────────────────────────────────────
  const fetchComments = useCallback(async () => {
    setLoading(true)
    const col = TARGET_COLUMN[targetType]
    const { data } = await supabase
      .from('plan_comentarios')
      .select('*, autor:profiles!plan_comentarios_autor_id_fkey(id, nombre, empresa, rol)')
      .eq(col, targetId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })

    if (data) {
      // Fetch replies for each top-level comment
      const withReplies: PlanComentario[] = []
      for (const c of data) {
        const { data: replies } = await supabase
          .from('plan_comentarios')
          .select('*, autor:profiles!plan_comentarios_autor_id_fkey(id, nombre, empresa, rol)')
          .eq('parent_id', c.id)
          .order('created_at', { ascending: true })
        withReplies.push({ ...c, respuestas: (replies || []) as PlanComentario[] } as PlanComentario)
      }
      setComments(withReplies)
      const unresolvedCount = withReplies.filter(c => !c.resuelto).length
      setLocalCount(unresolvedCount)
    }
    setLoading(false)
  }, [targetType, targetId, supabase])

  // Load when opened
  useEffect(() => {
    if (open) fetchComments()
  }, [open, fetchComments])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments])

  // ── Post comment ────────────────────────────────────────────
  async function handlePost() {
    if (!newText.trim()) return
    setSending(true)
    const col = TARGET_COLUMN[targetType]
    const payload: Record<string, unknown> = {
      proyecto_id: proyectoId,
      [col]: targetId,
      autor_id: currentUser.id,
      contenido: newText.trim(),
    }
    const { data } = await supabase.from('plan_comentarios').insert(payload).select('*, autor:profiles!plan_comentarios_autor_id_fkey(id, nombre, empresa, rol)').single()
    if (data) {
      setComments(prev => [...prev, { ...data, respuestas: [] } as PlanComentario])
      setLocalCount(prev => prev + 1)
      setNewText('')
      // Trigger notification (fire-and-forget)
      createNotification(data as PlanComentario, null)
    }
    setSending(false)
  }

  // ── Reply ───────────────────────────────────────────────────
  async function handleReply(parentId: string) {
    if (!replyText.trim()) return
    setSending(true)
    const col = TARGET_COLUMN[targetType]
    const payload: Record<string, unknown> = {
      proyecto_id: proyectoId,
      [col]: targetId,
      parent_id: parentId,
      autor_id: currentUser.id,
      contenido: replyText.trim(),
    }
    const { data } = await supabase.from('plan_comentarios').insert(payload).select('*, autor:profiles!plan_comentarios_autor_id_fkey(id, nombre, empresa, rol)').single()
    if (data) {
      setComments(prev => prev.map(c =>
        c.id === parentId
          ? { ...c, respuestas: [...(c.respuestas || []), data as PlanComentario] }
          : c
      ))
      setReplyText('')
      setReplyingTo(null)
      // Trigger notification (fire-and-forget)
      createNotification(data as PlanComentario, parentId)
    }
    setSending(false)
  }

  // ── Resolve ─────────────────────────────────────────────────
  async function handleResolve(commentId: string) {
    const c = comments.find(x => x.id === commentId)
    if (!c) return
    const newVal = !c.resuelto
    await supabase.from('plan_comentarios').update({
      resuelto: newVal,
      resuelto_por: newVal ? currentUser.id : null,
    }).eq('id', commentId)
    setComments(prev => prev.map(x => x.id === commentId ? { ...x, resuelto: newVal, resuelto_por: newVal ? currentUser.id : null } : x))
    setLocalCount(prev => newVal ? prev - 1 : prev + 1)
  }

  // ── Delete ──────────────────────────────────────────────────
  async function handleDelete(commentId: string, parentId?: string | null) {
    await supabase.from('plan_comentarios').delete().eq('id', commentId)
    if (parentId) {
      setComments(prev => prev.map(c =>
        c.id === parentId
          ? { ...c, respuestas: (c.respuestas || []).filter(r => r.id !== commentId) }
          : c
      ))
    } else {
      setComments(prev => prev.filter(c => c.id !== commentId))
      setLocalCount(prev => Math.max(0, prev - 1))
    }
  }

  // ── Create notification (fire-and-forget, no await) ─────────
  function createNotification(comment: PlanComentario, parentId: string | null) {
    // Determine the portal prefix for the deep link
    const rolePrefixMap: Record<string, string> = {
      epc: '/epc', nodo_admin: '/admin', nodo_analista: '/analista',
      financiero: '/financiero', cliente_final: '/cliente',
    }
    const prefix = rolePrefixMap[currentUser.rol] || '/epc'
    const enlace = `${prefix}/proyectos/${proyectoId}/plan`
    const autorName = currentUser.nombre || 'Usuario'

    // Notify participants — but we do this from the client by fetching relevant user IDs
    // In a production app, this would be a server action. For now, we notify the project stakeholders.
    supabase
      .from('proyectos')
      .select('epcista_id, cliente_id, financiero_id')
      .eq('id', proyectoId)
      .single()
      .then(({ data: proyecto }) => {
        if (!proyecto) return
        const recipientIds = new Set<string>()

        // Add project stakeholders
        if (proyecto.epcista_id) recipientIds.add(proyecto.epcista_id)
        if (proyecto.cliente_id) recipientIds.add(proyecto.cliente_id)
        if (proyecto.financiero_id) recipientIds.add(proyecto.financiero_id)

        // If replying, also notify the parent comment author
        if (parentId) {
          const parent = comments.find(c => c.id === parentId)
          if (parent) recipientIds.add(parent.autor_id)
        }

        // Don't notify yourself
        recipientIds.delete(currentUser.id)

        if (recipientIds.size === 0) return

        const tipo = parentId ? 'respuesta' : 'comentario'
        const titulo = parentId
          ? `${autorName} respondió a un comentario`
          : `${autorName} comentó en el plan`
        const mensaje = comment.contenido.length > 120
          ? comment.contenido.slice(0, 120) + '…'
          : comment.contenido

        const notifications = Array.from(recipientIds).map(uid => ({
          usuario_id: uid,
          tipo,
          titulo,
          mensaje,
          enlace,
          proyecto_id: proyectoId,
          comentario_id: comment.id,
        }))

        supabase.from('notificaciones').insert(notifications).then(() => {})
      })
  }

  // ── Can this user resolve? (author or EPC owner or admin) ───
  function canResolve(c: PlanComentario) {
    return c.autor_id === currentUser.id
      || currentUser.rol === 'epc'
      || currentUser.rol === 'nodo_admin'
  }
  function canDelete(c: PlanComentario) {
    return c.autor_id === currentUser.id || currentUser.rol === 'nodo_admin'
  }

  const unresolved = comments.filter(c => !c.resuelto)
  const resolved = comments.filter(c => c.resuelto)

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger button */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={`relative flex items-center gap-0.5 p-1 rounded-md transition-all ${
          open ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
        }`}
        title="Comentarios"
      >
        <MessageCircle size={13} />
        {localCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full leading-none px-0.5">
            {localCount}
          </span>
        )}
      </button>

      {/* Comment panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-[60] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <MessageCircle size={14} className="text-blue-500" />
              <span className="text-sm font-bold text-gray-800">Comentarios</span>
              {unresolved.length > 0 && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                  {unresolved.length}
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-0.5">
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div ref={scrollRef} className="max-h-72 overflow-y-auto px-3 py-2 space-y-1">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={18} className="animate-spin text-gray-300" />
              </div>
            ) : unresolved.length === 0 && resolved.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Sin comentarios aún. Sé el primero.</p>
            ) : (
              <>
                {/* Unresolved comments */}
                {unresolved.map(c => (
                  <CommentBubble
                    key={c.id}
                    comment={c}
                    currentUser={currentUser}
                    canResolve={canResolve(c)}
                    canDelete={canDelete(c)}
                    replyingTo={replyingTo}
                    replyText={replyText}
                    sending={sending}
                    onReplyClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                    onReplyTextChange={setReplyText}
                    onReplySubmit={() => handleReply(c.id)}
                    onResolve={() => handleResolve(c.id)}
                    onDelete={(id, pid) => handleDelete(id, pid)}
                  />
                ))}

                {/* Resolved toggle */}
                {resolved.length > 0 && (
                  <button
                    onClick={() => setShowResolved(!showResolved)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-600 w-full py-2 transition-colors"
                  >
                    <ChevronDown size={12} className={`transition-transform ${showResolved ? '' : '-rotate-90'}`} />
                    Ver resueltos ({resolved.length})
                  </button>
                )}

                {showResolved && resolved.map(c => (
                  <CommentBubble
                    key={c.id}
                    comment={c}
                    currentUser={currentUser}
                    canResolve={canResolve(c)}
                    canDelete={canDelete(c)}
                    replyingTo={replyingTo}
                    replyText={replyText}
                    sending={sending}
                    onReplyClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                    onReplyTextChange={setReplyText}
                    onReplySubmit={() => handleReply(c.id)}
                    onResolve={() => handleResolve(c.id)}
                    onDelete={(id, pid) => handleDelete(id, pid)}
                    isResolved
                  />
                ))}
              </>
            )}
          </div>

          {/* New comment input */}
          <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50/30">
            <div className="flex items-end gap-2">
              <textarea
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost() }
                }}
                placeholder="Escribe un comentario..."
                rows={1}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 max-h-20 overflow-y-auto"
              />
              <button
                onClick={handlePost}
                disabled={sending || !newText.trim()}
                className="flex items-center justify-center w-8 h-8 bg-principal text-acento rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              >
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Single Comment Bubble ─────────────────────────────────────
interface BubbleProps {
  comment: PlanComentario
  currentUser: Profile
  canResolve: boolean
  canDelete: boolean
  replyingTo: string | null
  replyText: string
  sending: boolean
  onReplyClick: () => void
  onReplyTextChange: (val: string) => void
  onReplySubmit: () => void
  onResolve: () => void
  onDelete: (id: string, parentId?: string | null) => void
  isResolved?: boolean
}

function CommentBubble({
  comment, currentUser, canResolve, canDelete,
  replyingTo, replyText, sending,
  onReplyClick, onReplyTextChange, onReplySubmit,
  onResolve, onDelete, isResolved,
}: BubbleProps) {
  const autor = comment.autor as Profile | undefined
  const badge = roleBadge(autor?.rol || 'epc')
  const isOwn = comment.autor_id === currentUser.id

  return (
    <div className={`rounded-lg transition-all ${isResolved ? 'opacity-60' : ''}`}>
      {/* Main comment */}
      <div className={`group px-2.5 py-2 rounded-lg ${isOwn ? 'bg-blue-50/60' : 'bg-gray-50/60'} hover:bg-gray-100/60 transition-colors`}>
        {/* Author line */}
        <div className="flex items-center gap-1.5 mb-1">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
            style={{ backgroundColor: badge.bg, color: badge.text }}
          >
            {(autor?.nombre || '?')[0].toUpperCase()}
          </div>
          <span className="text-[11px] font-bold text-gray-800 truncate">{autor?.nombre || 'Usuario'}</span>
          <span
            className="text-[9px] font-bold px-1 py-0.5 rounded"
            style={{ backgroundColor: badge.bg + '20', color: badge.text === '#fff' ? badge.bg : badge.text }}
          >
            {badge.label}
          </span>
          <span className="text-[9px] text-gray-400 ml-auto flex-shrink-0">{timeAgo(comment.created_at)}</span>
        </div>

        {/* Text */}
        <p className="text-xs text-gray-700 whitespace-pre-wrap break-words leading-relaxed pl-6">
          {comment.contenido}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-1.5 pl-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onReplyClick} className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-blue-500">
            <Reply size={10} /> Responder
          </button>
          {canResolve && (
            <button onClick={onResolve} className={`flex items-center gap-0.5 text-[10px] ${isResolved ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-green-500'}`}>
              <CheckCircle2 size={10} /> {isResolved ? 'Reabrir' : 'Resolver'}
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(comment.id, comment.parent_id)} className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-red-500">
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {(comment.respuestas || []).length > 0 && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l-2 border-gray-200 pl-2">
          {(comment.respuestas || []).map(r => {
            const rAutor = r.autor as Profile | undefined
            const rBadge = roleBadge(rAutor?.rol || 'epc')
            const rIsOwn = r.autor_id === currentUser.id
            return (
              <div key={r.id} className={`group px-2 py-1.5 rounded-md ${rIsOwn ? 'bg-blue-50/40' : 'bg-gray-50/40'} hover:bg-gray-100/60 transition-colors`}>
                <div className="flex items-center gap-1 mb-0.5">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                    style={{ backgroundColor: rBadge.bg, color: rBadge.text }}
                  >
                    {(rAutor?.nombre || '?')[0].toUpperCase()}
                  </div>
                  <span className="text-[10px] font-bold text-gray-700 truncate">{rAutor?.nombre || 'Usuario'}</span>
                  <span className="text-[8px] text-gray-400 ml-auto">{timeAgo(r.created_at)}</span>
                </div>
                <p className="text-[11px] text-gray-600 whitespace-pre-wrap break-words pl-5">{r.contenido}</p>
                {(r.autor_id === currentUser.id || currentUser.rol === 'nodo_admin') && (
                  <div className="pl-5 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                    <button onClick={() => onDelete(r.id, comment.id)} className="text-[10px] text-gray-400 hover:text-red-500">
                      <Trash2 size={9} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reply input */}
      {replyingTo === comment.id && (
        <div className="ml-5 mt-1 flex items-end gap-1.5 border-l-2 border-blue-200 pl-2">
          <CornerDownRight size={12} className="text-blue-300 flex-shrink-0 mb-1.5" />
          <textarea
            value={replyText}
            onChange={e => onReplyTextChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onReplySubmit() }
              if (e.key === 'Escape') onReplyClick()
            }}
            placeholder="Escribe una respuesta..."
            rows={1}
            autoFocus
            className="flex-1 text-[11px] border border-gray-200 rounded-md px-2 py-1.5 resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 max-h-16 overflow-y-auto"
          />
          <button
            onClick={onReplySubmit}
            disabled={sending || !replyText.trim()}
            className="w-6 h-6 flex items-center justify-center bg-principal text-acento rounded-md disabled:opacity-30 flex-shrink-0 mb-0.5"
          >
            {sending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
          </button>
        </div>
      )}
    </div>
  )
}
