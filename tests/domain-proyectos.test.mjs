import {
  TestSuite,
  assert,
  assertEqual,
} from './test-utils.mjs'

import {
  STAGE_ORDER,
  TERMINAL_STAGES,
  ESTADO_LABELS,
  SALES_CYCLE,
  validateStageTransition,
  calculateNextHistorialEstados,
  getStageTransitionPayload,
} from '../lib/domains/proyectos/lifecycle.ts'

import {
  parseNum,
  sanitizeFvDatos,
  sanitizeBessDatos,
  hydrateFvForm,
  hydrateBessForm,
} from '../lib/domains/proyectos/schemas.ts'

export const domainProyectosSuite = new TestSuite('Domain: Proyectos Lifecycle & Data Sanitization')

// ── 1. Lifecycle Constants & Ordering ─────────────────────────────────────────
domainProyectosSuite.test('Proyectos.1: STAGE_ORDER, ESTADO_LABELS, and TERMINAL_STAGES define complete pipeline', () => {
  const expectedOrder = [
    'recibido',
    'en_analisis',
    'propuesta_lista',
    'enviada',
    'cliente_interesado',
    'negociacion',
    'aprobado',
    'en_construccion',
    'operativo',
    'completado',
  ]

  assertEqual(STAGE_ORDER.length, 10, 'Must have exactly 10 pipeline stages')
  for (let i = 0; i < expectedOrder.length; i++) {
    assertEqual(
      STAGE_ORDER[i],
      expectedOrder[i],
      `Stage index ${i} must be "${expectedOrder[i]}"`
    )
    assert(
      typeof ESTADO_LABELS[expectedOrder[i]] === 'string' && ESTADO_LABELS[expectedOrder[i]].length > 0,
      `ESTADO_LABELS for "${expectedOrder[i]}" must be non-empty string`
    )
  }

  // Check terminal stages
  const expectedTerminal = ['aprobado', 'en_construccion', 'operativo', 'completado']
  assertEqual(TERMINAL_STAGES.length, expectedTerminal.length, 'Must have 4 terminal stages')
  for (const term of expectedTerminal) {
    assert(TERMINAL_STAGES.includes(term), `TERMINAL_STAGES must include "${term}"`)
  }

  // Check SALES_CYCLE
  assertEqual(SALES_CYCLE.length, 10, 'SALES_CYCLE must have 10 steps')
  for (let i = 0; i < SALES_CYCLE.length; i++) {
    assertEqual(SALES_CYCLE[i].key, expectedOrder[i], `SALES_CYCLE step ${i} key mismatch`)
    assert(SALES_CYCLE[i].label.length > 0, `SALES_CYCLE step ${i} label must be non-empty`)
  }
})

// ── 2. Stage Transition Guards ───────────────────────────────────────────────
domainProyectosSuite.test('Proyectos.2: validateStageTransition enforces winning config & financing for approval', () => {
  const dummyProject = { id: 'proj-1', nombre_proyecto: 'Test Project', estado: 'recibido' }

  // 2.1 Pre-approval transitions do NOT require winning selections
  const preApprovalStages = ['recibido', 'en_analisis', 'propuesta_lista', 'enviada', 'cliente_interesado', 'negociacion']
  for (const stage of preApprovalStages) {
    const res = validateStageTransition(dummyProject, stage, [], [])
    assert(res.valid, `Transitioning to "${stage}" without selections must be valid`)
    assertEqual(res.error, undefined, `No error should be returned for stage "${stage}"`)
  }

  // 2.2 Terminal stage transitions require BOTH winning technical config AND financing option
  const terminalStages = ['aprobado', 'en_construccion', 'operativo', 'completado']
  const expectedError = 'Se deben seleccionar una configuración técnica ganadora Y una opción de financiamiento ganadora antes de aprobar el proyecto o avanzar en el pipeline.'

  for (const stage of terminalStages) {
    // Neither selected
    const resNeither = validateStageTransition(dummyProject, stage, [{ seleccionada: false }], [{ seleccionada: false }])
    assert(!resNeither.valid, `Transitioning to "${stage}" with no selections must fail`)
    assertEqual(resNeither.error, expectedError)

    // Only config selected
    const resOnlyConfig = validateStageTransition(dummyProject, stage, [{ seleccionada: true }], [{ seleccionada: false }])
    assert(!resOnlyConfig.valid, `Transitioning to "${stage}" with only config selected must fail`)
    assertEqual(resOnlyConfig.error, expectedError)

    // Only financing selected
    const resOnlyFin = validateStageTransition(dummyProject, stage, [{ seleccionada: false }], [{ seleccionada: true }])
    assert(!resOnlyFin.valid, `Transitioning to "${stage}" with only financing selected must fail`)
    assertEqual(resOnlyFin.error, expectedError)

    // BOTH selected -> PASS
    const resBoth = validateStageTransition(
      dummyProject,
      stage,
      [{ seleccionada: false }, { seleccionada: true }],
      [{ seleccionada: true }, { seleccionada: false }]
    )
    assert(resBoth.valid, `Transitioning to "${stage}" with both selections must pass`)
    assertEqual(resBoth.error, undefined)
  }
})

