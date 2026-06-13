'use client'

// Indicador de pasos — patrón del brandbook pág. 28.
// Círculos numerados conectados por línea; activo en lima, completados en
// petróleo (✓), pendientes con borde. Etiqueta opcional al lado de cada paso.

interface StepIndicatorProps {
  steps: string[]
  /** Índice del paso actual (0-based). Los anteriores se marcan como completados. */
  current: number
  className?: string
}

export default function StepIndicator({ steps, current, className = '' }: StepIndicatorProps) {
  return (
    <div className={`flex items-center ${className}`} role="list" aria-label="Progreso">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center" role="listitem" aria-current={active ? 'step' : undefined}>
            {/* Círculo del paso */}
            <div
              className="grid place-items-center w-8 h-8 rounded-full text-sm font-bold shrink-0 transition-colors num"
              style={{
                backgroundColor: done ? 'var(--color-principal)' : active ? 'var(--color-acento)' : 'transparent',
                color: done ? 'var(--color-acento)' : active ? 'var(--color-principal)' : 'var(--color-texto-suave)',
                border: done || active ? 'none' : '1.5px solid var(--color-linea)',
              }}
            >
              {done ? '✓' : i + 1}
            </div>

            {/* Etiqueta */}
            <span
              className="ml-2 text-xs font-medium whitespace-nowrap hidden md:block transition-colors"
              style={{ color: active || done ? 'var(--color-principal)' : 'var(--color-texto-suave)' }}
            >
              {label}
            </span>

            {/* Línea conectora hacia el siguiente paso */}
            {i < steps.length - 1 && (
              <div
                className="h-px w-6 md:w-10 mx-2 shrink-0 transition-colors"
                style={{ backgroundColor: done ? 'var(--color-principal)' : 'var(--color-linea)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
