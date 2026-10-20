'use server'

import { createClient } from '@/lib/supabase/server'
import { executeCreateUserAdmin } from '@/lib/domains/auth/user-provisioning'
import type { Profile } from '@/lib/types'

export type CrearUsuarioResult = {
  success?: boolean
  userId?: string
  method?: 'created' | 'invited'
  error?: string
}

export async function crearUsuarioAdmin(data: {
  email: string
  nombre: string
  empresa: string
  rol: string
  password?: string
  cliente_crm_id?: string
}): Promise<CrearUsuarioResult> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.' }
    }

    const supabase = await createClient()

    // 1. Validate caller permissions
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'No autenticado' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nombre, empresa, rol, calendario_url, cliente_crm_id, created_at')
      .eq('id', user.id)
      .single()

    if (!profile) return { error: 'No se encontró tu perfil.' }

    return await executeCreateUserAdmin(user, profile as Profile, data, supabase)
  } catch (err) {
    console.error('crearUsuarioAdmin unexpected error:', err)
    return { error: 'Error inesperado al crear usuario.' }
  }
}
