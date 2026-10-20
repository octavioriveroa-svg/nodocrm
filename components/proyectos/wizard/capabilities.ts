import type { PortalType, WizardCapabilities } from './types'

export function getWizardCapabilities(portalType: PortalType): WizardCapabilities {
  switch (portalType) {
    case 'admin':
    case 'analista':
      return {
        portalType,
        canAssignEpc: true,
        canAssignResponsableNodo: true,
        canAssignFinder: true,
        canUseManualClient: true,
        canInviteEpc: false,
        implicitEpc: false,
        implicitFinder: false,
        clientQueryFilter: 'by_selected_epc',
        redirectPrefix: `/${portalType}/proyectos`,
      }
    case 'epc':
      return {
        portalType,
        canAssignEpc: false,
        canAssignResponsableNodo: false,
        canAssignFinder: true,
        canUseManualClient: false,
        canInviteEpc: false,
        implicitEpc: true,
        implicitFinder: false,
        clientQueryFilter: 'by_session_epc',
        redirectPrefix: '/epc/proyectos',
      }
    case 'finder':
      return {
        portalType,
        canAssignEpc: true,
        canAssignResponsableNodo: false,
        canAssignFinder: false,
        canUseManualClient: false,
        canInviteEpc: true,
        implicitEpc: false,
        implicitFinder: true,
        clientQueryFilter: 'by_session_finder',
        redirectPrefix: '/finder/proyectos',
      }
  }
}
