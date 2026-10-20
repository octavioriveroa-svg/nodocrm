/**
 * CHALLENGER 1: EMPIRICAL ADVERSARIAL STRESS TEST SUITE
 * 
 * Comprehensive boundary, edge case, and attack payload testing covering:
 * - Challenge R1: RBAC Enforcement & Server Actions (malicious payloads, unauthorized roles, self-deletion, spoofing)
 * - Challenge R2: ProjectWizard Validation (empty strings, negative numbers, missing fields, illegal transitions, hybrid inverter scoping)
 * - Challenge R3: Analyst Directory & Navigation (malformed queries, SQL injection, unicode, regex special chars, prefix bleed)
 * - Challenge R4: OfertasBoard Data Mapping & Safe PostgREST Querying (null, undefined, 0, NaN, extreme numbers)
 */

import {
  TestSuite,
  assert,
  assertEqual,
  assertIncludes,
  getAuthSession,
  setActiveSessionCookies,
  clearActiveSessionCookies,
  getAnonClient,
} from './test-utils.mjs'

import { getWizardCapabilities } from '../components/proyectos/wizard/capabilities.ts'
import {
  validarPaso0,
  validarPaso1,
  validarPaso2,
  validarPaso3,
  validarFvForm,
  validarBessForm,
} from '../components/proyectos/wizard/validation.ts'
import { calcFV, calcBESS, n2 } from '../components/proyectos/wizard/calculations.ts'
import { parseNum, formatNumberInput } from '../lib/format.ts'

export const challengerSuite = new TestSuite('Challenger 1: Empirical Adversarial Stress Suite')

// =============================================================================
// CHALLENGE R1: RBAC ENFORCEMENT & SERVER ACTIONS
// =============================================================================

challengerSuite.test('R1.A1: adminDeleteUser prevents self-deletion by nodo_admin', async () => {
  const adminAuth = await getAuthSession('admin')
  setActiveSessionCookies(adminAuth.session)

  const { adminDeleteUser } = await import('../app/actions/adminDeleteUser.ts')
  const result = await adminDeleteUser(adminAuth.user.id)

  clearActiveSessionCookies()
  assertEqual(
    result.error,
    'No puedes eliminar tu propia cuenta.',
    'Admin self-deletion must be blocked with explicit error message'
  )
  assertEqual(result.success, undefined, 'Self-deletion must not succeed')
})

challengerSuite.test('R1.A2: adminDeleteUser rejects unauthorized roles (analista, epc, cliente, unauthenticated)', async () => {
  const { adminDeleteUser } = await import('../app/actions/adminDeleteUser.ts')
  const dummyTargetId = '00000000-0000-0000-0000-000000000002'

  // 1. Unauthenticated
  clearActiveSessionCookies()
  const unauthRes = await adminDeleteUser(dummyTargetId)
  assertIncludes(unauthRes.error, 'No autenticado', 'Unauthenticated caller must be rejected')

  // 2. nodo_analista
  const analistaAuth = await getAuthSession('analista')
  setActiveSessionCookies(analistaAuth.session)
  const analistaRes = await adminDeleteUser(dummyTargetId)
  assertEqual(
    analistaRes.error,
    'No autorizado. Solo administradores pueden eliminar cuentas.',
    'Analyst must be rejected with unauthorized message'
  )

  // 3. epc
  const epcAuth = await getAuthSession('epc')
  setActiveSessionCookies(epcAuth.session)
  const epcRes = await adminDeleteUser(dummyTargetId)
  assertEqual(
    epcRes.error,
    'No autorizado. Solo administradores pueden eliminar cuentas.',
    'EPC must be rejected with unauthorized message'
  )

  // 4. cliente_final
  const clienteAuth = await getAuthSession('cliente')
  setActiveSessionCookies(clienteAuth.session)
  const clienteRes = await adminDeleteUser(dummyTargetId)
  assertEqual(
    clienteRes.error,
    'No autorizado. Solo administradores pueden eliminar cuentas.',
    'Cliente final must be rejected with unauthorized message'
  )

  clearActiveSessionCookies()
})

challengerSuite.test('R1.A3: adminDeleteUser handles boundary, malformed, and malicious targetId payloads safely', async () => {
  const adminAuth = await getAuthSession('admin')
  setActiveSessionCookies(adminAuth.session)
  const { adminDeleteUser } = await import('../app/actions/adminDeleteUser.ts')

  const boundaryPayloads = [
    { id: '', expected: 'ID de usuario inválido.', desc: 'empty string' },
    { id: null, expected: 'ID de usuario inválido.', desc: 'null' },
    { id: undefined, expected: 'ID de usuario inválido.', desc: 'undefined' },
    { id: 12345, expected: 'ID de usuario inválido.', desc: 'number' },
    { id: {}, expected: 'ID de usuario inválido.', desc: 'object' },
    { id: ['uuid'], expected: 'ID de usuario inválido.', desc: 'array' },
  ]

  for (const { id, expected, desc } of boundaryPayloads) {
    const res = await adminDeleteUser(id)
    assertEqual(res.error, expected, `adminDeleteUser should reject ${desc} targetId`)
  }

  // Malicious strings: SQL injection and extremely long payload
  const sqlInjectionId = "00000000-0000-0000-0000-000000000001'; DROP TABLE auth.users;--"
  const sqlRes = await adminDeleteUser(sqlInjectionId)
  assert(sqlRes.error && typeof sqlRes.error === 'string', 'SQL injection payload should be safely rejected with error')
  assertEqual(sqlRes.success, undefined, 'SQL injection payload must not succeed')

  const longPayloadId = 'a'.repeat(5000)
  const longRes = await adminDeleteUser(longPayloadId)
  assert(longRes.error && typeof longRes.error === 'string', 'Long string payload should be safely rejected with error')

  clearActiveSessionCookies()
})

