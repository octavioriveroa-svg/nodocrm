'use client'

import React from 'react'
import PortalShell from '@/components/layout/PortalShell'

export default function EpcistaLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell allowedRoles="epc">{children}</PortalShell>
}
