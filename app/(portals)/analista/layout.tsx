'use client'

import React from 'react'
import PortalShell from '@/components/layout/PortalShell'

export default function AnalistaLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell allowedRoles="nodo_analista">{children}</PortalShell>
}