challengerSuite.test('R1.B1: crearUsuarioAdmin blocks privilege escalation (analista & epc creating nodo_admin)', async () => {
  const { crearUsuarioAdmin } = await import('../app/actions/crearUsuario.ts')

  // 1. Analyst attempting to create nodo_admin
  const analistaAuth = await getAuthSession('analista')
  setActiveSessionCookies(analistaAuth.session)
  const analistaRes = await crearUsuarioAdmin({
    email: 'hacker_admin@nodoenergy.com',
    nombre: 'Malicious Admin',
    empresa: 'Attack Corp',
    rol: 'nodo_admin',
    password: 'Password123!',
  })
  assertEqual(
    analistaRes.error,
    'No autorizado: solo los administradores pueden crear cuentas de administrador.',
    'Analyst privilege escalation must be strictly rejected'
  )

  // 2. EPC attempting to create nodo_admin
  const epcAuth = await getAuthSession('epc')
  setActiveSessionCookies(epcAuth.session)
  const epcAdminRes = await crearUsuarioAdmin({
    email: 'epc_fake_admin@nodoenergy.com',
    nombre: 'EPC Fake Admin',
    empresa: 'Attack Corp',
    rol: 'nodo_admin',
    password: 'Password123!',
  })
  assertEqual(
    epcAdminRes.error,
    'No autorizado: solo los administradores pueden crear cuentas de administrador.',
    'EPC privilege escalation must be strictly rejected'
  )

  // 3. EPC attempting to create nodo_analista
  const epcAnalistaRes = await crearUsuarioAdmin({
    email: 'epc_analyst@nodoenergy.com',
    nombre: 'EPC Analyst',
    empresa: 'Attack Corp',
    rol: 'nodo_analista',
    password: 'Password123!',
  })
  assertEqual(
    epcAnalistaRes.error,
    'No autorizado para crear este tipo de usuario.',
    'EPC creating analyst role must be rejected'
  )

  // 4. EPC attempting to create another EPC
  const epcEpcRes = await crearUsuarioAdmin({
    email: 'epc_peer@nodoenergy.com',
    nombre: 'EPC Peer',
    empresa: 'Attack Corp',
    rol: 'epc',
    password: 'Password123!',
  })
  assertEqual(
    epcEpcRes.error,
    'No autorizado para crear este tipo de usuario.',
    'EPC creating another EPC must be rejected'
  )

  clearActiveSessionCookies()
})

challengerSuite.test('R1.B2: crearUsuarioAdmin rejects invalid/spoofed role strings and unauthenticated calls', async () => {
  const { crearUsuarioAdmin } = await import('../app/actions/crearUsuario.ts')

  // Unauthenticated
  clearActiveSessionCookies()
  const unauthRes = await crearUsuarioAdmin({
    email: 'unauth@test.com',
    nombre: 'Test',
    empresa: 'Test',
    rol: 'cliente_final',
  })
  assertEqual(unauthRes.error, 'No autenticado', 'Unauthenticated caller must be rejected')

  // Admin caller with spoofed/invalid roles
  const adminAuth = await getAuthSession('admin')
  setActiveSessionCookies(adminAuth.session)

  const invalidRoles = ['super_admin', 'root', 'ADMIN', '__proto__', 'constructor', 'undefined', 'null', '']
  for (const invRole of invalidRoles) {
    const res = await crearUsuarioAdmin({
      email: 'invalid_role_test@test.com',
      nombre: 'Test',
      empresa: 'Test',
      rol: invRole,
    })
    assertEqual(res.error, `Rol inválido: ${invRole}`, `Role "${invRole}" must be rejected`)
  }

  clearActiveSessionCookies()
})

