'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function adminDeleteUser(targetId: string) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.' }
    }

    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'No autenticado: ' + (userError?.message || 'sesión expirada') }

    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!profile || !['nodo_admin', 'nodo_analista'].includes(profile.rol)) {
      return { error: 'No autorizado. Solo usuarios Nodo pueden eliminar cuentas.' }
    }

    // Prevent self-deletion
    if (targetId === user.id) {
      return { error: 'No puedes eliminar tu propia cuenta.' }
    }

    const adminClient = createAdminClient()

    // Delete the auth user (cascades to profile via FK)
    const { error: authError } = await adminClient.auth.admin.deleteUser(targetId)

    if (authError) {
      return { error: 'Error al eliminar usuario: ' + authError.message }
    }

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('adminDeleteUser error:', message)
    return { error: 'Error del servidor: ' + message }
  }
}
