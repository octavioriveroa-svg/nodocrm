'use client'

import React from 'react'
import { Modal } from '@/components/ui/Modal'

export interface EvidenciaLightboxProps {
  photoUrl: string | null
  onClose: () => void
}

/**
 * Fullscreen lightbox modal for installation evidence photography.
 */
export function EvidenciaLightbox({ photoUrl, onClose }: EvidenciaLightboxProps) {
  return (
    <Modal isOpen={Boolean(photoUrl)} onClose={onClose} variant="lightbox">
      {photoUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Fullscreen preview"
            className="max-w-full max-h-[90vh] object-contain rounded-xl select-none"
          />
        </>
      )}
    </Modal>
  )
}
