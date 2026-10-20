import type { Rol } from '@/lib/types'

export type PortalPrefix = 'admin' | 'analista' | 'epc' | 'finder' | 'cliente' | 'financiero' | 'mem' | 'pendiente'

export const NODO_ROLES: readonly Rol[] = ['nodo_admin', 'nodo_analista'] as const
export const VALID_USER_ROLES: readonly Rol[] = [
  'epc',
  'nodo_analista',
  'nodo_admin',
  'cliente_final',
  'financiero',
  'suministrador',
  'finder',
] as const

export const VALID_ROLES = VALID_USER_ROLES

export const ROLE_TO_PORTAL_PREFIX: Record<Rol, PortalPrefix> = {
  nodo_admin: 'admin',
  nodo_analista: 'analista',
  epc: 'epc',
  finder: 'finder',
  cliente_final: 'cliente',
  financiero: 'financiero',
  suministrador: 'mem',
  pendiente: 'pendiente',
}

export const PORTAL_PREFIX_TO_ROLE: Record<string, Rol> = {
  admin: 'nodo_admin',
  analista: 'nodo_analista',
  epc: 'epc',
  finder: 'finder',
  cliente: 'cliente_final',
  financiero: 'financiero',
  mem: 'suministrador',
  pendiente: 'pendiente',
}

// Role guards
export function isNodoRole(rol?: Rol | string | null): boolean {
  return rol === 'nodo_admin' || rol === 'nodo_analista'
}

export function isAdminRole(rol?: Rol | string | null): boolean {
  return rol === 'nodo_admin'
}

export function isAnalystRole(rol?: Rol | string | null): boolean {
  return rol === 'nodo_analista'
}

export function isEpcRole(rol?: Rol | string | null): boolean {
  return rol === 'epc'
}

export function isFinderRole(rol?: Rol | string | null): boolean {
  return rol === 'finder'
}

export function isClienteRole(rol?: Rol | string | null): boolean {
  return rol === 'cliente_final'
}

export function isFinancieroRole(rol?: Rol | string | null): boolean {
  return rol === 'financiero'
}

// Routing helpers
export function getPortalPrefix(rol?: Rol | string | null): PortalPrefix {
  if (!rol) return 'pendiente'
  return ROLE_TO_PORTAL_PREFIX[rol as Rol] || 'pendiente'
}

export function getPortalPrefixForRole(rol: Rol | string): string {
  return getPortalPrefix(rol)
}

export function getPortalBackHref(
  rol?: Rol | string | null,
  section: 'proyectos' | 'clientes' | 'root' = 'proyectos'
): string {
  const prefix = getPortalPrefix(rol)
  if (prefix === 'pendiente') return '/pendiente'
  if (section === 'root') return `/${prefix}`
  return `/${prefix}/${section}`
}

// Action capability checks
export function canChangeProjectStage(
  rol?: Rol | string | null,
  currentStage?: string,
  nextStage?: string
): boolean {
  if (currentStage && nextStage && currentStage === nextStage) return false
  return rol === 'nodo_admin' || rol === 'nodo_analista' || rol === 'epc'
}

export function canDeleteProject(
  user: { id?: string; rol: Rol | string } | Rol | string,
  proyecto?: { epcista_id?: string | null; created_by?: string | null; currentUserId?: string }
): boolean {
  const role = typeof user === 'string' ? user : user?.rol
  const userId = typeof user === 'string' ? proyecto?.currentUserId : user?.id
  const epcistaId = proyecto?.epcista_id ?? proyecto?.created_by

  if (role === 'nodo_admin') return true
  if (role === 'epc' && epcistaId && userId && epcistaId === userId) return true
  return false
}


export function canEditProjectGeneral(
  user: { id?: string; rol: Rol | string } | Rol | string,
  proyecto?: { epcista_id?: string | null; created_by?: string | null; currentUserId?: string }
): boolean {
  const role = typeof user === 'string' ? user : user?.rol
  const userId = typeof user === 'string' ? proyecto?.currentUserId : user?.id
  const epcistaId = proyecto?.epcista_id ?? proyecto?.created_by

  if (role === 'nodo_admin' || role === 'nodo_analista') return true
  if (role === 'epc' && (!epcistaId || (userId && epcistaId === userId))) return true
  return false
}

