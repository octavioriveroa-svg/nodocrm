import { useState, useEffect } from 'react'
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

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

interface NavSection {
  label: string | null
  items: NavItem[]
}

export default function Sidebar({ rol, nombre }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // Fetch pending users count for admin/analyst
  useEffect(() => {
    if (rol !== 'nodo_admin' && rol !== 'nodo_analista') return
    async function fetchPending() {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('rol', 'pendiente')
      setPendingCount(count ?? 0)
    }
    fetchPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol])

  // ─── Grouped navigation per role ─────────────────────

  const navEpc: NavSection[] = [
    { label: null, items: [
      { href: '/epc', label: 'Dashboard', icon: LayoutDashboard },
    ]},
    { label: null, items: [
      { href: '/epc/proyectos', label: 'Proyectos', icon: Folder },
      { href: '/epc/clientes', label: 'Clientes', icon: Users },
    ]},
  ]

  const navAnalista: NavSection[] = [
    { label: 'Visión general', items: [
      { href: '/analista', label: 'Proyectos', icon: Folder },
    ]},
    { label: 'Operaciones', items: [
      { href: '/analista/clientes', label: 'Clientes', icon: Building2 },
    ]},
    { label: 'Equipo', items: [
      { href: '/analista/usuarios', label: 'Usuarios', icon: Users },
    ]},
  ]

  const navAdmin: NavSection[] = [
    { label: 'Visión general', items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ]},
    { label: 'Operaciones', items: [
      { href: '/admin/proyectos', label: 'Proyectos', icon: Folder },
      { href: '/admin/clientes', label: 'Clientes', icon: Building2 },
    ]},
    { label: 'Equipo', items: [
      { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
    ]},
  ]

  const navCliente: NavSection[] = [
    { label: null, items: [
      { href: '/cliente', label: 'Mis Proyectos', icon: Folder },
    ]},
  ]

  const navFinanciero: NavSection[] = [
    { label: null, items: [
      { href: '/financiero', label: 'Portafolio', icon: LayoutDashboard },
    ]},
  ]

  const navMem: NavSection[] = [
    { label: null, items: [
      { href: '/mem', label: 'Marketplace', icon: LayoutDashboard },
    ]},
  ]

  let sections: NavSection[] = []
  if (rol === 'nodo_admin') sections = navAdmin
  else if (rol === 'nodo_analista') sections = navAnalista
  else if (rol === 'cliente_final') sections = navCliente
  else if (rol === 'financiero') sections = navFinanciero
  else if (rol === 'suministrador') sections = navMem
  else sections = navEpc

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
          {sections.map((section, sIdx) => (
            <div key={sIdx} className={sIdx > 0 ? 'mt-3' : ''}>
              {/* Section label */}
              {section.label && (
                <div className="px-3 mb-2 mt-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                    {section.label}
                  </span>
                </div>
              )}
              {/* Section items */}
              {section.items.map(({ href, label, icon: Icon }) => {
                const portalRoots = ['/epc', '/analista', '/admin', '/cliente', '/financiero', '/mem']
                const isRoot = portalRoots.includes(href)
                const active = pathname === href || (!isRoot && pathname.startsWith(href))
                const showBadge = label === 'Usuarios' && pendingCount > 0
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${active ? 'bg-acento text-principal shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                  >
                    <Icon size={16} />
                    {label}
                    {showBadge && (
                      <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
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
