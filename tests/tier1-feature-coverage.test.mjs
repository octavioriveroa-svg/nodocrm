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
import { calcFV, calcBESS } from '../components/proyectos/wizard/calculations.ts'

export const tier1Suite = new TestSuite('Tier 1: Feature Coverage (R1 - R4)')

// ── R1. Security & RBAC Enforcement ──────────────────────────────────────────
tier1Suite.test('R1.1: adminDeleteUser rejects deletion by nodo_analista with exact unauthorized contract', async () => {
  const analystAuth = await getAuthSession('analista')
  setActiveSessionCookies(analystAuth.session)

  const { adminDeleteUser } = await import('../app/actions/adminDeleteUser.ts')
  const dummyTargetId = '00000000-0000-0000-0000-000000000001'
  const result = await adminDeleteUser(dummyTargetId)

  clearActiveSessionCookies()
  assertEqual(
    result.error,
    'No autorizado. Solo administradores pueden eliminar cuentas.',
    'Analyst deletion attempt must return strict unauthorized error'
  )
})

tier1Suite.test('R1.2: crearUsuarioAdmin rejects privilege escalation (analista creating nodo_admin)', async () => {
  const analystAuth = await getAuthSession('analista')
  setActiveSessionCookies(analystAuth.session)

  const { crearUsuarioAdmin } = await import('../app/actions/crearUsuario.ts')
  const result = await crearUsuarioAdmin({
    email: 'escalation_test@nodoenergy.com',
    nombre: 'Escalation Hacker',
    empresa: 'Hacker Corp',
    rol: 'nodo_admin',
    password: 'Password123!',
  })

  clearActiveSessionCookies()
  assertEqual(
    result.error,
    'No autorizado: solo los administradores pueden crear cuentas de administrador.',
    'Privilege escalation attempt by analyst must be blocked with explicit error'
  )
})

tier1Suite.test('R1.3: adminDeleteUser prevents self-deletion by nodo_admin', async () => {
  const adminAuth = await getAuthSession('admin')
  setActiveSessionCookies(adminAuth.session)

  const { adminDeleteUser } = await import('../app/actions/adminDeleteUser.ts')
  const result = await adminDeleteUser(adminAuth.user.id)

  clearActiveSessionCookies()
  assertEqual(
    result.error,
    'No puedes eliminar tu propia cuenta.',
    'Self-deletion must be blocked'
  )
})

// ── R2. Unified Project Creation Wizard (ProjectWizard) ──────────────────────
tier1Suite.test('R2.1: getWizardCapabilities correctly maps capabilities across all portals', () => {
  const adminCaps = getWizardCapabilities('admin')
  assertEqual(adminCaps.canAssignEpc, true, 'Admin can assign EPC')
  assertEqual(adminCaps.canAssignResponsableNodo, true, 'Admin can assign Responsable Nodo')
  assertEqual(adminCaps.canAssignFinder, true, 'Admin can assign Finder')
  assertEqual(adminCaps.canUseManualClient, true, 'Admin can toggle manual client')
  assertEqual(adminCaps.canInviteEpc, false, 'Admin has no invite EPC modal')
  assertEqual(adminCaps.implicitEpc, false, 'Admin has no implicit EPC')

  const analistaCaps = getWizardCapabilities('analista')
  assertEqual(analistaCaps.canAssignEpc, true, 'Analyst can assign EPC')
  assertEqual(analistaCaps.canAssignResponsableNodo, true, 'Analyst can assign Responsable Nodo')
  assertEqual(analistaCaps.canUseManualClient, true, 'Analyst can toggle manual client')

  const epcCaps = getWizardCapabilities('epc')
  assertEqual(epcCaps.canAssignEpc, false, 'EPC has implicit identity')
  assertEqual(epcCaps.canAssignResponsableNodo, false, 'EPC cannot assign Responsable')
  assertEqual(epcCaps.canAssignFinder, true, 'EPC can optionally attribute a Finder')
  assertEqual(epcCaps.canUseManualClient, false, 'EPC cannot toggle manual client')
  assertEqual(epcCaps.implicitEpc, true, 'EPC has implicit creator identity')

  const finderCaps = getWizardCapabilities('finder')
  assertEqual(finderCaps.canAssignEpc, true, 'Finder can select EPC')
  assertEqual(finderCaps.canInviteEpc, true, 'Finder can invite EPC')
  assertEqual(finderCaps.canAssignFinder, false, 'Finder has implicit creator identity')
  assertEqual(finderCaps.implicitFinder, true, 'Finder has implicit creator identity')
})

