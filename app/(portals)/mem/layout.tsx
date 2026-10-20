'use client'

import React from 'react'
import PortalShell from '@/components/layout/PortalShell'

export default function MemLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell allowedRoles="suministrador">{children}</PortalShell>
}
