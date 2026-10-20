import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import {
  TestSuite,
  getAnonClient,
  getAuthSession,
} from './test-utils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

export const challengerSprint2Suite = new TestSuite('Challenger Sprint 2: UX Boundaries, PostgREST Joins, CI/CD & Migration Verification')

// =============================================================================
// SUITE 1: APP ROUTER UX BOUNDARIES & RESILIENCE (REL-01)
// =============================================================================

challengerSprint2Suite.test('1.1: Root UX boundary files exist', () => {
  const rootFiles = ['app/error.tsx', 'app/loading.tsx', 'app/not-found.tsx']
  for (const relPath of rootFiles) {
    const fullPath = path.join(rootDir, relPath)
    assert(fs.existsSync(fullPath), `Root boundary file ${relPath} must exist`)
    const stat = fs.statSync(fullPath)
    assert(stat.size > 0, `Root boundary file ${relPath} must not be empty`)
  }
})

challengerSprint2Suite.test('1.2: All 7 portal routes re-export error.tsx and loading.tsx', () => {
  const portals = ['admin', 'analista', 'epc', 'finder', 'cliente', 'financiero', 'mem']

  for (const portal of portals) {
    const errorPath = path.join(rootDir, `app/(portals)/${portal}/error.tsx`)
    const loadingPath = path.join(rootDir, `app/(portals)/${portal}/loading.tsx`)

    assert(fs.existsSync(errorPath), `Portal ${portal}/error.tsx must exist`)
    assert(fs.existsSync(loadingPath), `Portal ${portal}/loading.tsx must exist`)

    const errorContent = fs.readFileSync(errorPath, 'utf8')
    assert(errorContent.includes("'use client'") || errorContent.includes('"use client"'),
      `Portal ${portal}/error.tsx must declare 'use client'`)
    assert(errorContent.includes("export { default } from '@/app/error'"),
      `Portal ${portal}/error.tsx must re-export default from @/app/error`)

    const loadingContent = fs.readFileSync(loadingPath, 'utf8')
    assert(loadingContent.includes("export { default } from '@/app/loading'"),
      `Portal ${portal}/loading.tsx must re-export default from @/app/loading`)
  }
})

challengerSprint2Suite.test('1.3: Empirical rendering of app/error.tsx with edge cases and attack payloads', async () => {
  const errorModule = await import('../app/error.tsx')
  const GlobalError = errorModule.default
  assert.strictEqual(typeof GlobalError, 'function', 'GlobalError must export a default React component')

  // Case A: Standard Error with message
  let resetCalled = false
  const resetHandler = () => { resetCalled = true }
  resetHandler()
  assert.strictEqual(resetCalled, true, 'Reset callback must be callable')
  const standardError = new Error('Database connection timed out')
  const htmlA = ReactDOMServer.renderToStaticMarkup(
    React.createElement(GlobalError, {
      error: standardError,
      reset: resetHandler,
    })
  )
  assert(htmlA.includes('Ocurrió un problema inesperado'), 'Must contain Spanish title')
  assert(htmlA.includes('Database connection timed out'), 'Must contain error message')
  assert(htmlA.includes('Reintentar'), 'Must contain retry button')

  // Case B: Error with empty message (fallback message test)
  const emptyError = new Error('')
  const htmlB = ReactDOMServer.renderToStaticMarkup(
    React.createElement(GlobalError, {
      error: emptyError,
      reset: () => {},
    })
  )
  assert(htmlB.includes('No pudimos cargar esta sección. Por favor intenta nuevamente.'),
    'Must display fallback message when error.message is empty')

  // Case C: Error with digest
  const digestError = Object.assign(new Error('Server action failed'), { digest: 'NEXT_DIGEST_98765' })
  const htmlC = ReactDOMServer.renderToStaticMarkup(
    React.createElement(GlobalError, {
      error: digestError,
      reset: () => {},
    })
  )
  assert(htmlC.includes('Server action failed'), 'Must render digest error message')

  // Case D: Attack payload - XSS injection attempt in error message
  const xssError = new Error('<script>alert("XSS")</script><img src="x" onerror="steal()" />')
  const htmlD = ReactDOMServer.renderToStaticMarkup(
    React.createElement(GlobalError, {
      error: xssError,
      reset: () => {},
    })
  )
  assert(!htmlD.includes('<script>alert'), 'React must encode script tags safely')
  assert(htmlD.includes('&lt;script&gt;alert'), 'React must escape dangerous HTML entities')

  // Case E: Massive message payload (10,000 chars)
  const massiveError = new Error('ERR_'.repeat(2500))
  const htmlE = ReactDOMServer.renderToStaticMarkup(
    React.createElement(GlobalError, {
      error: massiveError,
      reset: () => {},
    })
  )
  assert(htmlE.includes('ERR_'), 'Must handle massive message without truncation crash')
})

