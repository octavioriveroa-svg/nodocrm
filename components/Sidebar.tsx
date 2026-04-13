'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Folder, FolderPlus, Users, LogOut, Settings, LayoutDashboard, Building2, ShieldCheck } from 'lucide-react'
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
    { href: '/epcista/nuevo', label: 'Nuevo proyecto', icon: FolderPlus, alwaysYellow: true },
    { href: '/epcista', label: 'Proyectos', icon: Folder },
    { href: '/epcista/clientes', label: 'Clientes', icon: Users },
  ]

  const navAnalista = [
    { href: '/analista', label: 'Proyectos', icon: Folder },
  ]

  const navAdmin = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
    { href: '/admin/proyectos', label: 'Proyectos', icon: Folder },
    { href: '/admin/clientes', label: 'Clientes', icon: Building2 },
  ]

  const nav = rol === 'admin' ? navAdmin : rol === 'analista' ? navAnalista : navEpcista

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
          const isRoot = href === '/epcista' || href === '/analista' || href === '/admin'
          const active = pathname === href || (!isRoot && pathname.startsWith(href))
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
            {rol === 'admin' ? 'Administrador' : rol === 'analista' ? 'Analista' : 'EPCista'}
          </p>
          <p className="text-sm font-medium text-white truncate">{nombre}</p>
        </div>
        <Link
          href={rol === 'admin' ? '/admin/configuracion' : rol === 'analista' ? '/analista/configuracion' : '/epcista/configuracion'}
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
