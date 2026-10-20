import fs from 'node:fs'
import path from 'node:path'
import { TestSuite, assert, assertEqual, assertIncludes } from './test-utils.mjs'

export const sprint2ChallengerSuite = new TestSuite('Sprint 2 Challenger Adversarial Suite')

const projectRoot = process.cwd()

// ── Test 1: TOML Configuration Parser & Spec Compliance ─────────────────────
sprint2ChallengerSuite.test('TOML config exists, parses strictly, and matches project_id nlqrdxwyxmgdwawedweh', async () => {
  const configPath = path.join(projectRoot, 'supabase', 'config.toml')
  assert(fs.existsSync(configPath), 'supabase/config.toml must exist')
  const content = fs.readFileSync(configPath, 'utf8')

  // Check project_id
  const projectIdMatch = content.match(/project_id\s*=\s*"([^"]+)"/)
  assert(projectIdMatch, 'project_id must be declared as a string')
  assertEqual(projectIdMatch[1], 'nlqrdxwyxmgdwawedweh', 'project_id must match nlqrdxwyxmgdwawedweh')

  // Verify mandatory sections
  const requiredSections = ['api', 'db', 'db.migrations', 'db.seed', 'studio', 'auth', 'storage']
  for (const section of requiredSections) {
    const sectionRegex = new RegExp(`\\[${section.replace('.', '\\.')}\\]`)
    assert(sectionRegex.test(content), `supabase/config.toml must contain [${section}]`)
  }

  // Check ports are valid positive integers
  const portMatches = [...content.matchAll(/port\s*=\s*(\d+)/g)]
  assert(portMatches.length >= 3, 'Must define at least api, db, and studio ports')
  for (const match of portMatches) {
    const port = parseInt(match[1], 10)
    assert(port > 1024 && port < 65535, `Port ${port} must be a valid non-privileged port (1025-65534)`)
  }

  // Check migrations path
  assertIncludes(content, 'path = "supabase/migrations"', 'db.migrations path must point to supabase/migrations')
})

// ── Test 2: SQL Migration 20261021000002 Syntax & Idempotency ───────────────
sprint2ChallengerSuite.test('SQL migration 20261021000002 has idempotent index and constraint definitions', async () => {
  const migPath = path.join(projectRoot, 'supabase', 'migrations', '20261021000002_dashboard_views_and_indexes.sql')
  assert(fs.existsSync(migPath), 'Migration 20261021000002 must exist')
  const sql = fs.readFileSync(migPath, 'utf8')

  // 1. Verify idx_telemetria_proyecto_time
  assert(
    sql.includes('CREATE INDEX IF NOT EXISTS idx_telemetria_proyecto_time'),
    'idx_telemetria_proyecto_time must use CREATE INDEX IF NOT EXISTS'
  )
  assert(
    sql.includes('ON public.telemetria_egauge (proyecto_id, timestamp DESC)'),
    'idx_telemetria_proyecto_time must index (proyecto_id, timestamp DESC)'
  )

  // 2. Verify idx_proyectos_estado_created
  assert(
    sql.includes('CREATE INDEX IF NOT EXISTS idx_proyectos_estado_created'),
    'idx_proyectos_estado_created must use CREATE INDEX IF NOT EXISTS'
  )
  assert(
    sql.includes('ON public.proyectos (estado, created_at DESC)'),
    'idx_proyectos_estado_created must index (estado, created_at DESC)'
  )

  // 3. Verify Foreign key DO block idempotency
  assert(
    sql.includes("SELECT 1 FROM pg_constraint WHERE conname = 'proyectos_epcista_id_fkey'"),
    'Constraint creation must check pg_constraint for existing conname'
  )
  assert(
    sql.includes('ALTER TABLE public.proyectos'),
    'Must alter table public.proyectos'
  )
  assert(
    sql.includes('ADD CONSTRAINT proyectos_epcista_id_fkey'),
    'Must name constraint proyectos_epcista_id_fkey'
  )
  assert(
    sql.includes('FOREIGN KEY (epcista_id) REFERENCES public.profiles(id)'),
    'Constraint must reference public.profiles(id)'
  )
  assert(
    sql.includes('ON DELETE SET NULL'),
    'Constraint must specify ON DELETE SET NULL'
  )

  // 4. Test idempotency simulation: Verify no non-idempotent statements (e.g. bare CREATE INDEX or bare ALTER TABLE ADD CONSTRAINT)
  const bareCreateIndex = sql.replace(/CREATE INDEX IF NOT EXISTS/g, '')
  assert(!bareCreateIndex.includes('CREATE INDEX'), 'There should be no bare CREATE INDEX without IF NOT EXISTS')
  const bareAddConstraint = sql.replace(/DO \$\$[\s\S]*?\$\$[\s\S]*?;/g, '')
  assert(!bareAddConstraint.includes('ADD CONSTRAINT'), 'ADD CONSTRAINT must be encapsulated inside idempotent conditional DO block')
})

