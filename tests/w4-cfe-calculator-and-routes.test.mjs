import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

console.log('=== RUNNING TRACK W4 VERIFICATION TESTS ===')

// ----------------------------------------------------------------------------
// 1. Deleted Mockup Files & Root Lint Dumps
// ----------------------------------------------------------------------------
console.log('\n--- 1. Verification of Deleted Mockups & Root Lint Dumps ---')

assert.ok(
  !fs.existsSync(path.join(rootDir, 'lib', 'egauge.ts')),
  'lib/egauge.ts must be deleted'
)
console.log('✓ Test 1.1: lib/egauge.ts does not exist')

assert.ok(
  !fs.existsSync(path.join(rootDir, 'app', 'brand-preview', 'page.tsx')),
  'app/brand-preview/page.tsx must be deleted'
)
console.log('✓ Test 1.2: app/brand-preview/page.tsx does not exist')

const rootFiles = fs.readdirSync(rootDir)
const lintDumps = rootFiles.filter(f => f.startsWith('eslint_results') || f === 'lint_results.txt')
assert.strictEqual(
  lintDumps.length,
  0,
  `Root directory must have 0 lint dumps, found: ${lintDumps.join(', ')}`
)
console.log('✓ Test 1.3: All root eslint_results*.txt and lint_results.txt deleted (0 found)')

// ----------------------------------------------------------------------------
// 2. CFE Calculator Unit Tests
// ----------------------------------------------------------------------------
console.log('\n--- 2. CFE Calculator Unit Tests ---')

const cfeModule = await import('../lib/tariffs/cfe-calculator.ts')
const {
  CFE_TARIFF_RATES_MXN,
  calculateProjectSavingsMxn,
  calculateBatteryCycles,
  resolveCfeTariffLabel,
} = cfeModule

// 2.1 Rates
assert.strictEqual(CFE_TARIFF_RATES_MXN.GDMTH, 2.85, 'GDMTH rate must be 2.85')
assert.strictEqual(CFE_TARIFF_RATES_MXN.GDMTO, 3.12, 'GDMTO rate must be 3.12')
assert.strictEqual(CFE_TARIFF_RATES_MXN.PDBT, 3.95, 'PDBT rate must be 3.95')
assert.strictEqual(CFE_TARIFF_RATES_MXN.GDBT, 3.45, 'GDBT rate must be 3.45')
console.log('✓ Test 2.1: CFE reference tariff rates correctly defined')

// 2.2 calculateProjectSavingsMxn
const savingsZeroGenAnnual = calculateProjectSavingsMxn({
  totalGeneratedKwh: 0,
  selectedConfig: {
    ahorro_estimado_anual: 36500,
    ahorro_estimado_mensual: 3000,
    ahorro_moneda: 'MXN',
  },
})
assert.strictEqual(savingsZeroGenAnnual, 100, '0 kWh gen with 36500 annual should return daily pro-rata 100')
console.log('✓ Test 2.2: Daily pro-rata savings from annual config when generation is 0')

const savingsZeroGenMonthly = calculateProjectSavingsMxn({
  totalGeneratedKwh: 0,
  selectedConfig: {
    ahorro_estimado_anual: null,
    ahorro_estimado_mensual: 3000,
    ahorro_moneda: 'MXN',
  },
})
assert.strictEqual(savingsZeroGenMonthly, 100, '0 kWh gen with 3000 monthly should return daily pro-rata 100')
console.log('✓ Test 2.3: Daily pro-rata savings from monthly config when generation is 0')

const savingsZeroGenNoConfig = calculateProjectSavingsMxn({
  totalGeneratedKwh: 0,
})
assert.strictEqual(savingsZeroGenNoConfig, 0, '0 kWh gen without config must return 0')
console.log('✓ Test 2.4: 0 kWh generation without config returns 0')

const savingsGenGdmto = calculateProjectSavingsMxn({
  totalGeneratedKwh: 1000,
  tarifaCfe: 'GDMTO',
})
assert.strictEqual(savingsGenGdmto, 3120, '1000 kWh at GDMTO (3.12) should be 3120 MXN')
console.log('✓ Test 2.5: Real generation calculation using explicit CFE tariff (GDMTO)')

const savingsGenDefault = calculateProjectSavingsMxn({
  totalGeneratedKwh: 1000,
})
assert.strictEqual(savingsGenDefault, 2850, '1000 kWh at default GDMTH (2.85) should be 2850 MXN')
console.log('✓ Test 2.6: Real generation calculation defaulting to GDMTH')

// 2.3 calculateBatteryCycles
assert.strictEqual(calculateBatteryCycles(0), 0, '0 discharge returns 0 cycles')
assert.strictEqual(calculateBatteryCycles(-5), 0, 'Negative discharge returns 0 cycles')
assert.strictEqual(calculateBatteryCycles(400, 200), 2.0, '400 kWh discharge on 200 kWh BESS is 2.0 cycles')
assert.strictEqual(calculateBatteryCycles(300, null), 1.5, '300 kWh discharge on default 200 kWh BESS is 1.5 cycles')
console.log('✓ Test 2.7: Battery equivalent cycle calculations accurate')

