'use client'

import React from 'react'
import PortalShell from '@/components/layout/PortalShell'

export default function FinancieroLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell allowedRoles="financiero">{children}</PortalShell>
}
