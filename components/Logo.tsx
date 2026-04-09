'use client'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  inverted?: boolean
}

export default function Logo({ size = 'md', inverted = false }: LogoProps) {
  const sizes = {
    sm: { text: 'text-2xl', dot: 'w-2 h-2' },
    md: { text: 'text-4xl', dot: 'w-3 h-3' },
    lg: { text: 'text-6xl', dot: 'w-4 h-4' },
  }
  const s = sizes[size]

  return (
    <div className="flex items-center gap-2">
      <span
        className={`${s.text} font-black tracking-tight`}
        style={{ color: inverted ? '#D7FF2F' : '#000000' }}
      >
        Nodo
      </span>
      <span
        className={`${s.dot} rounded-full inline-block`}
        style={{ backgroundColor: '#D7FF2F' }}
      />
    </div>
  )
}
