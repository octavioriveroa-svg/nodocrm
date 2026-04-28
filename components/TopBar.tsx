'use client'

import { Search, Bell } from 'lucide-react'

interface TopBarProps {
  nombre: string
}

export default function TopBar({ nombre }: TopBarProps) {
  const initials = nombre
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

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
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell size={18} className="text-gray-500" />
        </button>

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