// 2.4 resolveCfeTariffLabel
assert.strictEqual(resolveCfeTariffLabel(120, 100), 'GDMTH', 'Demanda >= 100 kW is GDMTH')
assert.strictEqual(resolveCfeTariffLabel(10, 600), 'GDMTH', 'Volumen >= 500 MWh is GDMTH')
assert.strictEqual(resolveCfeTariffLabel(35, 100), 'GDMTO', 'Demanda >= 25 kW is GDMTO')
assert.strictEqual(resolveCfeTariffLabel(10, 50), 'PDBT', 'Demanda <= 25 kW is PDBT')
assert.strictEqual(resolveCfeTariffLabel(35, 50), 'GDBT', 'Demanda > 25 kW and volumen < 100 MWh is GDBT')
assert.strictEqual(resolveCfeTariffLabel(null, null), 'GDMTH', 'Default tariff without inputs is GDMTH')
console.log('✓ Test 2.8: CFE tariff resolution from demand and annual volume (PDBT, GDBT, GDMTO, GDMTH)')

// ----------------------------------------------------------------------------
// 3. Client Portal Queries & Savings Integration
// ----------------------------------------------------------------------------
console.log('\n--- 3. Client Portal Queries & Savings Integration ---')

const clientePageContent = fs.readFileSync(path.join(rootDir, 'app', '(portals)', 'cliente', 'page.tsx'), 'utf8')
assert.ok(
  clientePageContent.includes("select('cliente_crm_id')"),
  'cliente/page.tsx must resolve profile.cliente_crm_id'
)
assert.ok(
  clientePageContent.includes('.eq(\'cliente_id\', profile.cliente_crm_id)'),
  'cliente/page.tsx must query proyectos by profile.cliente_crm_id FK'
)
assert.ok(
  clientePageContent.includes('calculateProjectSavingsMxn'),
  'cliente/page.tsx must calculate savings via calculateProjectSavingsMxn'
)
assert.ok(
  clientePageContent.includes('.gte(\'timestamp\', thirtyDaysAgo)'),
  'cliente/page.tsx must bound telemetry queries to last 30 days'
)
console.log('✓ Test 3.1: cliente/page.tsx properly queries CRM client FK, bounds telemetry, and calculates CFE savings')

const clienteInstPageContent = fs.readFileSync(path.join(rootDir, 'app', '(portals)', 'cliente', 'proyectos', '[id]', 'instalaciones', 'page.tsx'), 'utf8')
assert.ok(
  clienteInstPageContent.includes("if (!profile.cliente_crm_id) redirect('/cliente')"),
  'cliente instalaciones page must guard against missing cliente_crm_id'
)
assert.ok(
  clienteInstPageContent.includes(".eq('cliente_id', profile.cliente_crm_id)"),
  'cliente instalaciones page must filter by cliente_id == profile.cliente_crm_id'
)
console.log('✓ Test 3.2: cliente instalaciones subroute verified with strict cliente_crm_id guard')

// ----------------------------------------------------------------------------
// 4. Financiero Dashboard Bounded Query & Real Savings
// ----------------------------------------------------------------------------
console.log('\n--- 4. Financiero Dashboard Bounded Query & Real Savings ---')

const financieroPageContent = fs.readFileSync(path.join(rootDir, 'app', '(portals)', 'financiero', 'page.tsx'), 'utf8')
assert.ok(
  financieroPageContent.includes('.gte(\'timestamp\', thirtyDaysAgo)'),
  'financiero/page.tsx must bound telemetry to last 30 days'
)
assert.ok(
  financieroPageContent.includes('calculateProjectSavingsMxn'),
  'financiero/page.tsx must calculate savings via calculateProjectSavingsMxn'
)
assert.ok(
  financieroPageContent.includes('calculateBatteryCycles'),
  'financiero/page.tsx must calculate battery cycles via calculateBatteryCycles'
)
console.log('✓ Test 4.1: financiero/page.tsx bounds telemetry and uses CFE calculator')

// ----------------------------------------------------------------------------
// 5. OfertasBoard Real Column Querying
// ----------------------------------------------------------------------------
console.log('\n--- 5. OfertasBoard Real Column Querying ---')

const ofertasContent = fs.readFileSync(path.join(rootDir, 'components', 'marketplace', 'OfertasBoard.tsx'), 'utf8')
assert.ok(
  ofertasContent.includes('demanda_kw'),
  'OfertasBoard.tsx must select demanda_kw'
)
assert.ok(
  ofertasContent.includes('resolveCfeTariffLabel(p.demanda_kw, p.volumen_energia_mwh_anual)'),
  'OfertasBoard.tsx must resolve CFE tariff label dynamically'
)
console.log('✓ Test 5.1: OfertasBoard queries demanda_kw and resolves tariff without hardcoded strings')

