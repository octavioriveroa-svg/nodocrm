import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Profile, Rol } from '@/lib/types'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  validateUserCreationPermission,
  validateUserInvitationPermission,
} from './permissions'

export interface CreateUserInput {
  email: string
  nombre: string
  empresa: string
  rol: string
  password?: string
  cliente_crm_id?: string
}

export interface InviteUserInput {
  email: string
  nombre: string
  empresa: string
  rol: 'cliente_final' | 'financiero' | 'epc'
  proyecto_id?: string
  cliente_crm_id?: string
}

export interface ProvisionResult {
  success?: boolean
  userId?: string
  method?: 'created' | 'invited'
  error?: string
}

export interface ProvisionUserInput {
  email: string
  nombre?: string
  rol: Rol
  empresa?: string
  telefono?: string
  cliente_crm_id?: string
}

export async function verifyClientBelongsToEpc(
  supabase: SupabaseClient,
  clienteId: string,
  epcistaId: string
): Promise<boolean> {
  const { data: clienteData } = await supabase
    .from('clientes')
    .select('id')
    .eq('id', clienteId)
    .eq('epcista_id', epcistaId)
    .single()

  return !!clienteData
}

export async function executeCreateUserAdmin(
  callerUser: User,
  callerProfile: Profile,
  input: CreateUserInput,
  clientSupabase: SupabaseClient
): Promise<ProvisionResult> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.' }
    }

    const permCheck = validateUserCreationPermission(callerProfile.rol, input.rol)
    if (!permCheck.allowed) {
      return { error: permCheck.error }
    }

    const isEpc = callerProfile.rol === 'epc'
    if (isEpc && input.cliente_crm_id) {
      const belongs = await verifyClientBelongsToEpc(clientSupabase, input.cliente_crm_id, callerUser.id)
      if (!belongs) {
        return { error: 'No autorizado: este cliente no te pertenece.' }
      }
    }

    const adminClient = createAdminClient()

    const profilePayload: Record<string, unknown> = {
      nombre: input.nombre,
      empresa: input.empresa,
      rol: input.rol,
    }
    if (input.cliente_crm_id) {
      profilePayload.cliente_crm_id = input.cliente_crm_id
    }

    if (input.password && input.password.length >= 6) {
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          nombre: input.nombre,
          empresa: input.empresa,
          rol: input.rol,
        },
      })

      if (authError) {
        console.error('Error creating user:', authError)
        return { error: 'Error al crear usuario: ' + authError.message }
      }

      const userId = authData.user.id

      const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({ id: userId, ...profilePayload })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        return { error: 'Usuario creado en auth pero error al crear perfil: ' + profileError.message }
      }

      return { success: true, userId, method: 'created' }
    } else {
      const { data: authData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(input.email, {
        data: {
          nombre: input.nombre,
          empresa: input.empresa,
          rol: input.rol,
        },
      })

      if (authError) {
        console.error('Error inviting user:', authError)
        return { error: 'Error al invitar usuario: ' + authError.message }
      }

      const userId = authData.user.id

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
    console.error('executeCreateUserAdmin unexpected error:', err)
    return { error: 'Error inesperado al crear usuario.' }
  }
}

export async function executeInviteUser(
  callerUser: User,
  callerProfile: Profile,
  input: InviteUserInput,
  clientSupabase: SupabaseClient
): Promise<ProvisionResult> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.' }
    }

    const permCheck = validateUserInvitationPermission(callerProfile.rol, input.rol)
    if (!permCheck.allowed) {
      return { error: permCheck.error }
    }

    if (callerProfile.rol === 'epc' && input.cliente_crm_id) {
      const belongs = await verifyClientBelongsToEpc(clientSupabase, input.cliente_crm_id, callerUser.id)
      if (!belongs) {
        return { error: 'No autorizado: este cliente no te pertenece' }
      }
    }

    const adminAuthClient = createAdminClient()

    const { data: authData, error: authError } = await adminAuthClient.auth.admin.inviteUserByEmail(input.email, {
      data: {
        nombre: input.nombre,
        empresa: input.empresa,
        rol: input.rol,
      },
    })

    if (authError) {
      console.error('Error inviting user:', authError)
      return { error: 'Error al enviar invitación: ' + authError.message }
    }

    const userId = authData.user.id

    const profilePayload: Record<string, unknown> = {
      id: userId,
      nombre: input.nombre,
      empresa: input.empresa,
      rol: input.rol,
    }
    if (input.cliente_crm_id) {
      profilePayload.cliente_crm_id = input.cliente_crm_id
    }

    const { error: profileError } = await adminAuthClient
      .from('profiles')
      .upsert(profilePayload)

    if (profileError) {
      console.error('Error updating profile:', profileError)
      return { error: 'Error al configurar el perfil del usuario.' }
    }

    if (input.proyecto_id) {
      const column = input.rol === 'cliente_final' ? 'cliente_id' : 'financiero_id'
      const value = input.rol === 'cliente_final' && input.cliente_crm_id ? input.cliente_crm_id : userId

      const { error: projectError } = await adminAuthClient
        .from('proyectos')
        .update({ [column]: value })
        .eq('id', input.proyecto_id)

      if (projectError) {
        console.error('Error linking project:', projectError)
      }
    }

    return { success: true, userId }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('executeInviteUser error:', message)
    return { error: 'Error del servidor: ' + message }
  }
}

