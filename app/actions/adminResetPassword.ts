'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function adminResetPassword(targetId: string, newPassword: string) {
  const supabase = await createClient()

  // 1. Verify caller is nodo_admin
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.rol !== 'nodo_admin') {
    return { error: 'No autorizado. Solo administradores pueden cambiar contraseñas.' }
  }

  // 2. Validate password
  if (!newPassword || newPassword.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  // 3. Use admin client to update the password
  const adminClient = createAdminClient()

  const { error: authError } = await adminClient.auth.admin.updateUserById(targetId, {
    password: newPassword,
  })

  if (authError) {
    console.error('Error resetting password:', authError)
    return { error: 'Error al cambiar contraseña: ' + authError.message }
  }

  return { success: true }
}