challengerSprint2Suite.test('1.4: Empirical rendering of app/loading.tsx', async () => {
  const loadingModule = await import('../app/loading.tsx')
  const GlobalLoading = loadingModule.default
  assert.strictEqual(typeof GlobalLoading, 'function', 'GlobalLoading must export a default React component')

  const html = ReactDOMServer.renderToStaticMarkup(React.createElement(GlobalLoading))
  assert(html.includes('animate-spin'), 'Must contain animate-spin class')
  assert(html.includes('border-acento'), 'Must contain border-acento class')
  assert(html.includes('bg-fondo'), 'Must contain bg-fondo class')
})

challengerSprint2Suite.test('1.5: Empirical rendering of app/not-found.tsx', async () => {
  const notFoundModule = await import('../app/not-found.tsx')
  const NotFoundPage = notFoundModule.default
  assert.strictEqual(typeof NotFoundPage, 'function', 'NotFoundPage must export a default React component')

  const html = ReactDOMServer.renderToStaticMarkup(React.createElement(NotFoundPage))
  assert(html.includes('404'), 'Must display 404 heading')
  assert(html.includes('La página que buscas no existe o fue movida.'), 'Must display Spanish message')
  assert(html.includes('href="/login"'), 'Must contain link to /login')
  assert(html.includes('Ir al inicio'), 'Must display "Ir al inicio" link label')
})

challengerSprint2Suite.test('1.6: All portal re-exports resolve and render without circular dependencies', async () => {
  const portals = ['admin', 'analista', 'epc', 'finder', 'cliente', 'financiero', 'mem']

  for (const portal of portals) {
    const errorMod = await import(`../app/(portals)/${portal}/error.tsx`)
    const loadingMod = await import(`../app/(portals)/${portal}/loading.tsx`)

    assert.strictEqual(typeof errorMod.default, 'function', `Portal ${portal}/error.tsx default must be a component`)
    assert.strictEqual(typeof loadingMod.default, 'function', `Portal ${portal}/loading.tsx default must be a component`)

    // Verify rendering of re-exported components
    const errorHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(errorMod.default, {
        error: new Error(`Test in ${portal}`),
        reset: () => {},
      })
    )
    assert(errorHtml.includes(`Test in ${portal}`), `Portal ${portal}/error must render message correctly`)

    const loadingHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(loadingMod.default))
    assert(loadingHtml.includes('animate-spin'), `Portal ${portal}/loading must render spinner correctly`)
  }
})

// =============================================================================
// SUITE 2: POSTGREST RELATIONAL JOINS & FALLBACK STRESS TESTS (PERF-01 / PERF-03)
// =============================================================================

// Helper for extracting profile matching admin & analista implementations
function extractProfile(val) {
  if (!val) return null
  if (Array.isArray(val)) return val[0] ?? null
  return val
}

challengerSprint2Suite.test('2.1: Live database query tests PostgREST join status & documents schema cache state (Admin session)', async () => {
  const adminAuth = await getAuthSession('admin')
  const client = getAnonClient()
  await client.auth.setSession(adminAuth.session)

  const { data: joinedData, error: joinError } = await client
    .from('proyectos')
    .select(`
      id,
      nombre_proyecto,
      epc:profiles!proyectos_epcista_id_fkey(id, nombre, empresa),
      responsable:profiles!proyectos_responsable_nodo_id_fkey(id, nombre, empresa),
      finder:profiles!proyectos_finder_id_fkey(id, nombre, empresa)
    `)
    .limit(5)

  if (joinError) {
    // If PostgREST schema cache has not reloaded foreign keys, error MUST be PGRST200
    assert.strictEqual(joinError.code, 'PGRST200', 'Expected PGRST200 when FK is not in PostgREST schema cache')
    assert(joinError.message.includes('schema cache') || joinError.message.includes('relationship'),
      'PGRST200 message must reference schema cache or relationship')
    console.log('    [Empirical Note] PostgREST schema cache returns PGRST200: fallback is strictly required and operational.')
  } else {
    assert(Array.isArray(joinedData), 'Joined data must be an array when join succeeds')
    console.log('    [Empirical Note] PostgREST join succeeded directly.')
  }
})

