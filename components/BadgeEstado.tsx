import type { EstadoProyecto } from '@/lib/types'

const config: Record<string, { label: string; classes: string }> = {
  recibido: { label: 'Lead', classes: 'bg-gray-100 text-gray-600' },
  en_analisis: { label: 'En análisis', classes: 'bg-acento text-principal' },
  propuesta_lista: { label: 'Propuesta lista', classes: 'bg-blue-100 text-blue-700' },
  enviada: { label: 'Propuesta enviada', classes: 'bg-amber-100 text-amber-700' },
  cliente_interesado: { label: 'Cliente interesado', classes: 'bg-emerald-100 text-emerald-700' },
  negociacion: { label: 'Negociación', classes: 'bg-purple-100 text-purple-700' },
  aprobado: { label: 'Cierre', classes: 'bg-green-100 text-green-700' },
  en_construccion: { label: 'En construcción', classes: 'bg-orange-100 text-orange-700' },
  operativo: { label: 'Operativo', classes: 'bg-teal-100 text-teal-700' },
  completado: { label: 'Completado', classes: 'bg-principal text-white' },
}

export default function BadgeEstado({ estado }: { estado: EstadoProyecto | string }) {
  const { label, classes } = config[estado] ?? { label: estado, classes: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${classes}`}>
      {label}
    </span>
  )
}
