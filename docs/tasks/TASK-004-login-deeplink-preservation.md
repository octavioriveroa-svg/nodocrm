# Task Specification: TASK-004 — Login Deep-Link Preservation & SSR Auth Hardening (GAP-01, GAP-06)

**Task ID**: `TASK-004`  
**Task Title**: Preserve and Redirect to `returnUrl` Upon Successful Login & Secure SSR Auth  
**Target Subsystem**: Authentication Flow & Routing (`proxy.ts`, `app/login/page.tsx`, `app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx`, `lib/domains/auth/routing.ts`)  
**Priority**: P1 (High UX & Security Value)  
**Severity**: Medium (Users opening emailed or bookmarked links lose context and query parameters upon login; Server Components calling `getSession()` risk stale/spoofed tokens)  
**Status**: Completed & Verified  

---

## 1. Problem Statement & Root Cause

### 1.1 Problem Statement
1. **Unauthenticated `returnUrl` Drops Query Parameters (`proxy.ts`)**:
   When an unauthenticated user visits a deep link with query parameters (such as `/admin/clientes?tab=active`), `proxy.ts:56` sets `loginUrl.searchParams.set('returnUrl', path)`, stripping `request.nextUrl.search`.
2. **Login Page Ignores `returnUrl` (`app/login/page.tsx`)**:
   After the user enters their credentials and is authenticated, `app/login/page.tsx` ignores the `returnUrl` query parameter entirely, calls `supabase.auth.getSession()` redundantly after `signInWithPassword`, and redirects unconditionally to `/${sub}`.
3. **Server Component Unverified `getSession()` (`GAP-06`)**:
   `app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx` invokes `supabase.auth.getSession()` inside a Server Component. Under Supabase SSR security guidelines, `getSession()` does not re-validate the JWT against the Supabase Auth server.

### 1.2 Root Cause
1. In `proxy.ts:56`: `path` (`request.nextUrl.pathname`) is passed without `request.nextUrl.search`.
2. In `app/login/page.tsx`: The component never invokes `useSearchParams()` from `next/navigation` to read query parameters, and destination redirect is hardcoded to `/${sub}`.
3. In `app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx:8-11`: `getSession()` is used instead of `getUser()`.

---

## 2. Scope Boundaries

### In-Scope
1. Update `proxy.ts` (line 56):
   - Preserve query parameters when setting `returnUrl`: `loginUrl.searchParams.set('returnUrl', `${path}${request.nextUrl.search}`)`.
2. Update `app/login/page.tsx`:
   - Read `returnUrl` via `useSearchParams()`.
   - Wrap the login form component in a React `<Suspense>` boundary (per Next.js 16 App Router requirements for client components reading search params).
   - Use `authData.user.id` directly from `signInWithPassword` instead of calling `getSession()`.
   - Validate that `returnUrl` starts with `/` and does not start with `//` or `/\` (blocking protocol-relative and backslash open redirects like `//evil.com` or `/\evil.com`).
   - Split `returnUrl` into `pathPart` and `searchPart` to preserve query strings (e.g. `?tab=active`).
   - Use `resolveCrossPortalDeepLink(pathPart, sub, searchPart)` from `lib/domains/auth/routing.ts` to translate shared links across portals, resolve aliases (`/nuevo`), and preserve query parameters, while safely falling back to `/${sub}` for unauthorized routes or malformed URLs.
3. Secure Client Installations Server Component (`GAP-06`):
   - Upgrade Server Component `app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx` from `getSession()` to `getUser()`, while strictly preserving the tenant isolation lines asserted by `CustomerIsolation.2` in `tests/adversarial-m3-empirical.test.mjs`.
4. Add automated unit/integration tests in `tests/proxy-deeplinks.test.mjs` verifying cross-portal translation, route aliases, query parameter preservation, and open redirect defense.

### Out-of-Scope
- Adding multi-factor authentication (MFA) or OAuth social logins.

---

## 3. Technical Prerequisites & Dependencies
- **Dependencies**: Next.js 16 App Router (`next/navigation`), `lib/domains/auth/routing.ts`, `lib/domains/auth/permissions.ts`.

---

## 4. Inputs
- Edge Proxy: `proxy.ts` (lines 53–60)
- Login Page: `app/login/page.tsx`
- SSR Auth Target: `app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx`
- Routing Utility: `lib/domains/auth/routing.ts` (`resolveCrossPortalDeepLink`)
- Permissions Utility: `lib/domains/auth/permissions.ts` (`getPortalPrefix`)
- Test Suite: `tests/proxy-deeplinks.test.mjs`

---

## 5. Step-by-Step Implementation Instructions

### Step 1: Preserve Query Parameters in `proxy.ts`
In `proxy.ts` (lines 53–60), update `loginUrl.searchParams.set`:
```typescript
  // ── 4. No authenticated user → redirect to login ──────────────
  if (!user || authError) {
    if (isProtectedPath) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('returnUrl', `${path}${request.nextUrl.search}`)
      return NextResponse.redirect(loginUrl)
    }
    return supabaseResponse
  }
```

