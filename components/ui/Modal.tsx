'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  subtitle?: React.ReactNode
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  variant?: 'default' | 'lightbox'
  className?: string
  showCloseButton?: boolean
}

const MAX_WIDTH_CLASSES: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
}

/**
 * Reusable accessible modal dialog with backdrop dismiss and Escape key handling.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
  variant = 'default',
  className = '',
  showCloseButton = true,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  if (variant === 'lightbox') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
        onClick={onClose}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa"
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        )}
        <div className={className} onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`glass-card bg-white w-full ${MAX_WIDTH_CLASSES[maxWidth]} shadow-2xl overflow-hidden ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {(title || subtitle || showCloseButton) && (
          <div className="p-6 border-b border-borde bg-gray-50 flex justify-between items-start gap-4">
            <div className="min-w-0">
              {title && <h3 className="font-bold text-lg text-principal">{title}</h3>}
              {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar modal"
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
