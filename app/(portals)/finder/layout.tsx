'use client'

import React from 'react'
import PortalShell from '@/components/layout/PortalShell'

export default function FinderLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell allowedRoles="finder">{children}</PortalShell>
}
