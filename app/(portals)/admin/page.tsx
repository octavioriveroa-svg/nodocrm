import Link from 'next/link'
import BadgeTipo from '@/components/BadgeTipo'
import BadgeEstado from '@/components/BadgeEstado'
import DashboardAnalytics from '@/components/DashboardAnalytics'
import { fetchDashboardData } from '@/lib/dashboard-data'
import type { TipoProyecto } from '@/lib/types'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function AdminDashboard() {
  const data = await fetchDashboardData()

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-1">Panel de administración</p>
        <h1 className="text-2xl font-black tracking-tight">Visión global de la plataforma</h1>
      </div>

      <DashboardAnalytics data={data} />

      {/* Proyectos recientes */}
      {data.recentProjects.length > 0 && (
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
              {data.recentProjects.map((proj, i) => (
                <tr key={proj.id} className={`border-t border-borde hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-fondo/50'}`}>
                  <td className="px-6 py-3.5 font-medium">
                    <Link href={`/admin/proyectos/${proj.id}`} className="hover:underline">{proj.nombre_proyecto}</Link>
                  </td>
                  <td className="px-6 py-3.5 text-gray-500">{proj.epcista_nombre}</td>
                  <td className="px-6 py-3.5"><BadgeTipo tipo={proj.tipo as TipoProyecto} /></td>
                  <td className="px-6 py-3.5"><BadgeEstado estado={proj.estado} historial={proj.historial_estados} /></td>
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
