'use client'

// Cifra destacada — patrón del brandbook pág. 29.
// Etiqueta pequeña en mayúsculas + número grande en tipografía numérica
// (BC Barell 1973, con fallback a Inter tabular). Variante de acento opcional.

interface StatFigureProps {
  label: string
  value: string | number
  /** 'plain' (petróleo) | 'accent' (lima) | 'menta'. Por defecto 'plain'. */
  tone?: 'plain' | 'accent' | 'menta'
  /** Tamaño del número. */
  size?: 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES: Record<NonNullable<StatFigureProps['size']>, string> = {
  md: 'text-2xl',
  lg: 'text-4xl',
  xl: 'text-5xl',
}

const TONES: Record<NonNullable<StatFigureProps['tone']>, string> = {
  plain: 'var(--color-principal)',
  accent: 'var(--color-acento)',
  menta: 'var(--color-menta)',
}

export default function StatFigure({ label, value, tone = 'plain', size = 'lg', className = '' }: StatFigureProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: TONES[tone] }}
          aria-hidden
        />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-texto-suave">
          {label}
        </span>
      </div>
      <div
        className={`num font-black leading-tight mt-1 ${SIZES[size]}`}
        style={{ color: TONES[tone] }}
      >
        {value}
      </div>
    </div>
  )
}