### Step 2: Update `app/login/page.tsx`
Refactor `app/login/page.tsx` into a `LoginForm` component wrapped by `Suspense` and using `resolveCrossPortalDeepLink` (with no unused `useRouter` import):

```tsx
'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import { resolveCrossPortalDeepLink } from '@/lib/domains/auth/routing'
import { getPortalPrefix } from '@/lib/domains/auth/permissions'

function LoginForm() {
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !authData?.user) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', authData.user.id)
      .single()

    if (profileError) {
      setError('Error obteniendo el perfil del usuario. Verifica la base de datos o contacta soporte.')
      setLoading(false)
      return
    }

    const rol = profileRow?.rol
    if (!rol) {
      setError('El usuario no tiene un rol asignado.')
      setLoading(false)
      return
    }

    if (rol === 'pendiente') {
      window.location.href = '/pendiente'
      return
    }

    const sub = getPortalPrefix(rol)

    // Validate returnUrl: must be a safe relative URL (block protocol-relative or backslash open redirects)
    const isSafeRelative =
      returnUrl &&
      returnUrl.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      !returnUrl.startsWith('/\\')

    if (isSafeRelative) {
      const [pathPart, ...queryParts] = returnUrl.split('?')
      const searchPart = queryParts.length > 0 ? `?${queryParts.join('?')}` : ''
      const destination = resolveCrossPortalDeepLink(pathPart, sub, searchPart)
      window.location.href = destination
    } else {
      window.location.href = `/${sub}`
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: 'transparent' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        <div className="glass-card p-8">
          <div className="mb-8 flex flex-col items-center">
            <h1 className="text-xl font-bold text-center tracking-tight">Bienvenido a Nodo</h1>
            <p className="text-sm text-gray-400 mt-1">Inicia sesión en tu cuenta</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-borde px-4 py-2.5 text-sm transition-all focus:border-acento focus:ring-2 focus:ring-acento/30"
                placeholder="tu@correo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-borde px-4 py-2.5 text-sm transition-all focus:border-acento focus:ring-2 focus:ring-acento/30"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-acento py-3 font-semibold text-sm text-principal shadow-sm transition-all hover:bg-acento-hover hover:shadow-md disabled:opacity-50 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-acento/50"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-8 text-gray-500">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="font-semibold text-principal hover:underline transition-all">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-principal">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  )
}
```

### Step 3: Secure Client Installations Server Component (`GAP-06`)
In `app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx`, replace `getSession()` with `getUser()` while preserving lines 19–30 verbatim for `CustomerIsolation.2` in `tests/adversarial-m3-empirical.test.mjs`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SharedProjectInstalacionesView from '@/components/proyectos/SharedProjectInstalacionesView'

export default async function ClienteInstalacionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('cliente_crm_id, rol')
    .eq('id', user.id)
    .single()

  if (!profile || profile.rol !== 'cliente_final') redirect('/login')

  if (!profile.cliente_crm_id) redirect('/cliente')

  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, nombre_proyecto')
    .eq('id', id)
    .eq('cliente_id', profile.cliente_crm_id)
    .single()

  if (!proyecto) redirect('/cliente')

  return (
    <SharedProjectInstalacionesView
      params={params}
      portal="cliente"
    />
  )
}
```

### Step 4: Add Automated Tests in `tests/proxy-deeplinks.test.mjs`
Add `Proxy.7` in `tests/proxy-deeplinks.test.mjs` verifying cross-portal translation, same-portal preservation, query string preservation, route alias translation, unauthorized route fallback, and open redirect defense (`//evil.com`, `https://evil.com`, `/\evil.com`).

---

## 6. Outputs
- **Modified File**: `proxy.ts`
- **Modified File**: `app/login/page.tsx`
- **Modified File**: `app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx`
- **Modified Test Suite**: `tests/proxy-deeplinks.test.mjs`

---

## 7. Acceptance Criteria & Exact Verification Commands

### Criteria
- [x] `proxy.ts` preserves `request.nextUrl.search` inside `returnUrl`.
- [x] Users visiting `/login?returnUrl=/admin/proyectos/123` are redirected to `/admin/proyectos/123` after logging in.
- [x] Users logging in with cross-portal deep links are translated to their portal equivalent (`resolveCrossPortalDeepLink`).
- [x] Protocol-relative URLs (`//evil.com`) and backslash URLs (`/\evil.com`) are rejected and fall back safely to `/${sub}`.
- [x] Server Component `app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx` validates authentication using `getUser()` with 0 calls to `getSession()`.
- [x] `npx tsx tests/adversarial-m3-empirical.test.mjs` and `npm test` pass 100%.
