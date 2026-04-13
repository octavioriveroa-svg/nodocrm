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
    { href: '/epcista/nuevo', label: 'Nuevo proyecto', icon: FolderPlus },
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
    { href: '/admin/configuracion/roles', label: 'Roles', icon: ShieldCheck },
  ]

  const nav = rol === 'admin' ? navAdmin : rol === 'analista' ? navAnalista : navEpcista

  type NavItem = { href: string; label: string; icon: React.ElementType; alwaysYellow?: boolean }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = nombre
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside className="flex flex-col w-[260px] min-h-screen px-4 py-6 bg-[#0F0F0F] shadow-xl">
      <div className="mb-8 px-3">
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${yellow ? 'bg-acento text-principal shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-white/10">
        <div className="mb-3 px-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-acento flex items-center justify-center text-xs font-bold text-principal flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">
              {rol === 'admin' ? 'Admin' : rol === 'analista' ? 'Analista' : 'EPCista'}
            </p>
            <p className="text-sm font-medium text-white truncate">{nombre}</p>
          </div>
        </div>
        <Link
          href={rol === 'admin' ? '/admin/configuracion' : rol === 'analista' ? '/analista/configuracion' : '/epcista/configuracion'}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-all ${pathname.includes('/configuracion') ? 'text-acento bg-acento/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
        >
          <Settings size={16} />
          Configuración
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-all text-gray-500 hover:text-white hover:bg-white/5"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