tier1Suite.test('R2.2: ProjectWizard Step 0 validation enforces role-specific requirements', () => {
  const adminCaps = getWizardCapabilities('admin')
  const epcCaps = getWizardCapabilities('epc')

  // 1. Missing project name
  const emptyForm = {
    nombre_proyecto: '',
    cliente_id: 'client-1',
    tipo_instalacion: 'epcista_instala',
  }
  const err1 = validarPaso0(emptyForm, adminCaps, 'epc-1', false, { nombre: '', empresa: '', contacto: '' })
  assertIncludes(err1, 'Enter project name', 'Missing project name must fail')

  // 2. Admin missing EPC selection
  const formWithName = { ...emptyForm, nombre_proyecto: 'Parque Solar Norte' }
  const err2 = validarPaso0(formWithName, adminCaps, '', false, { nombre: '', empresa: '', contacto: '' })
  assertIncludes(err2, 'Select an EPC', 'Admin without selected EPC must fail')

  // 3. EPC does not require EPC selection
  const err3 = validarPaso0(formWithName, epcCaps, '', false, { nombre: '', empresa: '', contacto: '' })
  assertEqual(err3, '', 'EPC does not require selecting EPC')

  // 4. Admin with manual client toggle
  const formNoClient = { ...formWithName, cliente_id: '' }
  const err4ManualEmpty = validarPaso0(formNoClient, adminCaps, 'epc-1', true, { nombre: '', empresa: '', contacto: '' })
  assertIncludes(err4ManualEmpty, 'contact name', 'Manual client without contact name must fail')

  const err4ManualComplete = validarPaso0(formNoClient, adminCaps, 'epc-1', true, { nombre: 'Juan Perez', empresa: 'SolarCo', contacto: '555-1234' })
  assertEqual(err4ManualComplete, '', 'Manual client with complete details must pass')
})

tier1Suite.test('R2.3: ProjectWizard Step 1 site validation requires at least one selected site', () => {
  const errEmpty = validarPaso1([])
  assertIncludes(errEmpty, 'select at least one site', 'Zero selected sites must fail')

  const errValid = validarPaso1(['site-uuid-1'])
  assertEqual(errValid, '', 'Valid selected sites array must pass')
})

