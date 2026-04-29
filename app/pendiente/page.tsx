'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

export default function PendientePage() {
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Si el rol ya fue actualizado, redirigir
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: p } = await supabase.from('profiles').select('rol').eq('id', session.user.id).single()
      if (p?.rol && p.rol !== 'pendiente') {
        clearInterval(interval)
        const dest = p.rol === 'admin' ? '/admin' : p.rol === 'analista' ? '/analista' : '/epc'
        window.location.href = dest
      }
    }, 10000) // revisa cada 10 segundos
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#F9F6EF' }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>
        <div className="border p-8 text-center glass-card">
          <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: '#D7FF2F' }}>
            <span className="text-2xl">⏳</span>
          </div>
          <h1 className="text-xl font-bold mb-2">Solicitud enviada</h1>
          <p className="text-sm mb-6 text-muted">
            Tu cuenta está pendiente de aprobación. Un administrador revisará tu solicitud y te asignará el acceso correspondiente. Te notificaremos cuando esté lista.
          </p>
          <p className="text-xs mb-6" style={{ color: '#aaa' }}>
            Esta página se actualizará automáticamente cuando tu acceso sea aprobado.
          </p>
          <button onClick={handleLogout}
            className="text-sm underline text-muted">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
