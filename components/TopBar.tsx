'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Bell, X, Check, MessageCircle, CheckCheck, Loader2, Folder, Building2, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import type { Notificacion, EstadoProyecto, TipoProyecto } from '@/lib/types'

interface TopBarProps {
  nombre: string
  userId?: string
}

interface SearchResultProyecto {
  id: string
  nombre_proyecto: string
  tipo: TipoProyecto
  estado: EstadoProyecto
  cliente_final_empresa?: string | null
  cliente_final_nombre?: string | null
  created_at: string
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

function getPortalPrefix(pathname: string): string {
  const match = pathname.match(/^\/([^/]+)/)
  if (match && ['admin', 'epc', 'analista', 'finder', 'financiero', 'cliente', 'mem'].includes(match[1])) {
    return match[1]
  }
  return 'admin'
}

export default function TopBar({ nombre, userId }: TopBarProps) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  // Notifications state
  const [notifs, setNotifs] = useState<Notificacion[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResultProyecto[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

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

  // Close notifications on outside click
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

  // Close search dropdown on outside click
  useEffect(() => {
    if (!searchOpen) return
    function handler(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [searchOpen])

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Debounced search query
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setSearchResults([])
      setIsSearching(false)
      setSelectedIndex(-1)
      return
    }

    setIsSearching(true)
    const timeout = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('proyectos')
          .select('id, nombre_proyecto, tipo, estado, cliente_final_empresa, cliente_final_nombre, created_at')
          .or(`nombre_proyecto.ilike.%${trimmed}%,cliente_final_empresa.ilike.%${trimmed}%,cliente_final_nombre.ilike.%${trimmed}%`)
          .order('created_at', { ascending: false })
          .limit(8)

        if (error) {
          console.error('Error buscando proyectos:', error)
          setSearchResults([])
        } else {
          setSearchResults((data as SearchResultProyecto[]) || [])
        }
      } catch (err) {
        console.error('Error en búsqueda:', err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
        setSelectedIndex(-1)
      }
    }, 250)

    return () => clearTimeout(timeout)
  }, [searchQuery, supabase])

  function handleSelectProject(proj: SearchResultProyecto) {
    const portal = getPortalPrefix(pathname)
    router.push(`/${portal}/proyectos/${proj.id}`)
    setSearchOpen(false)
    setSearchQuery('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (searchResults.length > 0) {
        setSelectedIndex(prev => (prev + 1) % searchResults.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (searchResults.length > 0) {
        setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        handleSelectProject(searchResults[selectedIndex])
      } else if (searchResults.length > 0) {
        handleSelectProject(searchResults[0])
      }
    } else if (e.key === 'Escape') {
      setSearchOpen(false)
      searchInputRef.current?.blur()
    }
  }

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
    <header className="flex items-center justify-between gap-4 h-16 px-4 md:px-8 pl-16 md:pl-8 mx-4 mt-4 mb-2 rounded-2xl glass-panel sticky top-4 z-40">
      {/* Global Search Bar */}
      <div className="relative flex-1 max-w-md" ref={searchContainerRef}>
        <div className="relative">
          {isSearching ? (
            <Loader2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
          ) : (
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          )}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value)
              if (!searchOpen) setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar proyectos por nombre o cliente…"
            className="w-full pl-10 pr-16 py-2 text-sm rounded-xl border border-white/40 bg-white/50 backdrop-blur-md placeholder:text-gray-500 focus:bg-white focus:border-acento focus:ring-2 focus:ring-acento/20 transition-all shadow-sm outline-none"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                  searchInputRef.current?.focus()
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-gray-100/80 border border-gray-200 rounded">
                ⌘K
              </kbd>
            )}
          </div>
        </div>

        {/* Search Results Dropdown */}
        {searchOpen && searchQuery.trim().length > 0 && (
          <div className="absolute left-0 top-full mt-2 w-full min-w-[360px] max-w-[480px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/80 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3.5 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-400 font-medium">
              <span>{isSearching ? 'Buscando…' : `${searchResults.length} proyecto${searchResults.length !== 1 ? 's' : ''} encontrado${searchResults.length !== 1 ? 's' : ''}`}</span>
              <span className="hidden sm:inline text-[10px]">↑↓ para navegar · ↵ para abrir</span>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {!isSearching && searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <Folder size={28} className="text-gray-300 mb-2" />
                  <p className="text-xs font-semibold text-gray-700">No se encontraron proyectos</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Intenta con otro nombre de proyecto o cliente</p>
                </div>
              ) : (
                searchResults.map((proj, idx) => {
                  const isSelected = idx === selectedIndex
                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => handleSelectProject(proj)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-acento/15 text-principal' : 'hover:bg-gray-50/80 text-gray-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-900 truncate">
                            {proj.nombre_proyecto}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          {proj.cliente_final_empresa && (
                            <span className="flex items-center gap-1 truncate">
                              <Building2 size={12} className="text-gray-400 flex-shrink-0" />
                              <span className="truncate">{proj.cliente_final_empresa}</span>
                            </span>
                          )}
                          {proj.cliente_final_nombre && !proj.cliente_final_empresa && (
                            <span className="flex items-center gap-1 truncate">
                              <User size={12} className="text-gray-400 flex-shrink-0" />
                              <span className="truncate">{proj.cliente_final_nombre}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <BadgeTipo tipo={proj.tipo} />
                        <BadgeEstado estado={proj.estado} />
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
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
