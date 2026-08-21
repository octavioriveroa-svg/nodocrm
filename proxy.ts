import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// ─── Route classification ───────────────────────────────────────
// Public routes: accessible without any authentication.
// No Supabase network call is made for these — they load instantly.
const PUBLIC_PATHS = ['/login', '/registro', '/pendiente']

// Protected portal path prefixes (require authenticated user with a role)
const PORTAL_PREFIXES = ['/admin', '/epc', '/analista', '/cliente', '/financiero', '/mem', '/finder']

// Maps Supabase role → portal path prefix
const ROLE_TO_PATH: Record<string, string> = {
  epc: 'epc',
  nodo_analista: 'analista',
  nodo_admin: 'admin',
  cliente_final: 'cliente',
  financiero: 'financiero',
  suministrador: 'mem',
  finder: 'finder',
  pendiente: 'pendiente',
}

// ─── Matcher ────────────────────────────────────────────────────
// Exclude static files, images, and API routes from the proxy.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

// ─── Proxy function ─────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  // ── 1. Public routes: skip Supabase entirely ──────────────────
  // This ensures /login, /registro, /pendiente always load, even if
  // Supabase is completely down.
  const isPublicPath = PUBLIC_PATHS.some(p => path.startsWith(p))
  if (isPublicPath) {
    return NextResponse.next()
  }

  // ── 2. Refresh session (with timeout guard) ───────────────────
  const { user, authError, supabaseResponse } = await updateSession(request)

  // ── 3. Check if request is for a protected portal ─────────────
  const isProtectedPath = PORTAL_PREFIXES.some(p => path.startsWith(p))

  // ── 4. No authenticated user → redirect to login ──────────────
  if (!user || authError) {
    if (isProtectedPath) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // For non-protected, non-public paths (e.g., "/"), just continue
    return supabaseResponse
  }

  // ── 5. Determine user role ────────────────────────────────────
  // Primary: read from JWT custom claim (set by Custom Access Token Hook).
  // Fallback: read from user_metadata (legacy, for users who haven't
  //           refreshed their token since the hook was deployed).
  const jwtRole = user.app_metadata?.user_role as string | undefined
  const metadataRole = user.user_metadata?.rol as string | undefined
  const rol = jwtRole || metadataRole

  const targetPath = rol ? ROLE_TO_PATH[rol] : undefined

  // ── 6. Cross-portal access prevention ─────────────────────────
  // If a user with role 'epc' tries to access '/admin', redirect them
  // to their own portal.
  if (isProtectedPath && targetPath && !path.startsWith(`/${targetPath}`)) {
    return NextResponse.redirect(new URL(`/${targetPath}`, request.url))
  }

  // ── 7. Redirect authenticated users away from root ────────────
  if (path === '/') {
    if (targetPath) {
      return NextResponse.redirect(new URL(`/${targetPath}`, request.url))
    }
  }

  return supabaseResponse
}

// For backwards compatibility if middleware export is called
export const middleware = proxy
export default proxy
