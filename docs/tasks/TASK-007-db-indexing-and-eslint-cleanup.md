# Task Specification: TASK-007 — DB Indexing & ESLint Zero-Warning Cleanup

**Task ID**: `TASK-007`  
**Task Title**: Database Foreign Key B-Tree Indexing (10 Indexes) & ESLint Zero-Warning Cleanup  
**Target Subsystem**: Database Performance & Code Hygiene (`supabase/migrations/`, `components/TimePeriodSelector.tsx`, `tests/*.mjs`)  
**Priority**: P2 (Performance Optimization & Quality Hygiene)  
**Severity**: Low-Medium (Sequential scans during RLS checks; linter noise)  
**Status**: Completed & Verified  

---

## 1. Problem Statement & Root Cause

### 1.1 Problem Statement
1. **Unindexed Foreign Keys**: In high-cardinality tables (`proyectos`, `sitios`, `proyecto_sitios`, `configuraciones_tecnicas`, `opciones_financiamiento`), critical foreign key columns lack explicit PostgreSQL B-tree indexes. When Row-Level Security (RLS) policies or PostgREST relational joins execute (such as filtering by `finder_id` on every Finder portal visit, `responsable_nodo_id` on analyst assignments, `opciones_financiamiento(proyecto_id)` on underwriting modals, or `proyecto_sitios(sitio_id)` on site reverse lookups), PostgreSQL is forced to perform sequential scans over these tables.
2. **ESLint Warning Noise**: Running `npm run lint` generates 13 `@typescript-eslint/no-unused-vars` warnings (1 in source code, 12 across test files), cluttering CI/CD logs and violating the zero-warning code standard.

---

## 2. Scope Boundaries

### In-Scope
1. Author SQL migration `supabase/migrations/20261112000004_fk_indexes.sql`:
   - Create 10 B-tree indexes across core foreign keys:
     - `proyectos(cliente_id)`
     - `proyectos(epcista_id)`
     - `proyectos(financiero_id)`
     - `proyectos(finder_id)`
     - `proyectos(responsable_nodo_id)`
     - `sitios(cliente_id)`
     - `proyecto_sitios(proyecto_id)`
     - `proyecto_sitios(sitio_id)`
     - `configuraciones_tecnicas(proyecto_id)`
     - `opciones_financiamiento(proyecto_id)`
2. Clean up 13 ESLint unused variable warnings:
   - `components/TimePeriodSelector.tsx:106`: rename `opts` to `_opts`.
   - `tests/adversarial-m3-empirical.test.mjs:27`: remove unused `QA_USERS`.
   - `tests/proxy-deeplinks.test.mjs:6`: remove unused `PORTAL_SUPPORTED_ROUTES`.
   - `tests/tier1-feature-coverage.test.mjs:19,21`: remove unused `validarBessForm`, `calcFV`, `calcBESS`.
   - `tests/tier3-cross-feature.test.mjs`: remove unused imports/destructuring variables.
3. Verify that `npm run lint` finishes with **0 errors and 0 warnings**.

### Out-of-Scope
- Modifying table primary keys or altering column nullability.
- Disabling ESLint rules via `# eslint-disable` comments.

---

## 3. Technical Prerequisites & Dependencies
- **Dependencies**: Phases 1–3 completed.

---

## 4. Inputs
- Source Files: `components/TimePeriodSelector.tsx`, `tests/*.mjs`
- Database Tables: `public.proyectos`, `public.sitios`, `public.proyecto_sitios`, `public.configuraciones_tecnicas`, `public.opciones_financiamiento`

---

## 5. Step-by-Step Implementation Instructions

### Step 1: Create SQL Migration for 10 Foreign Key Indexes
Create `supabase/migrations/20261112000004_fk_indexes.sql`:

