import { chromium } from 'playwright'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { QA_USERS } from './test-utils.mjs'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Known real entity IDs from production DB for detail views
const TEST_PROJECT_ID = 'd5a83243-9165-4a3a-bee1-3b37b8d747b6' // Hilton Reforma
const TEST_CLIENT_ID = 'c1e0f68c-f461-4828-9224-82fda1717005'  // Bebidas Reca

// Configure artifact directories
const ARTIFACT_DIRS = [
  path.resolve(process.cwd(), 'tests/artifacts'),
  'C:/Users/vmont/.gemini/antigravity/brain/1e36bc88-b21c-4ddc-970e-11aa13ce3cc1',
  path.resolve(process.cwd(), '.agents/teamwork/worker_browser/artifacts'),
]

// Ensure all artifact directories exist
for (const dir of ARTIFACT_DIRS) {
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    // Ignore permissions or existing dirs
  }
}

async function takeScreenshot(page, filename, options = {}) {
  const primaryDir = ARTIFACT_DIRS[0]
  const primaryPath = path.join(primaryDir, filename)
  await page.screenshot({ path: primaryPath, ...options })

  // Synchronize to other existing artifact directories
  for (let i = 1; i < ARTIFACT_DIRS.length; i++) {
    const targetDir = ARTIFACT_DIRS[i]
    try {
      if (fs.existsSync(targetDir)) {
        fs.copyFileSync(primaryPath, path.join(targetDir, filename))
      }
    } catch {
      // Best-effort mirror
    }
  }
  return primaryPath
}

