import React from 'react'
import { Card, CardTitle } from '@/components/ui/Card'

export function Seccion({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between px-6 pt-6">
        <CardTitle>{title}</CardTitle>
        {action}
      </div>
      <div className="px-6 pb-6 pt-2 overflow-hidden">
        {children}
      </div>
    </Card>
  )
}

export function Campo({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium mb-0.5 text-gray-400">{label}</div>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  )
}

export function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

export function formatDateTime(d: string): string {
  try {
    return new Date(d).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return d
  }
}

export function buildDefaultHitos(proyectoId: string) {
  const baseHitos = [
    { nombre: 'Ingenierías', orden: 1, duracion_semanas: 3 },
    { nombre: 'Permisos y Trámites', orden: 2, duracion_semanas: 4 },
    { nombre: 'Suministro de Equipos', orden: 3, duracion_semanas: 8 },
    { nombre: 'Obra Civil e Instalación Mecánica', orden: 4, duracion_semanas: 4 },
    { nombre: 'Instalación Eléctrica', orden: 5, duracion_semanas: 3 },
    { nombre: 'Pruebas y Comisionamiento', orden: 6, duracion_semanas: 2 },
  ]
  return baseHitos.map((h, i) => {
    const d1 = new Date(); d1.setDate(d1.getDate() + (i * 14))
    const d2 = new Date(d1); d2.setDate(d2.getDate() + (h.duracion_semanas * 7))
    return {
      proyecto_id: proyectoId,
      nombre: h.nombre,
      orden: h.orden,
      fecha_estimada_inicio: d1.toISOString().split('T')[0],
      fecha_estimada_fin: d2.toISOString().split('T')[0],
      estado: 'pendiente' as const,
    }
  })
}