// ── 3. Historial Estados & Transition Payloads ────────────────────────────────
domainProyectosSuite.test('Proyectos.3: calculateNextHistorialEstados and getStageTransitionPayload preserve history', () => {
  const initialHistory = {
    recibido: '2026-01-01T10:00:00.000Z',
    en_analisis: '2026-01-05T12:00:00.000Z',
  }

  const fixedTimestamp = '2026-02-01T15:30:00.000Z'
  const nextHistory = calculateNextHistorialEstados(initialHistory, 'propuesta_lista', fixedTimestamp)

  assertEqual(nextHistory.recibido, initialHistory.recibido, 'Must preserve existing recibido timestamp')
  assertEqual(nextHistory.en_analisis, initialHistory.en_analisis, 'Must preserve existing en_analisis timestamp')
  assertEqual(nextHistory.propuesta_lista, fixedTimestamp, 'Must add new propuesta_lista timestamp')

  // Handles null/undefined initial history
  const freshHistory = calculateNextHistorialEstados(null, 'recibido', fixedTimestamp)
  assertEqual(freshHistory.recibido, fixedTimestamp, 'Fresh history must contain new stage timestamp')

  // getStageTransitionPayload checks plan_bloqueado
  const payloadEnAnalisis = getStageTransitionPayload('en_analisis', initialHistory)
  assertEqual(payloadEnAnalisis.estado, 'en_analisis')
  assertEqual(payloadEnAnalisis.plan_bloqueado, undefined, 'Pre-construction should not set plan_bloqueado')

  const payloadConstruccion = getStageTransitionPayload('en_construccion', initialHistory)
  assertEqual(payloadConstruccion.estado, 'en_construccion')
  assertEqual(payloadConstruccion.plan_bloqueado, true, 'Transition to en_construccion must set plan_bloqueado to true')
})

// ── 4. Numeric Sanitization (parseNum) ─────────────────────────────────────────
domainProyectosSuite.test('Proyectos.4: parseNum strictly sanitizes formatted strings, commas, and edge values', () => {
  // Direct numbers
  assertEqual(parseNum(0), 0)
  assertEqual(parseNum(1500), 1500)
  assertEqual(parseNum(-250.75), -250.75)

  // Formatting commas stripped
  assertEqual(parseNum('1,500'), 1500)
  assertEqual(parseNum('250,000'), 250000)
  assertEqual(parseNum('1,234,567.89'), 1234567.89)
  assertEqual(parseNum('  18,500,000  '), 18500000)

  // Empty, null, undefined, invalid
  assertEqual(parseNum(null), 0)
  assertEqual(parseNum(undefined), 0)
  assertEqual(parseNum(''), 0)
  assertEqual(parseNum('   '), 0)
  assertEqual(parseNum('abc'), 0)
  assertEqual(parseNum(NaN), 0)
  assertEqual(parseNum({}), 0)
  assertEqual(parseNum([]), 0)
})

// ── 5. FV Equipment Data Sanitization (sanitizeFvDatos) ────────────────────────
domainProyectosSuite.test('Proyectos.5: sanitizeFvDatos produces clean numeric JSONB without formatting commas', () => {
  const dirtyFvForm = {
    num_modulos: '1,500',
    potencia_modulos_w: '550',
    marca_modulos: '  Canadian Solar HiKu7  ',
    num_inversores: '12',
    potencia_inversores_kw: '75',
    marca_inversores: '  Huawei SUN2000  ',
    generacion_anual_kwh: '1,250,000',
    capex: '18,500,000',
    capex_moneda: 'MXN',
  }

  const clean = sanitizeFvDatos(dirtyFvForm)

  // Assert exact numeric types (not strings with commas)
  assertEqual(typeof clean.num_modulos, 'number', 'num_modulos must be number')
  assertEqual(clean.num_modulos, 1500)

  assertEqual(typeof clean.potencia_modulos_w, 'number', 'potencia_modulos_w must be number')
  assertEqual(clean.potencia_modulos_w, 550)

  assertEqual(clean.marca_modulos, 'Canadian Solar HiKu7', 'marca_modulos must be trimmed')

  assertEqual(typeof clean.num_inversores, 'number', 'num_inversores must be number')
  assertEqual(clean.num_inversores, 12)

  assertEqual(typeof clean.potencia_inversores_kw, 'number', 'potencia_inversores_kw must be number')
  assertEqual(clean.potencia_inversores_kw, 75)

  assertEqual(clean.marca_inversores, 'Huawei SUN2000', 'marca_inversores must be trimmed')

  assertEqual(typeof clean.generacion_anual_kwh, 'number', 'generacion_anual_kwh must be number')
  assertEqual(clean.generacion_anual_kwh, 1250000)

  assertEqual(typeof clean.capex, 'number', 'capex must be number')
  assertEqual(clean.capex, 18500000)

  assertEqual(clean.capex_moneda, 'MXN')

  // Verify that JSON serialization contains ZERO commas inside values
  const jsonStr = JSON.stringify(clean)
  assert(!jsonStr.includes('"1,500"'), 'Serialized JSON must not contain comma-formatted num_modulos')
  assert(!jsonStr.includes('"18,500,000"'), 'Serialized JSON must not contain comma-formatted capex')
  assert(!jsonStr.includes('"1,250,000"'), 'Serialized JSON must not contain comma-formatted generacion_anual_kwh')
})

