import {
  TestSuite,
  assertEqual,
} from './test-utils.mjs'
import {
  PORTAL_SUPPORTED_ROUTES,
  resolveCrossPortalDeepLink,
} from '../lib/domains/auth/routing.ts'

export const proxyDeeplinksSuite = new TestSuite('Routing: Proxy Smart Cross-Portal Deep-Links')

// ── 1. Cross-Portal Project Deep Links ────────────────────────────────────────
proxyDeeplinksSuite.test('Proxy.1: Cross-portal project detail links are rewritten to user target portal', () => {
  const projectId = '92985502-a709-4c90-ac42-fad41883ea3f'

  // Admin link visited by EPC user -> /epc/proyectos/[id]
  assertEqual(
    resolveCrossPortalDeepLink(`/admin/proyectos/${projectId}`, 'epc'),
    `/epc/proyectos/${projectId}`,
    'Admin project link for EPC must rewrite to /epc/proyectos/[id]'
  )

  // Analista link visited by Admin -> /admin/proyectos/[id]
  assertEqual(
    resolveCrossPortalDeepLink(`/analista/proyectos/${projectId}`, 'admin'),
    `/admin/proyectos/${projectId}`,
    'Analyst project link for Admin must rewrite to /admin/proyectos/[id]'
  )

  // EPC link visited by Finder -> /finder/proyectos/[id]
  assertEqual(
    resolveCrossPortalDeepLink(`/epc/proyectos/${projectId}`, 'finder'),
    `/finder/proyectos/${projectId}`,
    'EPC project link for Finder must rewrite to /finder/proyectos/[id]'
  )

  // Finder link visited by Analista -> /analista/proyectos/[id]
  assertEqual(
    resolveCrossPortalDeepLink(`/finder/proyectos/${projectId}`, 'analista'),
    `/analista/proyectos/${projectId}`,
    'Finder project link for Analyst must rewrite to /analista/proyectos/[id]'
  )

  // Admin link visited by Financiero -> /financiero/proyectos/[id]
  assertEqual(
    resolveCrossPortalDeepLink(`/admin/proyectos/${projectId}`, 'financiero'),
    `/financiero/proyectos/${projectId}`,
    'Admin project link for Financier must rewrite to /financiero/proyectos/[id]'
  )
})

// ── 2. Sub-Route Deep Links (Plan & Instalaciones) ────────────────────────────
proxyDeeplinksSuite.test('Proxy.2: Project sub-routes (plan, instalaciones) rewrite correctly', () => {
  const projectId = '92985502-a709-4c90-ac42-fad41883ea3f'

  // /plan deep link from Admin for EPC
  assertEqual(
    resolveCrossPortalDeepLink(`/admin/proyectos/${projectId}/plan`, 'epc'),
    `/epc/proyectos/${projectId}/plan`
  )

  // /instalaciones deep link from Admin for Cliente (Cliente supports /proyectos/[id]/instalaciones)
  assertEqual(
    resolveCrossPortalDeepLink(`/admin/proyectos/${projectId}/instalaciones`, 'cliente'),
    `/cliente/proyectos/${projectId}/instalaciones`,
    'Cliente portal supports project instalaciones deep link'
  )

  // /instalaciones root link
  assertEqual(
    resolveCrossPortalDeepLink('/admin/instalaciones', 'finder'),
    '/finder/instalaciones'
  )
})

// ── 3. Route Aliases (/proyectos/nuevo ↔ /nuevo) ──────────────────────────────
proxyDeeplinksSuite.test('Proxy.3: Route aliases (/proyectos/nuevo vs /nuevo) are accurately translated', () => {
  // Admin (/proyectos/nuevo) -> EPC (/nuevo)
  assertEqual(
    resolveCrossPortalDeepLink('/admin/proyectos/nuevo', 'epc'),
    '/epc/nuevo',
    'Admin /proyectos/nuevo must alias to /epc/nuevo for EPC'
  )

  // Analista (/proyectos/nuevo) -> Finder (/nuevo)
  assertEqual(
    resolveCrossPortalDeepLink('/analista/proyectos/nuevo', 'finder'),
    '/finder/nuevo',
    'Analyst /proyectos/nuevo must alias to /finder/nuevo for Finder'
  )

  // EPC (/nuevo) -> Admin (/proyectos/nuevo)
  assertEqual(
    resolveCrossPortalDeepLink('/epc/nuevo', 'admin'),
    '/admin/proyectos/nuevo',
    'EPC /nuevo must alias to /admin/proyectos/nuevo for Admin'
  )

  // Finder (/nuevo) -> Analista (/proyectos/nuevo)
  assertEqual(
    resolveCrossPortalDeepLink('/finder/nuevo', 'analista'),
    '/analista/proyectos/nuevo',
    'Finder /nuevo must alias to /analista/proyectos/nuevo for Analyst'
  )
})