// ── Test 3: CI/CD Pipeline Structural & Security Validation ─────────────────
sprint2ChallengerSuite.test('.github/workflows/main.yml enforces all 4 quality gates with safe secrets', async () => {
  const workflowPath = path.join(projectRoot, '.github', 'workflows', 'main.yml')
  assert(fs.existsSync(workflowPath), '.github/workflows/main.yml must exist')
  const yaml = fs.readFileSync(workflowPath, 'utf8')

  // Trigger events
  assert(yaml.includes('push:'), 'Workflow must trigger on push')
  assert(yaml.includes('pull_request:'), 'Workflow must trigger on pull_request')
  assert(yaml.includes('branches: [main]'), 'Workflow must target main branch')

  // Node setup
  assert(yaml.includes('actions/setup-node@v4'), 'Workflow must use setup-node@v4')
  assert(yaml.includes("node-version: '20'"), 'Workflow must pin Node.js 20')

  // Check 4 sequential quality gates
  const steps = [
    { name: 'npm ci', pattern: /run:\s*npm ci/ },
    { name: 'Typecheck', pattern: /run:\s*npx tsc --noEmit/ },
    { name: 'Linter', pattern: /run:\s*npm run lint/ },
    { name: 'Test suite', pattern: /run:\s*npm test/ },
    { name: 'Build', pattern: /run:\s*npm run build/ }
  ]

  let lastIndex = -1
  for (const step of steps) {
    const match = yaml.search(step.pattern)
    assert(match !== -1, `Workflow must execute step: ${step.name}`)
    assert(match > lastIndex, `Step ${step.name} must appear in order after previous step`)
    lastIndex = match
  }

  // Security: No hardcoded production service role keys in workflow text
  assert(!yaml.includes('SUPABASE_SERVICE_ROLE_KEY: eyJ'), 'No production service role JWT must be hardcoded in YAML')
  assert(!yaml.includes('secret_key'), 'No raw secrets must be present')
})

// ── Test 4: package.json script wiring ──────────────────────────────────────
sprint2ChallengerSuite.test('package.json scripts wire test runner correctly', async () => {
  const pkgPath = path.join(projectRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

  assert(pkg.scripts, 'package.json must have scripts object')
  assertEqual(pkg.scripts.test, 'npx tsx tests/test-runner.mjs', 'scripts.test must run tsx tests/test-runner.mjs')
  assertEqual(pkg.scripts.build, 'next build', 'scripts.build must be next build')
  assertEqual(pkg.scripts.lint, 'eslint', 'scripts.lint must be eslint')
})

// If run directly:
if (process.argv[1]?.endsWith('adversarial-sprint2.test.mjs')) {
  sprint2ChallengerSuite.run(true).then((res) => {
    process.exit(res.failed > 0 ? 1 : 0)
  })
}
