'use server'

import { createClient } from '@/lib/supabase/server'
import { executeInviteUser } from '@/lib/domains/auth/user-provisioning'
import type { Profile } from '@/lib/types'

export type InvitarUsuarioResult = {
  success?: boolean
  userId?: string
  error?: string
}

export async function invitarUsuario(data: {
  email: string
  nombre: string
  empresa: string
  rol: 'cliente_final' | 'financiero' | 'epc'
  proyecto_id?: string
  cliente_crm_id?: string
}): Promise<InvitarUsuarioResult> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.' }
    }

    const supabase = await createClient()

    // 1. Validate permissions
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'No autenticado' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nombre, empresa, rol, calendario_url, cliente_crm_id, created_at')
      .eq('id', user.id)
      .single()

    if (!profile) return { error: 'No se encontró tu perfil.' }

    return await executeInviteUser(user, profile as Profile, data, supabase)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('invitarUsuario error:', message)
    return { error: 'Error del servidor: ' + message }
  }
}
