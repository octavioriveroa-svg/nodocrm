'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function invitarUsuario(data: {
  email: string
  nombre: string
  empresa: string
  rol: 'cliente_final' | 'financiero'
  proyecto_id: string
}) {
  const supabase = await createClient()
  
  // 1. Validate permissions (Only EPC or Admin can invite)
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

  // 2. Init Admin Client
  const adminAuthClient = createAdminClient()

  // 3. Invite the user
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

  // 4. Ensure profile exists (sometimes the trigger handles it, but just in case we upsert)
  const { error: profileError } = await adminAuthClient
    .from('profiles')
    .upsert({
      id: userId,
      nombre: data.nombre,
      empresa: data.empresa,
      rol: data.rol
    })

  if (profileError) {
    console.error('Error updating profile:', profileError)
    return { error: 'Error al configurar el perfil del usuario.' }
  }

  // 5. Link the user to the project
  const column = data.rol === 'cliente_final' ? 'cliente_id' : 'financiero_id'
  
  const { error: projectError } = await adminAuthClient
    .from('proyectos')
    .update({ [column]: userId })
    .eq('id', data.proyecto_id)
  
  if (projectError) {
    console.error('Error linking project:', projectError)
    return { error: 'Error al vincular el usuario al proyecto.' }
  }

  return { success: true }
}
