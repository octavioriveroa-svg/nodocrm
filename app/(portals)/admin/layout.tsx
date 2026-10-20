'use client'

import React from 'react'
import PortalShell from '@/components/layout/PortalShell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell allowedRoles="nodo_admin">{children}</PortalShell>
}