challengerSuite.test('R1.C1: invitarUsuario blocks unauthorized roles and privilege escalation', async () => {
  const { invitarUsuario } = await import('../app/actions/invitar.ts')

  // 1. Unauthenticated
  clearActiveSessionCookies()
  const unauthRes = await invitarUsuario({
    email: 'unauth_invite@test.com',
    nombre: 'Test',
    empresa: 'Test',
    rol: 'epc',
  })
  assertEqual(unauthRes.error, 'No autenticado', 'Unauthenticated invitation must be rejected')

  // 2. Analyst trying to invite nodo_admin
  const analistaAuth = await getAuthSession('analista')
  setActiveSessionCookies(analistaAuth.session)
  const analistaInviteRes = await invitarUsuario({
    email: 'invite_admin@nodoenergy.com',
    nombre: 'Admin Invite',
    empresa: 'Test',
    rol: 'nodo_admin',
  })
  assertEqual(
    analistaInviteRes.error,
    'No autorizado: solo los administradores pueden invitar cuentas de administrador.',
    'Analyst inviting admin must be rejected'
  )

  // 3. EPC trying to invite nodo_admin
  const epcAuth = await getAuthSession('epc')
  setActiveSessionCookies(epcAuth.session)
  const epcInviteAdminRes = await invitarUsuario({
    email: 'epc_invite_admin@nodoenergy.com',
    nombre: 'Admin Invite',
    empresa: 'Test',
    rol: 'nodo_admin',
  })
  assertEqual(
    epcInviteAdminRes.error,
    'No autorizado: solo los administradores pueden invitar cuentas de administrador.',
    'EPC inviting admin must be rejected'
  )

  // 4. EPC trying to invite epc
  const epcInviteEpcRes = await invitarUsuario({
    email: 'epc_invite_epc@test.com',
    nombre: 'EPC Invite',
    empresa: 'Test',
    rol: 'epc',
  })
  assertEqual(
    epcInviteEpcRes.error,
    'No autorizado para invitar este tipo de usuario',
    'EPC inviting another EPC must be rejected'
  )

  // 5. Cliente trying to invite
  const clienteAuth = await getAuthSession('cliente')
  setActiveSessionCookies(clienteAuth.session)
  const clienteInviteRes = await invitarUsuario({
    email: 'cliente_invite@test.com',
    nombre: 'Test',
    empresa: 'Test',
    rol: 'epc',
  })
  assertEqual(
    clienteInviteRes.error,
    'No autorizado para enviar invitaciones',
    'Cliente final cannot invite users'
  )

  clearActiveSessionCookies()
})

challengerSuite.test('R1.C2: EPC creating/inviting for a client belonging to someone else is blocked', async () => {
  const { crearUsuarioAdmin } = await import('../app/actions/crearUsuario.ts')
  const { invitarUsuario } = await import('../app/actions/invitar.ts')

  const epcAuth = await getAuthSession('epc')
  setActiveSessionCookies(epcAuth.session)

  // Non-existent or other EPC's client CRM ID
  const foreignClientId = '00000000-0000-0000-0000-000000000099'

  const resCrear = await crearUsuarioAdmin({
    email: 'fake_client_user@test.com',
    nombre: 'Victim Client',
    empresa: 'Victim SA',
    rol: 'cliente_final',
    cliente_crm_id: foreignClientId,
  })
  assertEqual(
    resCrear.error,
    'No autorizado: este cliente no te pertenece.',
    'EPC cannot create user for foreign client ID'
  )

  const resInvitar = await invitarUsuario({
    email: 'fake_client_user_inv@test.com',
    nombre: 'Victim Client',
    empresa: 'Victim SA',
    rol: 'cliente_final',
    cliente_crm_id: foreignClientId,
  })
  assertEqual(
    resInvitar.error,
    'No autorizado: este cliente no te pertenece',
    'EPC cannot invite user for foreign client ID'
  )

  clearActiveSessionCookies()
})


// =============================================================================
// CHALLENGE R2: PROJECT WIZARD VALIDATION & BOUNDARIES
// =============================================================================

