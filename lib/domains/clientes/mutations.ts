import type { SupabaseClient } from '@supabase/supabase-js'
import type { Cliente, Profile } from '@/lib/types'

export interface ClienteInput {
  razon_social: string
  rfc?: string | null
  industria?: string | null
  ubicacion_estado?: string | null
  contacto_nombre: string
  contacto_cargo?: string | null
  contacto_email?: string | null
  contacto_telefono?: string | null
  notas?: string | null
  epcista_id?: string | null
}

export async function createCliente(
  supabase: SupabaseClient,
  payload: ClienteInput,
  creatorProfile: Profile
): Promise<{ success: boolean; data?: Cliente; error?: string }> {
  try {
    const isEpc = creatorProfile.rol === 'epc'
    const isFinder = creatorProfile.rol === 'finder'

    const insertPayload: Record<string, unknown> = {
      razon_social: payload.razon_social.trim(),
      rfc: payload.rfc?.trim() || null,
      industria: payload.industria || null,
      ubicacion_estado: payload.ubicacion_estado || null,
      contacto_nombre: payload.contacto_nombre.trim(),
      contacto_cargo: payload.contacto_cargo?.trim() || null,
      contacto_email: payload.contacto_email?.trim() || null,
      contacto_telefono: payload.contacto_telefono?.trim() || null,
      notas: payload.notas?.trim() || null,
    }

    if (isEpc) {
      insertPayload.epcista_id = creatorProfile.id
    } else if (isFinder) {
      insertPayload.finder_id = creatorProfile.id
      if (payload.epcista_id) {
        insertPayload.epcista_id = payload.epcista_id
      }
    } else if (payload.epcista_id) {
      insertPayload.epcista_id = payload.epcista_id
    } else {
      insertPayload.epcista_id = creatorProfile.id
    }

    const { data, error } = await supabase.from('clientes').insert(insertPayload).select().single()
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true, data: data as Cliente }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export async function updateCliente(
  supabase: SupabaseClient,
  clienteId: string,
  payload: ClienteInput
): Promise<{ success: boolean; data?: Cliente; error?: string }> {
  try {
    const updatePayload: Record<string, unknown> = {
      razon_social: payload.razon_social.trim(),
      rfc: payload.rfc?.trim() || null,
      industria: payload.industria || null,
      ubicacion_estado: payload.ubicacion_estado || null,
      contacto_nombre: payload.contacto_nombre.trim(),
      contacto_cargo: payload.contacto_cargo?.trim() || null,
      contacto_email: payload.contacto_email?.trim() || null,
      contacto_telefono: payload.contacto_telefono?.trim() || null,
      notas: payload.notas?.trim() || null,
    }

    if (payload.epcista_id !== undefined) {
      updatePayload.epcista_id = payload.epcista_id
    }

    const { data, error } = await supabase
      .from('clientes')
      .update(updatePayload)
      .eq('id', clienteId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true, data: data as Cliente }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export async function deleteCliente(
  supabase: SupabaseClient,
  clienteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('clientes').delete().eq('id', clienteId)
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}