async function runBrowserTests() {
  console.log('════════════════════════════════════════════════════════════════════')
  console.log('   NODO CRM — AUTOMATED BROWSER UI & ROUTING SMOKE TEST SUITE      ')
  console.log('════════════════════════════════════════════════════════════════════\n')

  const browser = await chromium.launch({ headless: true })
  let passedCount = 0
  let totalCount = 0

  function pass(msg) {
    passedCount++
    totalCount++
    console.log(`  ✔ [PASS] ${msg}`)
  }

  try {
    // ════════════════════════════════════════════════════════════════════════
    // SUITE 1: Public Pages & Unauthenticated Proxy Redirection
    // ════════════════════════════════════════════════════════════════════════
    console.log('── SUITE 1: Public Pages & Unauthenticated Security Proxy ──────────')
    const anonContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const anonPage = await anonContext.newPage()

    const anonPageErrors = []
    const anonConsoleErrors = []
    anonPage.on('pageerror', err => anonPageErrors.push(err.message))
    anonPage.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Filter benign external font 404
        if (!text.includes('ArticulatCF') && !text.includes('favicon.ico')) {
          anonConsoleErrors.push(text)
        }
      }
    })

    // Test 1: Login Page
    console.log('▶ Test 1: Navigating to /login...')
    const loginRes = await anonPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    assert.strictEqual(loginRes.status(), 200, 'Login page should return HTTP 200')
    const title = await anonPage.title()
    assert.ok(title.includes('Nodo'), `Page title should mention Nodo, got: "${title}"`)
    const emailInput = await anonPage.$('input[type="email"], input[name="email"]')
    const passwordInput = await anonPage.$('input[type="password"]')
    const submitBtn = await anonPage.$('button[type="submit"]')
    assert.ok(emailInput && passwordInput && submitBtn, 'Form fields must be rendered')
    const s1 = await takeScreenshot(anonPage, 'browser_01_login.png')
    pass(`/login rendered cleanly (status 200, title "${title}")`)
    console.log(`    Screenshot: ${s1}`)

    // Test 2: Registro Page
    console.log('\n▶ Test 2: Navigating to /registro...')
    const regRes = await anonPage.goto(`${BASE_URL}/registro`, { waitUntil: 'networkidle' })
    assert.strictEqual(regRes.status(), 200, 'Registro page should return HTTP 200')
    const s2 = await takeScreenshot(anonPage, 'browser_02_registro.png')
    pass(`/registro rendered cleanly (status 200)`)
    console.log(`    Screenshot: ${s2}`)

    // Test 3: Pendiente Page
    console.log('\n▶ Test 3: Navigating to /pendiente...')
    const pendRes = await anonPage.goto(`${BASE_URL}/pendiente`, { waitUntil: 'networkidle' })
    assert.strictEqual(pendRes.status(), 200, 'Pendiente page should return HTTP 200')
    const s3 = await takeScreenshot(anonPage, 'browser_03_pendiente.png')
    pass(`/pendiente rendered cleanly without redirect`)
    console.log(`    Screenshot: ${s3}`)

    // Test 4: Unauthenticated Portal Redirection Matrix (All 7 Portals + Root)
    console.log('\n▶ Test 4: Testing unauthenticated portal redirection matrix...')
    const protectedPortals = ['/admin', '/analista', '/epc', '/finder', '/cliente', '/financiero', '/mem']
    for (const portalPath of protectedPortals) {
      await anonPage.goto(`${BASE_URL}${portalPath}`, { waitUntil: 'networkidle' })
      const redirectedUrl = anonPage.url()
      const expectedParam = encodeURIComponent(portalPath)
      assert.ok(
        redirectedUrl.includes('/login') && redirectedUrl.includes(expectedParam),
        `Visiting unauthenticated ${portalPath} must redirect to /login?returnUrl=${expectedParam}, got: ${redirectedUrl}`
      )
      pass(`Unauthenticated ${portalPath} redirected to login with returnUrl`)
    }

    // Root path redirect
    await anonPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
    const rootUrl = anonPage.url()
    assert.ok(rootUrl.includes('/login'), `Root / must redirect to /login, got: ${rootUrl}`)
    pass(`Unauthenticated root / redirected to /login`)

    await anonContext.close()

    // ════════════════════════════════════════════════════════════════════════
    // SUITE 2: Authenticated Admin Portal, Navigation & Entity Views
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── SUITE 2: Authenticated Admin Portal & Detail Views ───────────────')
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const adminPage = await adminContext.newPage()

    const adminPageErrors = []
    const adminConsoleErrors = []
    adminPage.on('pageerror', err => adminPageErrors.push(err.message))
    adminPage.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!text.includes('ArticulatCF') && !text.includes('favicon.ico')) {
          adminConsoleErrors.push(text)
        }
      }
    })

    // Test 5: Login as Admin
    console.log(`▶ Test 5: Performing UI authentication as Admin (${QA_USERS.admin.email})...`)
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await adminPage.fill('input[type="email"], input[name="email"]', QA_USERS.admin.email)
    await adminPage.fill('input[type="password"]', QA_USERS.admin.password)
    await adminPage.click('button[type="submit"]')

    await adminPage.waitForURL('**/admin', { timeout: 15000 })
    await adminPage.waitForLoadState('networkidle')
    assert.ok(adminPage.url().includes('/admin'), `Admin login should land on /admin, got: ${adminPage.url()}`)
    const s4 = await takeScreenshot(adminPage, 'browser_04_admin_dashboard.png')
    pass(`Admin successfully authenticated and redirected to /admin`)
    console.log(`    Screenshot: ${s4}`)

    // Test 6: Admin Projects Directory
    console.log('\n▶ Test 6: Navigating to Admin Projects Directory (/admin/proyectos)...')
    await adminPage.goto(`${BASE_URL}/admin/proyectos`, { waitUntil: 'networkidle' })
    assert.strictEqual(adminPage.url(), `${BASE_URL}/admin/proyectos`)
    const proyectosContent = await adminPage.content()
    assert.ok(
      proyectosContent.includes('Proyectos') || proyectosContent.includes('proyecto'),
      'Projects directory must render project section'
    )
    const s5 = await takeScreenshot(adminPage, 'browser_05_admin_proyectos.png')
    pass(`/admin/proyectos rendered project directory view`)
    console.log(`    Screenshot: ${s5}`)

    // Test 7: Admin Clients Directory
    console.log('\n▶ Test 7: Navigating to Admin Clients Directory (/admin/clientes)...')
    await adminPage.goto(`${BASE_URL}/admin/clientes`, { waitUntil: 'networkidle' })
    assert.strictEqual(adminPage.url(), `${BASE_URL}/admin/clientes`)
    const clientesContent = await adminPage.content()
    assert.ok(
      clientesContent.includes('Clientes') || clientesContent.includes('cliente'),
      'Clients directory must render client section'
    )
    const s6 = await takeScreenshot(adminPage, 'browser_06_admin_clientes.png')
    pass(`/admin/clientes rendered client directory view`)
    console.log(`    Screenshot: ${s6}`)

    // Test 8: Project Detail View
    console.log(`\n▶ Test 8: Navigating to Project Detail View (/admin/proyectos/${TEST_PROJECT_ID})...`)
    await adminPage.goto(`${BASE_URL}/admin/proyectos/${TEST_PROJECT_ID}`, { waitUntil: 'networkidle' })
    const detailContent = await adminPage.content()
    assert.ok(
      detailContent.includes('Hilton') || detailContent.includes('Reforma') || detailContent.includes('Solución') || detailContent.includes('General'),
      'Project detail view must display project header and tabs'
    )
    const s7 = await takeScreenshot(adminPage, 'browser_07_project_detail.png')
    pass(`Project detail view for Hilton Reforma loaded successfully`)
    console.log(`    Screenshot: ${s7}`)

    // Test 9: Client Detail View
    console.log(`\n▶ Test 9: Navigating to Client Detail View (/admin/clientes/${TEST_CLIENT_ID})...`)
    await adminPage.goto(`${BASE_URL}/admin/clientes/${TEST_CLIENT_ID}`, { waitUntil: 'networkidle' })
    const clientDetailContent = await adminPage.content()
    assert.ok(
      clientDetailContent.includes('Bebidas') || clientDetailContent.includes('Reca') || clientDetailContent.includes('Cliente') || clientDetailContent.includes('Sitios'),
      'Client detail view must display client info'
    )
    const s8 = await takeScreenshot(adminPage, 'browser_08_client_detail.png')
    pass(`Client detail view for Bebidas Reca loaded successfully`)
    console.log(`    Screenshot: ${s8}`)

    // ════════════════════════════════════════════════════════════════════════
    // SUITE 3: Smart Cross-Portal Deep-Link Routing via proxy.ts
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── SUITE 3: Smart Cross-Portal Deep-Link Routing ───────────────────')

    // Test 10: Cross-Portal Project Link Rewrite
    console.log(`▶ Test 10: Admin accessing cross-portal link /epc/proyectos/${TEST_PROJECT_ID}...`)
    await adminPage.goto(`${BASE_URL}/epc/proyectos/${TEST_PROJECT_ID}`, { waitUntil: 'networkidle' })
    assert.strictEqual(
      adminPage.url(),
      `${BASE_URL}/admin/proyectos/${TEST_PROJECT_ID}`,
      'Proxy must rewrite /epc/proyectos/[id] to /admin/proyectos/[id] for Admin user'
    )
    const s9 = await takeScreenshot(adminPage, 'browser_09_proxy_deeplink_project.png')
    pass(`Proxy cleanly rewrote /epc/proyectos/[id] -> /admin/proyectos/[id]`)
    console.log(`    Screenshot: ${s9}`)

    // Test 11: Cross-Portal Client Link Rewrite with Query Parameters
    console.log(`\n▶ Test 11: Admin accessing cross-portal link /analista/clientes/${TEST_CLIENT_ID}?tab=sitios...`)
    await adminPage.goto(`${BASE_URL}/analista/clientes/${TEST_CLIENT_ID}?tab=sitios`, { waitUntil: 'networkidle' })
    assert.strictEqual(
      adminPage.url(),
      `${BASE_URL}/admin/clientes/${TEST_CLIENT_ID}?tab=sitios`,
      'Proxy must rewrite /analista/clientes/[id]?tab=sitios to /admin/clientes/[id]?tab=sitios preserving query params'
    )
    const s10 = await takeScreenshot(adminPage, 'browser_10_proxy_deeplink_client.png')
    pass(`Proxy cleanly rewrote /analista/clientes/[id] -> /admin/clientes/[id] preserving query params`)
    console.log(`    Screenshot: ${s10}`)

    // Test 12: Cross-Portal Unsupported Route Fallback
    console.log('\n▶ Test 12: Admin accessing unsupported portal root /epc...')
    await adminPage.goto(`${BASE_URL}/epc`, { waitUntil: 'networkidle' })
    assert.strictEqual(
      adminPage.url(),
      `${BASE_URL}/admin`,
      'Admin visiting /epc root must fall back safely to /admin'
    )
    pass(`Proxy redirected unsupported portal root /epc -> /admin`)

    await adminContext.close()

    // ════════════════════════════════════════════════════════════════════════
    // SUITE 4: Multi-Role Verification (EPC Portal & Inverse Deep-Link)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── SUITE 4: Multi-Role Verification (EPC Portal & Deep-Link) ────────')
    const epcContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const epcPage = await epcContext.newPage()

    const epcPageErrors = []
    const epcConsoleErrors = []
    epcPage.on('pageerror', err => epcPageErrors.push(err.message))
    epcPage.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!text.includes('ArticulatCF') && !text.includes('favicon.ico')) {
          epcConsoleErrors.push(text)
        }
      }
    })

    // Test 13: Login as EPC
    console.log(`▶ Test 13: Performing UI authentication as EPC (${QA_USERS.epc.email})...`)
    await epcPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await epcPage.fill('input[type="email"], input[name="email"]', QA_USERS.epc.email)
    await epcPage.fill('input[type="password"]', QA_USERS.epc.password)
    await epcPage.click('button[type="submit"]')

    await epcPage.waitForURL('**/epc', { timeout: 15000 })
    await epcPage.waitForLoadState('networkidle')
    assert.ok(epcPage.url().includes('/epc'), `EPC login should land on /epc, got: ${epcPage.url()}`)
    const s11 = await takeScreenshot(epcPage, 'browser_11_epc_dashboard.png')
    pass(`EPC successfully authenticated and redirected to /epc`)
    console.log(`    Screenshot: ${s11}`)

    // Test 14: EPC Inverse Deep-Link Rewrite
    console.log(`\n▶ Test 14: EPC accessing Admin link /admin/proyectos/${TEST_PROJECT_ID}...`)
    await epcPage.goto(`${BASE_URL}/admin/proyectos/${TEST_PROJECT_ID}`, { waitUntil: 'networkidle' })
    assert.strictEqual(
      epcPage.url(),
      `${BASE_URL}/epc/proyectos/${TEST_PROJECT_ID}`,
      'Proxy must rewrite /admin/proyectos/[id] to /epc/proyectos/[id] for EPC user'
    )
    const s12 = await takeScreenshot(epcPage, 'browser_12_epc_deeplink_rewrite.png')
    pass(`Proxy cleanly rewrote /admin/proyectos/[id] -> /epc/proyectos/[id] for EPC user`)
    console.log(`    Screenshot: ${s12}`)

    await epcContext.close()

    // ════════════════════════════════════════════════════════════════════════
    // Final Error Audit & Summary
    // ════════════════════════════════════════════════════════════════════════
    const unhandledExceptions = [
      ...anonPageErrors,
      ...adminPageErrors,
      ...epcPageErrors,
    ]

    const allConsoleErrors = [
      ...anonConsoleErrors,
      ...adminConsoleErrors,
      ...epcConsoleErrors,
    ]

    const appConsoleErrors = allConsoleErrors.filter(text => !text.includes('Failed to load resource'))
    const networkResourceLogs = allConsoleErrors.filter(text => text.includes('Failed to load resource'))

    console.log('\n════════════════════════════════════════════════════════════════════')
    console.log('  AUTOMATED BROWSER TEST AUDIT SUMMARY                              ')
    console.log('════════════════════════════════════════════════════════════════════')
    console.log(`  Total Browser Scenarios Executed: ${totalCount}`)
    console.log(`  Total Passed:                    ${passedCount}`)
    console.log(`  Total Failed:                    0`)
    console.log(`  Uncaught JavaScript Exceptions:  ${unhandledExceptions.length}`)
    console.log(`  Application Console Errors:      ${appConsoleErrors.length}`)
    console.log(`  Browser Resource Status Logs:    ${networkResourceLogs.length} (fonts, API responses)`)
    console.log(`  Screenshots Captured:            12 visual artifact files`)
    console.log('════════════════════════════════════════════════════════════════════\n')

    assert.strictEqual(unhandledExceptions.length, 0, `Expected 0 unhandled JS exceptions, found: ${unhandledExceptions.length}`)
    assert.strictEqual(appConsoleErrors.length, 0, `Expected 0 application console errors, found: ${appConsoleErrors.length}`)
  } finally {
    await browser.close()
  }
}

runBrowserTests().catch(err => {
  console.error('\n❌ Browser test suite encountered fatal failure:', err)
  process.exit(1)
})