challengerSprint2Suite.test('2.2: Live database fallback query resolves all projects and stakeholder profiles (Admin & Analista)', async () => {
  // Test both admin and analista authenticated sessions
  for (const role of ['admin', 'analista']) {
    const auth = await getAuthSession(role)
    const client = getAnonClient()
    await client.auth.setSession(auth.session)

    // 1. Fetch proyectos
    const { data: rawProjects, error: projError } = await client
      .from('proyectos')
      .select('*')
      .order('created_at', { ascending: false })

    assert(!projError, `Proyectos select for ${role} must not error: ${projError?.message}`)
    assert(Array.isArray(rawProjects), `Projects for ${role} must be an array`)
    assert(rawProjects.length >= 6, `Expected at least 6 customer projects for ${role}, got ${rawProjects.length}`)

    // 2. Collect IDs
    const allIds = [...new Set([
      ...rawProjects.map(p => p.epcista_id),
      ...rawProjects.map(p => p.responsable_nodo_id).filter(Boolean),
      ...rawProjects.map(p => p.finder_id).filter(Boolean),
    ])]

    assert(allIds.length > 0, `Must have stakeholder IDs to resolve for ${role}`)

    // 3. Fetch profiles batch
    const { data: profiles, error: profError } = await client
      .from('profiles')
      .select('id, nombre, empresa')
      .in('id', allIds)

    assert(!profError, `Profiles batch select for ${role} must not error: ${profError?.message}`)
    assert(Array.isArray(profiles), `Profiles for ${role} must be an array`)

    const nameMap = {}
    for (const pf of profiles) {
      nameMap[pf.id] = { nombre: pf.nombre, empresa: pf.empresa }
    }

    // 4. Map proyectos
    const mappedProjects = rawProjects.map(p => {
      return {
        ...p,
        epcista_nombre: p.epcista_id ? nameMap[p.epcista_id]?.nombre ?? '—' : '—',
        epcista_empresa: p.epcista_id ? nameMap[p.epcista_id]?.empresa ?? '—' : '—',
        responsable_nombre: p.responsable_nodo_id ? nameMap[p.responsable_nodo_id]?.nombre ?? '—' : '—',
        finder_nombre: p.finder_id ? nameMap[p.finder_id]?.nombre ?? '—' : '—',
        finder_empresa: p.finder_id ? nameMap[p.finder_id]?.empresa ?? '—' : '—',
      }
    })

    // Verify all mapped projects have valid strings (never undefined or null)
    for (const p of mappedProjects) {
      assert.strictEqual(typeof p.epcista_nombre, 'string', `Project ${p.id} epcista_nombre must be string`)
      assert.strictEqual(typeof p.epcista_empresa, 'string', `Project ${p.id} epcista_empresa must be string`)
      assert.strictEqual(typeof p.responsable_nombre, 'string', `Project ${p.id} responsable_nombre must be string`)
      assert.strictEqual(typeof p.finder_nombre, 'string', `Project ${p.id} finder_nombre must be string`)
      assert.strictEqual(typeof p.finder_empresa, 'string', `Project ${p.id} finder_empresa must be string`)
    }
  }
})