// ── 4. Client Directory & Detail Routing ─────────────────────────────────────
proxyDeeplinksSuite.test('Proxy.4: Client detail and directory routes rewrite across supported portals', () => {
  const clientId = 'c1234567-89ab-cdef-0123-456789abcdef'

  // Admin client detail -> EPC client detail
  assertEqual(
    resolveCrossPortalDeepLink(`/admin/clientes/${clientId}`, 'epc'),
    `/epc/clientes/${clientId}`
  )

  // Finder client detail -> Analista client detail
  assertEqual(
    resolveCrossPortalDeepLink(`/finder/clientes/${clientId}`, 'analista'),
    `/analista/clientes/${clientId}`
  )

  // Client directory: Admin -> Finder
  assertEqual(
    resolveCrossPortalDeepLink('/admin/clientes', 'finder'),
    '/finder/clientes'
  )
})

// ── 5. Unsupported Route Fallback to Target Portal Root ──────────────────────
proxyDeeplinksSuite.test('Proxy.5: Unsupported routes fall back safely to /${targetPath} root', () => {
  // /admin/usuarios is NOT supported by EPC -> fallback to /epc
  assertEqual(
    resolveCrossPortalDeepLink('/admin/usuarios', 'epc'),
    '/epc',
    'EPC cannot access /usuarios, must fallback to /epc'
  )

  // /admin/usuarios for Finder -> /finder
  assertEqual(
    resolveCrossPortalDeepLink('/admin/usuarios', 'finder'),
    '/finder',
    'Finder cannot access /usuarios, must fallback to /finder'
  )

  // /admin/proyectos for MEM (suministrador only has /configuracion) -> /mem
  assertEqual(
    resolveCrossPortalDeepLink('/admin/proyectos', 'mem'),
    '/mem',
    'MEM portal does not support /proyectos, must fallback to /mem'
  )

  // /admin/clientes for Cliente (client portal has no /clientes view) -> /cliente
  assertEqual(
    resolveCrossPortalDeepLink('/admin/clientes', 'cliente'),
    '/cliente',
    'Cliente portal does not support /clientes, must fallback to /cliente'
  )

  // /admin/configuracion/roles for EPC -> fallback to /epc
  assertEqual(
    resolveCrossPortalDeepLink('/admin/configuracion/roles', 'epc'),
    '/epc/configuracion/roles',
  )
})

// ── 6. Query Parameters Preservation ─────────────────────────────────────────
proxyDeeplinksSuite.test('Proxy.6: Query parameters are strictly preserved across rewrites', () => {
  const projectId = '92985502-a709-4c90-ac42-fad41883ea3f'
  const search = '?tab=solucion&version=2&mode=edit'

  assertEqual(
    resolveCrossPortalDeepLink(`/admin/proyectos/${projectId}`, 'epc', search),
    `/epc/proyectos/${projectId}${search}`,
    'Query parameters must be preserved on rewrite'
  )

  assertEqual(
    resolveCrossPortalDeepLink('/admin/clientes', 'analista', '?estado=Jalisco&search=Solar'),
    '/analista/clientes?estado=Jalisco&search=Solar',
    'Filter search queries must be preserved'
  )
})

if (process.argv[1] && process.argv[1].endsWith('proxy-deeplinks.test.mjs')) {
  proxyDeeplinksSuite.run().catch((err) => {
    console.error('Test suite failed:', err)
    process.exit(1)
  })
}
