import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Calculator, Folder, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import BadgeEstado from '@/components/BadgeEstado'
import BadgeTipo from '@/components/BadgeTipo'
import { fmtCurrency } from '@/lib/format'
import type { Profile, Proyecto } from '@/lib/types'

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

export default async function ClienteProyectosPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, rol, cliente_crm_id')
    .eq('id', user.id)
    .single()

  const profile = profileRow as Pick<Profile, 'id' | 'rol' | 'cliente_crm_id'> | null
  if (!profile || profile.rol !== 'cliente_final') {
    redirect('/login')
  }

  const crmId = profile.cliente_crm_id
  const { data: proyectosData } = await supabase
    .from('proyectos')
    .select(
      'id, nombre_proyecto, tipo, estado, capex_estimado, moneda, ubicacion_estado, historial_estados, created_at',
    )
    .or(`cliente_id.eq.${user.id},cliente_id.eq.${crmId || NIL_UUID}`)
    .order('created_at', { ascending: false })

  const proyectos = (proyectosData ?? []) as Pick<
    Proyecto,
    | 'id'
    | 'nombre_proyecto'
    | 'tipo'
    | 'estado'
    | 'capex_estimado'
    | 'moneda'
    | 'ubicacion_estado'
    | 'historial_estados'
    | 'created_at'
  >[]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-principal mb-1">
            Mis Proyectos
          </h1>
          <p className="text-sm text-texto-suave">
            Consulta las alternativas técnicas, opciones de financiamiento y simula tus ahorros energéticos y financieros.
          </p>
        </div>
        <Link
          href="/cliente"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-borde bg-white text-principal hover:bg-fondo transition-colors"
        >
          Volver al resumen
        </Link>
      </div>

      {proyectos.length === 0 ? (
        <div className="py-20 text-center glass-panel border-dashed border-borde rounded-2xl bg-white/70">
          <Folder size={34} className="mx-auto text-texto-suave/50 mb-3" />
          <h2 className="text-lg font-bold text-principal mb-1">Sin Proyectos Asignados</h2>
          <p className="text-sm text-texto-suave">
            Aún no tienes proyectos vinculados a tu cuenta.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {proyectos.map((p) => {
            const hasPositiveCapex = p.capex_estimado != null && p.capex_estimado > 0
            return (
              <div
                key={p.id}
                className="glass-card p-6 flex flex-col justify-between gap-5 hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-black text-principal leading-snug">
                      {p.nombre_proyecto}
                    </h2>
                    <BadgeTipo tipo={p.tipo} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <BadgeEstado estado={p.estado} historial={p.historial_estados} />
                    {p.ubicacion_estado && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-texto-suave">
                        <MapPin size={13} />
                        {p.ubicacion_estado}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-linea flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                      Inversión (CAPEX)
                    </span>
                    <span className="num text-lg font-black text-principal">
                      {hasPositiveCapex
                        ? fmtCurrency(p.capex_estimado, p.moneda || 'MXN')
                        : 'En cotización'}
                    </span>
                  </div>

                  <Link
                    href={`/cliente/proyectos/${p.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-principal text-acento hover:opacity-90 transition-all shadow-sm"
                  >
                    <Calculator size={14} />
                    Ver solución y simulador
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
