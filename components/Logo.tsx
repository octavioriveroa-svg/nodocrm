'use client'

// Logo oficial de Nodo (wordmark vectorial extraído del brandbook, public/nodo.svg).
// Se pinta con máscara CSS para poder recolorearlo con cualquier token de marca.
// Combinaciones aprobadas (Brand/BRAND.md §2): lima/verde-claro sobre petróleo o menta,
// petróleo sobre lima/verde-claro/blanco.

type LogoSize = 'sm' | 'md' | 'lg'
type LogoColor = 'petrol' | 'lima' | 'menta' | 'verde-claro' | 'white'

interface LogoProps {
  size?: LogoSize
  /** Color del wordmark. Por defecto petróleo (o blanco si `inverted`). */
  color?: LogoColor
  /** Atajo legado: equivale a color="white" (para fondos oscuros). */
  inverted?: boolean
  className?: string
}

// Relación de aspecto real del wordmark ≈ 2.99:1 (viewBox 528.6×176.7)
const DIMENSIONS: Record<LogoSize, { width: number; height: number }> = {
  sm: { width: 84, height: 28 },
  md: { width: 120, height: 40 },
  lg: { width: 168, height: 56 },
}

const COLORS: Record<LogoColor, string> = {
  petrol: 'var(--color-principal)',
  lima: 'var(--color-acento)',
  menta: 'var(--color-menta)',
  'verde-claro': 'var(--color-verde-claro)',
  white: '#ffffff',
}

export default function Logo({ size = 'md', color, inverted = false, className = '' }: LogoProps) {
  const d = DIMENSIONS[size]
  const fill = COLORS[color ?? (inverted ? 'white' : 'petrol')]

  return (
    <span
      role="img"
      aria-label="Nodo"
      className={className}
      style={{
        display: 'inline-block',
        width: d.width,
        height: d.height,
        backgroundColor: fill,
        WebkitMaskImage: 'url(/nodo.svg)',
        maskImage: 'url(/nodo.svg)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  )
}