export function canEditTechnicalSolution(
  user: { id?: string; rol: Rol | string } | Rol | string,
  proyecto?: { epcista_id?: string | null; created_by?: string | null; currentUserId?: string }
): boolean {
  const role = typeof user === 'string' ? user : user?.rol
  const userId = typeof user === 'string' ? proyecto?.currentUserId : user?.id
  const epcistaId = proyecto?.epcista_id ?? proyecto?.created_by

  if (role === 'nodo_admin' || role === 'nodo_analista') return true
  if (role === 'epc' && (!epcistaId || (userId && epcistaId === userId))) return true
  return false
}

export function canSelectWinningOption(
  user: { id?: string; rol: Rol | string } | Rol | string,
  proyecto?: { epcista_id?: string | null; created_by?: string | null; currentUserId?: string }
): boolean {
  const role = typeof user === 'string' ? user : user?.rol
  const userId = typeof user === 'string' ? proyecto?.currentUserId : user?.id
  const epcistaId = proyecto?.epcista_id ?? proyecto?.created_by

  if (role === 'nodo_admin' || role === 'nodo_analista') return true
  if (role === 'epc' && (!epcistaId || (userId && epcistaId === userId))) return true
  return false
}


export function canManageClientUsers(callerRol?: Rol | string | null): boolean {
  return callerRol === 'nodo_admin' || callerRol === 'nodo_analista' || callerRol === 'epc'
}

// User creation & invitation permission validation
// NOTE: Preserves verbatim error strings asserted by tests/tier1, tier2, and challenger-stress-suite
export function validateUserCreationPermission(
  callerRol?: Rol | string | null,
  targetRol?: string
): { allowed: boolean; error?: string } {
  const isNodo = callerRol === 'nodo_admin' || callerRol === 'nodo_analista'
  const isEpc = callerRol === 'epc'
  const isFinder = callerRol === 'finder'

  if (!isNodo && !isEpc && !isFinder) {
    return { allowed: false, error: 'No autorizado para crear usuarios.' }
  }

  if (!targetRol || !(VALID_USER_ROLES as readonly string[]).includes(targetRol)) {
    return { allowed: false, error: 'Rol inválido: ' + (targetRol ?? '') }
  }

  if (callerRol === 'nodo_analista' && targetRol === 'nodo_admin') {
    return { allowed: false, error: 'No autorizado: solo los administradores pueden crear cuentas de administrador.' }
  }

  if (targetRol === 'nodo_admin' && callerRol !== 'nodo_admin') {
    return { allowed: false, error: 'No autorizado: solo los administradores pueden crear cuentas de administrador.' }
  }

  if (isEpc && !['cliente_final', 'financiero'].includes(targetRol)) {
    return { allowed: false, error: 'No autorizado para crear este tipo de usuario.' }
  }

  if (isFinder && targetRol !== 'epc') {
    return { allowed: false, error: 'No autorizado para crear este tipo de usuario.' }
  }

  return { allowed: true }
}

export function validateUserInvitationPermission(
  callerRol?: Rol | string | null,
  targetRol?: string
): { allowed: boolean; error?: string } {
  if (!callerRol || !['epc', 'nodo_admin', 'nodo_analista', 'finder'].includes(callerRol)) {
    return { allowed: false, error: 'No autorizado para enviar invitaciones' }
  }

  if (callerRol === 'nodo_analista' && targetRol === 'nodo_admin') {
    return { allowed: false, error: 'No autorizado: solo los administradores pueden invitar cuentas de administrador.' }
  }

  if (targetRol === 'nodo_admin' && callerRol !== 'nodo_admin') {
    return { allowed: false, error: 'No autorizado: solo los administradores pueden invitar cuentas de administrador.' }
  }

  if (callerRol === 'epc' && !['cliente_final', 'financiero'].includes(targetRol as string)) {
    return { allowed: false, error: 'No autorizado para invitar este tipo de usuario' }
  }

  if (callerRol === 'finder' && targetRol !== 'epc') {
    return { allowed: false, error: 'No autorizado para invitar este tipo de usuario' }
  }

  return { allowed: true }
}

export function canInviteRole(
  actorRole: Rol,
  targetRole: Rol
): { allowed: boolean; error?: string } {
  return validateUserInvitationPermission(actorRole, targetRole)
}
