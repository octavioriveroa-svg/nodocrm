import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Folder,
  Users,
  LogOut,
  Settings,
  LayoutDashboard,
  Building2,
  Menu,
  X,
  Wrench,
  Calculator,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import Logo from './Logo'
import { useSidebar } from '@/components/layout/SidebarContext'
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
  const { collapsed, toggleCollapsed } = useSidebar()
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
      { href: '/epc/calculadora', label: 'Simulador', icon: Calculator },
      { href: '/epc/instalaciones', label: 'Instalaciones', icon: Wrench },
      { href: '/epc/clientes', label: 'Clientes', icon: Users },
    ]},
  ]

  const navAnalista: NavSection[] = [
    { label: 'Visión general', items: [
      { href: '/analista', label: 'Dashboard', icon: LayoutDashboard },
    ]},
    { label: 'Operaciones', items: [
      { href: '/analista/proyectos', label: 'Proyectos', icon: Folder },
      { href: '/analista/calculadora', label: 'Simulador', icon: Calculator },
      { href: '/analista/instalaciones', label: 'Instalaciones', icon: Wrench },
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
      { href: '/admin/calculadora', label: 'Simulador', icon: Calculator },
      { href: '/admin/instalaciones', label: 'Instalaciones', icon: Wrench },
      { href: '/admin/clientes', label: 'Clientes', icon: Building2 },
    ]},
    { label: 'Equipo', items: [
      { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
    ]},
  ]

  const navCliente: NavSection[] = [
    { label: null, items: [
      { href: '/cliente', label: 'Resumen', icon: LayoutDashboard },
      { href: '/cliente/proyectos', label: 'Proyectos', icon: Folder },
      { href: '/cliente/instalaciones', label: 'Instalaciones', icon: Wrench },
    ]},
  ]

  const navFinanciero: NavSection[] = [
    { label: null, items: [
      { href: '/financiero', label: 'Portafolio', icon: LayoutDashboard },
      { href: '/financiero/calculadora', label: 'Simulador', icon: Calculator },
      { href: '/financiero/instalaciones', label: 'Instalaciones', icon: Wrench },
    ]},
  ]

  const navMem: NavSection[] = [
    { label: null, items: [
      { href: '/mem', label: 'Marketplace', icon: LayoutDashboard },
    ]},
  ]

  const navFinder: NavSection[] = [
    { label: 'Visión general', items: [
      { href: '/finder', label: 'Dashboard', icon: LayoutDashboard },
    ]},
    { label: 'Operaciones', items: [
      { href: '/finder/proyectos', label: 'Proyectos', icon: Folder },
      { href: '/finder/calculadora', label: 'Simulador', icon: Calculator },
      { href: '/finder/instalaciones', label: 'Instalaciones', icon: Wrench },
      { href: '/finder/clientes', label: 'Clientes', icon: Building2 },
    ]},
  ]

  let sections: NavSection[] = []
  if (rol === 'nodo_admin') sections = navAdmin
  else if (rol === 'nodo_analista') sections = navAnalista
  else if (rol === 'cliente_final') sections = navCliente
  else if (rol === 'financiero') sections = navFinanciero
  else if (rol === 'suministrador') sections = navMem
  else if (rol === 'finder') sections = navFinder
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

  const ROLE_PORTAL_PREFIX: Record<Rol, string> = {
    epc: 'epc',
    nodo_analista: 'analista',
    nodo_admin: 'admin',
    cliente_final: 'cliente',
    financiero: 'financiero',
    suministrador: 'mem',
    finder: 'finder',
    pendiente: 'pendiente',
  }

  return (
    <>
      {/* Mobile Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="md:hidden fixed top-6 left-6 z-40 p-2.5 bg-principal text-acento rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside
        data-collapsed={collapsed ? 'true' : 'false'}
        className={`
          fixed md:sticky top-4 h-[calc(100vh-2rem)] shrink-0 flex flex-col m-4 md:mr-0
          w-[260px] p-5 ${collapsed ? 'md:w-[76px] md:px-2.5 md:py-5' : 'md:w-[260px] md:p-5'}
          rounded-2xl glass-panel-dark text-white shadow-2xl overflow-hidden z-50
          transition-[transform,width,padding] duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-[150%] md:translate-x-0'}
        `}
      >
        <div
          className={`mb-8 flex items-center ${
            collapsed ? 'md:flex-col md:gap-3 md:px-0 justify-between px-1' : 'justify-between px-1'
          }`}
        >
          <div className={collapsed ? 'md:hidden' : ''}>
            <Logo inverted size="sm" />
          </div>
          {collapsed && (
            <div
              className="hidden md:flex w-9 h-9 rounded-xl bg-acento text-principal items-center justify-center font-black text-base tracking-tighter shrink-0"
              title="Nodo"
              aria-label="Nodo"
            >
              n.
            </div>
          )}

          {/* Desktop collapse/expand toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expandir menú (Ctrl+B)' : 'Colapsar menú (Ctrl+B)'}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-expanded={!collapsed}
            className="hidden md:inline-flex p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className={sIdx > 0 ? 'mt-3' : ''}>
              {/* Section label */}
              {section.label && (
                <>
                  <div className={`px-3 mb-2 mt-1 ${collapsed ? 'md:hidden' : ''}`}>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                      {section.label}
                    </span>
                  </div>
                  {collapsed && sIdx > 0 && (
                    <div className="hidden md:block mx-2 my-2 border-t border-white/10" aria-hidden />
                  )}
                </>
              )}
              {/* Section items */}
              {section.items.map(({ href, label, icon: Icon }) => {
                const portalRoots = ['/epc', '/analista', '/admin', '/cliente', '/financiero', '/mem', '/finder']
                const isRoot = portalRoots.includes(href)
                const active = pathname === href || (!isRoot && pathname.startsWith(`${href}/`))
                const showBadge = label === 'Usuarios' && pendingCount > 0
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    title={collapsed ? label : undefined}
                    aria-label={label}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      collapsed ? 'md:justify-center md:px-0' : ''
                    } ${active ? 'bg-acento text-principal shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
                    {showBadge && (
                      <span
                        className={`ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-amber-500 text-white ${
                          collapsed ? 'md:ml-0 md:absolute md:top-1 md:right-1 md:min-w-[16px] md:h-[16px] md:text-[9px]' : ''
                        }`}
                      >
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
          <div
            className={`mb-3 px-3 flex items-center gap-3 ${collapsed ? 'md:justify-center md:px-0' : ''}`}
            title={collapsed ? `${nombre} (${rol.replace('nodo_', '').replace('_', ' ')})` : undefined}
          >
            <div className="w-8 h-8 rounded-full bg-acento flex items-center justify-center text-xs font-bold text-principal flex-shrink-0">
              {initials}
            </div>
            <div className={`min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
              <p className="text-[11px] text-white/50 uppercase tracking-wider">
                {rol.replace('nodo_', '').replace('_', ' ')}
              </p>
              <p className="text-sm font-medium text-white truncate">{nombre}</p>
            </div>
          </div>
          <Link
            href={`/${ROLE_PORTAL_PREFIX[rol] ?? 'epc'}/configuracion`}
            onClick={() => setIsOpen(false)}
            title={collapsed ? 'Configuración' : undefined}
            aria-label="Configuración"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-all ${
              collapsed ? 'md:justify-center md:px-0' : ''
            } ${pathname.includes('/configuracion') ? 'text-acento bg-acento/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
          >
            <Settings size={16} className="shrink-0" />
            <span className={collapsed ? 'md:hidden' : ''}>Configuración</span>
          </Link>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Cerrar sesión' : undefined}
            aria-label="Cerrar sesión"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-all text-white/70 hover:text-white hover:bg-white/5 ${
              collapsed ? 'md:justify-center md:px-0' : ''
            }`}
          >
            <LogOut size={16} className="shrink-0" />
            <span className={collapsed ? 'md:hidden' : ''}>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  )
}
