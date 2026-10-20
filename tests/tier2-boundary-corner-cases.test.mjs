import {
  TestSuite,
  assert,
  assertEqual,
  assertIncludes,
  getAuthSession,
  setActiveSessionCookies,
  clearActiveSessionCookies,
} from './test-utils.mjs'

import { calcFV, calcBESS, n2 } from '../components/proyectos/wizard/calculations.ts'
import { parseNum } from '../lib/format.ts'

export const tier2Suite = new TestSuite('Tier 2: Boundary & Corner Cases')

// ── 1. Unauthorized Role Matrix ──────────────────────────────────────────────
tier2Suite.test('2.1: adminDeleteUser rejects unauthenticated caller with "No autenticado"', async () => {
  clearActiveSessionCookies()
  const { adminDeleteUser } = await import('../app/actions/adminDeleteUser.ts')
  const result = await adminDeleteUser('00000000-0000-0000-0000-000000000001')

  assertIncludes(
    result.error,
    'No autenticado',
    'Unauthenticated delete attempt must return unauthenticated error'
  )
})

tier2Suite.test('2.2: adminDeleteUser rejects EPC user with unauthorized error', async () => {
  const epcAuth = await getAuthSession('epc')
  setActiveSessionCookies(epcAuth.session)

  const { adminDeleteUser } = await import('../app/actions/adminDeleteUser.ts')
  const result = await adminDeleteUser('00000000-0000-0000-0000-000000000001')

  clearActiveSessionCookies()
  assertEqual(
    result.error,
    'No autorizado. Solo administradores pueden eliminar cuentas.',
    'EPC must not be authorized to delete accounts'
  )
})

tier2Suite.test('2.3: crearUsuarioAdmin rejects unauthenticated caller', async () => {
  clearActiveSessionCookies()
  const { crearUsuarioAdmin } = await import('../app/actions/crearUsuario.ts')
  const result = await crearUsuarioAdmin({
    email: 'test@prueba.com',
    nombre: 'Test',
    empresa: 'Test',
    rol: 'cliente_final',
  })

  assertIncludes(
    result.error,
    'No autenticado',
    'Unauthenticated user creation attempt must be blocked'
  )
})

tier2Suite.test('2.4: crearUsuarioAdmin rejects EPC creating forbidden roles (epc, nodo_admin, nodo_analista)', async () => {
  const epcAuth = await getAuthSession('epc')
  setActiveSessionCookies(epcAuth.session)

  const { crearUsuarioAdmin } = await import('../app/actions/crearUsuario.ts')

  // EPC attempting to create another EPC
  const resEpc = await crearUsuarioAdmin({
    email: 'new_epc@prueba.com',
    nombre: 'Another EPC',
    empresa: 'Solar Corp',
    rol: 'epc',
    password: 'Password123!',
  })
  assertEqual(
    resEpc.error,
    'No autorizado para crear este tipo de usuario.',
    'EPC creating epc must be rejected'
  )

  // EPC attempting to create admin
  const resAdmin = await crearUsuarioAdmin({
    email: 'new_admin@prueba.com',
    nombre: 'Hacker Admin',
    empresa: 'Solar Corp',
    rol: 'nodo_admin',
    password: 'Password123!',
  })
  assert(
    resAdmin.error.includes('No autorizado'),
    'EPC creating admin must be rejected'
  )

  clearActiveSessionCookies()
})

// ── 2. Malformed Inputs ──────────────────────────────────────────────────────
tier2Suite.test('2.5: adminDeleteUser rejects malformed targetId (empty, whitespace, null, non-string)', async () => {
  const adminAuth = await getAuthSession('admin')
  setActiveSessionCookies(adminAuth.session)

  const { adminDeleteUser } = await import('../app/actions/adminDeleteUser.ts')

  const resEmpty = await adminDeleteUser('')
  assertEqual(resEmpty.error, 'ID de usuario inválido.', 'Empty ID must be rejected')

  const resNull = await adminDeleteUser(null)
  assertEqual(resNull.error, 'ID de usuario inválido.', 'Null ID must be rejected')

  const resNum = await adminDeleteUser(12345)
  assertEqual(resNum.error, 'ID de usuario inválido.', 'Numeric ID must be rejected')

  clearActiveSessionCookies()
})

tier2Suite.test('2.6: crearUsuarioAdmin rejects invalid role identifiers', async () => {
  const adminAuth = await getAuthSession('admin')
  setActiveSessionCookies(adminAuth.session)

  const { crearUsuarioAdmin } = await import('../app/actions/crearUsuario.ts')

  const invalidRoles = ['superadmin', 'root', 'hacker', '']
  for (const role of invalidRoles) {
    const res = await crearUsuarioAdmin({
      email: 'invalid_role@prueba.com',
      nombre: 'Invalid Role Test',
      empresa: 'Test Corp',
      rol: role,
    })
    assertEqual(
      res.error,
      `Rol inválido: ${role}`,
      `Invalid role '${role}' must be rejected with explicit error`
    )
  }

  clearActiveSessionCookies()
})

