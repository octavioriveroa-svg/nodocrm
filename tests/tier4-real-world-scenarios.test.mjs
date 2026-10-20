import {
  TestSuite,
  assert,
  assertEqual,
  getAuthSession,
  getAnonClient,
} from './test-utils.mjs'

export const tier4Suite = new TestSuite('Tier 4: Real-World Scenarios')

// ── Scenario 4.1: Full Hybrid Solar + BESS Project Creation across Admin ─────
tier4Suite.test('4.1: Admin end-to-end multi-step hybrid FV + BESS project creation with DB persistence check', async () => {
  const adminAuth = await getAuthSession('admin')
  const client = getAnonClient()
  await client.auth.setSession(adminAuth.session)

  // 1. Get an existing EPC and Client to link to
  const { data: epcs } = await client.from('profiles').select('id').eq('rol', 'epc').limit(1)
  assert(epcs && epcs.length > 0, 'Must have at least one EPC profile')
  const epcId = epcs[0].id

  const { data: clientes, error: cliErr } = await client.from('clientes').select('id, razon_social, contacto_nombre, contacto_email').limit(1)
  assert(clientes && clientes.length > 0, 'Must have at least one client: ' + cliErr?.message)
  const cliente = clientes[0]

  // Get or create a site for this client
  let { data: sites } = await client.from('sitios').select('id').eq('cliente_id', cliente.id).limit(1)
  let siteId = sites && sites.length > 0 ? sites[0].id : null

  if (!siteId) {
    const { data: newSite } = await client
      .from('sitios')
      .insert({
        cliente_id: cliente.id,
        epcista_id: epcId,
        nombre: 'Planta Piloto E2E',
        ciudad: 'Monterrey',
        ubicacion_estado: 'Nuevo León',
        demanda_contratada_kw: 850,
      })
      .select('id')
      .single()
    siteId = newSite.id
  }

  // 2. Insert into `proyectos`
  const testProjectName = `[E2E-TEST-${Date.now()}] Parque Hibrido FV+BESS`
  const { data: proyecto, error: projErr } = await client
    .from('proyectos')
    .insert({
      nombre_proyecto: testProjectName,
      epcista_id: epcId,
      responsable_nodo_id: adminAuth.user.id,
      cliente_id: cliente.id,
      cliente_final_nombre: cliente.contacto_nombre || 'Contacto Test',
      cliente_final_empresa: cliente.razon_social || 'Empresa Test',
      cliente_final_contacto: cliente.contacto_email || 'test@empresa.com',
      tipo: 'FV+BESS',
      estado: 'recibido',
      tipo_instalacion: 'epcista_instala',
      capex_estimado: 550000,
      moneda: 'USD',
      ubicacion_estado: 'Nuevo León',
      incluye_mem: false,
    })
    .select('id')
    .single()

  assertEqual(projErr, null, 'Project insertion must succeed')
  const proyectoId = proyecto.id
  let configId = null

  try {
    // 3. Insert into `proyecto_sitios`
    const { error: psErr } = await client
      .from('proyecto_sitios')
      .insert({ proyecto_id: proyectoId, sitio_id: siteId })
    assertEqual(psErr, null, 'Project sites junction insertion must succeed')

    // 4. Insert into `configuraciones_tecnicas`
    const { data: config, error: cfgErr } = await client
      .from('configuraciones_tecnicas')
      .insert({
        proyecto_id: proyectoId,
        nombre: 'Alternativa A (Híbrida)',
        descripcion: '500 kWp FV + 250 kW / 500 kWh BESS con inversores híbridos',
        inversion_total: 550000,
        moneda: 'USD',
        ahorro_estimado_anual: 60000,
        ahorro_estimado_mensual: 5000,
        ahorro_moneda: 'USD',
        seleccionada: true,
      })
      .select('id')
      .single()
    assertEqual(cfgErr, null, 'Technical config insertion must succeed')
    configId = config.id

    // 5. Insert into `opciones_financiamiento`
    const { data: finOption, error: finErr } = await client
      .from('opciones_financiamiento')
      .insert({
        proyecto_id: proyectoId,
        nombre: 'Arrendamiento Financiero USD',
        vehiculo_inversion: 'arrendamiento',
        plazo_meses: 60,
        ahorro_estimado_anual: 45000,
        moneda: 'USD',
        seleccionada: true,
      })
      .select('id')
      .single()
    assertEqual(finErr, null, 'Financing option insertion must succeed')
    const finOptionId = finOption.id

    // 6. Link config to financing in `config_financiamiento`
    const { error: linkErr } = await client
      .from('config_financiamiento')
      .insert({ configuracion_id: configId, opcion_financiamiento_id: finOptionId })
    assertEqual(linkErr, null, 'Config financing junction link must succeed')

    // 7. Insert products into `proyecto_sitio_productos`
    const { error: prodErr } = await client
      .from('proyecto_sitio_productos')
      .insert([
        {
          proyecto_id: proyectoId,
          sitio_id: siteId,
          configuracion_id: configId,
          tipo: 'fv',
          datos: {
            num_modulos: '1000',
            potencia_modulos_w: '500',
            marca_modulos: 'Canadian Solar',
            generacion_anual_kwh: '850000',
            capex: '250000',
            capex_moneda: 'USD',
          },
        },
        {
          proyecto_id: proyectoId,
          sitio_id: siteId,
          configuracion_id: configId,
          tipo: 'bess',
          datos: {
            potencia_kw: '250',
            capacidad_kwh: '500',
            marca: 'Tesla Megapack',
            uso: 'load_shifting',
            inversores_hibridos: true,
            capex: '300000',
            capex_moneda: 'USD',
          },
        },
      ])
    assertEqual(prodErr, null, 'Site products insertion must succeed')

    // ── DATABASE PERSISTENCE VERIFICATION ────────────────────────────────────
    const { data: persistedProject, error: checkErr } = await client
      .from('proyectos')
      .select('*')
      .eq('id', proyectoId)
      .single()
    assertEqual(checkErr, null, 'Must read back persisted project')
    assertEqual(persistedProject.tipo, 'FV+BESS', 'Project type must be FV+BESS')
    assertEqual(persistedProject.capex_estimado, 550000, 'Project CAPEX must be 550,000 USD')
    assertEqual(persistedProject.moneda, 'USD', 'Currency must be USD')

    const { data: persistedConfigs } = await client
      .from('configuraciones_tecnicas')
      .select('*')
      .eq('proyecto_id', proyectoId)
    assertEqual(persistedConfigs.length, 1, 'Config count must be 1')
    assertEqual(persistedConfigs[0].inversion_total, 550000, 'Config total inversion matches')

    const { data: persistedProducts } = await client
      .from('proyecto_sitio_productos')
      .select('*')
      .eq('proyecto_id', proyectoId)
    assertEqual(persistedProducts.length, 2, 'Should persist 2 products (FV + BESS)')

    const bessProduct = persistedProducts.find((p) => p.tipo === 'bess')
    assertEqual(bessProduct.datos.inversores_hibridos, true, 'BESS hybrid inverter flag preserved in datos JSONB')

  } finally {
    // ── CLEANUP TEST RECORDS ─────────────────────────────────────────────────
    await client.from('proyecto_sitio_productos').delete().eq('proyecto_id', proyectoId)
    if (configId) {
      await client.from('config_financiamiento').delete().eq('configuracion_id', configId)
    }
    await client.from('opciones_financiamiento').delete().eq('proyecto_id', proyectoId)
    await client.from('configuraciones_tecnicas').delete().eq('proyecto_id', proyectoId)
    await client.from('proyecto_sitios').delete().eq('proyecto_id', proyectoId)
    await client.from('proyectos').delete().eq('id', proyectoId)

    // Verify cleanup
    const { data: remaining } = await client.from('proyectos').select('id').eq('id', proyectoId)
    assertEqual(remaining.length, 0, 'Test project must be cleanly purged after test')
  }
})

