'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import OfertasBoard from '@/components/marketplace/OfertasBoard'

export default function SuministradorDashboard() {
  const supabase = createClient()
  const [suministradorId, setSuministradorId] = useState<string>('')

  useEffect(() => {
    async function getUserId() {
      const { data } = await supabase.auth.getSession()
      if (data?.session?.user) {
        setSuministradorId(data.session.user.id)
      }
    }
    getUserId()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black mb-2 tracking-tight text-principal">Portal del Suministrador MEM</h1>
        <p className="text-gray-500">Marketplace de energía mayorista: Oportunidades y Licitaciones Abiertas.</p>
      </div>

      <div className="bg-gradient-to-r from-principal to-gray-800 rounded-2xl p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Marketplace Activo</h2>
        <p className="text-gray-300 max-w-2xl text-sm leading-relaxed mb-6">
          Los siguientes proyectos están buscando contratos de suministro eléctrico. Evalúa sus perfiles de consumo, la región, y envía tus ofertas en firme directamente a través de este portal. Nodo verificará tu oferta con los clientes finales.
        </p>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-bold text-principal mb-6 flex items-center gap-2">
          Licitaciones Abiertas
        </h3>
        {suministradorId ? (
          <OfertasBoard suministradorId={suministradorId} />
        ) : (
          <div className="animate-pulse h-64 bg-gray-100 rounded-2xl"></div>
        )}
      </div>
    </div>
  )
}
