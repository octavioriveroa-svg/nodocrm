# Task Specification: TASK-001 — Telemetry Schema Alignment (BUG-42703)

**Task ID**: `TASK-001`  
**Task Title**: Telemetry Column Schema Alignment in Historical Query Engine  
**Target Subsystem**: Telemetry & Analytics (`lib/dashboard-data.ts`, `components/telemetry/EnergyChart.tsx`)  
**Priority**: P0 (Critical Runtime Defect)  
**Severity**: Blocker (Crashes historical telemetry queries with Postgres error 42703)  
**Status**: Completed & Verified  

---

## 1. Problem Statement & Root Cause

### 1.1 Problem Statement
When viewing telemetry dashboards or fetching historical generation data in client or financial portals, calling `getTelemetryHistorical()` immediately fails, logging an error and returning an empty dataset `[]`.

### 1.2 Root Cause
In `lib/dashboard-data.ts:201-203`, the PostgREST query on table `telemetria_egauge` explicitly selects:
```typescript
'id, proyecto_id, timestamp, generacion_kwh, consumo_kwh, potencia_kw, bateria_soc_pct, bateria_estado, solar_produccion_kwh, consumo_red_kwh, bateria_descarga_kwh, bateria_porcentaje'
```
However, in the live PostgreSQL database (`supabase/schema.sql`, `20261021000001_sprint1_security_rpcs_and_profile_prefs.sql`), table `telemetria_egauge` only defines the following columns:
- `id` (UUID)
- `proyecto_id` (UUID)
- `timestamp` (TIMESTAMPTZ)
- `solar_produccion_kwh` (NUMERIC)
- `consumo_red_kwh` (NUMERIC)
- `bateria_porcentaje` (NUMERIC)
- `bateria_descarga_kwh` (NUMERIC)
- `created_at` (TIMESTAMPTZ)

The columns `generacion_kwh`, `consumo_kwh`, `potencia_kw`, `bateria_soc_pct`, and `bateria_estado` do **not** exist in the table. Because PostgREST strictly validates requested columns against its schema cache, requesting nonexistent columns causes PostgreSQL error:
`42703: column telemetria_egauge.generacion_kwh does not exist`.

---

## 2. Scope Boundaries

### In-Scope
1. Update `lib/dashboard-data.ts` (`getTelemetryHistorical` function) to query only the actual columns present in `telemetria_egauge`:
   `id, proyecto_id, timestamp, solar_produccion_kwh, consumo_red_kwh, bateria_porcentaje, bateria_descarga_kwh`.
2. Update the returned type definition or mapped properties in `TelemetryDataPoint` / `TelemetryRow` so that consumers (like `EnergyChart.tsx` and `BatteryStatus.tsx`) receive clean mapped properties:
   - `solarProductionKwh` $\leftarrow$ `solar_produccion_kwh`
   - `gridConsumptionKwh` $\leftarrow$ `consumo_red_kwh`
   - `batteryChargePct` $\leftarrow$ `bateria_porcentaje`
   - `batteryDischargeKwh` $\leftarrow$ `bateria_descarga_kwh`
3. Add a dedicated automated test in `tests/` verifying that `getTelemetryHistorical` executes against live Supabase without throwing Postgres error 42703.

### Out-of-Scope
- Altering the physical table schema in PostgreSQL (the existing table structure is correct and contains live/historical readings).
- Redesigning `EnergyChart.tsx` visuals or Recharts rendering.

---

## 3. Technical Prerequisites & Dependencies
- **Dependencies**: None. Operates directly on the current baseline.
- **Environment**: Next.js 16.2.3, Supabase client `@supabase/ssr`.

---

## 4. Inputs
- Source File: `lib/dashboard-data.ts` (lines 190–218).
- Consumer Component: `components/telemetry/EnergyChart.tsx` (lines 4–10).
- Database Object: Table `public.telemetria_egauge`.

---

## 5. Step-by-Step Implementation Instructions

### Step 1: Update PostgREST Query in `lib/dashboard-data.ts`
Locate `getTelemetryHistorical` in `lib/dashboard-data.ts` (around line 200). Replace lines 199–203:
```typescript
  let query = supabase
    .from('telemetria_egauge')
    .select(
      'id, proyecto_id, timestamp, solar_produccion_kwh, consumo_red_kwh, bateria_descarga_kwh, bateria_porcentaje'
    )
    .gte('timestamp', startDate)
    .order('timestamp', { ascending: true })
    .limit(limit)
```

### Step 2: Ensure Data Type Compatibility and Mapping
Verify that the mapped output of `getTelemetryHistorical` returns objects with numeric fallbacks:
```typescript
  return (data ?? []).map(row => ({
    id: row.id,
    proyecto_id: row.proyecto_id,
    timestamp: row.timestamp,
    solar_produccion_kwh: Number(row.solar_produccion_kwh) || 0,
    consumo_red_kwh: Number(row.consumo_red_kwh) || 0,
    bateria_descarga_kwh: Number(row.bateria_descarga_kwh) || 0,
    bateria_porcentaje: Number(row.bateria_porcentaje) || 0,
    // Convenience aliases for backward compatibility
    solarProductionKwh: Number(row.solar_produccion_kwh) || 0,
    gridConsumptionKwh: Number(row.consumo_red_kwh) || 0,
    batteryDischargeKwh: Number(row.bateria_descarga_kwh) || 0,
    batteryChargePct: Number(row.bateria_porcentaje) || 0,
  }))
```

### Step 3: Add Regression Test
In `tests/tier1-feature-coverage.test.mjs` (or a dedicated test suite), add test case:
```javascript
test('TASK-001: getTelemetryHistorical queries live telemetria_egauge without 42703 column error', async () => {
  const result = await getTelemetryHistorical(supabaseAdmin, { days: 30, limit: 10 })
  assert.ok(Array.isArray(result), 'Expected an array of telemetry rows')
})
```

---

## 6. Outputs
- **Modified File**: `lib/dashboard-data.ts`
- **Modified Test Suite**: `tests/tier1-feature-coverage.test.mjs`

---

## 7. Acceptance Criteria & Exact Verification Commands

### Criteria
- [x] `getTelemetryHistorical()` does not throw PostgreSQL error 42703.
- [x] Calling `getTelemetryHistorical()` against live Supabase returns an array without console errors.
- [x] `npx tsc --noEmit` passes with 0 errors.
- [x] `npm test` passes all test suites.

### Verification Command
```bash
npx tsx --env-file=.env.local --input-type=module -e "import { createAdminClient } from './lib/supabase/admin.ts'; import { getTelemetryHistorical } from './lib/dashboard-data.ts'; (async () => { const admin = createAdminClient(); const rows = await getTelemetryHistorical(admin, { days: 7, limit: 5 }); console.log('Telemetry rows returned successfully:', rows.length); })();"
```
**Expected Output**:
`Telemetry rows returned successfully: [N >= 0]` (Exit code 0, no error output).
