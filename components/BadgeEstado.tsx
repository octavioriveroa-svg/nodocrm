import type { EstadoProyecto } from '@/lib/types'

const config: Record<string, { label: string; bg: string; color: string }> = {
  recibido: { label: 'Recibido', bg: '#E8E8E8', color: '#444' },
  en_analisis: { label: 'En análisis', bg: '#D7FF2F', color: '#000' },
  propuesta_lista: { label: 'Propuesta lista', bg: '#DBEAFE', color: '#1e40af' },
  enviada: { label: 'Enviada', bg: '#FDE68A', color: '#92400e' },
  cliente_interesado: { label: 'Cliente interesado', bg: '#D1FAE5', color: '#065f46' },
  // legacy
  completado: { label: 'Completado', bg: '#000', color: '#fff' },
}

export default function BadgeEstado({ estado }: { estado: EstadoProyecto | string }) {
  const { label, bg, color } = config[estado] ?? { label: estado, bg: '#E8E8E8', color: '#444' }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  )
}
