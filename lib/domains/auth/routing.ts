/**
 * Centralized Route Resolution & Smart Cross-Portal Deep Linking
 */

export const PORTAL_SUPPORTED_ROUTES: Record<string, RegExp[]> = {
  admin: [
    /^\/proyectos(\/.*)?$/,
    /^\/clientes(\/.*)?$/,
    /^\/instalaciones$/,
    /^\/usuarios(\/.*)?$/,
    /^\/configuracion(\/.*)?$/,
  ],
  analista: [
    /^\/proyectos(\/.*)?$/,
    /^\/clientes(\/.*)?$/,
    /^\/instalaciones$/,
    /^\/usuarios(\/.*)?$/,
    /^\/configuracion(\/.*)?$/,
  ],
  epc: [
    /^\/proyectos(\/.*)?$/,
    /^\/clientes(\/.*)?$/,
    /^\/instalaciones$/,
    /^\/nuevo$/,
    /^\/configuracion(\/.*)?$/,
  ],
  finder: [
    /^\/proyectos(\/.*)?$/,
    /^\/clientes(\/.*)?$/,
    /^\/instalaciones$/,
    /^\/nuevo$/,
    /^\/configuracion(\/.*)?$/,
  ],
  cliente: [
    /^\/proyectos\/[^/]+\/instalaciones$/,
    /^\/instalaciones$/,
    /^\/configuracion(\/.*)?$/,
  ],
  financiero: [
    /^\/proyectos(\/.*)?$/,
    /^\/instalaciones$/,
    /^\/configuracion(\/.*)?$/,
  ],
  mem: [
    /^\/configuracion(\/.*)?$/,
  ],
}

/**
 * Resolves the destination URL for cross-portal navigation.
 * When an authenticated user with targetPath visits a protected URL
 * prefixed with another portal, rewrites the sub-path if supported,
 * resolving route aliases, or falls back to /${targetPath}.
 */
export function resolveCrossPortalDeepLink(
  incomingPath: string,
  targetPath?: string,
  search: string = ''
): string {
  if (!targetPath) return '/login'

  const match = incomingPath.match(/^\/([a-z]+)(\/.*)?$/)
  const sourcePortal = match?.[1] || ''
  const subPath = match?.[2] || ''

  const queryString = search && search.startsWith('?') ? search : ''

  // Already on target portal prefix
  if (sourcePortal === targetPath) {
    return `${incomingPath}${queryString}`
  }

  // Handle route alias differences (e.g. /proyectos/nuevo vs /nuevo)
  let resolvedSubPath = subPath
  if (['epc', 'finder'].includes(targetPath) && subPath === '/proyectos/nuevo') {
    resolvedSubPath = '/nuevo'
  } else if (['admin', 'analista'].includes(targetPath) && subPath === '/nuevo') {
    resolvedSubPath = '/proyectos/nuevo'
  }

  // Check if target portal supports this sub-route
  const supportedPatterns = PORTAL_SUPPORTED_ROUTES[targetPath] || []
  const isSupported = supportedPatterns.some((pattern) => pattern.test(resolvedSubPath))

  if (isSupported) {
    return `/${targetPath}${resolvedSubPath}${queryString}`
  }

  // Fallback: unsupported route redirect to target portal root
  return `/${targetPath}`
}
