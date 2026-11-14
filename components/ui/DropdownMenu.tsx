'use client'

import React, { useEffect, useRef, useState } from 'react'

export interface DropdownMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export interface DropdownMenuProps {
  trigger: React.ReactNode
  items: DropdownMenuItem[]
  align?: 'left' | 'right'
  className?: string
  menuClassName?: string
}

/**
 * Accessible dropdown action menu with outside-click and Escape key dismissal.
 */
export function DropdownMenu({
  trigger,
  items,
  align = 'right',
  className = '',
  menuClassName = '',
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        className="inline-flex items-center justify-center"
      >
        {trigger}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-full mt-1.5 min-w-[180px] bg-white border border-borde rounded-xl shadow-lg py-1.5 z-50 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${menuClassName}`}
        >
          {items.map(item => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                setOpen(false)
                item.onClick()
              }}
              className={`w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-left transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                item.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-principal hover:bg-gray-50'
              }`}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
