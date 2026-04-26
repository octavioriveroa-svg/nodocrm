'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap, MapPin, Building, ChevronRight, CheckCircle2, DollarSign } from 'lucide-react'

interface ProyectoMEM {
  id: string
  nombre_proyecto: string
  cliente_final_empresa: string
  consumo_anual_gwh: number
  tarifa_actual_cfe: string
  codigo_postal: string
  estado: string
}

interface OfertasBoardProps {
  suministradorId: string
}

export default function OfertasBoard({ suministradorId }: OfertasBoardProps) {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<ProyectoMEM[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProyecto, setSelectedProyecto] = useState<ProyectoMEM | null>(null)

  // Bidding Form State
  const [precioKwh, setPrecioKwh] = useState('')
  const [vigenciaMeses, setVigenciaMeses] = useState('12')
  const [notas, setNotas] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function loadProyectos() {
      // In a real app we'd filter by estado = 'en_analisis' and tipo in ('MEM', 'BESS+MEM')
      // For testing, we fetch any project that needs MEM
      const { data } = await supabase
        .from('proyectos')
        .select('id, nombre_proyecto, cliente_final_empresa, consumo_anual_gwh, tarifa_actual_cfe, codigo_postal, estado')
        .in('tipo', ['MEM', 'BESS+MEM'])
      
      if (data) setProyectos(data)
      setLoading(false)
    }
    loadProyectos()
  }, [])

  async function handleSumbitBid(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProyecto) return
    setSubmitting(true)

    const { error } = await supabase.from('ofertas_mem').insert({
      proyecto_id: selectedProyecto.id,
      suministrador_id: suministradorId,
      precio_kwh: parseFloat(precioKwh),
      vigencia_meses: parseInt(vigenciaMeses),
      notas,
      estado: 'enviada'
    })

    if (!error) {
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setSelectedProyecto(null)
        setPrecioKwh('')
        setNotas('')
      }, 2500)
    } else {
      console.error(error)
      alert('Error enviando la oferta. Inténtalo de nuevo.')
    }
    setSubmitting(false)
  }

  if (loading) {
    return <div className="animate-pulse flex gap-4"><div className="w-64 h-32 bg-gray-200 rounded-xl"></div></div>
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {proyectos.length === 0 ? (
          <div className="col-span-full py-12 text-center glass-panel border-dashed border-white/50 rounded-2xl">
            <Zap size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No hay proyectos buscando suministro en este momento.</p>
          </div>
        ) : (
          proyectos.map((proyecto) => (
            <div key={proyecto.id} className="glass-card shadow-sm hover:shadow-md transition-all flex flex-col group overflow-hidden">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-600">
                    <Zap size={14} /> Suministro MEM
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    ID: {proyecto.id.split('-')[0]}
                  </span>
                </div>
                
                <h3 className="text-lg font-black text-principal leading-tight mb-2 group-hover:text-acento transition-colors">
                  {proyecto.nombre_proyecto}
                </h3>
                
                <div className="space-y-2 mt-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Building size={16} className="text-gray-400" />
                    <span>{proyecto.cliente_final_empresa}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-gray-400" />
                    <span>CP: {proyecto.codigo_postal || 'No especificado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-yellow-500" />
                    <span className="font-semibold text-principal">{proyecto.consumo_anual_gwh || 0} GWh/año</span>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4 bg-gray-50 border-t border-borde">
                <button
                  onClick={() => setSelectedProyecto(proyecto)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-principal text-white rounded-lg text-sm font-bold hover:bg-principal/90 transition-colors shadow-sm"
                >
                  Generar Oferta <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bidding Modal */}
      {selectedProyecto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-borde flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-black text-principal">Oferta de Suministro</h2>
              <button onClick={() => setSelectedProyecto(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            
            {success ? (
              <div className="p-12 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 animate-bounce">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-principal mb-2">Oferta Enviada Exitosamente</h3>
                <p className="text-gray-500">Nodo notificará al cliente y a nuestro equipo de analistas.</p>
              </div>
            ) : (
              <form onSubmit={handleSumbitBid} className="p-6">
                <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-sm font-semibold text-blue-900 mb-1">{selectedProyecto.nombre_proyecto}</p>
                  <p className="text-xs text-blue-700">Consumo: {selectedProyecto.consumo_anual_gwh || 0} GWh/año • Tarifa actual: {selectedProyecto.tarifa_actual_cfe || 'GDMTH'}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Precio propuesto (MXN/kWh)</label>
                    <div className="relative">
                      <DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={precioKwh}
                        onChange={e => setPrecioKwh(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-borde focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all font-medium"
                        placeholder="Ej: 1.85"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Vigencia del Contrato (Meses)</label>
                    <select
                      value={vigenciaMeses}
                      onChange={e => setVigenciaMeses(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-borde focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all font-medium bg-white"
                    >
                      <option value="12">12 meses</option>
                      <option value="24">24 meses</option>
                      <option value="36">36 meses</option>
                      <option value="48">48 meses</option>
                      <option value="60">60 meses</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Condiciones y Notas (Opcional)</label>
                    <textarea
                      value={notas}
                      onChange={e => setNotas(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-borde focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all text-sm resize-none"
                      placeholder="Agrega condiciones especiales, detalles de factor de carga, etc."
                    ></textarea>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProyecto(null)}
                    className="flex-1 py-3 px-4 rounded-lg font-bold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 px-4 rounded-lg font-bold text-sm text-principal bg-acento hover:bg-acento-hover transition-colors shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Enviando...' : 'Enviar Oferta en Firme'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
