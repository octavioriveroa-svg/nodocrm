import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import type { HitoConstruccion, EstadoHito } from '@/lib/types'
import { X } from 'lucide-react'

interface ModalHitoProps {
  hito: HitoConstruccion
  onClose: () => void
  onUpdate: (hito: HitoConstruccion) => void
}

export default function ModalHito({ hito, onClose, onUpdate }: ModalHitoProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [estado, setEstado] = useState<EstadoHito>(hito.estado)
  const [fechaRealInicio, setFechaRealInicio] = useState(hito.fecha_real_inicio || '')
  const [fechaRealFin, setFechaRealFin] = useState(hito.fecha_real_fin || '')

  async function handleSave() {
    setLoading(true)
    const { data, error } = await supabase
      .from('hitos_construccion')
      .update({
        estado,
        fecha_real_inicio: fechaRealInicio || null,
        fecha_real_fin: fechaRealFin || null,
      })
      .eq('id', hito.id)
      .select()
      .single()

    if (error || !data) {
      alert('Error al actualizar el hito.')
    } else {
      onUpdate(data as HitoConstruccion)
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-borde bg-gray-50/50">
          <div>
            <h2 className="font-bold text-lg text-principal leading-none mb-1">Actualizar Hito</h2>
            <p className="text-xs text-gray-500">{hito.nombre}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">Estado del Hito</label>
            <select
              value={estado}
              onChange={e => setEstado(e.target.value as EstadoHito)}
              className="w-full rounded-lg border border-borde px-3 py-2.5 text-sm bg-white focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all"
            >
              <option value="pendiente">Pendiente</option>
              <option value="en_progreso">En Progreso</option>
              <option value="retrasado">Retrasado</option>
              <option value="completado">Completado</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">Inicio Real</label>
              <input
                type="date"
                value={fechaRealInicio}
                onChange={e => setFechaRealInicio(e.target.value)}
                className="w-full rounded-lg border border-borde px-3 py-2 text-sm focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">Fin Real</label>
              <input
                type="date"
                value={fechaRealFin}
                onChange={e => setFechaRealFin(e.target.value)}
                className="w-full rounded-lg border border-borde px-3 py-2 text-sm focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all"
              />
            </div>
          </div>

          <div className="bg-[#fafff0] border border-[#CEDC00]/40 p-3 rounded-xl mt-4">
            <p className="text-xs text-[#4a5e1e] font-medium leading-relaxed">
              <strong>Nota:</strong> Si el hito está completado, asegúrate de subir la evidencia fotográfica correspondiente en la sección de archivos.
            </p>
          </div>
        </div>

        <div className="p-5 border-t border-borde bg-gray-50/50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </div>
  )
}