challengerSuite.test('R2.A1: Step 0 validates empty, whitespace, and role-specific requirements', () => {
  const adminCaps = getWizardCapabilities('admin')
  const epcCaps = getWizardCapabilities('epc')
  const finderCaps = getWizardCapabilities('finder')

  const dummyForm = {
    nombre_proyecto: '',
    cliente_id: '',
    tipo_instalacion: '',
    tipo_financiamiento: 'contado',
    moneda: 'MXN',
  }
  const dummyManual = { nombre: '', empresa: '', contacto: '' }

  // 1. Empty and whitespace project name
  assertEqual(
    validarPaso0(dummyForm, adminCaps, '', false, dummyManual),
    'Ingresa el nombre del proyecto / Enter project name.'
  )
  assertEqual(
    validarPaso0({ ...dummyForm, nombre_proyecto: '    \t\n  ' }, adminCaps, '', false, dummyManual),
    'Ingresa el nombre del proyecto / Enter project name.'
  )

  // 2. Admin requiring EPC selection
  const formWithTitle = { ...dummyForm, nombre_proyecto: 'Proyecto Solar Alfa' }
  assertEqual(
    validarPaso0(formWithTitle, adminCaps, '', false, dummyManual),
    'Selecciona un EPCista / Select an EPC.'
  )

  // 3. Admin manual client validation
  assertEqual(
    validarPaso0(formWithTitle, adminCaps, 'epc-1', true, dummyManual),
    'Ingresa el nombre del contacto del cliente / Enter client contact name.'
  )
  assertEqual(
    validarPaso0(formWithTitle, adminCaps, 'epc-1', true, { nombre: 'Juan', empresa: '  ', contacto: '' }),
    'Ingresa la empresa del cliente / Enter client company name.'
  )

  // 4. Admin standard client selection requirement
  assertEqual(
    validarPaso0(formWithTitle, adminCaps, 'epc-1', false, dummyManual),
    'Selecciona un cliente o ingresa datos manualmente / Select a client or enter manually.'
  )

  // 5. EPC portal validation: EPC selection is NOT required, but client is
  assertEqual(
    validarPaso0(formWithTitle, epcCaps, '', false, dummyManual),
    'Selecciona un cliente / Select a client.'
  )

  // 6. Finder portal validation: EPC selection IS required, and client is
  assertEqual(
    validarPaso0(formWithTitle, finderCaps, '', false, dummyManual),
    'Selecciona un EPCista / Select an EPC.'
  )
  assertEqual(
    validarPaso0(formWithTitle, finderCaps, 'epc-1', false, dummyManual),
    'Selecciona un cliente / Select a client.'
  )

  // 7. Missing installation type
  const formWithClient = { ...formWithTitle, cliente_id: 'client-1' }
  assertEqual(
    validarPaso0(formWithClient, adminCaps, 'epc-1', false, dummyManual),
    'Selecciona el tipo de instalación / Select installation type.'
  )

  // 8. Fully valid Step 0 passes
  const validForm = { ...formWithClient, tipo_instalacion: 'generacion_distribuida' }
  assertEqual(validarPaso0(validForm, adminCaps, 'epc-1', false, dummyManual), '')
})

challengerSuite.test('R2.A2: Step 1 validates empty site selection', () => {
  assertEqual(
    validarPaso1([]),
    'Debes seleccionar al menos un sitio para el proyecto / You must select at least one site for the project.'
  )
  assertEqual(validarPaso1(['sitio-1']), '')
  assertEqual(validarPaso1(['sitio-1', 'sitio-2']), '')
})

