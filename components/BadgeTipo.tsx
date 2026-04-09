import type { TipoProyecto } from '@/lib/types'

export default function BadgeTipo({ tipo }: { tipo: TipoProyecto }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border"
      style={{ borderColor: '#CFCFCF', color: '#444' }}
    >
      {tipo}
    </span>
  )
}
