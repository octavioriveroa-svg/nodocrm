/**
 * CHALLENGER M3-1 EMPIRICAL ADVERSARIAL STRESS SUITE
 *
 * Empirical verification of:
 * 1. Client directory filtering under boundary conditions:
 *    - Special regex characters, HTML/XSS, SQL injection strings, unicode/emojis
 *    - Accents and case insensitivity across all 8 searchable fields
 *    - Whitespace handling, null/sparse object resilience, zero-result queries
 *    - Industry dropdown filtering combined with search query
 * 2. Client creation validation and domain mutations under edge inputs:
 *    - Form validation rejection boundaries (empty, whitespace, missing profile)
 *    - Input trimming and optional field nullification
 *    - Anti-spoofing and role attribution security (EPC locked, Finder attributed, Admin assigned)
 *    - Mutation error catching and exception resilience
 * 3. Cross-portal deep-link resolution:
 *    - All 4 portal routes for `clientes`, `clientes/nuevo`, and `clientes/[id]`
 *    - Unsupported role fallbacks (cliente, financiero, mem)
 *    - Query parameter preservation and URL edge cases
 * 4. Live Supabase read-only scoping & integrity:
 *    - Admin vs EPC directory scoping
 *    - Production records preservation
 */

import {
  TestSuite,
  assert,
  assertEqual,
  assertIncludes,
  getAuthSession,
} from './test-utils.mjs'

import {
  PORTAL_SUPPORTED_ROUTES,
  resolveCrossPortalDeepLink,
} from '../lib/domains/auth/routing.ts'

import {
  createCliente,
  updateCliente,
  deleteCliente,
} from '../lib/domains/clientes/mutations.ts'

import {
  fetchClientesDirectory,
} from '../lib/domains/clientes/queries.ts'

export const challengerM3Suite = new TestSuite('Challenger M3-1: Empirical Stress & Edge Cases')

