'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function adminUpdateEmail(targetId: string, newEmail: string) {
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
    return { error: 'No autorizado. Solo administradores pueden cambiar emails.' }
  }

  // 2. Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(newEmail)) {
    return { error: 'Formato de email inválido.' }
  }

  // 3. Use admin client to update the auth email
  const adminClient = createAdminClient()

  const { error: authError } = await adminClient.auth.admin.updateUserById(targetId, {
    email: newEmail,
    email_confirm: true, // Auto-confirm so the user can login immediately
  })

  if (authError) {
    console.error('Error updating email:', authError)
    return { error: 'Error al actualizar email: ' + authError.message }
  }

  return { success: true }
}
