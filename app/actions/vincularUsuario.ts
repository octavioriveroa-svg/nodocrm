'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Link or unlink a user profile to/from a client CRM card.
 * - EPC can only manage users of their own clients.
 * - Nodo Admin/Analyst can manage any.
 */
export async function vincularUsuarioCliente(data: {
  userId: string
  clienteId: string | null  // null = unlink
}) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'No autenticado' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!profile) return { error: 'No se encontró tu perfil.' }

    const isNodo = ['nodo_admin', 'nodo_analista'].includes(profile.rol)
    const isEpc = profile.rol === 'epc'

    if (!isNodo && !isEpc) {
      return { error: 'No autorizado.' }
    }

    // If EPC, verify the client belongs to them
    if (isEpc && data.clienteId) {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('id')
        .eq('id', data.clienteId)
        .eq('epcista_id', user.id)
        .single()

      if (!clienteData) {
        return { error: 'No autorizado: este cliente no te pertenece.' }
      }
    }

    const adminClient = createAdminClient()

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ cliente_crm_id: data.clienteId })
      .eq('id', data.userId)

    if (updateError) {
      console.error('Error linking user:', updateError)
      return { error: 'Error al vincular usuario: ' + updateError.message }
    }

    return { success: true }
  } catch (err) {
    console.error('vincularUsuarioCliente unexpected error:', err)
    return { error: 'Error inesperado.' }
  }
}
