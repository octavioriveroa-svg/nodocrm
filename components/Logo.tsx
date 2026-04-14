'use client'

import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  inverted?: boolean
}

export default function Logo({ size = 'md', inverted = false }: LogoProps) {
  const dimensions = {
    sm: { width: 80, height: 28 },
    md: { width: 120, height: 42 },
    lg: { width: 160, height: 56 },
  }
  const d = dimensions[size]

  return (
    <Image
      src={inverted ? '/nodo-white.png' : '/nodo-black.png'}
      alt="Nodo"
      width={d.width}
      height={d.height}
      priority
      style={{ objectFit: 'contain' }}
    />
  )
}