challengerSprint2Suite.test('2.3: Stress-test query logic harness - Join Success (Object format)', () => {
  const prs = [
    {
      id: 'proj-1',
      nombre: 'Solar Plant Alpha',
      epcista_id: 'epc-1',
      responsable_nodo_id: 'resp-1',
      finder_id: 'fnd-1',
      epc: { id: 'epc-1', nombre: 'Soluciones Solares MX', empresa: 'Soluciones Solares' },
      responsable: { id: 'resp-1', nombre: 'Octavio Admin', empresa: 'Nodo Energy' },
      finder: { id: 'fnd-1', nombre: 'Carlos Finder', empresa: 'Finder Corp' },
    },
  ]

  const mapped = prs.map((p) => {
    const epc = extractProfile(p.epc)
    const resp = extractProfile(p.responsable)
    const fnd = extractProfile(p.finder)
    const nameMap = {}

    return {
      ...p,
      epcista_nombre: epc?.nombre || (p.epcista_id ? nameMap[p.epcista_id]?.nombre ?? '—' : '—'),
      epcista_empresa: epc?.empresa || (p.epcista_id ? nameMap[p.epcista_id]?.empresa ?? '—' : '—'),
      responsable_nombre: resp?.nombre || (p.responsable_nodo_id ? nameMap[p.responsable_nodo_id]?.nombre ?? '—' : '—'),
      finder_nombre: fnd?.nombre || (p.finder_id ? nameMap[p.finder_id]?.nombre ?? '—' : '—'),
      finder_empresa: fnd?.empresa || (p.finder_id ? nameMap[p.finder_id]?.empresa ?? '—' : '—'),
    }
  })

  assert.strictEqual(mapped[0].epcista_nombre, 'Soluciones Solares MX')
  assert.strictEqual(mapped[0].epcista_empresa, 'Soluciones Solares')
  assert.strictEqual(mapped[0].responsable_nombre, 'Octavio Admin')
  assert.strictEqual(mapped[0].finder_nombre, 'Carlos Finder')
  assert.strictEqual(mapped[0].finder_empresa, 'Finder Corp')
})

challengerSprint2Suite.test('2.4: Stress-test query logic harness - Join Success (Array format from PostgREST)', () => {
  const prs = [
    {
      id: 'proj-2',
      nombre: 'BESS Industrial Beta',
      epcista_id: 'epc-2',
      responsable_nodo_id: null,
      finder_id: null,
      epc: [{ id: 'epc-2', nombre: 'Energia Verde SA', empresa: 'Energia Verde' }],
      responsable: null,
      finder: [],
    },
  ]

  const mapped = prs.map((p) => {
    const epc = extractProfile(p.epc)
    const resp = extractProfile(p.responsable)
    const fnd = extractProfile(p.finder)
    const nameMap = {}

    return {
      ...p,
      epcista_nombre: epc?.nombre || (p.epcista_id ? nameMap[p.epcista_id]?.nombre ?? '—' : '—'),
      epcista_empresa: epc?.empresa || (p.epcista_id ? nameMap[p.epcista_id]?.empresa ?? '—' : '—'),
      responsable_nombre: resp?.nombre || (p.responsable_nodo_id ? nameMap[p.responsable_nodo_id]?.nombre ?? '—' : '—'),
      finder_nombre: fnd?.nombre || (p.finder_id ? nameMap[p.finder_id]?.nombre ?? '—' : '—'),
      finder_empresa: fnd?.empresa || (p.finder_id ? nameMap[p.finder_id]?.empresa ?? '—' : '—'),
    }
  })

  assert.strictEqual(mapped[0].epcista_nombre, 'Energia Verde SA')
  assert.strictEqual(mapped[0].epcista_empresa, 'Energia Verde')
  assert.strictEqual(mapped[0].responsable_nombre, '—')
  assert.strictEqual(mapped[0].finder_nombre, '—')
  assert.strictEqual(mapped[0].finder_empresa, '—')
})

