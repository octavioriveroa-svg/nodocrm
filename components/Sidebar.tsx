import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Folder, Users, LogOut, Settings, LayoutDashboard, Building2, Menu, X } from 'lucide-react'
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
  const [isOpen, setIsOpen] = useState(false)

  const navEpc = [
    { href: '/epc', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/epc/proyectos', label: 'Proyectos', icon: Folder },
    { href: '/epc/clientes', label: 'Clientes', icon: Users },
  ]

  const navAnalista = [
    { href: '/analista', label: 'Proyectos', icon: Folder },
  ]

  const navAdmin = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/proyectos', label: 'Proyectos', icon: Folder },
    { href: '/admin/clientes', label: 'Clientes', icon: Building2 },
  ]

  const navCliente = [
    { href: '/cliente', label: 'Mis Proyectos', icon: Folder },
  ]

  const navFinanciero = [
    { href: '/financiero', label: 'Portafolio', icon: LayoutDashboard },
    { href: '/financiero/proyectos', label: 'Proyectos', icon: Folder },
  ]

  const navMem = [
    { href: '/mem', label: 'Marketplace', icon: LayoutDashboard },
  ]

  let nav: typeof navEpc = []
  if (rol === 'nodo_admin') nav = navAdmin
  else if (rol === 'nodo_analista') nav = navAnalista
  else if (rol === 'cliente_final') nav = navCliente
  else if (rol === 'financiero') nav = navFinanciero
  else if (rol === 'suministrador') nav = navMem
  else nav = navEpc

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
    <>
      {/* Mobile Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="md:hidden fixed top-6 left-6 z-50 p-2.5 bg-principal text-acento rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all"
        aria-label="Toggle Menu"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      {/* Sidebar Content */}
      <aside className={`
        fixed md:sticky top-4 h-[calc(100vh-2rem)] flex flex-col w-[260px] m-4 md:mr-0 p-5 
        rounded-2xl glass-panel-dark text-white shadow-2xl overflow-hidden z-40 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-[150%] md:translate-x-0'}
      `}>
        <div className="mb-8 px-1">
          <Logo inverted size="sm" />
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {(nav as NavItem[]).map(({ href, label, icon: Icon, alwaysYellow }) => {
            const isRoot = ['/epc', '/analista', '/admin', '/cliente', '/financiero', '/mem'].includes(href)
            const active = pathname === href || (!isRoot && pathname.startsWith(href))
            const yellow = alwaysYellow || active
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${yellow ? 'bg-acento text-principal shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
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
              <p className="text-[11px] text-white/50 uppercase tracking-wider">
                {rol.replace('nodo_', '').replace('_', ' ')}
              </p>
              <p className="text-sm font-medium text-white truncate">{nombre}</p>
            </div>
          </div>
          <Link
            href={`/${rol.replace('nodo_analista', 'analista').replace('nodo_admin', 'admin')}/configuracion`}
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-all ${pathname.includes('/configuracion') ? 'text-acento bg-acento/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
          >
            <Settings size={16} />
            Configuración
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-all text-white/70 hover:text-white hover:bg-white/5"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
