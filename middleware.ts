import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const url = request.nextUrl
  const path = url.pathname

  // Protected portals list
  const isProtectedPath = path.startsWith('/admin') || path.startsWith('/epc') || 
                          path.startsWith('/analista') || path.startsWith('/cliente') || 
                          path.startsWith('/financiero') || path.startsWith('/mem')

  // Si no hay sesión y tratan de entrar a un portal privado, redirigir a login
  if (isProtectedPath && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Si hay sesión y están en login/registro/home, redirigirlos a su portal
  if (session && (path === '/login' || path === '/registro' || path === '/')) {
    // Obtener rol del perfil para saber a qué portal mandarlos
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', session.user.id).single()
    const rol = profile?.rol || session.user.user_metadata?.rol
    
    let targetPath = ''
    switch(rol) {
      case 'epc': targetPath = 'epc'; break;
      case 'nodo_analista': targetPath = 'analista'; break;
      case 'nodo_admin': targetPath = 'admin'; break;
      case 'cliente_final': targetPath = 'cliente'; break;
      case 'financiero': targetPath = 'financiero'; break;
      case 'suministrador': targetPath = 'mem'; break;
      case 'pendiente': targetPath = 'pendiente'; break;
    }

    if (targetPath && !path.startsWith(`/${targetPath}`)) {
      return NextResponse.redirect(new URL(`/${targetPath}`, request.url))
    }
  }

  return response
}