// ── Scenario 4.2: EPC Multi-Step Project Creation with Finder Attribution ────
tier4Suite.test('4.2: EPC portal project creation with Finder attribution and persistence verification', async () => {
  const adminAuth = await getAuthSession('admin')
  const adminClient = getAnonClient()
  await adminClient.auth.setSession(adminAuth.session)

  // Query a finder to attribute via admin catalog
  const { data: finders } = await adminClient.from('profiles').select('id').eq('rol', 'finder').limit(1)
  assert(finders && finders.length > 0, 'Platform should have a finder profile')
  const finderId = finders[0].id

  // Authenticate as EPC for creation
  const epcAuth = await getAuthSession('epc')
  const client = getAnonClient()
  await client.auth.setSession(epcAuth.session)

  const testProjectName = `[E2E-TEST-${Date.now()}] EPC Project con Finder`
  const { data: proyecto, error: projErr } = await client
    .from('proyectos')
    .insert({
      nombre_proyecto: testProjectName,
      epcista_id: epcAuth.user.id,
      finder_id: finderId,
      cliente_final_nombre: 'Contacto Cliente EPC',
      cliente_final_empresa: 'Empresa Cliente EPC',
      cliente_final_contacto: 'contacto@cliente.com',
      tipo: 'FV',
      estado: 'recibido',
      tipo_instalacion: 'epcista_instala',
      capex_estimado: 120000,
      moneda: 'MXN',
      ubicacion_estado: 'Jalisco',
      incluye_mem: false,
    })
    .select('id')
    .single()

  assertEqual(projErr, null, 'EPC project insertion must succeed')
  const proyectoId = proyecto.id

  try {
    const { data: persisted, error: readErr } = await client
      .from('proyectos')
      .select('id, epcista_id, finder_id, nombre_proyecto')
      .eq('id', proyectoId)
      .single()

    assertEqual(readErr, null, 'Must read back EPC project')
    assertEqual(persisted.epcista_id, epcAuth.user.id, 'Creator EPC identity verified')
    assertEqual(persisted.finder_id, finderId, 'Finder attribution verified')
  } finally {
    await client.from('proyectos').delete().eq('id', proyectoId)
  }
})

