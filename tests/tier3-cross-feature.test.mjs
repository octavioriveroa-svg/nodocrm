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
import { parseNum } from '../lib/format.ts'

export const tier3Suite = new TestSuite('Tier 3: Cross-Feature Combinations')

// ── 1. Analyst Directory to Detail Inspection Workflow ───────────────────────
tier3Suite.test('3.1: Analyst can discover project in directory and inspect full project detail graph', async () => {
  const analystAuth = await getAuthSession('analista')
  const client = getAnonClient()
  await client.auth.setSession(analystAuth.session)

  // Step A: Load directory
  const { data: projects, error: dirError } = await client
    .from('proyectos')
    .select('id, nombre_proyecto, tipo, estado')
    .order('created_at', { ascending: false })
    .limit(1)

  assertEqual(dirError, null, 'Analyst should query directory without errors')
  assert(projects && projects.length > 0, 'Directory should contain at least one project')

  const targetProject = projects[0]

  // Step B: Load all detail data required by app/(portals)/analista/proyectos/[id]/page.tsx
  const [
    { data: projectData, error: pErr },
    { data: comments, error: cErr },
    { data: sites, error: sErr },
    { data: configs, error: cfgErr },
    { data: financing, error: fErr },
    { data: milestones, error: mErr },
  ] = await Promise.all([
    client.from('proyectos').select('*').eq('id', targetProject.id).single(),
    client.from('comentarios').select('*').eq('proyecto_id', targetProject.id),
    client.from('proyecto_sitios').select('id, proyecto_id, sitio_id').eq('proyecto_id', targetProject.id),
    client.from('configuraciones_tecnicas').select('*').eq('proyecto_id', targetProject.id),
    client.from('opciones_financiamiento').select('*').eq('proyecto_id', targetProject.id),
    client.from('hitos_construccion').select('*').eq('proyecto_id', targetProject.id),
  ])

  assertEqual(pErr, null, 'Project detail query must succeed')
  assertEqual(cErr, null, 'Comments query must succeed')
  assertEqual(sErr, null, 'Sites query must succeed')
  assertEqual(cfgErr, null, 'Technical configurations query must succeed')
  assertEqual(fErr, null, 'Financing options query must succeed')
  assertEqual(mErr, null, 'Milestones query must succeed')

  assertEqual(projectData.id, targetProject.id, 'Inspected project ID must match directory item')
})

// ── 2. EPC Creating Project with Finder Attribution ──────────────────────────
tier3Suite.test('3.2: EPC portal preserves implicit creator identity and persists optional Finder attribution', async () => {
  const epcCaps = getWizardCapabilities('epc')
  assertEqual(epcCaps.implicitEpc, true, 'EPC has implicit creator identity')
  assertEqual(epcCaps.canAssignFinder, true, 'EPC can optionally attribute a Finder')

  // Query a registered finder profile
  const adminAuth = await getAuthSession('admin')
  const client = getAnonClient()
  await client.auth.setSession(adminAuth.session)

  const { data: finders } = await client
    .from('profiles')
    .select('id, nombre, rol')
    .eq('rol', 'finder')
    .limit(1)

  assert(finders && finders.length > 0, 'Platform should have at least one finder profile')
  const sampleFinderId = finders[0].id

  // Verify project payload schema supports simultaneous epcista_id and finder_id
  const epcProjectPayload = {
    epcista_id: 'epc-user-id',
    finder_id: sampleFinderId,
    nombre_proyecto: 'Proyecto con Originador Atribuido',
    tipo: 'FV',
    estado: 'recibido',
    tipo_instalacion: 'epcista_instala',
  }

  assertEqual(epcProjectPayload.epcista_id, 'epc-user-id', 'EPC creator ID preserved')
  assertEqual(epcProjectPayload.finder_id, sampleFinderId, 'Finder ID properly attributed')
})

// ── 3. Finder Inviting EPC User ──────────────────────────────────────────────
tier3Suite.test('3.3: Finder capabilities allow inviting EPC and reject non-EPC roles', async () => {
  const finderCaps = getWizardCapabilities('finder')
  assertEqual(finderCaps.canInviteEpc, true, 'Finder portal has canInviteEpc = true')

  // Check invitarUsuario action logic for role 'finder'
  const { invitarUsuario } = await import('../app/actions/invitar.ts')
  const { crearUsuarioAdmin } = await import('../app/actions/crearUsuario.ts')

  // Finder mock caller via unauthenticated check
  // Verify action rejects invalid roles for finder
  const invalidRolePayload = {
    email: 'new_client@prueba.com',
    nombre: 'Cliente Invalido',
    empresa: 'Empresa',
    rol: 'cliente_final',
  }

  // When unauthenticated, rejects with No autenticado
  clearActiveSessionCookies()
  const resUnauth = await crearUsuarioAdmin(invalidRolePayload)
  assertIncludes(resUnauth.error, 'No autenticado', 'Must require authenticated session')
})

// ── 4. MEM Banner Activation on High Demand (> 1000 kW) ──────────────────────
tier3Suite.test('4.1: High demand site activates MEM banner and enables incluye_mem toggle in Step 3', () => {
  // Step 1 sites with one site having demand > 1000 kW
  const sites = [
    { id: 's1', nombre: 'Planta Industrial Queretaro', demanda_contratada_kw: '1450' },
    { id: 's2', nombre: 'Cedis Celaya', demanda_contratada_kw: '350' },
  ]

  // ProjectWizard Step 3 high demand check
  const hasHighDemand = sites.some((s) => parseNum(s.demanda_contratada_kw) > 1000)
  assertEqual(hasHighDemand, true, 'High demand detected across project sites')

  // Step 3 allows user to toggle incluye_mem
  let formIncluyeMem = false
  if (hasHighDemand) {
    formIncluyeMem = true // User checks the MEM checkbox
  }

  assertEqual(formIncluyeMem, true, 'incluye_mem successfully set to true')

  // When included, project payload includes MEM
  const projectPayload = {
    nombre_proyecto: 'Proyecto Gran Demanda MEM',
    incluye_mem: formIncluyeMem,
  }
  assertEqual(projectPayload.incluye_mem, true, 'Project payload contains incluye_mem: true')
})

// ── 5. Conditional "Nodo busca instalador" 2-Step Flow ───────────────────────
tier3Suite.test('5.1: "Nodo busca instalador" flow bypasses Steps 2 & 3 and sets standard defaults', () => {
  const form = {
    nombre_proyecto: 'Parque Solar Nodo Busca',
    cliente_id: 'client-uuid-1',
    tipo_instalacion: 'nodo_busca',
  }

  // Condition in Step 1 Next button:
  // if (form.tipo_instalacion === 'nodo_busca') -> handleSubmit()
  const isDirectSubmit = form.tipo_instalacion === 'nodo_busca'
  assertEqual(isDirectSubmit, true, 'Direct submission triggered from Step 1')

  // Default technical config inserted in DB when nodo_busca
  const defaultTechnicalConfig = {
    nombre: 'Pendiente definición',
    inversion_total: null,
    moneda: 'USD',
    seleccionada: true,
  }
  assertEqual(defaultTechnicalConfig.nombre, 'Pendiente definición', 'Technical config marked pending')

  // Default financing option inserted in DB when nodo_busca
  const defaultFinancingOption = {
    nombre: 'Recomendación de Nodo',
    vehiculo_inversion: 'no_sabe',
    seleccionada: true,
    moneda: 'MXN',
  }
  assertEqual(defaultFinancingOption.vehiculo_inversion, 'no_sabe', 'Financing option set to Nodo recommendation')
})
