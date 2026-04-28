'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function crearUsuarioAdmin(data: {
  email: string
  nombre: string
  empresa: string
  rol: string
  password?: string
}) {
  const supabase = await createClient()
  
  // 1. Validate caller is nodo_admin
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', session.user.id)
    .single()
  
  if (!profile || profile.rol !== 'nodo_admin') {
    return { error: 'No autorizado. Solo administradores pueden crear usuarios.' }
  }

  // 2. Validate role
  const VALID_ROLES = ['epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador']
  if (!VALID_ROLES.includes(data.rol)) {
    return { error: 'Rol inválido: ' + data.rol }
  }

  // 3. Use service-role admin client to create the user
  const adminClient = createAdminClient()

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

    // 4. Create profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        nombre: data.nombre,
        empresa: data.empresa,
        rol: data.rol,
      })

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

    // Create profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        nombre: data.nombre,
        empresa: data.empresa,
        rol: data.rol,
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      return { error: 'Invitación enviada pero error al crear perfil: ' + profileError.message }
    }

    return { success: true, userId, method: 'invited' }
  }
}
