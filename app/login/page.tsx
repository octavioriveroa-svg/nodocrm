'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

export default function LoginPage() {
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

    const { data: profiles } = await supabase.rpc('get_my_profile')
    const rol = profiles?.[0]?.rol ?? 'epcista'
    if (rol === 'admin') window.location.href = '/admin'
    else if (rol === 'analista') window.location.href = '/analista'
    else window.location.href = '/epcista'
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#F9F6EF' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        <div
          className="border p-8"
          style={{ borderColor: '#CFCFCF', backgroundColor: '#fff' }}
        >
          <h1 className="text-xl font-bold mb-6">Iniciar sesión</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border px-3 py-2 text-sm"
                style={{ borderColor: '#CFCFCF' }}
                placeholder="tu@correo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full border px-3 py-2 text-sm"
                style={{ borderColor: '#CFCFCF' }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 font-bold text-sm transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#D7FF2F', color: '#000' }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: '#666' }}>
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="font-semibold underline" style={{ color: '#000' }}>
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  )
}
