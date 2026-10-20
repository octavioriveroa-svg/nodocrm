import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  STAGE_ORDER as LIFECYCLE_STAGE_ORDER,
  ESTADO_LABELS as LIFECYCLE_ESTADO_LABELS,
  TERMINAL_STAGES as LIFECYCLE_TERMINAL_STAGES,
  MODALIDAD_LABELS as LIFECYCLE_MODALIDAD_LABELS,
} from '../lib/domains/proyectos/lifecycle.ts'
import {
  STAGE_ORDER,
  ESTADO_LABELS,
  TERMINAL_STAGES,
  MODALIDAD_LABELS,
  STAGE_LABELS,
  getModalidadLabel,
  getTelemetryStats,
  getTelemetryHistorical,
} from '../lib/dashboard-data.ts'

const rootDir = process.cwd()

console.log('\n--- Running Milestone M4 Verification Suite ---')

// 1. Shared Lifecycle Constants
console.log('1. Verifying shared lifecycle constants in lib/dashboard-data.ts...')
assert.deepEqual(STAGE_ORDER, LIFECYCLE_STAGE_ORDER, 'STAGE_ORDER must match lifecycle constant')
assert.deepEqual(ESTADO_LABELS, LIFECYCLE_ESTADO_LABELS, 'ESTADO_LABELS must match lifecycle constant')
assert.deepEqual(TERMINAL_STAGES, LIFECYCLE_TERMINAL_STAGES, 'TERMINAL_STAGES must match lifecycle constant')
assert.deepEqual(MODALIDAD_LABELS, LIFECYCLE_MODALIDAD_LABELS, 'MODALIDAD_LABELS must match lifecycle constant')
assert.deepEqual(STAGE_LABELS, ESTADO_LABELS, 'STAGE_LABELS alias must match ESTADO_LABELS')
assert.equal(getModalidadLabel('credito'), 'Crédito', 'getModalidadLabel must resolve credito')
assert.equal(getModalidadLabel('arrendamiento'), 'Arrendamiento', 'getModalidadLabel must resolve arrendamiento')
assert.equal(getModalidadLabel('unknown_custom'), 'unknown_custom', 'getModalidadLabel must fallback to raw string')
console.log('✔ Passed: Shared lifecycle constants verified.')

// 2. Telemetry Queries & Bounds
console.log('2. Verifying telemetry query boundedness and helpers in lib/dashboard-data.ts...')
assert.equal(typeof getTelemetryStats, 'function', 'getTelemetryStats must be an exported function')
assert.equal(typeof getTelemetryHistorical, 'function', 'getTelemetryHistorical must be an exported function')

const dashboardDataCode = fs.readFileSync(path.join(rootDir, 'lib/dashboard-data.ts'), 'utf-8')

// Must have gte date filter and limit on telemetria_egauge
assert.match(
  dashboardDataCode,
  /\.from\('telemetria_egauge'\)[\s\S]*?\.gte\('timestamp',\s*ninetyDaysAgo\)[\s\S]*?\.limit\(10000\)/,
  'telemetria_egauge query in fetchDashboardData must be bounded with .gte and .limit(10000)'
)

// Must not have the old unbounded query
assert(
  !dashboardDataCode.includes("supabase.from('telemetria_egauge').select('proyecto_id, solar_produccion_kwh, consumo_red_kwh, bateria_descarga_kwh'),"),
  'Old unbounded telemetria_egauge query must be removed'
)
console.log('✔ Passed: Telemetry query bounds verified.')

// 3. Migration Directory Cleanliness
console.log('3. Verifying migration directory cleanliness...')
const supabaseDir = path.join(rootDir, 'supabase')
const archiveDir = path.join(supabaseDir, 'archive')
const migrationsDir = path.join(supabaseDir, 'migrations')

assert(fs.existsSync(archiveDir), 'supabase/archive/ directory must exist')
assert(fs.existsSync(migrationsDir), 'supabase/migrations/ directory must exist')

const rootSqlFiles = fs.readdirSync(supabaseDir).filter(f => f.startsWith('v') && f.endsWith('.sql'))
assert.equal(rootSqlFiles.length, 0, `supabase/ root must contain 0 v*.sql files, found: ${rootSqlFiles.join(', ')}`)

const archiveSqlFiles = fs.readdirSync(archiveDir).filter(f => f.startsWith('v') && f.endsWith('.sql'))
assert.equal(archiveSqlFiles.length, 31, `supabase/archive/ must contain exactly 31 v*.sql files, found ${archiveSqlFiles.length}`)

const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
assert(migrationFiles.length >= 2, 'supabase/migrations/ must contain the authoritative migrations')
assert(migrationFiles.includes('20261021000001_sprint1_security_rpcs_and_profile_prefs.sql'))
assert(migrationFiles.includes('20261021000002_dashboard_views_and_indexes.sql'))

const configToml = fs.readFileSync(path.join(supabaseDir, 'config.toml'), 'utf-8')
assert(configToml.includes('path = "supabase/migrations"'), 'config.toml must point to supabase/migrations')

console.log('✔ Passed: Migration directory cleanliness verified (31 files archived, 0 in root, migrations authoritative).')
console.log('\n--- ALL M4 CHECKS PASSED SUCCESSFULLY ---\n')