// ── Scenario 4.3: 2-Step "Nodo Busca Instalador" Flow Persistence ─────────────
tier4Suite.test('4.3: 2-Step "Nodo busca instalador" flow persistence with pending defaults', async () => {
  const adminAuth = await getAuthSession('admin')
  const client = getAnonClient()
  await client.auth.setSession(adminAuth.session)

  const testProjectName = `[E2E-TEST-${Date.now()}] Nodo Busca Flow`
  const { data: proyecto, error: projErr } = await client
    .from('proyectos')
    .insert({
      nombre_proyecto: testProjectName,
      epcista_id: adminAuth.user.id,
      cliente_final_nombre: 'Contacto Rapido',
      cliente_final_empresa: 'Empresa Rapida SA',
      cliente_final_contacto: 'rapido@empresa.com',
      tipo: 'FV',
      estado: 'recibido',
      tipo_instalacion: 'nodo_busca',
      capex_estimado: null,
      moneda: 'USD',
      ubicacion_estado: 'Ciudad de México',
      incluye_mem: false,
    })
    .select('id')
    .single()

  assertEqual(projErr, null, 'Nodo busca project insertion must succeed')
  const proyectoId = proyecto.id

  try {
    // Insert default technical config
    const { data: cfg } = await client
      .from('configuraciones_tecnicas')
      .insert({
        proyecto_id: proyectoId,
        nombre: 'Pendiente definición',
        inversion_total: null,
        moneda: 'USD',
        seleccionada: true,
      })
      .select('id')
      .single()

    // Insert default financing option
    const { data: fin } = await client
      .from('opciones_financiamiento')
      .insert({
        proyecto_id: proyectoId,
        nombre: 'Recomendación de Nodo',
        vehiculo_inversion: 'no_sabe',
        moneda: 'MXN',
        seleccionada: true,
      })
      .select('id')
      .single()

    // Verify defaults
    const { data: checkCfg } = await client.from('configuraciones_tecnicas').select('*').eq('id', cfg.id).single()
    assertEqual(checkCfg.nombre, 'Pendiente definición', 'Technical config marked pending')
    assertEqual(checkCfg.inversion_total, null, 'Inversion total is null')

    const { data: checkFin } = await client.from('opciones_financiamiento').select('*').eq('id', fin.id).single()
    assertEqual(checkFin.vehiculo_inversion, 'no_sabe', 'Financing vehicle is no_sabe')
  } finally {
    await client.from('opciones_financiamiento').delete().eq('proyecto_id', proyectoId)
    await client.from('configuraciones_tecnicas').delete().eq('proyecto_id', proyectoId)
    await client.from('proyectos').delete().eq('id', proyectoId)
  }
})