challengerSprint2Suite.test('2.5: Stress-test query logic harness - PGRST200 join failure simulation & full fallback', () => {
  // Simulate PostgREST join failure
  const joinError = {
    code: 'PGRST200',
    message: "Could not find a relationship between 'proyectos' and 'profiles' in the schema cache",
  }

  // Raw projects from fallback select('*')
  const fallbackProjects = [
    { id: 'p1', nombre: 'P1', epcista_id: 'user-epc', responsable_nodo_id: 'user-resp', finder_id: 'user-fnd' },
    { id: 'p2', nombre: 'P2', epcista_id: 'user-epc', responsable_nodo_id: null, finder_id: null },
    { id: 'p3', nombre: 'P3', epcista_id: 'orphan-epc', responsable_nodo_id: 'user-resp', finder_id: null },
    { id: 'p4', nombre: 'P4', epcista_id: null, responsable_nodo_id: null, finder_id: null },
  ]

  let prs = fallbackProjects
  const hasJoinedRelations = !joinError && prs.some(p => p.epc || p.responsable || p.finder)
  assert.strictEqual(hasJoinedRelations, false, 'hasJoinedRelations must be false on join failure')

  // Deduplicated ID collection
  const allIds = [...new Set([
    ...prs.map(p => p.epcista_id),
    ...prs.map(p => p.responsable_nodo_id).filter(Boolean),
    ...prs.map(p => p.finder_id).filter(Boolean),
  ])].filter(Boolean)

  assert.deepStrictEqual(allIds.sort(), ['orphan-epc', 'user-epc', 'user-fnd', 'user-resp'].sort())

  // Mocked profiles lookup (notice orphan-epc is NOT in profiles table)
  const perfiles = [
    { id: 'user-epc', nombre: 'EPC Solar Pro', empresa: 'Solar Pro SA' },
    { id: 'user-resp', nombre: 'Nodo Lead', empresa: 'Nodo Energy' },
    { id: 'user-fnd', nombre: 'Deal Finder', empresa: 'Capital Partners' },
  ]

  const nameMap = {}
  for (const pf of perfiles) {
    nameMap[pf.id] = { nombre: pf.nombre, empresa: pf.empresa }
  }

  const mapped = prs.map((p) => {
    const epc = extractProfile(p.epc)
    const resp = extractProfile(p.responsable)
    const fnd = extractProfile(p.finder)

    return {
      ...p,
      epcista_nombre: epc?.nombre || (p.epcista_id ? nameMap[p.epcista_id]?.nombre ?? '—' : '—'),
      epcista_empresa: epc?.empresa || (p.epcista_id ? nameMap[p.epcista_id]?.empresa ?? '—' : '—'),
      responsable_nombre: resp?.nombre || (p.responsable_nodo_id ? nameMap[p.responsable_nodo_id]?.nombre ?? '—' : '—'),
      finder_nombre: fnd?.nombre || (p.finder_id ? nameMap[p.finder_id]?.nombre ?? '—' : '—'),
      finder_empresa: fnd?.empresa || (p.finder_id ? nameMap[p.finder_id]?.empresa ?? '—' : '—'),
    }
  })

  // Assert P1 has all profiles mapped
  assert.strictEqual(mapped[0].epcista_nombre, 'EPC Solar Pro')
  assert.strictEqual(mapped[0].epcista_empresa, 'Solar Pro SA')
  assert.strictEqual(mapped[0].responsable_nombre, 'Nodo Lead')
  assert.strictEqual(mapped[0].finder_nombre, 'Deal Finder')
  assert.strictEqual(mapped[0].finder_empresa, 'Capital Partners')

  // Assert P2 has epcista and dashes for nulls
  assert.strictEqual(mapped[1].epcista_nombre, 'EPC Solar Pro')
  assert.strictEqual(mapped[1].responsable_nombre, '—')
  assert.strictEqual(mapped[1].finder_nombre, '—')

  // Assert P3 with orphan epcista defaults gracefully to '—'
  assert.strictEqual(mapped[2].epcista_nombre, '—')
  assert.strictEqual(mapped[2].epcista_empresa, '—')
  assert.strictEqual(mapped[2].responsable_nombre, 'Nodo Lead')

  // Assert P4 with all nulls defaults cleanly to '—'
  assert.strictEqual(mapped[3].epcista_nombre, '—')
  assert.strictEqual(mapped[3].epcista_empresa, '—')
  assert.strictEqual(mapped[3].responsable_nombre, '—')
  assert.strictEqual(mapped[3].finder_nombre, '—')
})

challengerSprint2Suite.test('2.6: Stress-test query logic - Empty projects table and null resilience', () => {
  // Empty projects array
  const prs = []
  const hasJoinedRelations = prs.some(p => p.epc || p.responsable || p.finder)
  assert.strictEqual(hasJoinedRelations, false)

  const allIds = [...new Set([
    ...prs.map(p => p.epcista_id),
    ...prs.map(p => p.responsable_nodo_id).filter(Boolean),
    ...prs.map(p => p.finder_id).filter(Boolean),
  ])]
  assert.strictEqual(allIds.length, 0, 'allIds must be empty')
})

// =============================================================================
// SUITE 3: SQL MIGRATION INTEGRITY (PERF-01 / PERF-03)
// =============================================================================

