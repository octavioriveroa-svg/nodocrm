import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CalculadoraTemplate } from '@/lib/types'
import {
  FALLBACK_HORIZONTE_OPCIONES,
  FALLBACK_TEMPLATE_CAMPOS,
  FALLBACK_TEMPLATE_FORMULAS,
} from '@/lib/calculator/template-schema'
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

function buildFallbackTemplate(): CalculadoraTemplate {
  const now = new Date().toISOString()
  return {
    id: 'fallback-v1',
    version: 1,
    nombre: 'Plantilla Racional Estándar Nodo MX v1',
    descripcion: 'Plantilla racional por defecto en memoria.',
    modo: 'default',
    is_active: true,
    campos: FALLBACK_TEMPLATE_CAMPOS,
    formulas: FALLBACK_TEMPLATE_FORMULAS,
    horizonte_opciones: [...FALLBACK_HORIZONTE_OPCIONES],
    excel_archivo_nombre: null,
    excel_archivo_hash: null,
    excel_hoja_origen: null,
    excel_mapeo_campos: null,
    excel_preview_snapshot: null,
    validation_status: 'valid',
    validation_errors: [],
    notas: null,
    created_by: null,
    created_at: now,
    updated_at: now,
  }
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
  const effectiveTemplates = migrationPending ? [buildFallbackTemplate()] : templates
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
