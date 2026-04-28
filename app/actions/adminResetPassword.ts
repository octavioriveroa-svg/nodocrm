'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function adminResetPassword(targetId: string, newPassword: string) {
  try {
    const supabase = await createClient()

    // Use getUser() instead of getSession() — more reliable in server actions
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'No autenticado' }

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
      console.error('Error resetting password:', authError)
      return { error: 'Error al cambiar contraseña: ' + authError.message }
    }

    return { success: true }
  } catch (err) {
    console.error('adminResetPassword unexpected error:', err)
    return { error: 'Error inesperado al cambiar contraseña.' }
  }
}