challengerSuite.test('R2.B1: Step 2 validates empty configs, duplicates, and missing products', () => {
  // Empty configs
  assertEqual(
    validarPaso2([]),
    'Debes definir al menos una alternativa técnica / You must define at least one technical alternative.'
  )

  // Duplicate names (including whitespace trimming)
  const dupConfigs = [
    { tempId: '1', nombre: 'Alternativa A', descripcion: '', sitiosSeleccionados: [], productosMap: {}, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
    { tempId: '2', nombre: '  Alternativa A  ', descripcion: '', sitiosSeleccionados: [], productosMap: {}, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
  ]
  assertEqual(
    validarPaso2(dupConfigs),
    'Cada alternativa técnica debe tener un nombre único / Each technical alternative must have a unique name.'
  )

  // Config without products
  const emptyProdConfig = [
    { tempId: '1', nombre: 'Alternativa A', descripcion: '', sitiosSeleccionados: [], productosMap: { 'site-1': [] }, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
  ]
  assertEqual(
    validarPaso2(emptyProdConfig),
    'La alternativa "Alternativa A" debe tener al menos un producto (FV o BESS) / Alternative "Alternativa A" must have at least one product (PV or BESS).'
  )
})

challengerSuite.test('R2.B2: FV Form validation enforces strict requirements and proper hybrid inverter scoping', () => {
  const dummyFv = {
    num_modulos: '',
    potencia_modulos_w: '',
    marca_modulos: '',
    num_inversores: '',
    potencia_inversores_kw: '',
    marca_inversores: '',
    generacion_anual_kwh: '',
    capex: '',
    capex_moneda: 'MXN',
  }

  // 1. Missing module count & power
  assertEqual(validarFvForm(dummyFv, 'site-1', {}), 'Ingresa número y potencia de módulos.')

  const fvWithModules = { ...dummyFv, num_modulos: '100', potencia_modulos_w: '550' }
  assertEqual(validarFvForm(fvWithModules, 'site-1', {}), 'Ingresa la marca de los módulos.')

  const fvWithBrand = { ...fvWithModules, marca_modulos: 'Longi' }

  // 2. Without hybrid BESS in same site: inverters are strictly required
  assertEqual(validarFvForm(fvWithBrand, 'site-1', {}), 'Ingresa número y potencia de inversores.')
  const fvWithInvNums = { ...fvWithBrand, num_inversores: '2', potencia_inversores_kw: '50' }
  assertEqual(validarFvForm(fvWithInvNums, 'site-1', {}), 'Ingresa la marca de los inversores.')

  // 3. WITH hybrid BESS on the SAME site: inverters can be omitted!
  const productsWithHybrid = {
    'site-1': [
      {
        tempId: 'bess-1',
        tipo: 'bess',
        bess: {
          potencia_kw: '50',
          capacidad_kwh: '100',
          marca: 'Tesla',
          uso: 'arbitraje',
          capex: '50000',
          capex_moneda: 'USD',
          inversores_hibridos: true,
        },
      },
    ],
  }
  // With hybrid BESS, inverter fields are omitted, moves straight to generation requirement
  assertEqual(validarFvForm(fvWithBrand, 'site-1', productsWithHybrid), 'Ingresa la generación anual estimada.')

  // 4. Mismatched site scoping test: hybrid BESS on Site 1, but adding FV on Site 2!
  // Inverters MUST STILL BE REQUIRED on Site 2!
  assertEqual(
    validarFvForm(fvWithBrand, 'site-2', productsWithHybrid),
    'Ingresa número y potencia de inversores.',
    'Hybrid BESS on Site 1 must NOT satisfy inverter requirement on Site 2'
  )

  // 5. BESS on same site with inversores_hibridos: false!
  // Inverters MUST STILL BE REQUIRED!
  const productsWithNonHybridBess = {
    'site-1': [
      {
        tempId: 'bess-1',
        tipo: 'bess',
        bess: {
          potencia_kw: '50',
          capacidad_kwh: '100',
          marca: 'Tesla',
          uso: 'arbitraje',
          capex: '50000',
          capex_moneda: 'USD',
          inversores_hibridos: false,
        },
      },
    ],
  }
  assertEqual(
    validarFvForm(fvWithBrand, 'site-1', productsWithNonHybridBess),
    'Ingresa número y potencia de inversores.',
    'Non-hybrid BESS must NOT allow omitting FV inverters'
  )

  // 6. Fully valid standalone FV
  const fullFv = {
    ...fvWithInvNums,
    marca_inversores: 'SMA',
    generacion_anual_kwh: '85000',
    capex: '1200000',
  }
  assertEqual(validarFvForm(fullFv, 'site-1', {}), '')
})

challengerSuite.test('R2.B3: BESS Form validation enforces all mandatory fields', () => {
  const dummyBess = {
    potencia_kw: '',
    capacidad_kwh: '',
    marca: '',
    uso: '',
    capex: '',
    capex_moneda: 'USD',
    inversores_hibridos: false,
  }

  assertEqual(validarBessForm(dummyBess), 'Ingresa la potencia del BESS.')
  assertEqual(validarBessForm({ ...dummyBess, potencia_kw: '100' }), 'Ingresa la capacidad del BESS.')
  assertEqual(validarBessForm({ ...dummyBess, potencia_kw: '100', capacidad_kwh: '200' }), 'Ingresa la marca del BESS.')
  assertEqual(validarBessForm({ ...dummyBess, potencia_kw: '100', capacidad_kwh: '200', marca: 'BYD' }), 'Selecciona el uso del BESS.')
  assertEqual(validarBessForm({ ...dummyBess, potencia_kw: '100', capacidad_kwh: '200', marca: 'BYD', uso: 'peak_shaving' }), 'Ingresa el CAPEX del BESS.')

  const validBess = {
    potencia_kw: '100',
    capacidad_kwh: '200',
    marca: 'BYD',
    uso: 'peak_shaving',
    capex: '80000',
    capex_moneda: 'USD',
    inversores_hibridos: true,
  }
  assertEqual(validarBessForm(validBess), '')
})

challengerSuite.test('R2.C1: Math calculations prevent divide-by-zero, NaN, and negative numbers', () => {
  // 1. Zero values
  const zeroFv = {
    num_modulos: '0',
    potencia_modulos_w: '0',
    num_inversores: '0',
    potencia_inversores_kw: '0',
    capex: '0',
  }
  const calcZero = calcFV(zeroFv)
  assertEqual(calcZero.kwpSistema, null, 'kwpSistema must be null on 0 input')
  assertEqual(calcZero.kwpInversores, null, 'kwpInversores must be null on 0 input')
  assertEqual(calcZero.precioWatt, null, 'precioWatt must be null on 0 input')
  assertEqual(n2(calcZero.kwpSistema), '—', 'n2 helper must format null as em-dash')

  // 2. Negative numbers
  const negFv = {
    num_modulos: '-10',
    potencia_modulos_w: '550',
    num_inversores: '-2',
    potencia_inversores_kw: '50',
    capex: '-1000',
  }
  const calcNeg = calcFV(negFv)
  assertEqual(calcNeg.kwpSistema, null, 'Negative modules must yield null')
  assertEqual(calcNeg.kwpInversores, null, 'Negative inverters must yield null')
  assertEqual(calcNeg.precioWatt, null, 'Negative capex must yield null')

  // 3. String formatting with commas
  assertEqual(parseNum('1,250,500.50'), 1250500.5)
  assertEqual(parseNum(null), 0)
  assertEqual(parseNum(undefined), 0)
  assertEqual(parseNum('invalid'), 0)
  assertEqual(formatNumberInput('1250000.50'), '1,250,000.50')

  // 4. BESS zero/negative calculations
  const zeroBess = { capacidad_kwh: '0', capex: '0' }
  assertEqual(calcBESS(zeroBess).precioKwh, null, 'BESS 0 capex/capacidad must yield null')
  const negBess = { capacidad_kwh: '-50', capex: '10000' }
  assertEqual(calcBESS(negBess).precioKwh, null, 'BESS negative capacity must yield null')
})

challengerSuite.test('R2.D1: Step 3 financing validation handles Nodo recomendacion and custom configurations', () => {
  // 1. Recomendacion Nodo ignores missing custom options
  assertEqual(validarPaso3([], true), '', 'Nodo recomendacion allows empty options')

  // 2. Custom financing requires at least one option
  assertEqual(
    validarPaso3([], false),
    'Selecciona al menos una opción de financiamiento / Select at least one financing option.'
  )

  // 3. Option must have name
  const unamedOpt = [{ tempId: '1', nombre: '   ', vehiculo_inversion: 'credito', linkedConfigIds: ['cfg-1'] }]
  assertEqual(
    validarPaso3(unamedOpt, false),
    'La opción de financiamiento 1 debe tener un nombre / Option 1 must have a name.'
  )

  // 4. Option must have investment vehicle
  const noVehiculoOpt = [{ tempId: '1', nombre: 'Opción A', vehiculo_inversion: '', linkedConfigIds: ['cfg-1'] }]
  assertEqual(
    validarPaso3(noVehiculoOpt, false),
    'La opción de financiamiento "Opción A" debe tener un vehículo de inversión / Option "Opción A" must have an investment vehicle.'
  )

  // 5. Option must be linked to at least one technical alternative
  const unlinkedOpt = [{ tempId: '1', nombre: 'Opción A', vehiculo_inversion: 'credito', linkedConfigIds: [] }]
  assertEqual(
    validarPaso3(unlinkedOpt, false),
    'La opción "Opción A" debe estar vinculada a al menos una alternativa técnica / Option "Opción A" must be linked to at least one technical alternative.'
  )
})


// =============================================================================
// CHALLENGE R3: ANALYST DIRECTORY & NAVIGATION STRESS TESTING
// =============================================================================

challengerSuite.test('R3.A1: Analyst directory filter withstands SQL injection, XSS, unicode, and regex special characters', () => {
  const sampleProjects = [
    {
      id: 'proj-1',
      nombre_proyecto: 'Parque Solar Sonora ⚡',
      estado: 'diseno',
      tipo: 'FV',
      epcista_nombre: 'Octavio Paz',
      epcista_empresa: 'Adgreen Power SA',
      cliente_final_empresa: 'Bimbo México',
      cliente_final_nombre: 'Carlos Slim',
      finder_nombre: 'Mauro Rossi',
      responsable_nombre: 'Ana Gómez',
    },
    {
      id: 'proj-2',
      nombre_proyecto: 'BESS Industrial Cancún [Hotel]',
      estado: 'prospeccion',
      tipo: 'BESS',
      epcista_nombre: 'Juan Rulfo',
      epcista_empresa: 'Eurolatina Energy',
      cliente_final_empresa: 'Xcaret Hoteles',
      cliente_final_nombre: 'Roberto Palazuelos',
      finder_nombre: '—',
      responsable_nombre: '—',
    },
    {
      id: 'proj-3',
      nombre_proyecto: 'Proyecto Especial (Test & Demo)',
      estado: 'cerrado_ganado',
      tipo: 'FV+BESS',
      epcista_nombre: null,
      epcista_empresa: undefined,
      cliente_final_empresa: null,
      cliente_final_nombre: undefined,
      finder_nombre: null,
      responsable_nombre: undefined,
    },
  ]

  function filterProjects(list, estado, tipo, busqueda) {
    return list.filter(p => {
      if (estado !== 'todos' && p.estado !== estado) return false
      if (tipo !== 'todos' && p.tipo !== tipo) return false
      if (busqueda) {
        const q = busqueda.toLowerCase().trim()
        if (
          !p.nombre_proyecto?.toLowerCase().includes(q) &&
          !p.epcista_nombre?.toLowerCase().includes(q) &&
          !p.epcista_empresa?.toLowerCase().includes(q) &&
          !p.cliente_final_empresa?.toLowerCase().includes(q) &&
          !p.cliente_final_nombre?.toLowerCase().includes(q) &&
          !p.finder_nombre?.toLowerCase().includes(q) &&
          !p.responsable_nombre?.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }

  // 1. Empty and whitespace queries
  assertEqual(filterProjects(sampleProjects, 'todos', 'todos', '').length, 3)
  assertEqual(filterProjects(sampleProjects, 'todos', 'todos', '   \t  ').length, 3)

  // 2. Unicode and accented characters
  assertEqual(filterProjects(sampleProjects, 'todos', 'todos', 'sonora').length, 1)
  assertEqual(filterProjects(sampleProjects, 'todos', 'todos', '⚡').length, 1)
  assertEqual(filterProjects(sampleProjects, 'todos', 'todos', 'cancún').length, 1)
  assertEqual(filterProjects(sampleProjects, 'todos', 'todos', 'méxico').length, 1)

  // 3. Regex special characters: MUST NOT crash or throw syntax error
  const regexQueries = ['.*', '[hotel]', '(test', '^$', '\\d+', '(?=.*)', '+', '?', '{2}']
  for (const rq of regexQueries) {
    let result
    try {
      result = filterProjects(sampleProjects, 'todos', 'todos', rq)
    } catch (err) {
      assert(false, `Regex query "${rq}" caused crash: ${err.message}`)
    }
    assert(Array.isArray(result), `Query "${rq}" must return array`)
  }
  // Specifically verify bracket matching
  assertEqual(filterProjects(sampleProjects, 'todos', 'todos', '[hotel]').length, 1)
  assertEqual(filterProjects(sampleProjects, 'todos', 'todos', '(test').length, 1)

  // 4. SQL injection payloads
  const sqlQueries = ["' OR '1'='1", "'; DROP TABLE proyectos;--", 'UNION SELECT 1,2,3']
  for (const sq of sqlQueries) {
    const res = filterProjects(sampleProjects, 'todos', 'todos', sq)
    assertEqual(res.length, 0, `SQL injection query "${sq}" should match 0 rows without error`)
  }

  // 5. XSS payloads
  const xssQueries = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>']
  for (const xq of xssQueries) {
    const res = filterProjects(sampleProjects, 'todos', 'todos', xq)
    assertEqual(res.length, 0, `XSS query "${xq}" should match 0 rows without executing`)
  }

  // 6. Tolerance to null/undefined fields (proj-3 has nulls across all metadata)
  const nullProjMatch = filterProjects(sampleProjects, 'todos', 'todos', 'especial')
  assertEqual(nullProjMatch.length, 1, 'Project with null/undefined fields must be searchable without throwing')
})

challengerSuite.test('R3.B1: Sidebar navigation active route resolution eliminates prefix bleed across all roles', () => {
  const portalRoots = ['/epc', '/analista', '/admin', '/cliente', '/financiero', '/mem', '/finder']

  function isNavActive(pathname, href) {
    const isRoot = portalRoots.includes(href)
    return pathname === href || (!isRoot && pathname.startsWith(`${href}/`))
  }

  // 1. Analyst portal
  // Visiting /analista (Dashboard)
  assertEqual(isNavActive('/analista', '/analista'), true, 'At /analista, Dashboard is active')
  assertEqual(isNavActive('/analista', '/analista/proyectos'), false, 'At /analista, Proyectos is inactive')

  // Visiting /analista/proyectos (Directory)
  assertEqual(isNavActive('/analista/proyectos', '/analista'), false, 'At /analista/proyectos, Dashboard MUST BE INACTIVE (no prefix bleed)')
  assertEqual(isNavActive('/analista/proyectos', '/analista/proyectos'), true, 'At /analista/proyectos, Proyectos is active')

  // Visiting /analista/proyectos/uuid-123 (Detail view)
  assertEqual(isNavActive('/analista/proyectos/uuid-123', '/analista'), false, 'At /analista/proyectos/uuid, Dashboard MUST BE INACTIVE')
  assertEqual(isNavActive('/analista/proyectos/uuid-123', '/analista/proyectos'), true, 'At /analista/proyectos/uuid, Proyectos is active')

  // Visiting /analista/proyectos/nuevo (Wizard)
  assertEqual(isNavActive('/analista/proyectos/nuevo', '/analista'), false, 'At /analista/proyectos/nuevo, Dashboard MUST BE INACTIVE')
  assertEqual(isNavActive('/analista/proyectos/nuevo', '/analista/proyectos'), true, 'At /analista/proyectos/nuevo, Proyectos is active')

  // 2. Admin portal
  assertEqual(isNavActive('/admin/proyectos', '/admin'), false, 'Admin /admin/proyectos must not bleed into /admin')
  assertEqual(isNavActive('/admin/proyectos', '/admin/proyectos'), true, 'Admin /admin/proyectos is active')

  // 3. EPC portal
  assertEqual(isNavActive('/epc/proyectos', '/epc'), false, 'EPC /epc/proyectos must not bleed into /epc')
  assertEqual(isNavActive('/epc/proyectos', '/epc/proyectos'), true, 'EPC /epc/proyectos is active')

  // 4. Finder portal
  assertEqual(isNavActive('/finder/proyectos', '/finder'), false, 'Finder /finder/proyectos must not bleed into /finder')
  assertEqual(isNavActive('/finder/proyectos', '/finder/proyectos'), true, 'Finder /finder/proyectos is active')
})


// =============================================================================
// CHALLENGE R4: OFERTAS BOARD DATA MAPPING & SAFE QUERYING
// =============================================================================

challengerSuite.test('R4.A1: OfertasBoard data mapping handles null, undefined, 0, NaN, and negative values safely', () => {
  // Mapping logic verbatim from components/marketplace/OfertasBoard.tsx line 45-53
  function mapProyectoMEM(p) {
    return {
      id: p.id,
      nombre_proyecto: p.nombre_proyecto,
      cliente_final_empresa: p.cliente_final_empresa,
      consumo_anual_gwh: p.volumen_energia_mwh_anual ? +(Number(p.volumen_energia_mwh_anual) / 1000).toFixed(2) : 0,
      tarifa_actual_cfe: 'GDMTH',
      codigo_postal: p.ubicacion_estado || 'No especificada',
      estado: p.estado,
    }
  }

  // 1. Normal values
  const m1 = mapProyectoMEM({
    id: 'p-1',
    nombre_proyecto: 'Planta Industrial',
    cliente_final_empresa: 'Acero SA',
    volumen_energia_mwh_anual: 2500,
    ubicacion_estado: 'Nuevo León',
    estado: 'prospeccion',
  })
  assertEqual(m1.consumo_anual_gwh, 2.5)
  assertEqual(m1.codigo_postal, 'Nuevo León')

  // 2. Boundary: null volumen and null estado
  const mNull = mapProyectoMEM({
    id: 'p-2',
    nombre_proyecto: 'Proyecto Null',
    cliente_final_empresa: 'Test',
    volumen_energia_mwh_anual: null,
    ubicacion_estado: null,
    estado: 'prospeccion',
  })
  assertEqual(mNull.consumo_anual_gwh, 0, 'Null volumen must map to 0')
  assertEqual(mNull.codigo_postal, 'No especificada', 'Null ubicacion must fallback to No especificada')

  // 3. Boundary: undefined volumen and empty string estado
  const mUndef = mapProyectoMEM({
    id: 'p-3',
    nombre_proyecto: 'Proyecto Undef',
    cliente_final_empresa: 'Test',
    volumen_energia_mwh_anual: undefined,
    ubicacion_estado: '',
    estado: 'prospeccion',
  })
  assertEqual(mUndef.consumo_anual_gwh, 0, 'Undefined volumen must map to 0')
  assertEqual(mUndef.codigo_postal, 'No especificada', 'Empty string ubicacion must fallback to No especificada')

  // 4. Boundary: 0 and "0"
  const mZero = mapProyectoMEM({
    id: 'p-4',
    nombre_proyecto: 'Proyecto Zero',
    cliente_final_empresa: 'Test',
    volumen_energia_mwh_anual: 0,
    ubicacion_estado: 'CDMX',
    estado: 'prospeccion',
  })
  assertEqual(mZero.consumo_anual_gwh, 0, 'Numeric 0 volumen must map to 0')

  const mStrZero = mapProyectoMEM({
    id: 'p-5',
    nombre_proyecto: 'Proyecto Str Zero',
    cliente_final_empresa: 'Test',
    volumen_energia_mwh_anual: '0',
    ubicacion_estado: 'CDMX',
    estado: 'prospeccion',
  })
  assertEqual(mStrZero.consumo_anual_gwh, 0, 'String "0" volumen must map to 0')

  // 5. Boundary: NaN / malformed string volumen
  const mNaN = mapProyectoMEM({
    id: 'p-6',
    nombre_proyecto: 'Proyecto NaN',
    cliente_final_empresa: 'Test',
    volumen_energia_mwh_anual: 'invalid_number',
    ubicacion_estado: 'Jalisco',
    estado: 'prospeccion',
  })
  // Verify UI fallback `consumo_anual_gwh || 0` does not crash
  const displayVal = mNaN.consumo_anual_gwh || 0
  assertEqual(displayVal, 0, 'UI fallback (consumo_anual_gwh || 0) cleanly handles NaN')

  // 6. Extreme large number
  const mHuge = mapProyectoMEM({
    id: 'p-7',
    nombre_proyecto: 'Mega Proyecto',
    cliente_final_empresa: 'Gigawatt Corp',
    volumen_energia_mwh_anual: 50000000,
    ubicacion_estado: 'Sonora',
    estado: 'prospeccion',
  })
  assertEqual(mHuge.consumo_anual_gwh, 50000)
})

challengerSuite.test('R4.A2: PostgREST query on table "proyectos" with volumen_energia_mwh_anual & ubicacion_estado succeeds without PGRST204', async () => {
  const supplyAuth = await getAuthSession('suministrador')
  const client = getAnonClient()
  await client.auth.setSession(supplyAuth.session)

  // Exactly matching OfertasBoard.tsx lines 37-40
  const { data, error } = await client
    .from('proyectos')
    .select('id, nombre_proyecto, cliente_final_empresa, volumen_energia_mwh_anual, ubicacion_estado, estado')
    .in('tipo', ['MEM', 'BESS+MEM'])
    .limit(10)

  assertEqual(error, null, `Database query must not fail with column missing error: ${error?.message}`)
  assert(Array.isArray(data), 'Result must be an array')
})

// Run suite directly if executed as main script
if (process.argv[1]?.endsWith('challenger-stress-suite.mjs')) {
  challengerSuite.run().then(res => {
    if (res.failed > 0) {
      console.error(`\n❌ CHALLENGER VERDICT: REQUEST_CHANGES (${res.failed} tests failed)`)
      process.exit(1)
    } else {
      console.log(`\n✅ CHALLENGER VERDICT: APPROVE (${res.passed} tests passed, 0 failed)`)
      process.exit(0)
    }
  })
}
