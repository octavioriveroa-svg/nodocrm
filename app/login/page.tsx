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

    // Validate returnUrl: only allow safe relative paths (block protocol-relative or backslash open redirects)
    const isSafeRelative =
      Boolean(returnUrl) &&
      returnUrl!.startsWith('/') &&
      !returnUrl!.startsWith('//') &&
      !returnUrl!.startsWith('/\\')

    if (isSafeRelative && returnUrl) {
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
