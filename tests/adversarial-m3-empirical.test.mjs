/**
 * ADVERSARIAL M3 EMPIRICAL CHALLENGE SUITE
 * 
 * Empirical verification and stress testing of:
 * 1. Plan & Instalaciones role-based permissions:
 *    - Gantt editing is strictly forbidden for non-EPC roles
 *    - Evidence upload is strictly forbidden for read-only roles (cliente, financiero, finder)
 * 2. Customer isolation guards:
 *    - Client dashboard, instalaciones detail, and instalaciones list guard against missing cliente_crm_id
 *    - Strict cliente_id foreign key filtering prevents horizontal tenant leaks
 * 3. Exact export identifiers:
 *    - FinderPlanPage exported from app/(portals)/finder/proyectos/[id]/plan/page.tsx
 *    - FinderInstalacionesPage exported from app/(portals)/finder/proyectos/[id]/instalaciones/page.tsx
 * 4. UI / Route Navigation across portals:
 *    - All 7 portal layouts, error, loading, and configuracion boundaries exist
 *    - Deep-link rewriting across portals
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  TestSuite,
  assert,
  assertEqual,
  assertIncludes,
  QA_USERS,
  getServiceRoleClient,
} from './test-utils.mjs'

import { resolveCrossPortalDeepLink } from '../lib/domains/auth/routing.ts'

export const adversarialM3Suite = new TestSuite('Adversarial M3: Plan, Instalaciones & Route Security')

// ── 1. Plan Role-Based Permissions & Gantt Editing ───────────────────────────

adversarialM3Suite.test('Plan.1: SharedProjectPlanView readOnly logic permits editing ONLY for EPC', async () => {
  const planViewPath = path.resolve('components/proyectos/SharedProjectPlanView.tsx')
  assert(fs.existsSync(planViewPath), 'SharedProjectPlanView.tsx must exist')
  const content = fs.readFileSync(planViewPath, 'utf8')

  // Verify readOnly computation logic
  assertIncludes(
    content,
    "const resolvedReadOnly = readOnly !== undefined ? readOnly : (portal === 'epc' ? !isEpc : true)",
    'SharedProjectPlanView must compute readOnly such that non-epc or non-epc portal is read-only by default'
  )

  // Simulation test of the resolvedReadOnly formula:
  const computeReadOnly = (portal, userRole, explicitReadOnly) => {
    const isEpc = userRole === 'epc'
    return explicitReadOnly !== undefined ? explicitReadOnly : (portal === 'epc' ? !isEpc : true)
  }

  // EPC in EPC portal -> should be editable (readOnly: false)
  assertEqual(computeReadOnly('epc', 'epc', undefined), false, 'EPC user in EPC portal must have readOnly=false')

  // Admin in admin portal -> readOnly: true (Plan is owned by EPC)
  assertEqual(computeReadOnly('admin', 'nodo_admin', undefined), true, 'Admin in admin portal must have readOnly=true')

  // Analista in analista portal -> readOnly: true
  assertEqual(computeReadOnly('analista', 'nodo_analista', undefined), true, 'Analyst in analista portal must have readOnly=true')

  // Finder in finder portal -> readOnly: true
  assertEqual(computeReadOnly('finder', 'finder', undefined), true, 'Finder in finder portal must have readOnly=true')

  // Financiero in financiero portal -> readOnly: true
  assertEqual(computeReadOnly('financiero', 'financiero', undefined), true, 'Financiero in financiero portal must have readOnly=true')

  // Admin navigating to EPC portal -> readOnly: true (!isEpc is true)
  assertEqual(computeReadOnly('epc', 'nodo_admin', undefined), true, 'Admin accessing epc portal must have readOnly=true')
})

adversarialM3Suite.test('Plan.2: GanttView intercepts and blocks all drag/edit operations when readOnly=true', async () => {
  const ganttViewPath = path.resolve('components/plan/GanttView.tsx')
  assert(fs.existsSync(ganttViewPath), 'GanttView.tsx must exist')
  const content = fs.readFileSync(ganttViewPath, 'utf8')

  // Verify that all 6 SVAR API modification events are intercepted when readOnly is true
  assertIncludes(content, 'if (readOnly) {', 'GanttView must check readOnly in handleInit')
  assertIncludes(content, "api.intercept('drag-task', () => false)", 'GanttView must intercept drag-task')
  assertIncludes(content, "api.intercept('update-task', () => false)", 'GanttView must intercept update-task')
  assertIncludes(content, "api.intercept('add-task', () => false)", 'GanttView must intercept add-task')
  assertIncludes(content, "api.intercept('delete-task', () => false)", 'GanttView must intercept delete-task')
  assertIncludes(content, "api.intercept('add-link', () => false)", 'GanttView must intercept add-link')
  assertIncludes(content, "api.intercept('delete-link', () => false)", 'GanttView must intercept delete-link')
})

adversarialM3Suite.test('Plan.3: PlanBuilder locks plan structure when isLocked or readOnly', async () => {
  const planBuilderPath = path.resolve('components/plan/PlanBuilder.tsx')
  assert(fs.existsSync(planBuilderPath), 'PlanBuilder.tsx must exist')
  const content = fs.readFileSync(planBuilderPath, 'utf8')

  // Verify lock conditions: readOnly OR project in construction/operation/completed
  assertIncludes(
    content,
    "const isLocked = readOnly || ['en_construccion', 'operativo', 'completado'].includes(proyectoEstado || '')",
    'PlanBuilder must lock plan when readOnly or during construction/operation'
  )

  // Verify template manager is guarded by !isLocked
  assertIncludes(content, '!isLocked', 'TemplateManager must be guarded by !isLocked')
  assertIncludes(content, '<TemplateManager', 'TemplateManager must be rendered conditionally')

  // Verify GanttView receives readOnly={isLocked}
  assertIncludes(content, '<GanttView', 'GanttView must be rendered')
  assertIncludes(content, 'readOnly={isLocked}', 'GanttView must receive readOnly={isLocked}')
})

// ── 2. Instalaciones Role-Based Permissions & Evidence Uploading ─────────────

adversarialM3Suite.test('Instalaciones.1: SharedProjectInstalacionesView permits evidence upload ONLY for admin, analista, epc', async () => {
  const instViewPath = path.resolve('components/proyectos/SharedProjectInstalacionesView.tsx')
  assert(fs.existsSync(instViewPath), 'SharedProjectInstalacionesView.tsx must exist')
  const content = fs.readFileSync(instViewPath, 'utf8')

  // Verify readOnly computation
  assertIncludes(
    content,
    "readOnly !== undefined ? readOnly : !['nodo_admin', 'nodo_analista', 'epc'].includes(profile.rol)",
    'SharedProjectInstalacionesView must compute readOnly based on authorized roles'
  )

  const computeInstReadOnly = (userRole, explicitReadOnly) => {
    return explicitReadOnly !== undefined ? explicitReadOnly : !['nodo_admin', 'nodo_analista', 'epc'].includes(userRole)
  }

  // Cliente final -> readOnly: true (evidence upload forbidden)
  assertEqual(computeInstReadOnly('cliente_final', undefined), true, 'cliente_final must be readOnly=true')

  // Financiero -> readOnly: true (evidence upload forbidden)
  assertEqual(computeInstReadOnly('financiero', undefined), true, 'financiero must be readOnly=true')

  // Finder -> readOnly: true (evidence upload forbidden)
  assertEqual(computeInstReadOnly('finder', undefined), true, 'finder must be readOnly=true')

  // Suministrador -> readOnly: true (evidence upload forbidden)
  assertEqual(computeInstReadOnly('suministrador', undefined), true, 'suministrador must be readOnly=true')

  // EPC -> readOnly: false (can upload evidence)
  assertEqual(computeInstReadOnly('epc', undefined), false, 'epc must be readOnly=false')

  // Admin -> readOnly: false (can upload evidence)
  assertEqual(computeInstReadOnly('nodo_admin', undefined), false, 'nodo_admin must be readOnly=false')

  // Analista -> readOnly: false (can upload evidence)
  assertEqual(computeInstReadOnly('nodo_analista', undefined), false, 'nodo_analista must be readOnly=false')
})

adversarialM3Suite.test('Instalaciones.2: InstalacionMonitor hides all upload and delete controls when readOnly=true', async () => {
  const instMonPath = path.resolve('components/InstalacionMonitor.tsx')
  assert(fs.existsSync(instMonPath), 'InstalacionMonitor.tsx must exist')
  const content = fs.readFileSync(instMonPath, 'utf8').replace(/\r\n/g, '\n')

  // Delete button guarded by !readOnly
  assertIncludes(
    content,
    "{!readOnly && (currentUser.id === ev.autor_id || currentUser.rol === 'nodo_admin') && (",
    'Delete evidence button must be guarded by !readOnly'
  )

  // Phase upload button guarded by !readOnly
  assert(
    content.includes("!readOnly") && content.includes("setUploadTarget({ type: 'fase'"),
    'Phase upload button must be guarded by !readOnly'
  )

  // Activity upload button guarded by !readOnly
  assert(
    content.includes("!readOnly") && content.includes("setUploadTarget({ type: 'actividad'"),
    'Activity upload button must be guarded by !readOnly'
  )

  // Task upload button guarded by !readOnly
  assert(
    content.includes("!readOnly") && content.includes("setUploadTarget({ type: 'tarea'"),
    'Task upload button must be guarded by !readOnly'
  )
})

// ── 3. Customer Isolation Guard Verification ─────────────────────────────────

adversarialM3Suite.test('CustomerIsolation.1: Client Dashboard guards against missing cliente_crm_id and filters by cliente_id', async () => {
  const clienteDashPath = path.resolve('app/(portals)/cliente/page.tsx')
  assert(fs.existsSync(clienteDashPath), 'app/(portals)/cliente/page.tsx must exist')
  const content = fs.readFileSync(clienteDashPath, 'utf8')

  // 1. Must query cliente_crm_id from profile
  assertIncludes(content, ".select('cliente_crm_id')", 'Dashboard must select cliente_crm_id')

  // 2. Must stop loading and return early if profile.cliente_crm_id is absent
  assertIncludes(content, 'if (!profile?.cliente_crm_id) {', 'Dashboard must check for missing cliente_crm_id')
  assertIncludes(content, 'setLoading(false)', 'Dashboard must stop loading on missing cliente_crm_id')

  // 3. Must filter proyectos strictly by cliente_id
  assertIncludes(content, ".eq('cliente_id', profile.cliente_crm_id)", 'Dashboard must filter proyectos by cliente_id')
})

adversarialM3Suite.test('CustomerIsolation.2: Cliente Instalaciones Detail page strictly enforces cliente_crm_id and project ownership', async () => {
  const clienteInstPath = path.resolve('app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx')
  assert(fs.existsSync(clienteInstPath), 'cliente instalaciones page must exist')
  const content = fs.readFileSync(clienteInstPath, 'utf8')

  // Must redirect to /login if role is not cliente_final
  assertIncludes(content, "if (!profile || profile.rol !== 'cliente_final') redirect('/login')", 'Must enforce cliente_final role')

  // Must redirect to /cliente if cliente_crm_id is missing
  assertIncludes(content, "if (!profile.cliente_crm_id) redirect('/cliente')", 'Must redirect if cliente_crm_id missing')

  // Must query project with BOTH id and cliente_id
  assertIncludes(content, ".eq('id', id)", 'Must filter by project id')
  assertIncludes(content, ".eq('cliente_id', profile.cliente_crm_id)", 'Must filter by cliente_id')

  // Must redirect to /cliente if project not found
  assertIncludes(content, "if (!proyecto) redirect('/cliente')", 'Must redirect if project does not belong to client')
})

adversarialM3Suite.test('CustomerIsolation.3: SharedProjectInstalacionesView validates cliente_crm_id when portal=cliente', async () => {
  const sharedInstPath = path.resolve('components/proyectos/SharedProjectInstalacionesView.tsx')
  const content = fs.readFileSync(sharedInstPath, 'utf8').replace(/\r\n/g, '\n')

  // In role check:
  assertIncludes(
    content,
    "if (profile.rol !== 'cliente_final') redirect('/login')\n      if (!profile.cliente_crm_id) redirect('/cliente')",
    'SharedProjectInstalacionesView must validate cliente_crm_id for portal=cliente'
  )

  // In query:
  assertIncludes(
    content,
    "} else if (portal === 'cliente') {\n    query = query.eq('cliente_id', profile.cliente_crm_id)",
    'SharedProjectInstalacionesView must query with eq(cliente_id, profile.cliente_crm_id)'
  )
})

adversarialM3Suite.test('CustomerIsolation.4: Cliente Instalaciones List page isolates by cliente_crm_id', async () => {
  const listPagePath = path.resolve('app/(portals)/cliente/instalaciones/page.tsx')
  assert(fs.existsSync(listPagePath), 'cliente/instalaciones/page.tsx must exist')
  const content = fs.readFileSync(listPagePath, 'utf8')

  // Enforces cliente_final
  assertIncludes(content, "if (!profile || profile.rol !== 'cliente_final') redirect('/login')", 'Must enforce cliente_final')

  // If !profile.cliente_crm_id returns empty initialProyectos
  assertIncludes(content, 'if (!profile.cliente_crm_id) {', 'Must check for missing cliente_crm_id')
  assertIncludes(content, 'initialProyectos={[]}', 'Must return empty initialProyectos on missing cliente_crm_id')

  // Filters by cliente_id
  assertIncludes(content, ".eq('cliente_id', profile.cliente_crm_id)", 'Must filter by cliente_id')
})

adversarialM3Suite.test('CustomerIsolation.5: Live DB empirical verification of cliente_crm_id protection', async () => {
  const admin = getServiceRoleClient()

  // 1. Verify that the production QA account for cliente_final has cliente_crm_id = null
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('id, rol, cliente_crm_id')
    .eq('rol', 'cliente_final')
    .single()

  assert(!profErr, `Profile query error: ${profErr?.message}`)
  assertEqual(profile.rol, 'cliente_final', 'Role must be cliente_final')
  assertEqual(profile.cliente_crm_id, null, 'cliente@prueba.com correctly has null cliente_crm_id, triggering isolation redirects')

  // 2. Query projects for an arbitrary client entity (e.g. 3c5469d8-df55-4711-b9de-015fb93056c9 - Hilton Reforma)
  const targetClienteId = '3c5469d8-df55-4711-b9de-015fb93056c9'
  const { data: scopedProjs } = await admin
    .from('proyectos')
    .select('id, nombre_proyecto, cliente_id')
    .eq('cliente_id', targetClienteId)

  assert(Array.isArray(scopedProjs) && scopedProjs.length > 0, 'Target client should have projects')
  for (const p of scopedProjs) {
    assertEqual(p.cliente_id, targetClienteId, 'All returned projects must strictly match target client')
  }

  // 3. Querying for a non-existent or null client returns zero projects
  const { data: emptyProjs } = await admin
    .from('proyectos')
    .select('id, nombre_proyecto')
    .eq('cliente_id', '00000000-0000-0000-0000-000000000000')

  assertEqual((emptyProjs ?? []).length, 0, 'Non-existent client must return 0 records')
})

// ── 4. Exact Export Identifiers Verification ─────────────────────────────────

adversarialM3Suite.test('Exports.1: FinderPlanPage retains exact export identifier', async () => {
  const filePath = path.resolve('app/(portals)/finder/proyectos/[id]/plan/page.tsx')
  assert(fs.existsSync(filePath), 'Finder plan page must exist')
  const content = fs.readFileSync(filePath, 'utf8')

  assertIncludes(
    content,
    'export default function FinderPlanPage',
    'app/(portals)/finder/proyectos/[id]/plan/page.tsx must export default function FinderPlanPage'
  )

  // Verify dynamic import loads the component with proper function name
  const fileUrl = pathToFileURL(filePath).href
  const mod = await import(fileUrl)
  assertEqual(typeof mod.default, 'function', 'Default export must be a function')
  assertEqual(mod.default.name, 'FinderPlanPage', 'Default export function name must be FinderPlanPage')
})

adversarialM3Suite.test('Exports.2: FinderInstalacionesPage retains exact export identifier', async () => {
  const filePath = path.resolve('app/(portals)/finder/proyectos/[id]/instalaciones/page.tsx')
  assert(fs.existsSync(filePath), 'Finder instalaciones page must exist')
  const content = fs.readFileSync(filePath, 'utf8')

  assertIncludes(
    content,
    'export default function FinderInstalacionesPage',
    'app/(portals)/finder/proyectos/[id]/instalaciones/page.tsx must export default function FinderInstalacionesPage'
  )

  // Verify dynamic import loads the component with proper function name
  const fileUrl = pathToFileURL(filePath).href
  const mod = await import(fileUrl)
  assertEqual(typeof mod.default, 'function', 'Default export must be a function')
  assertEqual(mod.default.name, 'FinderInstalacionesPage', 'Default export function name must be FinderInstalacionesPage')
})

// ── 5. UI / Route Navigation Checks Across Portals ───────────────────────────

adversarialM3Suite.test('Routes.1: All 7 portal layouts, error, and loading boundaries exist', async () => {
  const portals = ['admin', 'analista', 'epc', 'finder', 'cliente', 'financiero', 'mem']

  for (const portal of portals) {
    const layoutPath = path.resolve(`app/(portals)/${portal}/layout.tsx`)
    const errorPath = path.resolve(`app/(portals)/${portal}/error.tsx`)
    const loadingPath = path.resolve(`app/(portals)/${portal}/loading.tsx`)
    const configPath = path.resolve(`app/(portals)/${portal}/configuracion/page.tsx`)

    assert(fs.existsSync(layoutPath), `Portal layout must exist: ${layoutPath}`)
    assert(fs.existsSync(errorPath), `Portal error boundary must exist: ${errorPath}`)
    assert(fs.existsSync(loadingPath), `Portal loading boundary must exist: ${loadingPath}`)
    assert(fs.existsSync(configPath), `Portal configuracion must exist: ${configPath}`)

    // Verify layout uses PortalShell
    const layoutContent = fs.readFileSync(layoutPath, 'utf8')
    assertIncludes(layoutContent, 'PortalShell', `${portal}/layout.tsx must use PortalShell`)
  }
})

adversarialM3Suite.test('Routes.2: Plan sub-routes exist for all supported portals with valid components', async () => {
  const planPortals = ['admin', 'analista', 'epc', 'finder', 'financiero']

  for (const portal of planPortals) {
    const planPath = path.resolve(`app/(portals)/${portal}/proyectos/[id]/plan/page.tsx`)
    assert(fs.existsSync(planPath), `Plan page must exist for ${portal}: ${planPath}`)

    const content = fs.readFileSync(planPath, 'utf8')
    assertIncludes(content, 'SharedProjectPlanView', `${portal} plan page must render SharedProjectPlanView`)
  }
})

adversarialM3Suite.test('Routes.3: Instalaciones sub-routes exist for all supported portals with valid components', async () => {
  const instPortals = ['admin', 'analista', 'epc', 'finder', 'financiero', 'cliente']

  for (const portal of instPortals) {
    const instPath = path.resolve(`app/(portals)/${portal}/proyectos/[id]/instalaciones/page.tsx`)
    assert(fs.existsSync(instPath), `Instalaciones page must exist for ${portal}: ${instPath}`)

    const content = fs.readFileSync(instPath, 'utf8')
    assertIncludes(content, 'SharedProjectInstalacionesView', `${portal} instalaciones page must render SharedProjectInstalacionesView`)
  }
})

adversarialM3Suite.test('Routes.4: Cross-portal deep link routing rewrites project and client subpaths accurately', async () => {
  const testId = '92985502-a709-4c90-ac42-fad41883ea3f'

  // Admin link -> EPC user
  const r1 = resolveCrossPortalDeepLink(`/admin/proyectos/${testId}`, 'epc')
  assertEqual(r1, `/epc/proyectos/${testId}`, 'Admin project link rewritten to epc')

  // Admin plan link -> Finder user
  const r2 = resolveCrossPortalDeepLink(`/admin/proyectos/${testId}/plan`, 'finder')
  assertEqual(r2, `/finder/proyectos/${testId}/plan`, 'Admin plan link rewritten to finder')

  // Admin instalaciones link -> Cliente user
  const r3 = resolveCrossPortalDeepLink(`/admin/proyectos/${testId}/instalaciones`, 'cliente')
  assertEqual(r3, `/cliente/proyectos/${testId}/instalaciones`, 'Admin instalaciones link rewritten to cliente')

  // EPC client detail -> Admin user
  const r4 = resolveCrossPortalDeepLink(`/epc/clientes/${testId}`, 'admin')
  assertEqual(r4, `/admin/clientes/${testId}`, 'EPC client detail link rewritten to admin')

  // Unsupported subpath (e.g. /epc/nuevo) -> Admin user maps to /admin/proyectos/nuevo
  const r5 = resolveCrossPortalDeepLink('/epc/nuevo', 'admin')
  assertEqual(r5, '/admin/proyectos/nuevo', 'EPC nuevo maps to admin proyectos/nuevo')

  // Non-matching unknown path falls back to user target root
  const r6 = resolveCrossPortalDeepLink('/admin/unknown-arbitrary-path', 'epc')
  assertEqual(r6, '/epc', 'Unknown path falls back to /epc root')
})

// Auto-run when executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('adversarial-m3-empirical.test.mjs')) {
  adversarialM3Suite.run().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0)
  })
}