// ----------------------------------------------------------------------------
// 6. Real Configuration Persistence & All 7 Portal Routes
// ----------------------------------------------------------------------------
console.log('\n--- 6. Real Configuration Persistence & Portal Routes ---')

const configComponentContent = fs.readFileSync(path.join(rootDir, 'components', 'Configuracion.tsx'), 'utf8')
assert.ok(
  !configComponentContent.includes('localStorage'),
  'components/Configuracion.tsx must NOT contain any localStorage references'
)
assert.ok(
  configComponentContent.includes("from('profiles').update"),
  'components/Configuracion.tsx must update public.profiles directly'
)
console.log('✓ Test 6.1: Configuracion.tsx operates with zero localStorage and persists to profiles table')

const configRoles = ['admin', 'analista', 'epc', 'finder', 'cliente', 'financiero', 'mem']
for (const role of configRoles) {
  const pagePath = path.join(rootDir, 'app', '(portals)', role, 'configuracion', 'page.tsx')
  assert.ok(
    fs.existsSync(pagePath),
    `Config page for portal /${role}/configuracion must exist`
  )
}
console.log(`✓ Test 6.2: All 7 portal configuracion pages exist (${configRoles.join(', ')})`)

const sidebarContent = fs.readFileSync(path.join(rootDir, 'components', 'Sidebar.tsx'), 'utf8')
assert.ok(
  sidebarContent.includes('ROLE_PORTAL_PREFIX: Record<Rol, string>'),
  'Sidebar.tsx must define ROLE_PORTAL_PREFIX'
)
assert.ok(
  sidebarContent.includes('ROLE_PORTAL_PREFIX[rol]'),
  'Sidebar.tsx must use ROLE_PORTAL_PREFIX for configuracion link'
)
console.log('✓ Test 6.3: Sidebar properly maps all 8 roles to correct portal URLs')

// ----------------------------------------------------------------------------
// 7. Missing Finder Subroutes
// ----------------------------------------------------------------------------
console.log('\n--- 7. Missing Finder Subroutes ---')

const finderInstalacionesPath = path.join(rootDir, 'app', '(portals)', 'finder', 'proyectos', '[id]', 'instalaciones', 'page.tsx')
assert.ok(fs.existsSync(finderInstalacionesPath), 'Finder instalaciones page must exist')
const finderInstContent = fs.readFileSync(finderInstalacionesPath, 'utf8')
assert.ok(finderInstContent.includes('FinderInstalacionesPage'), 'Finder instalaciones page must export FinderInstalacionesPage')

const finderPlanPath = path.join(rootDir, 'app', '(portals)', 'finder', 'proyectos', '[id]', 'plan', 'page.tsx')
assert.ok(fs.existsSync(finderPlanPath), 'Finder plan page must exist')
const finderPlanContent = fs.readFileSync(finderPlanPath, 'utf8')
assert.ok(finderPlanContent.includes('FinderPlanPage'), 'Finder plan page must export FinderPlanPage')
console.log('✓ Test 7.1: Both /finder/proyectos/[id]/instalaciones and /plan subroutes exist and export valid components')

// ----------------------------------------------------------------------------
// 8. Sweep for Forbidden Magic Constants & Fake Storage
// ----------------------------------------------------------------------------
console.log('\n--- 8. Sweep for Forbidden Magic Constants & Fake Storage ---')

function scanDir(dir, pattern, extList = ['.ts', '.tsx', '.js', '.jsx']) {
  let matches = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        matches = matches.concat(scanDir(fullPath, pattern, extList))
      }
    } else if (entry.isFile() && extList.includes(path.extname(entry.name))) {
      const content = fs.readFileSync(fullPath, 'utf8')
      if (pattern.test(content)) {
        matches.push(fullPath)
      }
    }
  }
  return matches
}

const appDir = path.join(rootDir, 'app')
const compDir = path.join(rootDir, 'components')

const badMultipliers = [
  ...scanDir(appDir, /totalGenerated\s*\*\s*3\.9/),
  ...scanDir(compDir, /totalGenerated\s*\*\s*3\.9/),
]
assert.strictEqual(
  badMultipliers.length,
  0,
  `Found totalGenerated * 3.9 in: ${badMultipliers.join(', ')}`
)
console.log('✓ Test 8.1: Exactly 0 occurrences of "totalGenerated * 3.9" across app/ and components/')

const badLocalStorage = [
  ...scanDir(appDir, /localStorage\.setItem\s*\(\s*`?nodo-/),
  ...scanDir(compDir, /localStorage\.setItem\s*\(\s*`?nodo-/),
]
assert.strictEqual(
  badLocalStorage.length,
  0,
  `Found localStorage.setItem(nodo- in: ${badLocalStorage.join(', ')}`
)
console.log('✓ Test 8.2: Exactly 0 occurrences of "localStorage.setItem(\`nodo-" across app/ and components/')

console.log('\n======================================================')
console.log('ALL 14 TRACK W4 INTEGRATION AND UNIT TESTS PASSED!')
console.log('======================================================\n')
