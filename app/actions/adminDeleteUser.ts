'use server'

import { createClient } from '@/lib/supabase/server'
import { executeDeleteUser } from '@/lib/domains/auth/user-provisioning'
import type { Profile } from '@/lib/types'

export type AdminDeleteUserResult = {
  success?: boolean
  error?: string
}

export async function adminDeleteUser(targetId: string): Promise<AdminDeleteUserResult> {
  try {
    if (!targetId || typeof targetId !== 'string') {
      return { error: 'ID de usuario inválido.' }
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.' }
    }

    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'No autenticado: ' + (userError?.message || 'sesión expirada') }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nombre, empresa, rol, calendario_url, cliente_crm_id, created_at')
      .eq('id', user.id)
      .single()

    return await executeDeleteUser(user, profile as Profile, targetId)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('adminDeleteUser error:', message)
    return { error: 'Error del servidor: ' + message }
  }
}
