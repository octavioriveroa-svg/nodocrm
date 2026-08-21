import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes the Supabase session (if expired) and syncs auth cookies.
 * Uses the modern getAll/setAll cookie pattern required by @supabase/ssr.
 *
 * Returns the Supabase client, the authenticated user (or null), and
 * the NextResponse with updated cookies.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Race getUser() against a 3-second timeout.
  // If Supabase is unreachable (paused, DNS failure, network issue),
  // this prevents the proxy from hanging until Vercel kills it.
  let user = null
  let authError = null

  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase auth timeout')), 3000)
      ),
    ])
    user = result.data?.user ?? null
    authError = result.error
  } catch {
    // Timeout or network error — treat as unauthenticated
    user = null
    authError = new Error('Supabase unreachable')
  }

  return { supabase, user, authError, supabaseResponse }
}