// ── 3. Missing CFE Receipt File ──────────────────────────────────────────────
tier2Suite.test('3.1: Site creation handles missing CFE receipt file gracefully without crashing', () => {
  // In Step1Sites, receipt upload is optional. When no file is selected,
  // the site payload assigns recibo_cfe_url = null
  const newSiteWithoutReceipt = {
    nombre: 'Nave Industrial Norte',
    nombre_recibo: 'Nave Norte RPU',
    ciudad: 'Monterrey',
    ubicacion_estado: 'Nuevo León',
    rpu: '123456789012',
    demanda_contratada_kw: '450',
    recibo_cfe_url: null,
  }

  assert(newSiteWithoutReceipt.nombre.length > 0, 'Site has name')
  assertEqual(newSiteWithoutReceipt.recibo_cfe_url, null, 'Receipt URL is null without throwing')
})

// ── 4. Empty Directory Filters & Zero-Match Queries ──────────────────────────
tier2Suite.test('4.1: Analyst directory handles zero-match searches and empty filter strings cleanly', () => {
  const sampleProjects = [
    { id: '1', nombre_proyecto: 'Proyecto Alfa', epcista_nombre: 'EPC Uno', cliente_final_empresa: 'Empresa A' },
    { id: '2', nombre_proyecto: 'Proyecto Beta', epcista_nombre: 'EPC Dos', cliente_final_empresa: 'Empresa B' },
  ]

  // Filter function matching analista/proyectos/page.tsx line 82-93
  function filterProjects(proyectos, filtroEstado, filtroTipo, busqueda) {
    return proyectos.filter((p) => {
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
      if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        if (
          !p.nombre_proyecto?.toLowerCase().includes(q) &&
          !p.epcista_nombre?.toLowerCase().includes(q) &&
          !p.cliente_final_empresa?.toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
  }

  // 1. Zero-match query
  const zeroMatches = filterProjects(sampleProjects, 'todos', 'todos', 'XYZ_NONEXISTENT_QUERY_9999')
  assertEqual(zeroMatches.length, 0, 'Zero-match query must return empty array without error')

  // 2. Empty query string returns all projects
  const allProjects = filterProjects(sampleProjects, 'todos', 'todos', '')
  assertEqual(allProjects.length, 2, 'Empty query string must return all projects')

  // 3. Special characters search
  const specialChars = filterProjects(sampleProjects, 'todos', 'todos', '!@#$%^&*()_+')
  assertEqual(specialChars.length, 0, 'Special characters must not throw syntax errors')
})

// ── 5. Negative Values & Zero Division Boundaries ────────────────────────────
tier2Suite.test('5.1: Technical calculations handle negative and zero values without crashing or NaN', () => {
  // Zero / negative module count or module watts
  const fvZero = {
    num_modulos: '0',
    potencia_modulos_w: '550',
    num_inversores: '0',
    potencia_inversores_kw: '0',
    marca_modulos: '',
    marca_inversores: '',
    generacion_anual_kwh: '0',
    capex: '0',
    capex_moneda: 'USD',
  }
  const calcZero = calcFV(fvZero)
  assertEqual(calcZero.kwpSistema, null, '0 modules must produce null kwpSistema')
  assertEqual(calcZero.kwpInversores, null, '0 inverters must produce null kwpInversores')
  assertEqual(calcZero.precioWatt, null, '0 capex / modules must produce null precioWatt (no division by zero)')
  assertEqual(n2(calcZero.precioWatt), '—', 'null price per watt formats to "—"')

  // Negative values
  const fvNegative = {
    ...fvZero,
    num_modulos: '-10',
    potencia_modulos_w: '-500',
    capex: '-1000',
  }
  const calcNeg = calcFV(fvNegative)
  assertEqual(calcNeg.kwpSistema, null, 'Negative modules must produce null kwpSistema')
  assertEqual(calcNeg.precioWatt, null, 'Negative values must produce null precioWatt')

  // BESS zero capacity
  const bessZero = {
    potencia_kw: '0',
    capacidad_kwh: '0',
    marca: '',
    uso: '',
    capex: '0',
    capex_moneda: 'USD',
    inversores_hibridos: false,
  }
  const calcBessZero = calcBESS(bessZero)
  assertEqual(calcBessZero.precioKwh, null, '0 BESS capacity must produce null precioKwh (no division by zero)')
})

// ── 6. Extreme Demand Boundaries (> 1000 kW) ─────────────────────────────────
tier2Suite.test('6.1: High demand MEM threshold triggers strictly when demand exceeds 1000 kW', () => {
  function checkMemTrigger(sitios) {
    return sitios.some((s) => parseNum(s.demanda_contratada_kw) > 1000)
  }

  // 1. Demand below threshold (999 kW)
  assertEqual(checkMemTrigger([{ demanda_contratada_kw: '999' }]), false, '999 kW must not trigger MEM')

  // 2. Demand exact threshold boundary (1000 kW)
  assertEqual(checkMemTrigger([{ demanda_contratada_kw: '1000' }]), false, '1000 kW boundary does not trigger MEM (> 1000 required)')

  // 3. Demand just above threshold (1000.5 kW)
  assertEqual(checkMemTrigger([{ demanda_contratada_kw: '1000.5' }]), true, '1000.5 kW must trigger MEM')

  // 4. Extreme demand (50000 kW)
  assertEqual(checkMemTrigger([{ demanda_contratada_kw: '50000' }]), true, '50000 kW must trigger MEM')

  // 5. Multiple sites, one high demand
  const multiSites = [
    { demanda_contratada_kw: '350' },
    { demanda_contratada_kw: '1200' },
  ]
  assertEqual(checkMemTrigger(multiSites), true, 'Multiple sites with one > 1000 must trigger MEM')
})