export async function executeDeleteUser(
  callerUser: User,
  callerProfile: Profile,
  targetId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!targetId || typeof targetId !== 'string') {
      return { error: 'ID de usuario inválido.' }
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.' }
    }

    if (!callerProfile || callerProfile.rol !== 'nodo_admin') {
      return { error: 'No autorizado. Solo administradores pueden eliminar cuentas.' }
    }

    if (targetId === callerUser.id) {
      return { error: 'No puedes eliminar tu propia cuenta.' }
    }

    const adminClient = createAdminClient()
    const { error: authError } = await adminClient.auth.admin.deleteUser(targetId)

    if (authError) {
      return { error: 'Error al eliminar usuario: ' + authError.message }
    }

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('executeDeleteUser error:', message)
    return { error: 'Error del servidor: ' + message }
  }
}

export async function executeResetPassword(
  _callerUser: User,
  callerProfile: Profile,
  targetId: string,
  newPassword: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        error:
          'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor. Agrégala en Vercel → Settings → Environment Variables.',
      }
    }

    if (!callerProfile || callerProfile.rol !== 'nodo_admin') {
      return { error: 'No autorizado. Solo administradores pueden cambiar contraseñas.' }
    }

    if (!newPassword || newPassword.length < 6) {
      return { error: 'La contraseña debe tener al menos 6 caracteres.' }
    }

    const adminClient = createAdminClient()
    const { error: authError } = await adminClient.auth.admin.updateUserById(targetId, {
      password: newPassword,
    })

    if (authError) {
      return { error: 'Error al cambiar contraseña: ' + authError.message }
    }

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('executeResetPassword error:', message)
    return { error: 'Error del servidor: ' + message }
  }
}

export async function executeUpdateEmail(
  _callerUser: User,
  callerProfile: Profile,
  targetId: string,
  newEmail: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        error:
          'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor. Agrégala en Vercel → Settings → Environment Variables.',
      }
    }

    if (!callerProfile || callerProfile.rol !== 'nodo_admin') {
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

export async function executeLinkUserCliente(
  callerUser: User,
  callerProfile: Profile,
  data: { userId: string; clienteId: string | null },
  clientSupabase: SupabaseClient
): Promise<{ success?: boolean; error?: string }> {
  try {
    const isNodo = ['nodo_admin', 'nodo_analista'].includes(callerProfile.rol)
    const isEpc = callerProfile.rol === 'epc'

    if (!isNodo && !isEpc) {
      return { error: 'No autorizado.' }
    }

    if (isEpc && data.clienteId) {
      const belongs = await verifyClientBelongsToEpc(clientSupabase, data.clienteId, callerUser.id)
      if (!belongs) {
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
    console.error('executeLinkUserCliente unexpected error:', err)
    return { error: 'Error inesperado.' }
  }
}

export async function provisionUserAccount(
  callerId: string,
  input: ProvisionUserInput,
  clientSupabase: SupabaseClient,
  options?: { sendInvite?: boolean }
): Promise<ProvisionResult> {
  const { data: callerProfile } = await clientSupabase
    .from('profiles')
    .select('*')
    .eq('id', callerId)
    .single()

  if (!callerProfile) {
    return { error: 'No se encontró el perfil del usuario autenticado.' }
  }

  const callerUser = { id: callerId } as User

  if (options?.sendInvite) {
    return executeInviteUser(
      callerUser,
      callerProfile as Profile,
      {
        email: input.email,
        nombre: input.nombre || '',
        empresa: input.empresa || '',
        rol: input.rol as 'cliente_final' | 'financiero' | 'epc',
        cliente_crm_id: input.cliente_crm_id,
      },
      clientSupabase
    )
  }

  return executeCreateUserAdmin(
    callerUser,
    callerProfile as Profile,
    {
      email: input.email,
      nombre: input.nombre || '',
      empresa: input.empresa || '',
      rol: input.rol,
      cliente_crm_id: input.cliente_crm_id,
    },
    clientSupabase
  )
}
