'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function invitarUsuario(data: {
  email: string
  nombre: string
  empresa: string
  rol: 'cliente_final' | 'financiero'
  proyecto_id?: string
  cliente_crm_id?: string
}) {
  const supabase = await createClient()
  
  // 1. Validate permissions (EPC, Admin, or Analyst can invite)
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', session.user.id)
    .single()
  
  if (!profile || !['epc', 'nodo_admin', 'nodo_analista'].includes(profile.rol)) {
    return { error: 'No autorizado para enviar invitaciones' }
  }

  // 2. EPC can only invite cliente_final or financiero
  if (profile.rol === 'epc' && !['cliente_final', 'financiero'].includes(data.rol)) {
    return { error: 'No autorizado para invitar este tipo de usuario' }
  }

  // 3. If EPC, verify the client belongs to them
  if (profile.rol === 'epc' && data.cliente_crm_id) {
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', data.cliente_crm_id)
      .eq('epcista_id', session.user.id)
      .single()
    
    if (!clienteData) {
      return { error: 'No autorizado: este cliente no te pertenece' }
    }
  }

  // 4. Init Admin Client
  const adminAuthClient = createAdminClient()

  // 5. Invite the user
  const { data: authData, error: authError } = await adminAuthClient.auth.admin.inviteUserByEmail(data.email, {
    data: {
      nombre: data.nombre,
      empresa: data.empresa,
      rol: data.rol
    }
  })

  if (authError) {
    console.error('Error inviting user:', authError)
    return { error: 'Error al enviar invitación: ' + authError.message }
  }

  const userId = authData.user.id

  // 6. Ensure profile exists with cliente_crm_id
  const profilePayload: Record<string, unknown> = {
    id: userId,
    nombre: data.nombre,
    empresa: data.empresa,
    rol: data.rol,
  }
  if (data.cliente_crm_id) {
    profilePayload.cliente_crm_id = data.cliente_crm_id
  }

  const { error: profileError } = await adminAuthClient
    .from('profiles')
    .upsert(profilePayload)

  if (profileError) {
    console.error('Error updating profile:', profileError)
    return { error: 'Error al configurar el perfil del usuario.' }
  }

  // 7. Link the user to a specific project (optional, legacy support)
  if (data.proyecto_id) {
    const column = data.rol === 'cliente_final' ? 'cliente_id' : 'financiero_id'
    
    const { error: projectError } = await adminAuthClient
      .from('proyectos')
      .update({ [column]: userId })
      .eq('id', data.proyecto_id)
    
    if (projectError) {
      console.error('Error linking project:', projectError)
      // Non-fatal: the user was still created
    }
  }

  return { success: true, userId }
}
