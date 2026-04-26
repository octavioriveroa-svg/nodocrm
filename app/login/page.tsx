'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

export default function LoginPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }

    const { data: { session: newSession } } = await supabase.auth.getSession()
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles').select('rol').eq('id', newSession?.user?.id ?? '').single()

    if (profileError) {
      setError('Error obteniendo el perfil del usuario. Verifica la base de datos o contacta soporte.')
      setLoading(false)
      return
    }

    const rol = profileRow?.rol ?? newSession?.user?.user_metadata?.rol
    if (!rol) {
      setError('El usuario no tiene un rol asignado.')
      setLoading(false)
      return
    }
    
    if (rol === 'pendiente') {
      window.location.href = '/pendiente'
      return
    }

    let sub = 'epc'
    if (rol === 'nodo_admin') sub = 'admin'
    else if (rol === 'nodo_analista') sub = 'analista'
    else if (rol === 'cliente_final') sub = 'cliente'
    else if (rol === 'financiero') sub = 'financiero'
    else if (rol === 'suministrador') sub = 'mem'

    const hostname = window.location.hostname
    const isNodoEnergy = hostname.endsWith('nodo.energy')
    
    if (!isNodoEnergy) {
      // Localhost, Vercel, or any other staging environment: Use path-based routing
      window.location.href = `/${sub}`
    } else {
      // Production: Use subdomain-based routing
      window.location.href = `https://${sub}.nodo.energy/`
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

        <div
          className="glass-card p-8"
        >
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