// ── 6. BESS Equipment Data Sanitization (sanitizeBessDatos) ────────────────────
domainProyectosSuite.test('Proyectos.6: sanitizeBessDatos produces clean numeric JSONB without formatting commas', () => {
  const dirtyBessForm = {
    potencia_kw: '250',
    capacidad_kwh: '1,000',
    marca: '  CATL EnerOne  ',
    uso: 'peak_shaving',
    capex: '8,750,000',
    capex_moneda: 'USD',
    inversores_hibridos: true,
  }

  const clean = sanitizeBessDatos(dirtyBessForm)

  assertEqual(typeof clean.potencia_kw, 'number', 'potencia_kw must be number')
  assertEqual(clean.potencia_kw, 250)

  assertEqual(typeof clean.capacidad_kwh, 'number', 'capacidad_kwh must be number')
  assertEqual(clean.capacidad_kwh, 1000)

  assertEqual(clean.marca, 'CATL EnerOne', 'marca must be trimmed')
  assertEqual(clean.uso, 'peak_shaving')

  assertEqual(typeof clean.capex, 'number', 'capex must be number')
  assertEqual(clean.capex, 8750000)

  assertEqual(clean.capex_moneda, 'USD')
  assertEqual(clean.inversores_hibridos, true)

  const jsonStr = JSON.stringify(clean)
  assert(!jsonStr.includes('"1,000"'), 'Serialized JSON must not contain comma-formatted capacidad_kwh')
  assert(!jsonStr.includes('"8,750,000"'), 'Serialized JSON must not contain comma-formatted capex')
})

// ── 7. Form Hydration (hydrateFvForm & hydrateBessForm) ────────────────────────
domainProyectosSuite.test('Proyectos.7: hydrateFvForm and hydrateBessForm format stored numbers for UI inputs', () => {
  // 7.1 Hydrate stored clean numbers to formatted input strings
  const storedFvDatos = {
    num_modulos: 1500,
    potencia_modulos_w: 550,
    marca_modulos: 'Canadian Solar',
    num_inversores: 10,
    potencia_inversores_kw: 60,
    marca_inversores: 'Huawei',
    generacion_anual_kwh: 1250000,
    capex: 18500000,
    capex_moneda: 'MXN',
  }

  const hydratedFv = hydrateFvForm(storedFvDatos)
  assertEqual(hydratedFv.num_modulos, '1,500', 'num_modulos should be hydrated with formatting commas')
  assertEqual(hydratedFv.potencia_modulos_w, '550')
  assertEqual(hydratedFv.marca_modulos, 'Canadian Solar')
  assertEqual(hydratedFv.generacion_anual_kwh, '1,250,000', 'generacion_anual_kwh should have formatting commas')
  assertEqual(hydratedFv.capex, '18,500,000', 'capex should have formatting commas')
  assertEqual(hydratedFv.capex_moneda, 'MXN')

  // 7.2 Hydrate BESS stored clean numbers
  const storedBessDatos = {
    potencia_kw: 250,
    capacidad_kwh: 1000,
    marca: 'Tesla',
    uso: 'peak_shaving',
    capex: 8750000,
    capex_moneda: 'USD',
    inversores_hibridos: true,
  }

  const hydratedBess = hydrateBessForm(storedBessDatos)
  assertEqual(hydratedBess.potencia_kw, '250')
  assertEqual(hydratedBess.capacidad_kwh, '1,000', 'capacidad_kwh should have formatting commas')
  assertEqual(hydratedBess.marca, 'Tesla')
  assertEqual(hydratedBess.capex, '8,750,000', 'capex should have formatting commas')
  assertEqual(hydratedBess.inversores_hibridos, true)

  // 7.3 Null / undefined handling does not throw and returns empty form defaults
  const emptyFv = hydrateFvForm(null)
  assertEqual(emptyFv.num_modulos, '')
  assertEqual(emptyFv.marca_modulos, '')
  assertEqual(emptyFv.capex, '')

  const emptyBess = hydrateBessForm(undefined)
  assertEqual(emptyBess.potencia_kw, '')
  assertEqual(emptyBess.marca, '')
  assertEqual(emptyBess.inversores_hibridos, false)
})

if (process.argv[1] && process.argv[1].endsWith('domain-proyectos.test.mjs')) {
  domainProyectosSuite.run().catch((err) => {
    console.error('Test suite failed:', err)
    process.exit(1)
  })
}
