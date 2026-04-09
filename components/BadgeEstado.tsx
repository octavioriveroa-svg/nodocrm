import type { EstadoProyecto } from '@/lib/types'

const config: Record<EstadoProyecto, { label: string; bg: string; color: string }> = {
  recibido: { label: 'Recibido', bg: '#E8E8E8', color: '#444' },
  en_analisis: { label: 'En análisis', bg: '#D7FF2F', color: '#000' },
  completado: { label: 'Completado', bg: '#000', color: '#fff' },
}

export default function BadgeEstado({ estado }: { estado: EstadoProyecto }) {
  const { label, bg, color } = config[estado]
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  )
}
