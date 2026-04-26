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

  // Routing basado en subdominios
  const url = request.nextUrl
  const hostname = request.headers.get('host') || 'localhost:3000'

  // Remover puertos y dominio principal para obtener el subdominio
  const cleanHostname = hostname.replace(/:\d+$/, '') // remover puerto
  
  let subdomain = ''
  if (cleanHostname.endsWith('.nodo.energy')) {
    subdomain = cleanHostname.replace('.nodo.energy', '')
  } else if (cleanHostname.endsWith('.localhost')) {
    subdomain = cleanHostname.replace('.localhost', '')
  }

  // Si no hay sesión y tratan de entrar a un subdominio privado, redirigir a login
  if (subdomain && subdomain !== 'www' && !session) {
    if (url.pathname !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Si hay sesión y están en login, redirigirlos a su subdominio
  if (session && url.pathname === '/login') {
    // Obtener rol del perfil para saber a qué subdominio mandarlos
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', session.user.id).single()
    const rol = profile?.rol || session.user.user_metadata?.rol
    
    let targetSubdomain = ''
    switch(rol) {
      case 'epc': targetSubdomain = 'epc'; break;
      case 'nodo_analista': targetSubdomain = 'analista'; break;
      case 'nodo_admin': targetSubdomain = 'admin'; break;
      case 'cliente_final': targetSubdomain = 'cliente'; break;
      case 'financiero': targetSubdomain = 'financiero'; break;
      case 'suministrador': targetSubdomain = 'mem'; break;
    }

    const isNodoEnergy = hostname.endsWith('nodo.energy')

    if (targetSubdomain && targetSubdomain !== subdomain) {
      if (isNodoEnergy) {
        // Production: Redirect to the proper subdomain
        const port = hostname.includes(':') ? `:${hostname.split(':')[1]}` : ''
        return NextResponse.redirect(new URL(`https://${targetSubdomain}.nodo.energy${port}/`))
      } else {
        // Localhost, Vercel, Staging: Redirect to path
        return NextResponse.redirect(new URL(`/${targetSubdomain}`, request.url))
      }
    }
  }

  // Reescribir la ruta internamente si estamos en un subdominio
  // Ej: cliente.nodo.energy/ -> /cliente/
  // Evitamos reescribir archivos estáticos y rutas especiales
  if (subdomain && subdomain !== 'www' && !url.pathname.startsWith(`/${subdomain}`)) {
    url.pathname = `/${subdomain}${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  return response
}
