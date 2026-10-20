'use server'

import { createClient } from '@/lib/supabase/server'
import { executeResetPassword } from '@/lib/domains/auth/user-provisioning'
import type { Profile } from '@/lib/types'

export async function adminResetPassword(targetId: string, newPassword: string) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        error:
          'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor. Agrégala en Vercel → Settings → Environment Variables.',
      }
    }

    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'No autenticado: ' + (userError?.message || 'sesión expirada') }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nombre, empresa, rol, calendario_url, cliente_crm_id, created_at')
      .eq('id', user.id)
      .single()

    return await executeResetPassword(user, profile as Profile, targetId, newPassword)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('adminResetPassword error:', message)
    return { error: 'Error del servidor: ' + message }
  }
}
