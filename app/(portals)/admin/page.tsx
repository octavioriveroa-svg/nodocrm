import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import BadgeTipo from '@/components/BadgeTipo'
import BadgeEstado from '@/components/BadgeEstado'
import { Users, Folder, Building2, TrendingUp, Zap, Sun } from 'lucide-react'

const estadoLabel: Record<string, string> = {
  recibido: 'Recibido',
  en_analisis: 'En análisis',
  propuesta_lista: 'Propuesta lista',
  enviada: 'Enviada',
  cliente_interesado: 'Cliente interesado',
  completado: 'Completado',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M`
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} k`
  return n.toLocaleString('es-MX', { maximumFractionDigits: 1 })
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [{ data: perfiles }, { data: proyectos }, { data: clientes }, { data: productos }] = await Promise.all([
    supabase.from('profiles').select('rol'),
    supabase.from('proyectos').select('id, nombre_proyecto, tipo, estado, created_at, epcista_id').order('created_at', { ascending: false }),
    supabase.from('clientes').select('id'),
    supabase.from('proyecto_sitio_productos').select('tipo, datos'),
  ])

  const p = perfiles ?? []
  const pr = proyectos ?? []
  const prods = productos ?? []

  let bess_kw = 0, bess_kwh = 0, bess_capex = 0, fv_kwp = 0, fv_capex = 0
  for (const prod of prods) {
    const d = prod.datos as Record<string, unknown> | null
    if (!d) continue
    if (prod.tipo === 'bess') {
      bess_kw += Number(d.potencia_kw) || 0
      bess_kwh += Number(d.capacidad_kwh) || 0
      bess_capex += Number(d.capex) || 0
    } else if (prod.tipo === 'fv') {
      fv_kwp += ((Number(d.num_modulos) || 0) * (Number(d.potencia_modulos_w) || 0)) / 1000
      fv_capex += Number(d.capex) || 0
    }
  }
  const hasPortafolio = bess_kw > 0 || fv_kwp > 0

  const byEstado: Record<string, number> = {}
  for (const x of pr) {
    const e = (x as { estado: string }).estado
    byEstado[e] = (byEstado[e] ?? 0) + 1
  }

  const stats = {
    totalUsuarios: p.length,
    epcistas: p.filter((u: { rol: string }) => u.rol === 'epcista').length,
    analistas: p.filter((u: { rol: string }) => u.rol === 'analista').length,
    admins: p.filter((u: { rol: string }) => u.rol === 'admin').length,
    totalProyectos: pr.length,
    totalClientes: (clientes ?? []).length,
    byEstado,
  }

  type RecentProyecto = { id: string; nombre_proyecto: string; tipo: string; estado: string; created_at: string; epcista_id: string; epcista_nombre: string }
  let recientes: RecentProyecto[] = []
  const recientesList = pr.slice(0, 8) as { id: string; nombre_proyecto: string; tipo: string; estado: string; created_at: string; epcista_id: string }[]
  if (recientesList.length > 0) {
    const ids = [...new Set(recientesList.map(r => r.epcista_id))]
    const { data: profilesData } = await supabase.from('profiles').select('id, nombre').in('id', ids)
    const nameMap: Record<string, string> = {}
    for (const pf of profilesData ?? []) {
      nameMap[(pf as { id: string; nombre: string }).id] = (pf as { id: string; nombre: string }).nombre
    }
    recientes = recientesList.map(r => ({ ...r, epcista_nombre: nameMap[r.epcista_id] ?? '—' }))
  }

  const iconColors = {
    Users: 'bg-blue-50 text-blue-600',
    Folder: 'bg-acento/20 text-principal',
    Building2: 'bg-purple-50 text-purple-600',
    TrendingUp: 'bg-emerald-50 text-emerald-600',
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-1">Panel de administración</p>
        <h1 className="text-2xl font-black tracking-tight">Visión global de la plataforma</h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        {[
          { label: 'Usuarios totales', value: stats.totalUsuarios, icon: Users, href: '/admin/usuarios', color: iconColors.Users },
          { label: 'Proyectos', value: stats.totalProyectos, icon: Folder, href: '/admin/proyectos', color: iconColors.Folder },
          { label: 'Clientes', value: stats.totalClientes, icon: Building2, href: '/admin/clientes', color: iconColors.Building2 },
          { label: 'Cliente interesado', value: stats.byEstado['cliente_interesado'] ?? 0, icon: TrendingUp, href: '/admin/proyectos', color: iconColors.TrendingUp },
        ].map(({ label, value, icon: Icon, href, color }) => (
          <Link key={label} href={href}
            className="glass-card p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200 group">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-3xl font-black tracking-tight">{value}</div>
                <div className="text-sm mt-1.5 text-gray-500">{label}</div>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
                <Icon size={18} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Usuarios breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'EPCistas', value: stats.epcistas },
          { label: 'Analistas', value: stats.analistas },
          { label: 'Administradores', value: stats.admins },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card p-5 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">{label}</span>
            <span className="text-lg font-black px-3 py-1 rounded-lg bg-acento">{value}</span>
          </div>
        ))}
      </div>

      {/* Proyectos por estado */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {(['recibido', 'en_analisis', 'propuesta_lista', 'enviada', 'cliente_interesado'] as const).map(estado => (
          <div key={estado} className="glass-card p-5">
            <div className="text-2xl font-black mb-2">{stats.byEstado[estado] ?? 0}</div>
            <BadgeEstado estado={estado} />
          </div>
        ))}
      </div>

      {/* Portafolio técnico */}
      {hasPortafolio && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Portafolio técnico</h2>
          <div className="grid grid-cols-2 gap-4">
            {bess_kw > 0 && (
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-principal">
                    <Zap size={16} className="text-acento" />
                  </div>
                  <span className="text-sm font-bold">BESS — Almacenamiento</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-2xl font-black">{fmt(bess_kw)}</div>
                    <div className="text-xs mt-1 text-gray-400">kW Potencia</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black">{fmt(bess_kwh)}</div>
                    <div className="text-xs mt-1 text-gray-400">kWh Capacidad</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black">${fmt(bess_capex)}</div>
                    <div className="text-xs mt-1 text-gray-400">CAPEX total</div>
                  </div>
                </div>
              </div>
            )}
            {fv_kwp > 0 && (
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-acento">
                    <Sun size={16} className="text-principal" />
                  </div>
                  <span className="text-sm font-bold">FV — Solar fotovoltaico</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-black">{fmt(fv_kwp)}</div>
                    <div className="text-xs mt-1 text-gray-400">kWp instalados</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black">${fmt(fv_capex)}</div>
                    <div className="text-xs mt-1 text-gray-400">CAPEX total</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Proyectos recientes */}
      {recientes.length > 0 && (
        <div className="rounded-xl border border-borde overflow-hidden shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-borde">
            <h2 className="font-bold text-sm">Proyectos recientes</h2>
            <Link href="/admin/proyectos" className="text-xs font-semibold text-gray-400 hover:text-principal transition-colors">Ver todos →</Link>
          </div>
          <table className="w-full text-sm bg-white">
            <thead>
              <tr className="bg-gray-50 border-b border-borde">
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Proyecto</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">EPCista</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Tipo</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Estado</th>
                <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-400">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((proj, i) => (
                <tr key={proj.id} className={`border-t border-borde hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-fondo/50'}`}>
                  <td className="px-6 py-3.5 font-medium">
                    <Link href={`/admin/proyectos/${proj.id}`} className="hover:underline">{proj.nombre_proyecto}</Link>
                  </td>
                  <td className="px-6 py-3.5 text-gray-500">{proj.epcista_nombre}</td>
                  <td className="px-6 py-3.5"><BadgeTipo tipo={proj.tipo as import('@/lib/types').TipoProyecto} /></td>
                  <td className="px-6 py-3.5"><BadgeEstado estado={proj.estado} /></td>
                  <td className="px-6 py-3.5 text-xs text-gray-400">{formatDate(proj.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
