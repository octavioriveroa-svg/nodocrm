'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function crearUsuarioAdmin(data: {
  email: string
  nombre: string
  empresa: string
  rol: string
  password?: string
  cliente_crm_id?: string
}) {
  try {
  const supabase = await createClient()
  
  // 1. Validate caller permissions
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  
  if (!profile) return { error: 'No se encontró tu perfil.' }

  // Permission matrix:
  // - nodo_admin: can create any role
  // - nodo_analista: can create any role
  // - epc: can only create cliente_final or financiero (for their own clients)
  const isNodo = ['nodo_admin', 'nodo_analista'].includes(profile.rol)
  const isEpc = profile.rol === 'epc'
  const isFinder = profile.rol === 'finder'

  if (!isNodo && !isEpc && !isFinder) {
    return { error: 'No autorizado para crear usuarios.' }
  }

  // 2. Validate role
  const VALID_ROLES = ['epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador', 'finder']
  if (!VALID_ROLES.includes(data.rol)) {
    return { error: 'Rol inválido: ' + data.rol }
  }

  // EPC can only create client-facing roles
  if (isEpc && !['cliente_final', 'financiero'].includes(data.rol)) {
    return { error: 'No autorizado para crear este tipo de usuario.' }
  }

  // Finder can only create epc users
  if (isFinder && data.rol !== 'epc') {
    return { error: 'No autorizado para crear este tipo de usuario.' }
  }

  // 3. If EPC, verify the client belongs to them
  if (isEpc && data.cliente_crm_id) {
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', data.cliente_crm_id)
      .eq('epcista_id', user.id)
      .single()
    
    if (!clienteData) {
      return { error: 'No autorizado: este cliente no te pertenece.' }
    }
  }

  // 4. Use service-role admin client to create the user
  const adminClient = createAdminClient()

  const profilePayload: Record<string, unknown> = {
    nombre: data.nombre,
    empresa: data.empresa,
    rol: data.rol,
  }
  if (data.cliente_crm_id) {
    profilePayload.cliente_crm_id = data.cliente_crm_id
  }

  // If password provided → create user directly. Otherwise → send invite email.
  if (data.password && data.password.length >= 6) {
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nombre: data.nombre,
        empresa: data.empresa,
        rol: data.rol,
      }
    })

    if (authError) {
      console.error('Error creating user:', authError)
      return { error: 'Error al crear usuario: ' + authError.message }
    }

    const userId = authData.user.id

    // Create profile with org link
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({ id: userId, ...profilePayload })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      return { error: 'Usuario creado en auth pero error al crear perfil: ' + profileError.message }
    }

    return { success: true, userId, method: 'created' }

  } else {
    // Send invite email
    const { data: authData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(data.email, {
      data: {
        nombre: data.nombre,
        empresa: data.empresa,
        rol: data.rol,
      }
    })

    if (authError) {
      console.error('Error inviting user:', authError)
      return { error: 'Error al invitar usuario: ' + authError.message }
    }

    const userId = authData.user.id

    // Create profile with org link
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({ id: userId, ...profilePayload })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      return { error: 'Invitación enviada pero error al crear perfil: ' + profileError.message }
    }

    return { success: true, userId, method: 'invited' }
  }
  } catch (err) {
    console.error('crearUsuarioAdmin unexpected error:', err)
    return { error: 'Error inesperado al crear usuario.' }
  }
}
