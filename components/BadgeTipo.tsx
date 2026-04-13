import type { TipoProyecto } from '@/lib/types'

export default function BadgeTipo({ tipo }: { tipo: TipoProyecto }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border border-borde text-gray-600 bg-white">
      {tipo}
    </span>
  )
}
