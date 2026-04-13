'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Users, Folder, Building2, TrendingUp } from 'lucide-react'

interface Stats {
  totalUsuarios: number
  epcistas: number
  analistas: number
  admins: number
  totalProyectos: number
  proyectosRecibidos: number
  proyectosEnAnalisis: number
  proyectosCompletados: number
  totalClientes: number
}

interface RecentProyecto {
  id: string
  nombre_proyecto: string
  tipo: string
  estado: string
  created_at: string
  epcista_nombre: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const estadoLabel: Record<string, string> = {
  recibido: 'Recibido',
  en_analisis: 'En análisis',
  completado: 'Completado',
}
const estadoColor: Record<string, { bg: string; color: string }> = {
  recibido: { bg: '#E8E8E8', color: '#444' },
  en_analisis: { bg: '#D7FF2F', color: '#000' },
  completado: { bg: '#000', color: '#fff' },
}

export default function AdminDashboard() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recientes, setRecientes] = useState<RecentProyecto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: perfiles }, { data: proyectos }, { data: clientes }] = await Promise.all([
        supabase.from('profiles').select('rol'),
        supabase.from('proyectos').select('id, nombre_proyecto, tipo, estado, created_at, epcista_id').order('created_at', { ascending: false }),
        supabase.from('clientes').select('id'),
      ])

      const p = perfiles ?? []
      const pr = proyectos ?? []

      setStats({
        totalUsuarios: p.length,
        epcistas: p.filter((u: { rol: string }) => u.rol === 'epcista').length,
        analistas: p.filter((u: { rol: string }) => u.rol === 'analista').length,
        admins: p.filter((u: { rol: string }) => u.rol === 'admin').length,
        totalProyectos: pr.length,
        proyectosRecibidos: pr.filter((x: { estado: string }) => x.estado === 'recibido').length,
        proyectosEnAnalisis: pr.filter((x: { estado: string }) => x.estado === 'en_analisis').length,
        proyectosCompletados: pr.filter((x: { estado: string }) => x.estado === 'completado').length,
        totalClientes: (clientes ?? []).length,
      })

      // Enrich recent projects with epcista names from profiles
      const recientesList = pr.slice(0, 8) as { id: string; nombre_proyecto: string; tipo: string; estado: string; created_at: string; epcista_id: string }[]
      if (recientesList.length > 0) {
        const ids = [...new Set(recientesList.map(r => r.epcista_id))]
        const { data: profilesData } = await supabase.from('profiles').select('id, nombre').in('id', ids)
        const nameMap: Record<string, string> = {}
        for (const pf of profilesData ?? []) {
          nameMap[(pf as { id: string; nombre: string }).id] = (pf as { id: string; nombre: string }).nombre
        }
        setRecientes(recientesList.map(r => ({ ...r, epcista_nombre: nameMap[r.epcista_id] ?? '—' })))
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return null

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Panel de administración</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Visión global de la plataforma</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Usuarios totales', value: stats!.totalUsuarios, icon: Users, href: '/admin/usuarios' },
          { label: 'Proyectos', value: stats!.totalProyectos, icon: Folder, href: '/admin/proyectos' },
          { label: 'Clientes', value: stats!.totalClientes, icon: Building2, href: '/admin/clientes' },
          { label: 'Completados', value: stats!.proyectosCompletados, icon: TrendingUp, href: '/admin/proyectos' },
        ].map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}
            className="border p-5 hover:border-black transition-colors"
            style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-3xl font-black">{value}</div>
                <div className="text-sm mt-1" style={{ color: '#666' }}>{label}</div>
              </div>
              <Icon size={18} style={{ color: '#CFCFCF' }} />
            </div>
          </Link>
        ))}
      </div>

      {/* Usuarios breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'EPCistas', value: stats!.epcistas },
          { label: 'Analistas', value: stats!.analistas },
          { label: 'Administradores', value: stats!.admins },
        ].map(({ label, value }) => (
          <div key={label} className="border p-4 flex items-center justify-between"
            style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xl font-black px-3 py-0.5" style={{ backgroundColor: '#D7FF2F' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Proyectos por estado */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Recibidos', value: stats!.proyectosRecibidos },
          { label: 'En análisis', value: stats!.proyectosEnAnalisis },
          { label: 'Completados', value: stats!.proyectosCompletados },
        ].map(({ label, value }) => (
          <div key={label} className="border p-4 flex items-center justify-between"
            style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}>
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xl font-black px-3 py-0.5" style={{ backgroundColor: '#f0f0f0' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Proyectos recientes */}
      {recientes.length > 0 && (
        <div className="border overflow-hidden" style={{ borderColor: '#CFCFCF' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#fff', borderBottom: '1px solid #CFCFCF' }}>
            <h2 className="font-bold text-sm">Proyectos recientes</h2>
            <Link href="/admin/proyectos" className="text-xs underline font-medium">Ver todos</Link>
          </div>
          <table className="w-full text-sm" style={{ backgroundColor: '#fff' }}>
            <thead>
              <tr style={{ backgroundColor: '#000', color: '#fff' }}>
                <th className="text-left px-4 py-2.5 font-semibold text-xs">Proyecto</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs">EPCista</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs">Tipo</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs">Estado</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((p, i) => {
                const ec = estadoColor[p.estado] ?? { bg: '#E8E8E8', color: '#444' }
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #CFCFCF', backgroundColor: i % 2 === 0 ? '#fff' : '#fafaf8' }}>
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/admin/proyectos/${p.id}`} className="hover:underline">{p.nombre_proyecto}</Link>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: '#666' }}>{p.epcista_nombre}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs border px-2 py-0.5 font-medium" style={{ borderColor: '#CFCFCF' }}>{p.tipo}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 font-semibold" style={{ backgroundColor: ec.bg, color: ec.color }}>
                        {estadoLabel[p.estado] ?? p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#666' }}>{formatDate(p.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
