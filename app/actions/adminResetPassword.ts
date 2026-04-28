'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function adminResetPassword(targetId: string, newPassword: string) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor. Agrégala en Vercel → Settings → Environment Variables.' }
    }

    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'No autenticado: ' + (userError?.message || 'sesión expirada') }

    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!profile || profile.rol !== 'nodo_admin') {
      return { error: 'No autorizado. Solo administradores pueden cambiar contraseñas.' }
    }

    if (!newPassword || newPassword.length < 6) {
      return { error: 'La contraseña debe tener al menos 6 caracteres.' }
    }

    const adminClient = createAdminClient()

    const { error: authError } = await adminClient.auth.admin.updateUserById(targetId, {
      password: newPassword,
    })

    if (authError) {
      return { error: 'Error al cambiar contraseña: ' + authError.message }
    }

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('adminResetPassword error:', message)
    return { error: 'Error del servidor: ' + message }
  }
}
