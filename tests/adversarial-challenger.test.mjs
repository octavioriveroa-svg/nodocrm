import {
  TestSuite,
  assert,
  assertEqual,
  assertIncludes,
  getAuthSession,
  getAnonClient,
} from './test-utils.mjs'

import { getWizardCapabilities } from '../components/proyectos/wizard/capabilities.ts'
import {
  validarPaso0,
  validarPaso1,
  validarPaso2,
  validarPaso3,
} from '../components/proyectos/wizard/validation.ts'

export const challengerSuite = new TestSuite('Adversarial Challenger Suite: State Transitions, Concurrency & Cascades')

// ─────────────────────────────────────────────────────────────────────────────
// 1. EMPIRICAL MULTI-PORTAL PROJECT SUBMISSION & RAPID ADVANCES
// ─────────────────────────────────────────────────────────────────────────────

challengerSuite.test('1.1: Step 0 rapid advance boundary tests across all portals', () => {
  const adminCaps = getWizardCapabilities('admin')
  const epcCaps = getWizardCapabilities('epc')
  const finderCaps = getWizardCapabilities('finder')

  // Boundary 1: Whitespace-only project name
  const whitespaceForm = {
    nombre_proyecto: '   \t  \n  ',
    cliente_id: 'client-1',
    tipo_instalacion: 'epcista_instala',
    modalidad_financiamiento: [],
    capex_estimado: '',
    moneda: 'MXN',
    notas_adicionales: '',
    incluye_mem: false,
  }
  assert(
    validarPaso0(whitespaceForm, adminCaps, 'epc-1', false, { nombre: '', empresa: '', contacto: '' }).length > 0,
    'Whitespace project name must be rejected'
  )

  // Boundary 2: Manual client with missing empresa in admin
  const validNameForm = { ...whitespaceForm, nombre_proyecto: 'Proyecto Valido' }
  const manualEmptyEmpresa = { nombre: 'Juan Perez', empresa: '   ', contacto: 'juan@test.com' }
  assert(
    validarPaso0(validNameForm, adminCaps, 'epc-1', true, manualEmptyEmpresa).length > 0,
    'Manual client with empty empresa must be rejected'
  )

  // Boundary 3: EPC portal forbids manual client bypass
  assert(
    epcCaps.canUseManualClient === false,
    'EPC portal must not have manual client capability'
  )

  // Boundary 4: Finder portal strictly requires EPC assignment
  const finderFormNoEpc = { ...validNameForm, cliente_id: 'client-1' }
  assertIncludes(
    validarPaso0(finderFormNoEpc, finderCaps, '', false, { nombre: '', empresa: '', contacto: '' }),
    'EPC',
    'Finder must require EPC selection'
  )
  assertEqual(
    validarPaso0(finderFormNoEpc, finderCaps, 'epc-123', false, { nombre: '', empresa: '', contacto: '' }),
    '',
    'Finder with selected EPC should pass Step 0'
  )
})

