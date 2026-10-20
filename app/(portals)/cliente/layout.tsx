'use client'

import React from 'react'
import PortalShell from '@/components/layout/PortalShell'

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell allowedRoles="cliente_final">{children}</PortalShell>
}
