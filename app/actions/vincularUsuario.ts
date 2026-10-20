'use server'

import { createClient } from '@/lib/supabase/server'
import { executeLinkUserCliente } from '@/lib/domains/auth/user-provisioning'
import type { Profile } from '@/lib/types'

/**
 * Link or unlink a user profile to/from a client CRM card.
 * - EPC can only manage users of their own clients.
 * - Nodo Admin/Analyst can manage any.
 */
export async function vincularUsuarioCliente(data: {
  userId: string
  clienteId: string | null // null = unlink
}) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'No autenticado' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nombre, empresa, rol, calendario_url, cliente_crm_id, created_at')
      .eq('id', user.id)
      .single()

    if (!profile) return { error: 'No se encontró tu perfil.' }

    return await executeLinkUserCliente(user, profile as Profile, data, supabase)
  } catch (err) {
    console.error('vincularUsuarioCliente unexpected error:', err)
    return { error: 'Error inesperado.' }
  }
}
