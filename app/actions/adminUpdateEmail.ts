'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function adminUpdateEmail(targetId: string, newEmail: string) {
  try {
    // Check env vars first
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
      return { error: 'No autorizado. Solo administradores pueden cambiar emails.' }
    }

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
      return { error: 'Error al actualizar email: ' + authError.message }
    }

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('adminUpdateEmail error:', message)
    return { error: 'Error del servidor: ' + message }
  }
}