```sql
-- Migration: 20261112000004_fk_indexes.sql
-- Description: Adds B-Tree indexes on high-traffic foreign keys to accelerate joins and RLS evaluations.

-- 1. Project Role Foreign Keys (Core RBAC & Directory Filters)
CREATE INDEX IF NOT EXISTS idx_proyectos_cliente_id 
  ON public.proyectos(cliente_id) 
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_epcista_id 
  ON public.proyectos(epcista_id) 
  WHERE epcista_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_financiero_id 
  ON public.proyectos(financiero_id) 
  WHERE financiero_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_finder_id 
  ON public.proyectos(finder_id) 
  WHERE finder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_responsable_nodo_id 
  ON public.proyectos(responsable_nodo_id) 
  WHERE responsable_nodo_id IS NOT NULL;

-- 2. Physical Site Associations
CREATE INDEX IF NOT EXISTS idx_sitios_cliente_id 
  ON public.sitios(cliente_id);

CREATE INDEX IF NOT EXISTS idx_proyecto_sitios_proyecto_id 
  ON public.proyecto_sitios(proyecto_id);

CREATE INDEX IF NOT EXISTS idx_proyecto_sitios_sitio_id 
  ON public.proyecto_sitios(sitio_id);

-- 3. Technical Configurations & Financial Options Junctions
CREATE INDEX IF NOT EXISTS idx_configuraciones_tecnicas_proyecto_id 
  ON public.configuraciones_tecnicas(proyecto_id);

CREATE INDEX IF NOT EXISTS idx_opciones_financiamiento_proyecto_id 
  ON public.opciones_financiamiento(proyecto_id);
```

### Step 2: Fix `components/TimePeriodSelector.tsx`
In `components/TimePeriodSelector.tsx` (line 106), prefix unused parameter with an underscore:
```typescript
// Before:
opts: RawFinancingOption[] = []
// After:
_opts: RawFinancingOption[] = []
```

### Step 3: Clean Up Unused Test Variables
- In `tests/adversarial-m3-empirical.test.mjs`, remove unused `QA_USERS` declaration.
- In `tests/proxy-deeplinks.test.mjs`, remove unused `PORTAL_SUPPORTED_ROUTES` import.
- In `tests/tier1-feature-coverage.test.mjs`, remove unused `validarBessForm`, `calcFV`, `calcBESS` imports.
- In `tests/tier3-cross-feature.test.mjs`, remove unused `setActiveSessionCookies` and unused destructuring elements.

---

## 6. Outputs
- **New Migration**: `supabase/migrations/20261112000004_fk_indexes.sql`
- **Modified Source**: `components/TimePeriodSelector.tsx`
- **Cleaned Tests**: `tests/adversarial-m3-empirical.test.mjs`, `tests/proxy-deeplinks.test.mjs`, `tests/tier1-feature-coverage.test.mjs`, `tests/tier3-cross-feature.test.mjs`

---

## 7. Acceptance Criteria & Exact Verification Commands

### Criteria
- [x] `npm run lint` outputs `0 problems (0 errors, 0 warnings)`.
- [x] All 10 B-tree indexes are defined in `supabase/migrations/20261112000004_fk_indexes.sql`.
- [x] All 65 tests in `npm test` continue to pass.
- [x] TypeScript check `npx tsc --noEmit` passes with 0 errors.

### Verification Command
```bash
npm run lint
```
**Expected Output**:
`✔ No ESLint warnings or errors found.` (Exit code 0).

And CLI schema verification:
```bash
npx tsx --env-file=.env.local --input-type=module -e "import { createAdminClient } from './lib/supabase/admin.ts'; (async () => { const admin = createAdminClient(); const { data, error } = await admin.from('opciones_financiamiento').select('id, proyecto_id').limit(1); if (error) { console.error('FAILED query on opciones_financiamiento:', error); process.exit(1); } console.log('SUCCESS: opciones_financiamiento queryable, sample count:', data.length); })();"
```
**Expected Output**:
`SUCCESS: opciones_financiamiento queryable, sample count: [N >= 0]` (Exit code 0).
