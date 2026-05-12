'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, X, Check, MessageCircle, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Notificacion } from '@/lib/types'

interface TopBarProps {
  nombre: string
  userId?: string
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

export default function TopBar({ nombre, userId }: TopBarProps) {
  const supabase = createClient()
  const router = useRouter()
  const [notifs, setNotifs] = useState<Notificacion[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const initials = nombre
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Fetch notifications
  const loadNotifs = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setNotifs(data as Notificacion[])
    // Unread count
    const { count: unread } = await supabase
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId)
      .eq('leido', false)
    setUnreadCount(unread || 0)
  }, [userId, supabase])

  useEffect(() => {
    if (!userId) return
    const timeout = setTimeout(loadNotifs, 0)
    const interval = setInterval(loadNotifs, 30000)
    return () => { clearTimeout(timeout); clearInterval(interval) }
  }, [userId, loadNotifs])

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

  async function markAsRead(id: string) {
    await supabase.from('notificaciones').update({ leido: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    if (!userId) return
    await supabase.from('notificaciones').update({ leido: true }).eq('usuario_id', userId).eq('leido', false)
    setNotifs(prev => prev.map(n => ({ ...n, leido: true })))
    setUnreadCount(0)
  }

  function handleNotifClick(n: Notificacion) {
    if (!n.leido) markAsRead(n.id)
    if (n.enlace) {
      router.push(n.enlace)
    }
    setOpen(false)
  }

  const TIPO_ICON: Record<string, React.ReactNode> = {
    comentario: <MessageCircle size={14} className="text-blue-500" />,
    respuesta: <MessageCircle size={14} className="text-purple-500" />,
    resuelto: <Check size={14} className="text-green-500" />,
    sistema: <Bell size={14} className="text-gray-500" />,
  }

  return (
    <header className="flex items-center justify-between gap-4 h-16 px-4 md:px-8 pl-16 md:pl-8 mx-4 mt-4 mb-2 rounded-2xl glass-panel sticky top-4 z-30">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar proyectos…"
          className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-white/40 bg-white/40 backdrop-blur-md placeholder:text-gray-500 focus:bg-white/80 focus:border-acento transition-all"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setOpen(!open)}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Bell size={18} className="text-gray-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full leading-none px-1 animate-in zoom-in duration-200">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <span className="text-sm font-bold text-gray-800">Notificaciones</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] font-bold text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                    >
                      <CheckCheck size={12} /> Leer todas
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Bell size={24} className="text-gray-200 mb-2" />
                    <p className="text-xs text-gray-400">Sin notificaciones</p>
                  </div>
                ) : (
                  notifs.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${
                        !n.leido ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {TIPO_ICON[n.tipo] || TIPO_ICON.sistema}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug ${!n.leido ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                          {n.titulo}
                        </p>
                        {n.mensaje && (
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">{n.mensaje}</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.leido && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-principal flex items-center justify-center text-xs font-bold text-acento">
            {initials}
          </div>
          <span className="text-sm font-medium">{nombre}</span>
        </div>
      </div>
    </header>
  )
}