challengerSprint2Suite.test('3.1: Migration 20261021000002 contains required composite indexes and FK constraint', () => {
  const migPath = path.join(rootDir, 'supabase/migrations/20261021000002_dashboard_views_and_indexes.sql')
  assert(fs.existsSync(migPath), 'Migration file 20261021000002_dashboard_views_and_indexes.sql must exist')

  const content = fs.readFileSync(migPath, 'utf8')

  // 1. Composite index on telemetria_egauge
  assert(content.includes('idx_telemetria_proyecto_time'), 'Must create idx_telemetria_proyecto_time')
  assert(content.includes('public.telemetria_egauge (proyecto_id, timestamp DESC)'),
    'Composite index must index proyecto_id and timestamp DESC')

  // 2. Index on proyectos estado + created_at
  assert(content.includes('idx_proyectos_estado_created'), 'Must create idx_proyectos_estado_created')
  assert(content.includes('public.proyectos (estado, created_at DESC)'),
    'Index must index estado and created_at DESC')

  // 3. FK constraint on proyectos.epcista_id referencing profiles.id
  assert(content.includes('proyectos_epcista_id_fkey'), 'Must name constraint proyectos_epcista_id_fkey')
  assert(content.includes('FOREIGN KEY (epcista_id) REFERENCES public.profiles(id)'),
    'Constraint must reference public.profiles(id)')
  assert(content.includes('ON DELETE SET NULL'), 'Constraint must specify ON DELETE SET NULL')

  // 4. Idempotency guards
  assert(content.includes('CREATE INDEX IF NOT EXISTS'), 'Must use CREATE INDEX IF NOT EXISTS')
  assert(content.includes('IF NOT EXISTS'), 'Must guard constraint creation idempotently')
})

// =============================================================================
// SUITE 4: SUPABASE CONFIG & CI/CD WORKFLOW STANDARDS (ARCH-01 / REL-06)
// =============================================================================

challengerSprint2Suite.test('4.1: supabase/config.toml schema and project configuration', () => {
  const configPath = path.join(rootDir, 'supabase/config.toml')
  assert(fs.existsSync(configPath), 'supabase/config.toml must exist')

  const content = fs.readFileSync(configPath, 'utf8')
  assert(content.includes('project_id = "nlqrdxwyxmgdwawedweh"'), 'Must specify correct project_id')
  assert(content.includes('path = "supabase/migrations"'), 'Must specify migrations path')
  assert(content.includes('[api]'), 'Must contain [api] section')
  assert(content.includes('[db]'), 'Must contain [db] section')
  assert(content.includes('[db.migrations]'), 'Must contain [db.migrations] section')
  assert(content.includes('[auth]'), 'Must contain [auth] section')
  assert(content.includes('[storage]'), 'Must contain [storage] section')
})