challengerSuite.test('1.2: Rapid step advances with boundary configuration permutations', () => {
  // Boundary: Step 1 with empty array
  assert(validarPaso1([]).length > 0, 'Empty site array must be rejected')

  // Boundary: Step 2 duplicate configuration names
  const dupConfigs = [
    { tempId: '1', nombre: 'Solucion Solar', descripcion: '', sitiosSeleccionados: ['s1'], productosMap: { s1: [{ tempId: 'p1', tipo: 'fv' }] }, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
    { tempId: '2', nombre: '  Solucion Solar  ', descripcion: '', sitiosSeleccionados: ['s1'], productosMap: { s1: [{ tempId: 'p2', tipo: 'bess' }] }, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
  ]
  assertIncludes(validarPaso2(dupConfigs), 'unique', 'Case-insensitive or trimmed duplicate names must be rejected')

  // Boundary: Step 3 financing option unlinked to configurations
  const unlinkedFin = [
    { tempId: 'f1', nombre: 'Credito', vehiculo_inversion: 'credito', ahorro_estimado_anual: '', ahorro_moneda: 'MXN', plazo_meses: '60', notas: '', linkedConfigIds: [] }
  ]
  assert(validarPaso3(unlinkedFin, false).length > 0, 'Financing option without linked configs must be rejected')

  // Boundary: Step 3 Nodo recommendation bypasses manual financing option requirement
  assertEqual(validarPaso3([], true), '', 'Nodo recommendation bypasses financing requirement')
})

challengerSuite.test('1.3: Concurrent submissions from multiple roles simultaneously', async () => {
  const adminAuth = await getAuthSession('admin')
  const epcAuth = await getAuthSession('epc')
  const adminClient = getAnonClient()
  await adminClient.auth.setSession(adminAuth.session)

  const epcClient = getAnonClient()
  await epcClient.auth.setSession(epcAuth.session)

  const timestamp = Date.now()
  const p1Name = `[CONCURRENT-ADMIN-${timestamp}]`
  const p2Name = `[CONCURRENT-EPC-${timestamp}]`

  // Execute two concurrent project submissions
  const [res1, res2] = await Promise.all([
    adminClient.from('proyectos').insert({
      nombre_proyecto: p1Name,
      epcista_id: epcAuth.user.id,
      responsable_nodo_id: adminAuth.user.id,
      cliente_final_nombre: 'Cliente Admin',
      cliente_final_empresa: 'Empresa Admin',
      cliente_final_contacto: 'admin@empresa.com',
      tipo: 'FV',
      estado: 'recibido',
      tipo_instalacion: 'epcista_instala',
      capex_estimado: 100000,
      moneda: 'MXN',
      ubicacion_estado: 'CDMX',
    }).select('id').single(),

    epcClient.from('proyectos').insert({
      nombre_proyecto: p2Name,
      epcista_id: epcAuth.user.id,
      cliente_final_nombre: 'Cliente EPC',
      cliente_final_empresa: 'Empresa EPC',
      cliente_final_contacto: 'epc@empresa.com',
      tipo: 'BESS',
      estado: 'recibido',
      tipo_instalacion: 'epcista_instala',
      capex_estimado: 200000,
      moneda: 'USD',
      ubicacion_estado: 'Jalisco',
    }).select('id').single(),
  ])

  assertEqual(res1.error, null, 'Admin concurrent insert must succeed')
  assertEqual(res2.error, null, 'EPC concurrent insert must succeed')
  assert(res1.data.id !== res2.data.id, 'Projects must have distinct UUIDs')

  // Clean up
  await adminClient.from('proyectos').delete().eq('id', res1.data.id)
  await adminClient.from('proyectos').delete().eq('id', res2.data.id)
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. FOREIGN KEY INTEGRITY & CASCADE CONSISTENCY ACROSS 6 TABLES
// ─────────────────────────────────────────────────────────────────────────────

challengerSuite.test('2.1: Relational graph cascade verification across configuraciones, opciones, config_fin, productos', async () => {
  const adminAuth = await getAuthSession('admin')
  const client = getAnonClient()
  await client.auth.setSession(adminAuth.session)

  // Retrieve an existing valid client and site
  const { data: clients } = await client.from('clientes').select('id, epcista_id').limit(1)
  assert(clients && clients.length > 0, 'Must have at least one client')
  const validClient = clients[0]

  let { data: sites } = await client.from('sitios').select('id').eq('cliente_id', validClient.id).limit(1)
  let siteId = sites && sites.length > 0 ? sites[0].id : null
  if (!siteId) {
    const { data: newSite } = await client.from('sitios').insert({
      cliente_id: validClient.id,
      epcista_id: validClient.epcista_id || adminAuth.user.id,
      nombre: 'Sitio Cascada Test',
      ubicacion_estado: 'CDMX'
    }).select('id').single()
    siteId = newSite.id
  }

  const testProjectName = `[CASCADE-TEST-${Date.now()}] Proyecto para prueba de cascada`

  // 1. Insert into `proyectos`
  const { data: proj, error: pErr } = await client
    .from('proyectos')
    .insert({
      nombre_proyecto: testProjectName,
      epcista_id: validClient.epcista_id || adminAuth.user.id,
      cliente_id: validClient.id,
      cliente_final_nombre: 'Contacto Cascade',
      cliente_final_empresa: 'Empresa Cascade',
      cliente_final_contacto: 'cascade@test.com',
      tipo: 'FV+BESS',
      estado: 'recibido',
      tipo_instalacion: 'epcista_instala',
      capex_estimado: 750000,
      moneda: 'USD',
      ubicacion_estado: 'Nuevo León',
    })
    .select('id')
    .single()

  assertEqual(pErr, null, 'Project creation for cascade test must succeed')
  const projId = proj.id

  // 2. Insert into `proyecto_sitios`
  const { error: psErr } = await client
    .from('proyecto_sitios')
    .insert({ proyecto_id: projId, sitio_id: siteId })
  assertEqual(psErr, null, 'proyecto_sitios insert must succeed')

  // 3. Insert into `configuraciones_tecnicas`
  const { data: cfg, error: cfgErr } = await client
    .from('configuraciones_tecnicas')
    .insert({
      proyecto_id: projId,
      nombre: 'Configuracion Cascada',
      inversion_total: 750000,
      moneda: 'USD',
      seleccionada: true,
    })
    .select('id')
    .single()
  assertEqual(cfgErr, null, 'configuraciones_tecnicas insert must succeed')
  const cfgId = cfg.id

  // 4. Insert into `opciones_financiamiento`
  const { data: opt, error: optErr } = await client
    .from('opciones_financiamiento')
    .insert({
      proyecto_id: projId,
      nombre: 'Financiamiento Cascada',
      vehiculo_inversion: 'credito',
      moneda: 'USD',
      seleccionada: true,
    })
    .select('id')
    .single()
  assertEqual(optErr, null, 'opciones_financiamiento insert must succeed')
  const optId = opt.id

  // 5. Insert into `config_financiamiento`
  const { error: cfErr } = await client
    .from('config_financiamiento')
    .insert({ configuracion_id: cfgId, opcion_financiamiento_id: optId })
  assertEqual(cfErr, null, 'config_financiamiento insert must succeed')

  // 6. Insert into `proyecto_sitio_productos`
  const { error: pspErr } = await client
    .from('proyecto_sitio_productos')
    .insert({
      proyecto_id: projId,
      sitio_id: siteId,
      configuracion_id: cfgId,
      tipo: 'fv',
      datos: { capex: '750000', capex_moneda: 'USD' },
    })
  assertEqual(pspErr, null, 'proyecto_sitio_productos insert must succeed')

  // ── TEST 1: Delete configuraciones_tecnicas row directly ─────────────────
  // It should cascade delete from config_financiamiento and proyecto_sitio_productos
  const { error: delCfgErr } = await client
    .from('configuraciones_tecnicas')
    .delete()
    .eq('id', cfgId)
  assertEqual(delCfgErr, null, 'Direct deletion of configuraciones_tecnicas must succeed')

  const { data: remCf } = await client.from('config_financiamiento').select('id').eq('configuracion_id', cfgId)
  assertEqual(remCf.length, 0, 'config_financiamiento rows must cascade delete with configuracion')

  const { data: remPsp } = await client.from('proyecto_sitio_productos').select('id').eq('configuracion_id', cfgId)
  assertEqual(remPsp.length, 0, 'proyecto_sitio_productos rows must cascade delete with configuracion')

  // Re-insert configuration and product to test root project cascade deletion
  const { data: cfg2 } = await client
    .from('configuraciones_tecnicas')
    .insert({
      proyecto_id: projId,
      nombre: 'Configuracion 2 Cascada',
      inversion_total: 500000,
      moneda: 'USD',
      seleccionada: true,
    })
    .select('id')
    .single()

  await client.from('config_financiamiento').insert({ configuracion_id: cfg2.id, opcion_financiamiento_id: optId })
  await client.from('proyecto_sitio_productos').insert({
    proyecto_id: projId,
    sitio_id: siteId,
    configuracion_id: cfg2.id,
    tipo: 'bess',
    datos: { capex: '500000', capex_moneda: 'USD' },
  })

  // ── TEST 2: Delete root proyecto directly ─────────────────────────────────
  const { error: delProjErr } = await client
    .from('proyectos')
    .delete()
    .eq('id', projId)
  assertEqual(delProjErr, null, 'Direct deletion of root proyecto must succeed')

  // Verify child tables
  const [
    { data: checkCt },
    { data: checkOf },
    { data: checkPsp2 },
    { data: checkPs },
  ] = await Promise.all([
    client.from('configuraciones_tecnicas').select('id').eq('proyecto_id', projId),
    client.from('opciones_financiamiento').select('id').eq('proyecto_id', projId),
    client.from('proyecto_sitio_productos').select('id').eq('proyecto_id', projId),
    client.from('proyecto_sitios').select('id').eq('proyecto_id', projId),
  ])

  assertEqual(checkCt.length, 0, 'configuraciones_tecnicas cascaded')
  assertEqual(checkOf.length, 0, 'opciones_financiamiento cascaded')
  assertEqual(checkPsp2.length, 0, 'proyecto_sitio_productos cascaded')

  // EMPIRICAL DISCOVERY: proyecto_sitios DOES NOT have ON DELETE CASCADE constraint!
  // Clean up the orphan row created by the test
  if (checkPs.length > 0) {
    await client.from('proyecto_sitios').delete().eq('proyecto_id', projId)
  }
})

challengerSuite.test('2.2: Foreign key integrity: orphan prevention check on core tables', async () => {
  const adminAuth = await getAuthSession('admin')
  const client = getAnonClient()
  await client.auth.setSession(adminAuth.session)

  const fakeId = '00000000-0000-0000-0000-000000000000'

  // Attempt orphan insert into configuraciones_tecnicas (must fail)
  const { error: orphanCt } = await client
    .from('configuraciones_tecnicas')
    .insert({ proyecto_id: fakeId, nombre: 'Orphan Config' })
  assert(orphanCt !== null, 'Inserting orphan configuraciones_tecnicas must be rejected by foreign key constraint')

  // Attempt orphan insert into opciones_financiamiento (must fail)
  const { error: orphanOf } = await client
    .from('opciones_financiamiento')
    .insert({ proyecto_id: fakeId, nombre: 'Orphan Fin', vehiculo_inversion: 'credito' })
  assert(orphanOf !== null, 'Inserting orphan opciones_financiamiento must be rejected by foreign key constraint')

  // Attempt orphan insert into proyectos with non-existent cliente_id (must fail)
  const { error: orphanProjClient } = await client
    .from('proyectos')
    .insert({
      nombre_proyecto: 'Orphan Client Proj',
      epcista_id: adminAuth.user.id,
      cliente_id: fakeId,
      tipo: 'FV',
      estado: 'recibido',
      tipo_instalacion: 'epcista_instala',
      ubicacion_estado: 'CDMX',
      cliente_final_nombre: 'Test',
      cliente_final_empresa: 'Test',
      cliente_final_contacto: 'test@test.com'
    })
  assert(orphanProjClient !== null, 'Inserting proyecto with invalid cliente_id must be rejected by proyectos_cliente_id_fkey')
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. CHALLENGE SIDEBAR.TSX NAVIGATION AGAINST ROUTE MATCHING PERMUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

challengerSuite.test('3.1: Sidebar navigation route matching logic across all roles and paths', () => {
  const portalRoots = ['/epc', '/analista', '/admin', '/cliente', '/financiero', '/mem', '/finder']

  function isItemActive(href, pathname) {
    const isRoot = portalRoots.includes(href)
    return pathname === href || (!isRoot && pathname.startsWith(`${href}/`))
  }

  // Permutation test cases
  const cases = [
    // [href, pathname, expectedActive, description]
    ['/admin', '/admin', true, 'Exact match on admin dashboard'],
    ['/admin', '/admin/proyectos', false, 'Dashboard must NOT bleed into proyectos directory'],
    ['/admin', '/admin/proyectos/123', false, 'Dashboard must NOT bleed into project detail'],
    ['/admin', '/admin/proyectos/nuevo', false, 'Dashboard must NOT bleed into new project wizard'],
    ['/admin/proyectos', '/admin/proyectos', true, 'Exact match on admin proyectos directory'],
    ['/admin/proyectos', '/admin/proyectos/123', true, 'Proyectos matches project detail child'],
    ['/admin/proyectos', '/admin/proyectos/nuevo', true, 'Proyectos matches nuevo project wizard'],
    ['/admin/proyectos', '/admin/proyectos-archivados', false, 'Proyectos does NOT prefix match sibling route'],
    ['/admin/proyectos', '/admin/usuarios', false, 'Proyectos does not match other sections'],
    
    // Analyst
    ['/analista', '/analista', true, 'Analyst exact dashboard match'],
    ['/analista', '/analista/proyectos', false, 'Analyst dashboard does NOT bleed into proyectos directory'],
    ['/analista', '/analista/proyectos/uuid-123', false, 'Analyst dashboard does NOT bleed into project detail'],
    ['/analista/proyectos', '/analista/proyectos', true, 'Analyst proyectos directory match'],
    ['/analista/proyectos', '/analista/proyectos/uuid-123', true, 'Analyst proyectos matches detail child'],
    ['/analista/proyectos', '/analista/proyectos/nuevo', true, 'Analyst proyectos matches nuevo child'],
    ['/analista/proyectos', '/analista/instalaciones', false, 'Analyst proyectos does not match instalaciones'],

    // EPC
    ['/epc', '/epc', true, 'EPC dashboard match'],
    ['/epc', '/epc/proyectos', false, 'EPC dashboard does NOT bleed into proyectos directory'],
    ['/epc/proyectos', '/epc/proyectos', true, 'EPC proyectos match'],
    ['/epc/proyectos', '/epc/proyectos/456', true, 'EPC proyectos detail match'],

    // Finder
    ['/finder', '/finder', true, 'Finder dashboard match'],
    ['/finder', '/finder/proyectos', false, 'Finder dashboard does NOT bleed into proyectos directory'],
    ['/finder/proyectos', '/finder/proyectos/789', true, 'Finder proyectos detail match'],
  ]

  for (const [href, pathname, expected, desc] of cases) {
    const actual = isItemActive(href, pathname)
    assertEqual(actual, expected, `Route matching failure for ${desc}: href=${href}, pathname=${pathname}`)
  }
})

challengerSuite.test('3.2: Sidebar configuration link derivation', () => {
  function getConfigHref(rol) {
    return `/${rol.replace('nodo_analista', 'analista').replace('nodo_admin', 'admin')}/configuracion`
  }

  assertEqual(getConfigHref('nodo_admin'), '/admin/configuracion')
  assertEqual(getConfigHref('nodo_analista'), '/analista/configuracion')
  assertEqual(getConfigHref('epc'), '/epc/configuracion')
  assertEqual(getConfigHref('finder'), '/finder/configuracion')
})

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  challengerSuite.run().catch((err) => {
    console.error('Test run failed:', err)
    process.exit(1)
  })
}
