'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function adminUpdateEmail(targetId: string, newEmail: string) {
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
      return { error: 'No autorizado. Solo administradores pueden cambiar emails.' }
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      return { error: 'Formato de email inválido.' }
    }

    const adminClient = createAdminClient()

    const { error: authError } = await adminClient.auth.admin.updateUserById(targetId, {
      email: newEmail,
      email_confirm: true,
    })

    if (authError) {
      console.error('Error updating email:', authError)
      return { error: 'Error al actualizar email: ' + authError.message }
    }

    return { success: true }
  } catch (err) {
    console.error('adminUpdateEmail unexpected error:', err)
    return { error: 'Error inesperado al actualizar email.' }
  }
}