// ── Mock Filter Function (Exact Replica of SharedClientDirectoryView.tsx:145-161) ──
function filterClientes(clientes, busqueda, filtroIndustria = 'todos') {
  return clientes.filter((c) => {
    const matchIndustria = filtroIndustria === 'todos' || c.industria === filtroIndustria
    if (!matchIndustria) return false

    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      (c.razon_social || '').toLowerCase().includes(q) ||
      (c.contacto_nombre || '').toLowerCase().includes(q) ||
      (c.contacto_email || '').toLowerCase().includes(q) ||
      (c.contacto_telefono || '').toLowerCase().includes(q) ||
      (c.rfc || '').toLowerCase().includes(q) ||
      (c.industria || '').toLowerCase().includes(q) ||
      (c.epcista_nombre || '').toLowerCase().includes(q) ||
      (c.ubicacion_estado || '').toLowerCase().includes(q)
    )
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLIENT DIRECTORY FILTERING UNDER BOUNDARY CONDITIONS
// ─────────────────────────────────────────────────────────────────────────────

const mockDataset = [
  {
    id: 'c-1',
    razon_social: 'Energías Renovables de México S.A. de C.V.',
    contacto_nombre: 'Alejandro González Peña',
    contacto_email: 'agonzalez@renovables.mx',
    contacto_telefono: '+52 55 1234 5678',
    rfc: 'ERM180512AB3',
    industria: 'Manufactura',
    epcista_nombre: 'Volt Solar EPC',
    ubicacion_estado: 'Jalisco',
  },
  {
    id: 'c-2',
    razon_social: 'Parque Industrial & Tecnológico del Bajío',
    contacto_nombre: 'María del Carmen Núñez',
    contacto_email: 'mnunez@bajio-tech.com',
    contacto_telefono: '477-987-6543',
    rfc: 'PIT200101XYZ',
    industria: 'Inmobiliario',
    epcista_nombre: 'Soluciones Fotovoltaicas',
    ubicacion_estado: 'Guanajuato',
  },
  {
    id: 'c-3',
    razon_social: 'Acero Solar Especializado <Corp>',
    contacto_nombre: 'John O\'Connor & Sons',
    contacto_email: 'joconnor@acerosolar.com',
    contacto_telefono: '81 8345 0000',
    rfc: 'ASE991122110',
    industria: 'Minería',
    epcista_nombre: 'Volt Solar EPC',
    ubicacion_estado: 'Nuevo León',
  },
  {
    id: 'c-4',
    razon_social: 'Minas y Metales (México) [S.A.P.I.]',
    contacto_nombre: 'René François Müller',
    contacto_email: 'rene.muller@minas.de',
    contacto_telefono: '+49 151 234567',
    rfc: 'MMM150820888',
    industria: 'Minería',
    epcista_nombre: 'SunPower Mex',
    ubicacion_estado: 'Sonora',
  },
  {
    id: 'c-5',
    razon_social: 'Solar & Storage Innovations ⚡🔋',
    contacto_nombre: 'Dr. Héctor Ávalos C.',
    contacto_email: 'hector@innovations.tech',
    contacto_telefono: '33 1122 3344',
    rfc: 'SSI210909AA1',
    industria: 'Tecnología',
    epcista_nombre: 'Energía Directa',
    ubicacion_estado: 'Jalisco',
  },
]

challengerM3Suite.test('Filter.1: Empty query returns full client list unmodified', () => {
  const result = filterClientes(mockDataset, '')
  assertEqual(result.length, mockDataset.length, 'Empty search string must retain all clients')
})

challengerM3Suite.test('Filter.2: Regex metacharacters do not crash or corrupt substring matching', () => {
  const regexPatterns = [
    '.*',
    '\\d+',
    '(México)',
    '[S.A.P.I.]',
    '^Solar',
    'Tech$',
    'O\'Connor',
    '<Corp>',
    '⚡🔋',
    '???+++***',
  ]

  for (const pattern of regexPatterns) {
    let result
    try {
      result = filterClientes(mockDataset, pattern)
      assert(Array.isArray(result), `Pattern "${pattern}" must return an array`)
    } catch (err) {
      assert(false, `Pattern "${pattern}" threw unexpected error: ${err.message}`)
    }
  }

  // Specifically verify exact substring matches
  const matchParen = filterClientes(mockDataset, '(México)')
  assertEqual(matchParen.length, 1, 'Should find client with (México) in razon_social')
  assertEqual(matchParen[0].id, 'c-4')

  const matchBracket = filterClientes(mockDataset, '[S.A.P.I.]')
  assertEqual(matchBracket.length, 1, 'Should find client with [S.A.P.I.] in razon_social')
  assertEqual(matchBracket[0].id, 'c-4')

  const matchEmoji = filterClientes(mockDataset, '⚡🔋')
  assertEqual(matchEmoji.length, 1, 'Should find client with unicode emoji')
  assertEqual(matchEmoji[0].id, 'c-5')

  const matchTag = filterClientes(mockDataset, '<Corp>')
  assertEqual(matchTag.length, 1, 'Should find client with angle brackets')
  assertEqual(matchTag[0].id, 'c-3')
})

challengerM3Suite.test('Filter.3: Accented and case-insensitive matching across all 8 fields', () => {
  // razon_social in uppercase
  const r1 = filterClientes(mockDataset, 'ENERGÍAS RENOVABLES')
  assertEqual(r1.length, 1, 'Uppercase with accent should match')

  // contacto_nombre in mixed case
  const r2 = filterClientes(mockDataset, 'mArÍa DeL cArMeN')
  assertEqual(r2.length, 1, 'Mixed case with accent should match')

  // contacto_email in uppercase
  const r3 = filterClientes(mockDataset, 'RENE.MULLER@MINAS.DE')
  assertEqual(r3.length, 1, 'Uppercase email should match')

  // contacto_telefono with spaces
  const r4 = filterClientes(mockDataset, '1234 5678')
  assertEqual(r4.length, 1, 'Partial phone substring should match')

  // rfc in lowercase
  const r5 = filterClientes(mockDataset, 'erm180512ab3')
  assertEqual(r5.length, 1, 'Lowercase RFC should match uppercase RFC in dataset')

  // industria in lowercase
  const r6 = filterClientes(mockDataset, 'minería')
  assertEqual(r6.length, 2, 'Industry search should match 2 mining clients')

  // epcista_nombre in lowercase
  const r7 = filterClientes(mockDataset, 'volt solar')
  assertEqual(r7.length, 2, 'EPCista name should match 2 clients')

  // ubicacion_estado in lowercase
  const r8 = filterClientes(mockDataset, 'guanajuato')
  assertEqual(r8.length, 1, 'State match should return 1 client')
})

challengerM3Suite.test('Filter.4: Nonexistent queries return empty array cleanly', () => {
  const nonexistent = '___NONEXISTENT_QUERY_XYZ_9999___'
  const result = filterClientes(mockDataset, nonexistent)
  assertEqual(result.length, 0, 'Nonexistent search must yield 0 results')
})

challengerM3Suite.test('Filter.5: Null, undefined, and sparse fields do not throw TypeError', () => {
  const sparseDataset = [
    { id: 's-1', razon_social: 'Only Name' },
    { id: 's-2', razon_social: null, contacto_nombre: null },
    { id: 's-3' }, // completely empty record
    {
      id: 's-4',
      razon_social: 'Sparse Corp',
      contacto_nombre: undefined,
      contacto_email: null,
      contacto_telefono: undefined,
      rfc: null,
      industria: undefined,
      epcista_nombre: null,
      ubicacion_estado: null,
    },
  ]

  let result
  try {
    result = filterClientes(sparseDataset, 'corp')
  } catch (err) {
    assert(false, `Sparse dataset filter threw: ${err.message}`)
  }
  assertEqual(result.length, 1, 'Should find s-4 by razon_social')
  assertEqual(result[0].id, 's-4')

  // Searching for empty should still return all sparse records
  const allSparse = filterClientes(sparseDataset, '')
  assertEqual(allSparse.length, 4, 'Empty search on sparse dataset should return all 4 items')
})

challengerM3Suite.test('Filter.6: Dual filter (Industry dropdown + search query)', () => {
  // Industry 'Minería' has 2 clients (c-3, c-4)
  const allMining = filterClientes(mockDataset, '', 'Minería')
  assertEqual(allMining.length, 2, 'Industry filter alone should yield 2 clients')

  // 'Minería' + search 'Acero' -> only c-3
  const miningAcero = filterClientes(mockDataset, 'Acero', 'Minería')
  assertEqual(miningAcero.length, 1, 'Industry + search should yield 1 client')
  assertEqual(miningAcero[0].id, 'c-3')

  // 'Minería' + search 'Guanajuato' -> 0 clients (Guanajuato is Inmobiliario)
  const miningGuanajuato = filterClientes(mockDataset, 'Guanajuato', 'Minería')
  assertEqual(miningGuanajuato.length, 0, 'Mismatched industry and search should yield 0')

  // Nonexistent industry filter
  const nonexistentInd = filterClientes(mockDataset, '', 'Aeroespacial')
  assertEqual(nonexistentInd.length, 0, 'Nonexistent industry should yield 0')
})

challengerM3Suite.test('Filter.7: Unique industries deduction handles nulls, duplicates, and empties', () => {
  const mixedClients = [
    { industria: 'Manufactura' },
    { industria: 'Manufactura' },
    { industria: 'Minería' },
    { industria: null },
    { industria: undefined },
    { industria: '' },
    { industria: 'Tecnología' },
  ]

  const allIndustrias = Array.from(new Set(mixedClients.map((c) => c.industria).filter(Boolean)))
  assertEqual(allIndustrias.length, 3, 'Should produce exactly 3 unique industries')
  assert(allIndustrias.includes('Manufactura'), 'Should include Manufactura')
  assert(allIndustrias.includes('Minería'), 'Should include Minería')
  assert(allIndustrias.includes('Tecnología'), 'Should include Tecnología')
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. CLIENT CREATION VALIDATION & DOMAIN MUTATIONS UNDER EDGE INPUTS
// ─────────────────────────────────────────────────────────────────────────────

challengerM3Suite.test('Validation.1: Client form validation rejects empty or whitespace-only names', () => {
  function validateNewClientForm(razon_social, contacto_nombre, viewerProfile) {
    if (!razon_social.trim()) {
      return { valid: false, error: 'La razón social es obligatoria.' }
    }
    if (!contacto_nombre.trim()) {
      return { valid: false, error: 'El nombre del contacto es obligatorio.' }
    }
    if (!viewerProfile) {
      return { valid: false, error: 'Sesión expirada o perfil no encontrado.' }
    }
    return { valid: true }
  }

  const dummyProfile = { id: 'usr-1', rol: 'epc' }

  // Empty razon_social
  const v1 = validateNewClientForm('', 'Juan Pérez', dummyProfile)
  assertEqual(v1.valid, false)
  assertEqual(v1.error, 'La razón social es obligatoria.')

  // Whitespace-only razon_social
  const v2 = validateNewClientForm('   \t\n   ', 'Juan Pérez', dummyProfile)
  assertEqual(v2.valid, false)
  assertEqual(v2.error, 'La razón social es obligatoria.')

  // Empty contacto_nombre
  const v3 = validateNewClientForm('Solar Co', '', dummyProfile)
  assertEqual(v3.valid, false)
  assertEqual(v3.error, 'El nombre del contacto es obligatorio.')

  // Whitespace-only contacto_nombre
  const v4 = validateNewClientForm('Solar Co', '   ', dummyProfile)
  assertEqual(v4.valid, false)
  assertEqual(v4.error, 'El nombre del contacto es obligatorio.')

  // Missing viewerProfile
  const v5 = validateNewClientForm('Solar Co', 'Juan Pérez', null)
  assertEqual(v5.valid, false)
  assertEqual(v5.error, 'Sesión expirada o perfil no encontrado.')

  // Valid inputs
  const v6 = validateNewClientForm('  Solar Co  ', '  Juan Pérez  ', dummyProfile)
  assertEqual(v6.valid, true)
})

challengerM3Suite.test('DomainMutation.1: createCliente sanitizes and attributes EPC ownership anti-spoofing', async () => {
  let capturedInsert = null
  const mockSupabase = {
    from: () => ({
      insert: (payload) => {
        capturedInsert = payload
        return {
          select: () => ({
            single: async () => ({
              data: { id: 'created-uuid-1', ...payload },
              error: null,
            }),
          }),
        }
      },
    }),
  }

  const epcProfile = { id: 'epc-profile-123', rol: 'epc' }
  const payload = {
    razon_social: '  Auto Parts Solar MX  ',
    rfc: '  APM190101ZZ9  ',
    contacto_nombre: '  Carlos Santana  ',
    contacto_cargo: '  Gerente General  ',
    contacto_email: '  csantana@autoparts.mx  ',
    contacto_telefono: '  55 1122 3344  ',
    notas: '  Nota confidencial  ',
    // Attacker attempts to spoof a different epcista_id:
    epcista_id: 'spoofed-epc-999',
  }

  const res = await createCliente(mockSupabase, payload, epcProfile)
  assert(res.success, 'createCliente should succeed')
  assert(capturedInsert !== null, 'Insert payload should be captured')

  // Trimming assertions
  assertEqual(capturedInsert.razon_social, 'Auto Parts Solar MX', 'razon_social must be trimmed')
  assertEqual(capturedInsert.rfc, 'APM190101ZZ9', 'rfc must be trimmed')
  assertEqual(capturedInsert.contacto_nombre, 'Carlos Santana', 'contacto_nombre must be trimmed')
  assertEqual(capturedInsert.contacto_cargo, 'Gerente General', 'contacto_cargo must be trimmed')
  assertEqual(capturedInsert.contacto_email, 'csantana@autoparts.mx', 'contacto_email must be trimmed')
  assertEqual(capturedInsert.contacto_telefono, '55 1122 3344', 'contacto_telefono must be trimmed')
  assertEqual(capturedInsert.notas, 'Nota confidencial', 'notas must be trimmed')

  // Security: EPC creator must be locked to creatorProfile.id
  assertEqual(
    capturedInsert.epcista_id,
    'epc-profile-123',
    'createCliente must lock epcista_id to creatorProfile.id for EPC role, ignoring spoofed ID'
  )
})

challengerM3Suite.test('DomainMutation.2: createCliente attributes Finder creator & optional EPCista assignment', async () => {
  let capturedInsert = null
  const mockSupabase = {
    from: () => ({
      insert: (payload) => {
        capturedInsert = payload
        return {
          select: () => ({
            single: async () => ({
              data: { id: 'created-uuid-2', ...payload },
              error: null,
            }),
          }),
        }
      },
    }),
  }

  const finderProfile = { id: 'finder-profile-456', rol: 'finder' }
  const payload = {
    razon_social: 'Finder Lead Corp',
    contacto_nombre: 'Pedro Infante',
    epcista_id: 'assigned-epc-789',
  }

  const res = await createCliente(mockSupabase, payload, finderProfile)
  assert(res.success, 'Finder createCliente must succeed')
  assertEqual(capturedInsert.finder_id, 'finder-profile-456', 'finder_id must be assigned')
  assertEqual(capturedInsert.epcista_id, 'assigned-epc-789', 'Assigned epcista_id must be persisted')
})

challengerM3Suite.test('DomainMutation.3: createCliente converts whitespace optional fields to null', async () => {
  let capturedInsert = null
  const mockSupabase = {
    from: () => ({
      insert: (payload) => {
        capturedInsert = payload
        return {
          select: () => ({
            single: async () => ({
              data: { id: 'created-uuid-3', ...payload },
              error: null,
            }),
          }),
        }
      },
    }),
  }

  const adminProfile = { id: 'admin-profile-001', rol: 'nodo_admin' }
  const payload = {
    razon_social: 'Clean Corp',
    contacto_nombre: 'Laura Bozzo',
    rfc: '   ',
    contacto_cargo: '   ',
    contacto_email: '',
    contacto_telefono: '  ',
    notas: '     ',
  }

  const res = await createCliente(mockSupabase, payload, adminProfile)
  assert(res.success)
  assertEqual(capturedInsert.rfc, null, 'Whitespace RFC must become null')
  assertEqual(capturedInsert.contacto_cargo, null, 'Whitespace cargo must become null')
  assertEqual(capturedInsert.contacto_email, null, 'Empty email must become null')
  assertEqual(capturedInsert.contacto_telefono, null, 'Whitespace phone must become null')
  assertEqual(capturedInsert.notas, null, 'Whitespace notes must become null')
})

challengerM3Suite.test('DomainMutation.4: Exception handling in create, update, and delete mutations', async () => {
  const failingSupabase = {
    from: () => {
      throw new Error('Supabase network timeout')
    },
  }

  const adminProfile = { id: 'admin-1', rol: 'nodo_admin' }

  // createCliente
  const cRes = await createCliente(failingSupabase, { razon_social: 'X', contacto_nombre: 'Y' }, adminProfile)
  assertEqual(cRes.success, false, 'createCliente must return success: false on throw')
  assertIncludes(cRes.error, 'network timeout', 'Error message must be preserved')

  // updateCliente
  const uRes = await updateCliente(failingSupabase, 'c-123', { razon_social: 'X', contacto_nombre: 'Y' })
  assertEqual(uRes.success, false, 'updateCliente must return success: false on throw')
  assertIncludes(uRes.error, 'network timeout', 'Error message must be preserved')

  // deleteCliente
  const dRes = await deleteCliente(failingSupabase, 'c-123')
  assertEqual(dRes.success, false, 'deleteCliente must return success: false on throw')
  assertIncludes(dRes.error, 'network timeout', 'Error message must be preserved')
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. CROSS-PORTAL DEEP LINKS & ROUTE INTEGRITY ACROSS ALL PORTALS
// ─────────────────────────────────────────────────────────────────────────────

challengerM3Suite.test('DeepLinks.1: Complete matrix of cross-portal /clientes directory deep links', () => {
  const supportedRoles = ['admin', 'analista', 'epc', 'finder']
  const sourcePortals = ['admin', 'analista', 'epc', 'finder']

  for (const source of sourcePortals) {
    for (const target of supportedRoles) {
      const incoming = `/${source}/clientes`
      const expected = `/${target}/clientes`
      const resolved = resolveCrossPortalDeepLink(incoming, target)
      assertEqual(
        resolved,
        expected,
        `Deep link from /${source}/clientes to target ${target} must resolve to ${expected}`
      )
    }
  }
})

challengerM3Suite.test('DeepLinks.2: Complete matrix of cross-portal /clientes/nuevo deep links', () => {
  const supportedRoles = ['admin', 'analista', 'epc', 'finder']
  const sourcePortals = ['admin', 'analista', 'epc', 'finder']

  for (const source of sourcePortals) {
    for (const target of supportedRoles) {
      const incoming = `/${source}/clientes/nuevo`
      const expected = `/${target}/clientes/nuevo`
      const resolved = resolveCrossPortalDeepLink(incoming, target)
      assertEqual(
        resolved,
        expected,
        `Deep link from /${source}/clientes/nuevo to target ${target} must resolve to ${expected}`
      )
    }
  }
})

challengerM3Suite.test('DeepLinks.3: Complete matrix of client detail /clientes/[id] deep links', () => {
  const supportedRoles = ['admin', 'analista', 'epc', 'finder']
  const clientId = 'c8b21e84-5f12-4d2a-bc93-a9d023412567'

  for (const source of supportedRoles) {
    for (const target of supportedRoles) {
      const incoming = `/${source}/clientes/${clientId}`
      const expected = `/${target}/clientes/${clientId}`
      const resolved = resolveCrossPortalDeepLink(incoming, target)
      assertEqual(
        resolved,
        expected,
        `Detail deep link from /${source}/clientes/[id] to target ${target} must resolve to ${expected}`
      )
    }
  }
})

challengerM3Suite.test('DeepLinks.4: Unsupported roles fallback safely to their respective portal root', () => {
  const clientId = 'c8b21e84-5f12-4d2a-bc93-a9d023412567'
  const unsupportedTargets = ['cliente', 'financiero', 'mem']

  for (const target of unsupportedTargets) {
    // Directory link
    const dirResult = resolveCrossPortalDeepLink('/admin/clientes', target)
    assertEqual(
      dirResult,
      `/${target}`,
      `Target ${target} has no /clientes directory and must fall back to /${target}`
    )

    // New client link
    const newResult = resolveCrossPortalDeepLink('/admin/clientes/nuevo', target)
    assertEqual(
      newResult,
      `/${target}`,
      `Target ${target} has no /clientes/nuevo and must fall back to /${target}`
    )

    // Detail link
    const detailResult = resolveCrossPortalDeepLink(`/admin/clientes/${clientId}`, target)
    assertEqual(
      detailResult,
      `/${target}`,
      `Target ${target} has no /clientes/[id] and must fall back to /${target}`
    )
  }
})

challengerM3Suite.test('DeepLinks.5: Query parameters and search filters are preserved across client rewrites', () => {
  const complexQuery = '?search=Solar&industria=Manufactura&page=1&sort=desc'

  const res1 = resolveCrossPortalDeepLink('/admin/clientes', 'epc', complexQuery)
  assertEqual(res1, `/epc/clientes${complexQuery}`, 'Filter parameters must be preserved on directory rewrite')

  const prefillQuery = '?razon_social=Nueva+Planta+SLP&rfc=NPS200101XYZ'
  const res2 = resolveCrossPortalDeepLink('/admin/clientes/nuevo', 'finder', prefillQuery)
  assertEqual(res2, `/finder/clientes/nuevo${prefillQuery}`, 'Prefill query must be preserved on new client rewrite')
})

challengerM3Suite.test('DeepLinks.6: URL edge cases and missing targets', () => {
  // Missing targetPath redirects to /login
  assertEqual(resolveCrossPortalDeepLink('/admin/clientes', undefined), '/login')
  assertEqual(resolveCrossPortalDeepLink('/admin/clientes', ''), '/login')

  // Incoming path without portal prefix
  assertEqual(resolveCrossPortalDeepLink('/', 'epc'), '/epc')
  assertEqual(resolveCrossPortalDeepLink('/unsupported', 'admin'), '/admin')

  // Same portal preserves path and query directly
  assertEqual(
    resolveCrossPortalDeepLink('/admin/clientes', 'admin', '?tab=active'),
    '/admin/clientes?tab=active'
  )
})

challengerM3Suite.test('DeepLinks.7: PORTAL_SUPPORTED_ROUTES regex patterns validation', () => {
  // Check regex matching for /clientes
  const adminClientRegex = PORTAL_SUPPORTED_ROUTES.admin.find((r) => r.test('/clientes'))
  assert(adminClientRegex !== undefined, 'Admin must support /clientes')

  assert(adminClientRegex.test('/clientes'), '/clientes matches')
  assert(adminClientRegex.test('/clientes/nuevo'), '/clientes/nuevo matches')
  assert(adminClientRegex.test('/clientes/c-12345'), '/clientes/c-12345 matches')
  assert(!adminClientRegex.test('/clientes_other'), '/clientes_other must NOT match')

  // Check cliente portal does not have /clientes regex
  const clienteMatchesClients = PORTAL_SUPPORTED_ROUTES.cliente.some((r) => r.test('/clientes'))
  assertEqual(clienteMatchesClients, false, 'Cliente portal must NOT support /clientes')

  // Check financiero portal does not have /clientes regex
  const financieroMatchesClients = PORTAL_SUPPORTED_ROUTES.financiero.some((r) => r.test('/clientes'))
  assertEqual(financieroMatchesClients, false, 'Financiero portal must NOT support /clientes')

  // Check mem portal does not have /clientes regex
  const memMatchesClients = PORTAL_SUPPORTED_ROUTES.mem.some((r) => r.test('/clientes'))
  assertEqual(memMatchesClients, false, 'MEM portal must NOT support /clientes')
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. LIVE SUPABASE DIRECTORY SCOPING & PRODUCTION DATA INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, getServiceRoleClient } from './test-utils.mjs'

function getAuthenticatedClient(session) {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  })
}

challengerM3Suite.test('LiveRead.1: Admin session retrieves real client directory with required fields', async () => {
  const { session, user } = await getAuthSession('admin')
  const authClient = getAuthenticatedClient(session)

  // Get Admin profile
  const { data: adminProfile, error: pErr } = await authClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  assert(!pErr, `Error fetching admin profile: ${pErr?.message}`)
  assert(adminProfile !== null, 'Admin profile must exist')
  assertEqual(adminProfile.rol, 'nodo_admin', 'Admin role must be nodo_admin')

  // Execute fetchClientesDirectory
  const clients = await fetchClientesDirectory(authClient, adminProfile)
  assert(Array.isArray(clients), 'fetchClientesDirectory must return an array')
  assert(clients.length >= 9, `Expected at least 9 production clients, got ${clients.length}`)

  // Verify all clients have valid IDs and razon_social
  for (const c of clients) {
    assert(typeof c.id === 'string' && c.id.length > 0, 'Client id must be a non-empty string')
    assert(typeof c.razon_social === 'string' && c.razon_social.length > 0, 'Client razon_social must be non-empty')
    assert(c.epcista_nombre !== undefined, 'Client must have epcista_nombre resolved')
  }
})

challengerM3Suite.test('LiveRead.2: EPC session strictly scopes client directory to EPC ownership', async () => {
  const { session, user } = await getAuthSession('epc')
  const authClient = getAuthenticatedClient(session)

  const { data: epcProfile, error: pErr } = await authClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  assert(!pErr, `Error fetching EPC profile: ${pErr?.message}`)
  assert(epcProfile !== null, 'EPC profile must exist')
  assertEqual(epcProfile.rol, 'epc', 'EPC profile role must be epc')

  const epcClients = await fetchClientesDirectory(authClient, epcProfile)
  assert(Array.isArray(epcClients), 'EPC directory must return an array')

  // Crucial security invariant: every client in the list MUST have epcista_id === epcProfile.id
  for (const c of epcClients) {
    assertEqual(
      c.epcista_id,
      epcProfile.id,
      `EPC client ${c.id} must be strictly owned by epcista_id ${epcProfile.id}`
    )
  }
})

challengerM3Suite.test('LiveRead.3: Zero production clients modified or deleted', async () => {
  const service = getServiceRoleClient()
  const { count, error } = await service.from('clientes').select('*', { count: 'exact', head: true })
  assert(!error, `Failed to query clientes count: ${error?.message}`)
  assert(count >= 9, `Production clientes table must have at least 9 clients intact, found ${count}`)
})

// ── Run if directly executed ──
if (process.argv[1] && process.argv[1].endsWith('challenger-m3-empirical.test.mjs')) {
  challengerM3Suite.run().catch((err) => {
    console.error('Test suite failed:', err)
    process.exit(1)
  })
}
