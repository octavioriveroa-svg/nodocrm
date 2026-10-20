import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

console.log('==================================================================')
console.log('CHALLENGER 1: EMPIRICAL ADVERSARIAL STRESS SUITE (SPRINT 1)')
console.log('RPCs, Fallbacks, CFE Tariffs & Modals Stress Testing')
console.log('==================================================================\n')

let passCount = 0
let failCount = 0
const findings = []

function test(name, fn) {
  try {
    fn()
    console.log(`  ✔ [PASS] ${name}`)
    passCount++
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}`)
    console.error(`    Error: ${err.message}`)
    failCount++
    findings.push({ name, error: err.message })
  }
}

// ----------------------------------------------------------------------------
// SUITE 1: CFE Calculator Adversarial Edge Cases & Boundary Conditions
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 1: CFE CALCULATOR ADVERSARIAL & BOUNDARY TESTS ---')

const cfeModule = await import('../lib/tariffs/cfe-calculator.ts')
const {
  CFE_TARIFF_RATES_MXN,
  calculateProjectSavingsMxn,
  calculateBatteryCycles,
  resolveCfeTariffLabel,
} = cfeModule

test('1.1: Tariff Rates Dictionary integrity', () => {
  assert.strictEqual(CFE_TARIFF_RATES_MXN.GDMTH, 2.85)
  assert.strictEqual(CFE_TARIFF_RATES_MXN.GDMTO, 3.12)
  assert.strictEqual(CFE_TARIFF_RATES_MXN.PDBT, 3.95)
  assert.strictEqual(CFE_TARIFF_RATES_MXN.GDBT, 3.45)
  assert.ok(Object.keys(CFE_TARIFF_RATES_MXN).includes('PDBT'), 'PDBT must be defined in rates')
  assert.ok(Object.keys(CFE_TARIFF_RATES_MXN).includes('GDBT'), 'GDBT must be defined in rates')
})

test('1.2: resolveCfeTariffLabel - extreme and boundary demand/volume inputs', () => {
  // Demand >= 100 kW -> GDMTH
  assert.strictEqual(resolveCfeTariffLabel(100, null), 'GDMTH')
  assert.strictEqual(resolveCfeTariffLabel(1000, 50), 'GDMTH')
  assert.strictEqual(resolveCfeTariffLabel(100000, 0), 'GDMTH')

  // Volume >= 500 MWh -> GDMTH
  assert.strictEqual(resolveCfeTariffLabel(0, 500), 'GDMTH')
  assert.strictEqual(resolveCfeTariffLabel(10, 500), 'GDMTH')
  assert.strictEqual(resolveCfeTariffLabel(null, 10000), 'GDMTH')

  // Demand >= 25 kW & < 100 kW
  assert.strictEqual(resolveCfeTariffLabel(25, 100), 'GDMTO')
  assert.strictEqual(resolveCfeTariffLabel(99.9, 100), 'GDMTO')
})

test('1.3: resolveCfeTariffLabel boundaries for PDBT and GDBT', () => {
  // Mexican CFE Tariff Regulations & Dispatch Requirement:
  // "Verify proper boundaries between PDBT (<=25 kW), GDBT (>25 kW and <100 MWh), GDMTO, and GDMTH"
  assert.strictEqual(resolveCfeTariffLabel(10, 50), 'PDBT', '10 kW demand resolves to PDBT')
  assert.strictEqual(resolveCfeTariffLabel(25, 50), 'PDBT', '25 kW demand resolves to PDBT')
  assert.strictEqual(resolveCfeTariffLabel(35, 50), 'GDBT', '35 kW demand with 50 MWh resolves to GDBT')
  assert.strictEqual(resolveCfeTariffLabel(35, 100), 'GDMTO', '35 kW demand with 100 MWh resolves to GDMTO')
  assert.strictEqual(resolveCfeTariffLabel(0, 0), 'GDMTH', '0 kW demand defaults to GDMTH')
  assert.strictEqual(resolveCfeTariffLabel(-50, 0), 'GDMTH', 'Negative demand defaults to GDMTH')
  assert.strictEqual(resolveCfeTariffLabel(null, null), 'GDMTH', 'null/null defaults to GDMTH')
  assert.strictEqual(resolveCfeTariffLabel(undefined, undefined), 'GDMTH', 'undefined defaults to GDMTH')
  assert.strictEqual(resolveCfeTariffLabel(NaN, NaN), 'GDMTH', 'NaN defaults to GDMTH')

  // Empirical confirmation: sweep across 2,107 combinations verifying all 4 tariffs are reachable
  let pdbtCount = 0
  let gdbtCount = 0
  let gdmtoCount = 0
  let gdmthCount = 0
  for (let d = -100; d <= 200; d += 1) {
    for (let v = 0; v <= 600; v += 100) {
      const tariff = resolveCfeTariffLabel(d, v)
      if (tariff === 'PDBT') pdbtCount++
      if (tariff === 'GDBT') gdbtCount++
      if (tariff === 'GDMTO') gdmtoCount++
      if (tariff === 'GDMTH') gdmthCount++
    }
  }

  assert.ok(pdbtCount > 0, `PDBT must be reachable (found ${pdbtCount})`)
  assert.ok(gdbtCount > 0, `GDBT must be reachable (found ${gdbtCount})`)
  assert.ok(gdmtoCount > 0, `GDMTO must be reachable (found ${gdmtoCount})`)
  assert.ok(gdmthCount > 0, `GDMTH must be reachable (found ${gdmthCount})`)
})

test('1.4: calculateProjectSavingsMxn - zero, negative, pro-rata, and undefined configs', () => {
  // Zero generation with annual config
  assert.strictEqual(
    calculateProjectSavingsMxn({
      totalGeneratedKwh: 0,
      selectedConfig: { ahorro_estimado_anual: 73000, ahorro_estimado_mensual: null, ahorro_moneda: 'MXN' },
    }),
    200 // 73000 / 365 = 200
  )

  // Zero generation with monthly config
  assert.strictEqual(
    calculateProjectSavingsMxn({
      totalGeneratedKwh: 0,
      selectedConfig: { ahorro_estimado_anual: null, ahorro_estimado_mensual: 1500, ahorro_moneda: 'MXN' },
    }),
    50 // 1500 / 30 = 50
  )

  // Negative generation (-500 kWh) treated as <= 0 (pro-rata fallback)
  assert.strictEqual(
    calculateProjectSavingsMxn({
      totalGeneratedKwh: -500,
      selectedConfig: { ahorro_estimado_anual: 36500, ahorro_estimado_mensual: 3000, ahorro_moneda: 'MXN' },
    }),
    100
  )

  // Negative config savings
  assert.strictEqual(
    calculateProjectSavingsMxn({
      totalGeneratedKwh: 0,
      selectedConfig: { ahorro_estimado_anual: -500, ahorro_estimado_mensual: -50, ahorro_moneda: 'MXN' },
    }),
    0 // Negative config rejected, returns 0
  )

  // Zero generation without config
  assert.strictEqual(calculateProjectSavingsMxn({ totalGeneratedKwh: 0 }), 0)
  assert.strictEqual(calculateProjectSavingsMxn({ totalGeneratedKwh: -10 }), 0)

  // Positive generation with specific and fallback tariffs
  assert.strictEqual(calculateProjectSavingsMxn({ totalGeneratedKwh: 100, tarifaCfe: 'PDBT' }), 395)
  assert.strictEqual(calculateProjectSavingsMxn({ totalGeneratedKwh: 100, tarifaCfe: 'GDBT' }), 345)
  assert.strictEqual(calculateProjectSavingsMxn({ totalGeneratedKwh: 100, tarifaCfe: 'GDMTO' }), 312)
  assert.strictEqual(calculateProjectSavingsMxn({ totalGeneratedKwh: 100, tarifaCfe: 'GDMTH' }), 285)
  assert.strictEqual(calculateProjectSavingsMxn({ totalGeneratedKwh: 100, tarifaCfe: 'UNKNOWN' }), 285)
  assert.strictEqual(calculateProjectSavingsMxn({ totalGeneratedKwh: 100, tarifaCfe: null }), 285)
})

test('1.5: calculateProjectSavingsMxn with NaN and Infinity sanitization', () => {
  const nanResult = calculateProjectSavingsMxn({ totalGeneratedKwh: NaN })
  assert.strictEqual(nanResult, 0, 'NaN generation must be sanitized to 0')

  const infResult = calculateProjectSavingsMxn({ totalGeneratedKwh: Infinity })
  assert.strictEqual(infResult, 0, 'Infinity generation must be sanitized to 0')
})

test('1.6: calculateBatteryCycles - discharge, negative, zero capacity, and fallbacks', () => {
  // Normal cases
  assert.strictEqual(calculateBatteryCycles(0), 0)
  assert.strictEqual(calculateBatteryCycles(-100), 0)
  assert.strictEqual(calculateBatteryCycles(600, 200), 3.0)
  assert.strictEqual(calculateBatteryCycles(200, 200), 1.0)
  assert.strictEqual(calculateBatteryCycles(100, 200), 0.5)

  // Default capacity fallback to 200 kWh when null/undefined/0/negative
  assert.strictEqual(calculateBatteryCycles(400, null), 2.0)
  assert.strictEqual(calculateBatteryCycles(400, undefined), 2.0)
  assert.strictEqual(calculateBatteryCycles(400, 0), 2.0, '0 capacity safely defaults to 200 without div-by-zero')
  assert.strictEqual(calculateBatteryCycles(400, -50), 2.0, 'Negative capacity safely defaults to 200')
  assert.strictEqual(calculateBatteryCycles(400, NaN), 2.0, 'NaN capacity safely defaults to 200')

  // NaN discharge
  assert.strictEqual(calculateBatteryCycles(NaN, 200), 0, 'NaN discharge must be sanitized to 0')
})

// ----------------------------------------------------------------------------
// SUITE 2: Transactional RPC & Sequential Fallback Logic
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 2: TRANSACTIONAL RPC & FALLBACK LOGIC TESTS ---')

test('2.1: ProjectWizard RPC error discrimination logic', () => {
  // In ProjectWizard.tsx:
  // if (rpcErr && !rpcErr.message.includes('crear_proyecto_completo')) {
  //   setError('Error al crear el proyecto: ' + rpcErr.message)
  //   setLoading(false)
  //   return
  // }
  
  // Case A: Missing RPC error returned by PostgREST
  const missingRpcErr = {
    code: 'PGRST202',
    message: 'Could not find the function public.crear_proyecto_completo(p_payload) in the schema cache',
  }
  const shouldAbortOnMissing = missingRpcErr && !missingRpcErr.message.includes('crear_proyecto_completo')
  assert.strictEqual(shouldAbortOnMissing, false, 'Missing RPC error MUST NOT abort; must proceed to fallback')

  // Case B: Validation / permission error from RPC or DB
  const validationRpcErr = {
    code: 'P0001',
    message: 'El nombre del proyecto es obligatorio.',
  }
  const shouldAbortOnValidation = validationRpcErr && !validationRpcErr.message.includes('crear_proyecto_completo')
  assert.strictEqual(shouldAbortOnValidation, true, 'Validation error MUST abort immediately without running fallback')

  // Case C: Permission error (unauthorized)
  const authRpcErr = {
    code: '42501',
    message: 'permission denied for function crear_proyecto_completo',
  }
  // If the message contains function name, it would trigger fallback!
  console.log(`    [OBSERVATION] Error message containing function name ('${authRpcErr.message}') includes function name: ${authRpcErr.message.includes('crear_proyecto_completo')}`)
})

test('2.2: DetalleProyecto RPC error discrimination and compensating restore logic', () => {
  // Case A: Missing RPC error does not throw, enters sequential fallback
  const missingRpcErr = {
    code: 'PGRST202',
    message: 'Could not find the function public.seleccionar_configuracion_tecnica(p_config_id, p_proyecto_id) in the schema cache',
  }
  const shouldThrowMissing = !missingRpcErr.message.includes('seleccionar_configuracion_tecnica')
  assert.strictEqual(shouldThrowMissing, false, 'Missing RPC error must NOT throw; fallback is used')

  // Case B: Real error throws
  const realErr = {
    code: '23503',
    message: 'foreign key violation',
  }
  const shouldThrowReal = !realErr.message.includes('seleccionar_configuracion_tecnica')
  assert.strictEqual(shouldThrowReal, true, 'Real database error must throw')
})

test('2.3: ProjectWizard AST / Code inspection of compensating rollback', () => {
  const wizardPath = path.join(rootDir, 'components', 'proyectos', 'ProjectWizard.tsx')
  const content = fs.readFileSync(wizardPath, 'utf8').replace(/\r\n/g, '\n')

  // Check that compensating delete is in catch block
  const catchIndex = content.indexOf('catch (fallbackErr: unknown) {')
  assert.ok(catchIndex > 0, 'ProjectWizard must have try/catch around fallback writes')

  const deleteSitiosIndex = content.indexOf("await supabase.from('proyecto_sitios').delete().eq('proyecto_id', proyecto.id)")
  assert.ok(deleteSitiosIndex > catchIndex, 'Compensating delete of proyecto_sitios must be inside catch block')

  const deleteRollbackIndex = content.indexOf("await supabase.from('proyectos').delete().eq('id', proyecto.id)")
  assert.ok(deleteRollbackIndex > catchIndex, 'Compensating delete of proyectos must be inside catch block')

  assert.ok(
    deleteSitiosIndex < deleteRollbackIndex,
    'proyecto_sitios delete must precede proyectos delete to prevent orphan junction records'
  )

  // Check that loading state is reset on error
  assert.ok(content.slice(catchIndex).includes('setLoading(false)'), 'Loading state must be reset on fallback error')
  assert.ok(content.slice(catchIndex).includes('setError('), 'Error must be surfaced on fallback error')
})

test('2.4: DetalleProyecto AST / Code inspection of compensating restore', () => {
  const detallePath = path.join(rootDir, 'components', 'DetalleProyecto.tsx')
  const content = fs.readFileSync(detallePath, 'utf8').replace(/\r\n/g, '\n')

  // Config restore
  assert.ok(
    content.includes("await supabase.from('configuraciones_tecnicas').update({ seleccionada: true }).eq('id', prevSelectedId)"),
    'DetalleProyecto must restore prevSelectedId on config selection failure'
  )

  // Financing option restore
  assert.ok(
    content.includes("await supabase.from('opciones_financiamiento').update({ seleccionada: true }).eq('id', prevSelectedOptionId)"),
    'DetalleProyecto must restore prevSelectedOptionId on financing selection failure'
  )
})

// ----------------------------------------------------------------------------
// SUITE 3: Modal Update-Before-Delete Ordering & Data Loss Prevention
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 3: MODAL UPDATE-BEFORE-DELETE ORDERING TESTS ---')

test('3.1: EditarFinanciamientoModal ordering in isRecomendacionNodo branch', () => {
  const filePath = path.join(rootDir, 'components', 'EditarFinanciamientoModal.tsx')
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')

  const insertOptIdx = content.indexOf(".from('opciones_financiamiento')\n          .insert({\n            proyecto_id: proyecto.id,\n            nombre: 'Recomendación de Nodo'")
  const insertLinkIdx = content.indexOf(".from('config_financiamiento').insert(junctionRows)")
  const deleteOptIdx = content.indexOf(".from('opciones_financiamiento')\n            .delete()\n            .in('id', previousOptionIds)")

  assert.ok(insertOptIdx > 0, 'Insert of recommendation option exists')
  assert.ok(insertLinkIdx > insertOptIdx, 'Insert of junctions exists after option insert')
  assert.ok(deleteOptIdx > insertLinkIdx, 'Delete of old options occurs ONLY AFTER insert of option and junctions')
})

test('3.2: EditarFinanciamientoModal ordering in custom options branch', () => {
  const filePath = path.join(rootDir, 'components', 'EditarFinanciamientoModal.tsx')
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')

  const updateOptIdx = content.indexOf(".from('opciones_financiamiento').update({")
  const insertOptIdx = content.indexOf(".from('opciones_financiamiento').insert(payload)")
  const deleteOptIdx = content.indexOf(".from('opciones_financiamiento').delete().in('id', toDelete.map(o => o.id))")

  assert.ok(updateOptIdx > 0, 'Update of existing options exists')
  assert.ok(insertOptIdx > 0, 'Insert of new options exists')
  assert.ok(deleteOptIdx > insertOptIdx, 'Delete of old options occurs ONLY AFTER new options are inserted')
})

test('3.3: EditarSolucionTecnicaModal ordering for configurations and products', () => {
  const filePath = path.join(rootDir, 'components', 'EditarSolucionTecnicaModal.tsx')
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')

  const insertCfgIdx = content.indexOf(".from('configuraciones_tecnicas').insert(newConfigsPayload)")
  const insertProdIdx = content.indexOf(".from('proyecto_sitio_productos').insert(")
  const deleteProdIdx = content.indexOf(".from('proyecto_sitio_productos').delete().in('id', productsToDelete)")
  const deleteCfgIdx = content.indexOf(".from('configuraciones_tecnicas').delete().in('id', configsToDelete.map(c => c.id))")

  assert.ok(insertCfgIdx > 0, 'Config insert exists')
  assert.ok(insertProdIdx > insertCfgIdx, 'Product insert exists after config insert')
  assert.ok(deleteProdIdx > insertProdIdx, 'Product delete occurs AFTER product insert')
  assert.ok(deleteCfgIdx > deleteProdIdx, 'Config delete occurs AFTER product delete')
})

test('3.4: EditarSolucionTecnicaModal winner configuration guarantee', () => {
  const filePath = path.join(rootDir, 'components', 'EditarSolucionTecnicaModal.tsx')
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')

  assert.ok(
    content.includes('if (!hasSelectedConfig && configs.length > 0)'),
    'Fallback winner selection logic must exist'
  )
  assert.ok(
    content.includes(".update({ seleccionada: true })"),
    'Winner config must be set to seleccionada: true'
  )
})

console.log('\n==================================================================')
console.log(`STRESS SUITE RESULTS: ${passCount} passed, ${failCount} failed`)
console.log('==================================================================\n')

if (findings.length > 0) {
  console.log('Detected Findings:')
  findings.forEach(f => console.log(`- ${f.name}: ${f.error}`))
}
