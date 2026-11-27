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

  // /admin/configuracion/roles for EPC -> /epc/configuracion/roles
  assertEqual(
    resolveCrossPortalDeepLink('/admin/configuracion/roles', 'epc'),
    '/epc/configuracion/roles',
  )

  // /admin/configuracion/calculadora is admin-only -> fallback to portal root for non-admin
  assertEqual(
    resolveCrossPortalDeepLink('/admin/configuracion/calculadora', 'cliente'),
    '/cliente',
    'Cliente cannot access /configuracion/calculadora, must fallback to /cliente'
  )
  assertEqual(
    resolveCrossPortalDeepLink('/admin/configuracion/calculadora', 'analista'),
    '/analista',
    'Analista cannot access /configuracion/calculadora, must fallback to /analista'
  )
  assertEqual(
    resolveCrossPortalDeepLink('/admin/configuracion/calculadora', 'epc'),
    '/epc',
    'EPC cannot access /configuracion/calculadora, must fallback to /epc'
  )
  assertEqual(
    resolveCrossPortalDeepLink('/admin/configuracion/calculadora', 'admin'),
    '/admin/configuracion/calculadora',
    'Admin keeps /admin/configuracion/calculadora'
  )

  // /admin/proyectos/[id] for Cliente -> /cliente/proyectos/[id]
  const clientProjId = '92985502-a709-4c90-ac42-fad41883ea3f'
  assertEqual(
    resolveCrossPortalDeepLink(`/admin/proyectos/${clientProjId}`, 'cliente'),
    `/cliente/proyectos/${clientProjId}`,
    'Cliente supports project detail deep link'
  )

  // Standalone /calculadora tab deep links: allowed for operational/commercial portals, blocked for cliente & mem
  for (const allowedPortal of ['admin', 'analista', 'epc', 'finder', 'financiero']) {
    assertEqual(
      resolveCrossPortalDeepLink('/admin/calculadora', allowedPortal, `?proyectoId=${clientProjId}`),
      `/${allowedPortal}/calculadora?proyectoId=${clientProjId}`,
      `${allowedPortal} portal must support /calculadora deep links`
    )
  }
  assertEqual(
    resolveCrossPortalDeepLink('/admin/calculadora', 'cliente'),
    '/cliente',
    'Cliente portal cannot access standalone /calculadora tab'
  )
  assertEqual(
    resolveCrossPortalDeepLink('/admin/calculadora', 'mem'),
    '/mem',
    'MEM portal cannot access standalone /calculadora tab'
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

// ── 7. Login ReturnUrl & Open-Redirect Defense (TASK-004) ────────────────────
proxyDeeplinksSuite.test('Proxy.7: Login returnUrl validation, query preservation, and open-redirect defense', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { assert, assertIncludes } = await import('./test-utils.mjs')

  const resolveLoginDestination = (returnUrl, targetSub) => {
    const isSafeRelative =
      Boolean(returnUrl) &&
      returnUrl.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      !returnUrl.startsWith('/\\')

    if (!isSafeRelative) return `/${targetSub}`
    const [pathPart, ...queryParts] = returnUrl.split('?')
    const searchPart = queryParts.length > 0 ? `?${queryParts.join('?')}` : ''
    return resolveCrossPortalDeepLink(pathPart, targetSub, searchPart)
  }

  // Same-portal with query parameters
  assertEqual(
    resolveLoginDestination('/admin/clientes?tab=active', 'admin'),
    '/admin/clientes?tab=active',
    'Same-portal deep link with query params must be preserved'
  )

  // Cross-portal deep link + route alias translation
  assertEqual(
    resolveLoginDestination('/admin/proyectos/nuevo?step=2', 'epc'),
    '/epc/nuevo?step=2',
    'Cross-portal alias deep link must translate with query params'
  )

  // Open-redirect payloads blocked
  assertEqual(resolveLoginDestination('//evil.com/phish', 'epc'), '/epc', 'Protocol-relative redirect blocked')
  assertEqual(resolveLoginDestination('/\\evil.com', 'epc'), '/epc', 'Backslash redirect blocked')
  assertEqual(resolveLoginDestination('https://evil.com', 'admin'), '/admin', 'Absolute external URL blocked')

  // Verify PORTAL_SUPPORTED_ROUTES exports rules for all 7 portals
  for (const portal of ['admin', 'analista', 'epc', 'finder', 'cliente', 'financiero', 'mem']) {
    assert(Array.isArray(PORTAL_SUPPORTED_ROUTES[portal]), `PORTAL_SUPPORTED_ROUTES must define rules for ${portal}`)
  }

  // Static audit of proxy.ts, app/login/page.tsx, and cliente instalaciones SSR guard
  const proxySrc = fs.readFileSync(path.resolve('proxy.ts'), 'utf8')
  assertIncludes(proxySrc, '${path}${request.nextUrl.search}', 'proxy.ts must preserve query string in returnUrl')

  const loginSrc = fs.readFileSync(path.resolve('app/login/page.tsx'), 'utf8')
  assertIncludes(loginSrc, 'Suspense', 'app/login/page.tsx must wrap LoginForm in Suspense')
  assertIncludes(loginSrc, 'useSearchParams', 'app/login/page.tsx must read returnUrl via useSearchParams')
  assert(!loginSrc.includes('getSession'), 'app/login/page.tsx must use signInWithPassword user id instead of getSession')

  const clienteInstSrc = fs.readFileSync(path.resolve('app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx'), 'utf8')
  assertIncludes(clienteInstSrc, 'auth.getUser()', 'Cliente instalaciones page must validate auth with getUser()')
  assert(!clienteInstSrc.includes('getSession'), 'Cliente instalaciones page must not call getSession()')
})

if (process.argv[1] && process.argv[1].endsWith('proxy-deeplinks.test.mjs')) {
  proxyDeeplinksSuite.run().catch((err) => {
    console.error('Test suite failed:', err)
    process.exit(1)
  })
}