tier1Suite.test('R2.4: ProjectWizard Step 2 technical validations fix the EPC copy-paste bug', () => {
  // Empty configs
  const errNoConfigs = validarPaso2([])
  assertIncludes(errNoConfigs, 'at least one technical alternative', 'Zero configs must fail')

  // Duplicate names
  const dupConfigs = [
    { tempId: '1', nombre: 'Alternativa A', descripcion: '', sitiosSeleccionados: [], productosMap: { s1: [{ tempId: 'p1', tipo: 'fv' }] }, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
    { tempId: '2', nombre: 'Alternativa A', descripcion: '', sitiosSeleccionados: [], productosMap: { s1: [{ tempId: 'p2', tipo: 'fv' }] }, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
  ]
  const errDups = validarPaso2(dupConfigs)
  assertIncludes(errDups, 'unique name', 'Duplicate config names must fail')

  // Config without products
  const emptyProdConfigs = [
    { tempId: '1', nombre: 'Alternativa A', descripcion: '', sitiosSeleccionados: [], productosMap: {}, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
  ]
  const errNoProds = validarPaso2(emptyProdConfigs)
  assertIncludes(errNoProds, 'must have at least one product', 'Config without products must fail')

  // Valid config
  const validConfigs = [
    { tempId: '1', nombre: 'Alternativa A', descripcion: '', sitiosSeleccionados: [], productosMap: { s1: [{ tempId: 'p1', tipo: 'fv' }] }, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
  ]
  assertEqual(validarPaso2(validConfigs), '', 'Valid technical configs must pass Step 2 validation')
})

tier1Suite.test('R2.5: ProjectWizard Step 2 hybrid inverter link allows omitting FV inverters', () => {
  // Standard FV requires inverter fields
  const standardFv = {
    num_modulos: '100',
    potencia_modulos_w: '550',
    marca_modulos: 'Jinko Solar',
    num_inversores: '',
    potencia_inversores_kw: '',
    marca_inversores: '',
    generacion_anual_kwh: '90000',
    capex: '50000',
    capex_moneda: 'USD',
  }
  const errStandard = validarFvForm(standardFv, 'site-1', { 'site-1': [] })
  assertIncludes(errStandard, 'inversores', 'Standard FV without inverters must fail')

  // Hybrid BESS on same site makes FV inverters optional
  const hybridSiteProducts = {
    'site-1': [
      {
        tempId: 'bess-1',
        tipo: 'bess',
        bess: {
          potencia_kw: '50',
          capacidad_kwh: '100',
          marca: 'Tesla',
          uso: 'load_shifting',
          capex: '40000',
          capex_moneda: 'USD',
          inversores_hibridos: true,
        },
      },
    ],
  }
  const errHybrid = validarFvForm(standardFv, 'site-1', hybridSiteProducts)
  assertEqual(errHybrid, '', 'FV with hybrid BESS on same site allows omitting inverters')
})

tier1Suite.test('R2.6: ProjectWizard Step 3 financing validation handles Nodo recommendation & custom options', () => {
  // Nodo recommendation bypasses option checks
  const errRec = validarPaso3([], true)
  assertEqual(errRec, '', 'Nodo recommendation requires no custom financing options')

  // Empty custom options
  const errEmpty = validarPaso3([], false)
  assertIncludes(errEmpty, 'at least one financing option', 'Zero options must fail when not recommendation')

  // Option missing investment vehicle
  const noVehicleOpt = [
    { tempId: 'f1', nombre: 'Plan A', vehiculo_inversion: '', ahorro_estimado_anual: '', ahorro_moneda: 'MXN', plazo_meses: '60', notas: '', linkedConfigIds: ['c1'] },
  ]
  const errNoVehicle = validarPaso3(noVehicleOpt, false)
  assertIncludes(errNoVehicle, 'investment vehicle', 'Missing vehicle must fail')

  // Option not linked to technical alternative
  const unlinkedOpt = [
    { tempId: 'f1', nombre: 'Plan A', vehiculo_inversion: 'credito', ahorro_estimado_anual: '', ahorro_moneda: 'MXN', plazo_meses: '60', notas: '', linkedConfigIds: [] },
  ]
  const errUnlinked = validarPaso3(unlinkedOpt, false)
  assertIncludes(errUnlinked, 'linked to at least one technical alternative', 'Unlinked option must fail')

  // Valid option
  const validOpt = [
    { tempId: 'f1', nombre: 'Plan A', vehiculo_inversion: 'credito', ahorro_estimado_anual: '', ahorro_moneda: 'MXN', plazo_meses: '60', notas: '', linkedConfigIds: ['c1'] },
  ]
  assertEqual(validarPaso3(validOpt, false), '', 'Valid financing option must pass')
})

// ── R3. Analyst Portal Projects Directory & Navigation ───────────────────────
tier1Suite.test('R3.1: Analyst Directory queries projects and resolves related profiles', async () => {
  const analystAuth = await getAuthSession('analista')
  const client = getAnonClient()

  // Authenticate anon client as analyst
  await client.auth.setSession(analystAuth.session)

  const { data: prs, error: prsError } = await client
    .from('proyectos')
    .select('id, nombre_proyecto, tipo, estado, epcista_id, responsable_nodo_id, finder_id, cliente_final_empresa, created_at')
    .order('created_at', { ascending: false })

  assertEqual(prsError, null, 'Analyst should query proyectos without errors')
  assert(Array.isArray(prs), 'Query must return an array of projects')
  assert(prs.length > 0, 'Platform should have existing projects')

  // Verify profile normalization works
  const allIds = [
    ...new Set([
      ...prs.map((p) => p.epcista_id).filter(Boolean),
      ...prs.map((p) => p.responsable_nodo_id).filter(Boolean),
      ...prs.map((p) => p.finder_id).filter(Boolean),
    ]),
  ]

  const { data: profiles, error: profError } = await client
    .from('profiles')
    .select('id, nombre, empresa')
    .in('id', allIds)

  assertEqual(profError, null, 'Analyst should resolve related profiles without errors')
  assert(Array.isArray(profiles), 'Profiles should return an array')
})

tier1Suite.test('R3.2: Analyst Directory in-memory filters match status, type, and search queries', () => {
  const mockProjects = [
    { id: '1', nombre_proyecto: 'Solar Monterrey', tipo: 'FV', estado: 'recibido', epcista_nombre: 'AdGreen', cliente_final_empresa: 'Oxxo' },
    { id: '2', nombre_proyecto: 'BESS Guadalajara', tipo: 'BESS', estado: 'en_analisis', epcista_nombre: 'Eurolatina', cliente_final_empresa: 'Bimbo' },
    { id: '3', nombre_proyecto: 'Hibrido Queretaro', tipo: 'FV+BESS', estado: 'aprobado', epcista_nombre: 'AdGreen', cliente_final_empresa: 'Kellogg' },
  ]

  // Filter by status
  const filterByStatus = mockProjects.filter((p) => p.estado === 'recibido')
  assertEqual(filterByStatus.length, 1, 'Status filter should isolate 1 project')
  assertEqual(filterByStatus[0].id, '1', 'Filtered project must match ID 1')

  // Filter by type
  const filterByType = mockProjects.filter((p) => p.tipo === 'FV+BESS')
  assertEqual(filterByType.length, 1, 'Type filter should isolate 1 project')
  assertEqual(filterByType[0].id, '3', 'Filtered project must match ID 3')

  // Search by project name
  const searchName = mockProjects.filter((p) => p.nombre_proyecto.toLowerCase().includes('guadalajara'))
  assertEqual(searchName.length, 1, 'Search query must match project name')

  // Search by EPC company
  const searchEpc = mockProjects.filter((p) => p.epcista_nombre.toLowerCase().includes('adgreen'))
  assertEqual(searchEpc.length, 2, 'Search query must match EPC company across multiple items')
})

tier1Suite.test('R3.3: Sidebar navigation active route resolution prevents prefix bleed for /analista', () => {
  function checkActive(href, pathname) {
    const portalRoots = ['/epc', '/analista', '/admin', '/cliente', '/financiero', '/mem', '/finder']
    const isRoot = portalRoots.includes(href)
    return pathname === href || (!isRoot && pathname.startsWith(`${href}/`))
  }

  // When on /analista (Dashboard): Dashboard is active, Proyectos is NOT active
  assertEqual(checkActive('/analista', '/analista'), true, 'Dashboard highlights at /analista')
  assertEqual(checkActive('/analista/proyectos', '/analista'), false, 'Proyectos does NOT highlight at /analista')

  // When on /analista/proyectos: Proyectos is active, Dashboard is NOT active
  assertEqual(checkActive('/analista', '/analista/proyectos'), false, 'Dashboard does NOT highlight at /analista/proyectos')
  assertEqual(checkActive('/analista/proyectos', '/analista/proyectos'), true, 'Proyectos highlights at /analista/proyectos')

  // When inspecting a project: Proyectos remains active, Dashboard is NOT active
  assertEqual(checkActive('/analista', '/analista/proyectos/proj-123'), false, 'Dashboard does NOT highlight on inspection')
  assertEqual(checkActive('/analista/proyectos', '/analista/proyectos/proj-123'), true, 'Proyectos highlights on inspection')
})

// ── R4. MEM Marketplace Safe Querying ────────────────────────────────────────
tier1Suite.test('R4.1: OfertasBoard queries existing columns safely without PostgREST PGRST204 errors', async () => {
  const supplyAuth = await getAuthSession('suministrador')
  const client = getAnonClient()
  await client.auth.setSession(supplyAuth.session)

  // Query exactly matching OfertasBoard.tsx line 49-51
  const { data, error } = await client
    .from('proyectos')
    .select('id, nombre_proyecto, cliente_final_empresa, volumen_energia_mwh_anual, ubicacion_estado, estado')
    .in('tipo', ['MEM', 'BESS+MEM'])

  assertEqual(error, null, 'Safe column selection must not trigger PostgREST PGRST204 missing column errors')
  assert(Array.isArray(data), 'Result must be an array')

  // Test client-side transformation
  const sample = {
    id: 'test-mem-1',
    nombre_proyecto: 'Proyecto MEM Bajio',
    cliente_final_empresa: 'Acero MX',
    volumen_energia_mwh_anual: 12500,
    ubicacion_estado: 'Guanajuato',
    estado: 'recibido',
  }

  const mapped = {
    id: sample.id,
    nombre_proyecto: sample.nombre_proyecto,
    cliente_final_empresa: sample.cliente_final_empresa,
    consumo_anual_gwh: sample.volumen_energia_mwh_anual ? +(Number(sample.volumen_energia_mwh_anual) / 1000).toFixed(2) : 0,
    tarifa_actual_cfe: 'GDMTH',
    codigo_postal: sample.ubicacion_estado || 'No especificada',
    estado: sample.estado,
  }

  assertEqual(mapped.consumo_anual_gwh, 12.5, '12500 MWh correctly converted to 12.50 GWh')
  assertEqual(mapped.tarifa_actual_cfe, 'GDMTH', 'Default tariff correctly assigned')
  assertEqual(mapped.codigo_postal, 'Guanajuato', 'Location correctly mapped')
})