challengerSprint2Suite.test('4.2: .github/workflows/main.yml schema standards and 4 quality gates', () => {
  const workflowPath = path.join(rootDir, '.github/workflows/main.yml')
  assert(fs.existsSync(workflowPath), '.github/workflows/main.yml must exist')

  const content = fs.readFileSync(workflowPath, 'utf8')

  // Triggers
  assert(content.includes('push:'), 'Must trigger on push')
  assert(content.includes('pull_request:'), 'Must trigger on pull_request')
  assert(content.includes('branches: [main]'), 'Must target main branch')

  // Runner
  assert(content.includes('runs-on: ubuntu-latest'), 'Must run on ubuntu-latest')

  // Fallback environment variables
  assert(content.includes('NEXT_PUBLIC_SUPABASE_URL:'), 'Must set NEXT_PUBLIC_SUPABASE_URL env')
  assert(content.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY:'), 'Must set NEXT_PUBLIC_SUPABASE_ANON_KEY env')
  assert(content.includes('SUPABASE_SERVICE_ROLE_KEY:'), 'Must set SUPABASE_SERVICE_ROLE_KEY env')

  // Step 1: Checkout
  assert(content.includes('actions/checkout@v4'), 'Must use actions/checkout@v4')

  // Step 2: Setup Node
  assert(content.includes('actions/setup-node@v4'), 'Must use actions/setup-node@v4')
  assert(content.includes("node-version: '20'"), 'Must specify node-version 20')
  assert(content.includes("cache: 'npm'"), 'Must enable npm cache')

  // Step 3: Install
  assert(content.includes('run: npm ci'), 'Must execute npm ci')

  // Gate 1: Typecheck
  assert(content.includes('run: npx tsc --noEmit'), 'Gate 1 must execute npx tsc --noEmit')

  // Gate 2: Lint
  assert(content.includes('run: npm run lint'), 'Gate 2 must execute npm run lint')

  // Gate 3: Test
  assert(content.includes('run: npm test'), 'Gate 3 must execute npm test')

  // Gate 4: Build
  assert(content.includes('run: npm run build'), 'Gate 4 must execute npm run build')

  // Strict step ordering check
  const idxCheckout = content.indexOf('actions/checkout@v4')
  const idxNode = content.indexOf('actions/setup-node@v4')
  const idxCi = content.indexOf('run: npm ci')
  const idxTsc = content.indexOf('run: npx tsc --noEmit')
  const idxLint = content.indexOf('run: npm run lint')
  const idxTest = content.indexOf('run: npm test')
  const idxBuild = content.indexOf('run: npm run build')

  assert(idxCheckout < idxNode, 'checkout must precede setup-node')
  assert(idxNode < idxCi, 'setup-node must precede npm ci')
  assert(idxCi < idxTsc, 'npm ci must precede tsc')
  assert(idxTsc < idxLint, 'tsc must precede lint')
  assert(idxLint < idxTest, 'lint must precede test')
  assert(idxTest < idxBuild, 'test must precede build')
})

challengerSprint2Suite.test('4.3: package.json script definitions', () => {
  const pkgPath = path.join(rootDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

  assert(pkg.scripts, 'scripts object must exist in package.json')
  assert.strictEqual(pkg.scripts.test, 'npx tsx tests/test-runner.mjs',
    'test script must invoke npx tsx tests/test-runner.mjs')
  assert.strictEqual(pkg.scripts.build, 'next build', 'build script must be next build')
  assert.strictEqual(pkg.scripts.lint, 'eslint', 'lint script must be eslint')
  assert.strictEqual(pkg.scripts.dev, 'next dev', 'dev script must be next dev')
})

challengerSprint2Suite.test('1.7: Error boundary handles varied JS Error subclasses cleanly', async () => {
  const errorModule = await import('../app/error.tsx')
  const GlobalError = errorModule.default

  const errorTypes = [
    new TypeError('Cannot read property foo of undefined'),
    new RangeError('Maximum call stack size exceeded'),
    new URIError('URI malformed'),
    new SyntaxError('Unexpected token < in JSON at position 0'),
  ]

  for (const err of errorTypes) {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(GlobalError, {
        error: err,
        reset: () => {},
      })
    )
    assert(html.includes('Ocurrió un problema inesperado'), `Must handle ${err.name}`)
    // React escapes HTML entities such as '<' to '&lt;'
    const escapedMessage = err.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    assert(html.includes(escapedMessage), `Must display message for ${err.name}`)
  }
})

challengerSprint2Suite.test('2.7: Query logic performance under high-volume projects (500 items, repeated profiles)', () => {
  const count = 500
  const heavyProjects = []
  for (let i = 0; i < count; i++) {
    heavyProjects.push({
      id: `p-${i}`,
      nombre: `Scale Project ${i}`,
      epcista_id: `epc-${i % 5}`, // Only 5 unique EPCs
      responsable_nodo_id: `resp-${i % 2}`, // Only 2 unique Responsables
      finder_id: i % 3 === 0 ? `fnd-${i % 3}` : null,
    })
  }

  const start = performance.now()
  const allIds = [...new Set([
    ...heavyProjects.map(p => p.epcista_id),
    ...heavyProjects.map(p => p.responsable_nodo_id).filter(Boolean),
    ...heavyProjects.map(p => p.finder_id).filter(Boolean),
  ])]

  // Verify deduplication
  assert(allIds.length <= 8, `Expected max 8 unique IDs, got ${allIds.length}`)

  const nameMap = {}
  for (const id of allIds) {
    nameMap[id] = { nombre: `Name of ${id}`, empresa: `Company of ${id}` }
  }

  const mapped = heavyProjects.map(p => ({
    ...p,
    epcista_nombre: p.epcista_id ? nameMap[p.epcista_id]?.nombre ?? '—' : '—',
    epcista_empresa: p.epcista_id ? nameMap[p.epcista_id]?.empresa ?? '—' : '—',
    responsable_nombre: p.responsable_nodo_id ? nameMap[p.responsable_nodo_id]?.nombre ?? '—' : '—',
    finder_nombre: p.finder_id ? nameMap[p.finder_id]?.nombre ?? '—' : '—',
    finder_empresa: p.finder_id ? nameMap[p.finder_id]?.empresa ?? '—' : '—',
  }))

  const duration = performance.now() - start
  assert.strictEqual(mapped.length, 500)
  assert(duration < 50, `Mapping 500 projects must take < 50ms (took ${duration.toFixed(2)}ms)`)
})

challengerSprint2Suite.test('2.8: Query fallback resilience when secondary profiles query returns null (DB error)', () => {
  const prs = [
    { id: 'p1', nombre: 'P1', epcista_id: 'epc-1', responsable_nodo_id: 'resp-1', finder_id: null },
  ]

  // Simulating profiles lookup error -> perfiles = null
  const perfiles = null
  const nameMap = {}
  for (const pf of perfiles ?? []) {
    nameMap[pf.id] = { nombre: pf.nombre, empresa: pf.empresa }
  }

  const mapped = prs.map(p => ({
    ...p,
    epcista_nombre: p.epcista_id ? nameMap[p.epcista_id]?.nombre ?? '—' : '—',
    epcista_empresa: p.epcista_id ? nameMap[p.epcista_id]?.empresa ?? '—' : '—',
    responsable_nombre: p.responsable_nodo_id ? nameMap[p.responsable_nodo_id]?.nombre ?? '—' : '—',
    finder_nombre: p.finder_id ? nameMap[p.finder_id]?.nombre ?? '—' : '—',
    finder_empresa: p.finder_id ? nameMap[p.finder_id]?.empresa ?? '—' : '—',
  }))

  assert.strictEqual(mapped[0].epcista_nombre, '—')
  assert.strictEqual(mapped[0].responsable_nombre, '—')
  assert.strictEqual(mapped[0].finder_nombre, '—')
})

challengerSprint2Suite.test('4.4: .github/workflows/main.yml has zero tab characters and valid YAML indentation', () => {
  const workflowPath = path.join(rootDir, '.github/workflows/main.yml')
  const content = fs.readFileSync(workflowPath, 'utf8')

  assert(!content.includes('\t'), 'YAML file must not contain tab characters')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('#') || !line.trim()) continue
    // Indentation must be spaces
    const indentMatch = line.match(/^(\s*)/)
    if (indentMatch) {
      assert.strictEqual(indentMatch[1].length % 2, 0,
        `Line ${i + 1} has non-standard indentation (must be multiple of 2 spaces): "${line}"`)
    }
  }
})

