'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import type { Rol } from '@/lib/types'

export default function RegistroPage() {
  const router = useRouter()
  const supabase = createClient()

  const [nombre, setNombre] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const rol: Rol = 'epcista'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre, empresa, rol },
      },
    })

    if (authError || !data.user) {
      setError(authError?.message ?? 'Error al crear la cuenta.')
      setLoading(false)
      return
    }

    // Intentar guardar en profiles (no bloquea si falla)
    await supabase.from('profiles').insert({
      id: data.user.id,
      nombre,
      empresa,
      rol,
    })

    window.location.href = '/epcista'
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
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
          <h1 className="text-xl font-bold mb-6">Crear cuenta</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre completo</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                className="w-full border px-3 py-2 text-sm"
                style={{ borderColor: '#CFCFCF' }}
                placeholder="Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Empresa</label>
              <input
                type="text"
                value={empresa}
                onChange={e => setEmpresa(e.target.value)}
                required
                className="w-full border px-3 py-2 text-sm"
                style={{ borderColor: '#CFCFCF' }}
                placeholder="Mi empresa S.A."
              />
            </div>

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
                minLength={6}
                className="w-full border px-3 py-2 text-sm"
                style={{ borderColor: '#CFCFCF' }}
                placeholder="Mínimo 6 caracteres"
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
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: '#666' }}>
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-semibold underline" style={{ color: '#000' }}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
