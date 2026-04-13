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
    <header className="flex items-center justify-between h-16 px-8 border-b border-borde bg-white/80 backdrop-blur-sm sticky top-0 z-30">
      {/* Search */}
      <div className="relative w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar proyectos, clientes…"
          className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-borde bg-fondo placeholder:text-gray-400 focus:bg-white"
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
