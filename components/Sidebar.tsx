'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Folder, FolderPlus, Users, LogOut, Settings } from 'lucide-react'
import Logo from './Logo'
import type { Rol } from '@/lib/types'

interface SidebarProps {
  rol: Rol
  nombre: string
}

export default function Sidebar({ rol, nombre }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const navEpcista = [
    { href: '/epcista', label: 'Proyectos', icon: Folder, alwaysYellow: true },
    { href: '/epcista/clientes', label: 'Clientes', icon: Users },
    { href: '/epcista/nuevo', label: 'Nuevo proyecto', icon: FolderPlus },
  ]

  const navAnalista = [
    { href: '/analista', label: 'Proyectos', icon: Folder, alwaysYellow: true },
  ]

  const nav = rol === 'analista' ? navAnalista : navEpcista

  type NavItem = { href: string; label: string; icon: React.ElementType; alwaysYellow?: boolean }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="flex flex-col w-64 min-h-screen px-5 py-7"
      style={{ backgroundColor: '#000000' }}
    >
      <div className="mb-10">
        <Logo inverted size="sm" />
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {(nav as NavItem[]).map(({ href, label, icon: Icon, alwaysYellow }) => {
          const active = pathname === href || (href !== '/epcista' && href !== '/analista' && pathname.startsWith(href))
          const yellow = alwaysYellow || active
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor: yellow ? '#D7FF2F' : 'transparent',
                color: yellow ? '#000000' : '#ffffff',
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-6 border-t" style={{ borderColor: '#222' }}>
        <div className="mb-3 px-3">
          <p className="text-xs" style={{ color: '#888' }}>
            {rol === 'analista' ? 'Analista' : 'EPCista'}
          </p>
          <p className="text-sm font-medium text-white truncate">{nombre}</p>
        </div>
        <Link
          href={rol === 'analista' ? '/analista/configuracion' : '/epcista/configuracion'}
          className="flex items-center gap-3 px-3 py-2.5 rounded text-sm w-full transition-colors hover:bg-white/10"
          style={{
            color: pathname.includes('/configuracion') ? '#D7FF2F' : '#888',
            backgroundColor: pathname.includes('/configuracion') ? 'rgba(215,255,47,0.1)' : 'transparent',
          }}
        >
          <Settings size={16} />
          Configuración
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded text-sm w-full transition-colors hover:bg-white/10"
          style={{ color: '#888' }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