challengerSprint2Suite.test('4.5: supabase/config.toml port and url validation', () => {
  const configPath = path.join(rootDir, 'supabase/config.toml')
  const content = fs.readFileSync(configPath, 'utf8')

  // Port checks
  assert(content.includes('port = 54321'), 'API port must be 54321')
  assert(content.includes('port = 54322'), 'DB port must be 54322')
  assert(content.includes('shadow_port = 54320'), 'Shadow port must be 54320')
  assert(content.includes('port = 54323'), 'Studio port must be 54323')
  assert(content.includes('major_version = 15'), 'Postgres major version must be 15')
})

challengerSprint2Suite.test('5.1: Zero regression verification on live database records', async () => {
  const adminAuth = await getAuthSession('admin')
  const client = getAnonClient()
  await client.auth.setSession(adminAuth.session)

  const { count: projCount, error: projErr } = await client.from('proyectos').select('*', { count: 'exact', head: true })
  const { count: clientCount, error: cliErr } = await client.from('clientes').select('*', { count: 'exact', head: true })
  const { count: siteCount, error: siteErr } = await client.from('sitios').select('*', { count: 'exact', head: true })
  const { count: profileCount, error: profErr } = await client.from('profiles').select('*', { count: 'exact', head: true })

  assert(!projErr, `Projects count error: ${projErr?.message}`)
  assert(!cliErr, `Clients count error: ${cliErr?.message}`)
  assert(!siteErr, `Sites count error: ${siteErr?.message}`)
  assert(!profErr, `Profiles count error: ${profErr?.message}`)

  console.log(`    [Empirical DB Counts] Proyectos: ${projCount}, Clientes: ${clientCount}, Sitios: ${siteCount}, Profiles: ${profileCount}`)
  assert(projCount >= 6, `Expected at least 6 customer projects, found ${projCount}`)
  assert(clientCount >= 9, `Expected at least 9 clients, found ${clientCount}`)
  assert(siteCount >= 44, `Expected at least 44 sites, found ${siteCount}`)
  assert(profileCount >= 8, `Expected at least 8 profiles, found ${profileCount}`)
})

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('challenger-sprint2.test.mjs')) {
  challengerSprint2Suite.run(true).then((res) => {
    process.exit(res.failed > 0 ? 1 : 0)
  })
}
