import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CalculadoraTemplate } from '@/lib/types'
import { buildFallbackCalculatorTemplate } from '@/lib/calculator/load-context'
import { AdminCalculadoraConfig } from '@/components/calculator/AdminCalculadoraConfig'

const ROLE_TO_PATH: Record<string, string> = {
  epc: '/epc',
  nodo_analista: '/analista',
  nodo_admin: '/admin',
  cliente_final: '/cliente',
  financiero: '/financiero',
  suministrador: '/mem',
  finder: '/finder',
  pendiente: '/pendiente',
}

export default async function AdminCalculadoraConfigPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!profile || profile.rol !== 'nodo_admin') {
    const target = profile?.rol ? ROLE_TO_PATH[profile.rol] : undefined
    redirect(target || '/login')
  }

  const { data: rows, error: tplError } = await supabase
    .from('calculadora_templates')
    .select('*')
    .order('version', { ascending: false })

  const templates = ((rows ?? []) as CalculadoraTemplate[])
  const migrationPending = Boolean(tplError) || templates.length === 0
  const effectiveTemplates = migrationPending ? [buildFallbackCalculatorTemplate()] : templates
  const activeTemplate =
    effectiveTemplates.find((t) => t.is_active) ?? effectiveTemplates[0]

  return (
    <AdminCalculadoraConfig
      mode="page"
      initialTemplates={effectiveTemplates}
      activeTemplate={activeTemplate}
      migrationPending={migrationPending}
    />
  )
}
