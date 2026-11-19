# Execution Roadmap — Nodo CRM Platform Refactoring & Hardening

**Document ID**: `EXECUTION_ROADMAP.md`  
**Target Environment**: Next.js 16.2.3, React 19.2.4, TypeScript 5.x, Supabase PostgreSQL (`nlqrdxwyxmgdwawedweh`)  
**Version**: 2.3.0  
**Status**: Completed & Verified (Phases 1–5 + v29 Savings Calculator / Simulator + v30–v31 Live QA Remediation)  

---

## 1. Roadmap Architecture & Execution Philosophy

This roadmap translates the findings of the architectural assessment into five sequenced, testable execution phases. Each phase is constructed with clear dependencies, strict risk mitigation strategies, and automated verification gates.

```
═════════════════════════════════════════════════════════════════════════════════
  PHASE 1: Critical Bug Fixes & Schema Integrity [P0]
  ├─ TASK-001: Telemetry Schema Alignment (BUG-42703)
  ├─ TASK-002: Missing Notifications Table Migration (PGRST205)
  └─ TASK-003: Client Portal Directory Relational Query Fix
═════════════════════════════════════════════════════════════════════════════════
                                        │
                                        ▼
═════════════════════════════════════════════════════════════════════════════════
  PHASE 2: Authentication & Routing Refinement [P1]
  ├─ TASK-004: Login returnUrl Deep-Link Preservation & SSR Auth Hardening (GAP-06)
  └─ TASK-005: Proxy JWT Custom Claims for Zero-DB RBAC Verification
═════════════════════════════════════════════════════════════════════════════════
                                        │
                                        ▼
═════════════════════════════════════════════════════════════════════════════════
  PHASE 3: CFE Engine & Financial Calculation Hardening [P1]
  └─ TASK-006: CFE Tariffs (DIST/DIT/01/DAC), SEMARNAT CO2e, USD/MXN Normalization
═════════════════════════════════════════════════════════════════════════════════
                                        │
                                        ▼
═════════════════════════════════════════════════════════════════════════════════
  PHASE 4: Database Indexing & Performance Optimization [P2]
  └─ TASK-007: Foreign Key B-Tree Indexing (10 Indexes) & ESLint 0-Warning Cleanup
═════════════════════════════════════════════════════════════════════════════════
                                        │
                                        ▼
═════════════════════════════════════════════════════════════════════════════════
  PHASE 5: Component Modernization & Portal Polish [P2 / P3]
  └─ TASK-008: Component Decomposition, UI Primitives, Tailwind Cleanup
═════════════════════════════════════════════════════════════════════════════════
```

---

## 2. Sequenced Execution Phases

### Phase 1: Critical Bug Fixes & Schema Integrity [Priority: P0]

**Objective**: Eliminate active database exceptions, runtime crashes, and polling errors across core portal views.

| Task ID | Task Title | Target Files / Subsystems | Primary Outcome |
|---|---|---|---|
| **TASK-001** | Telemetry Schema Alignment | `lib/dashboard-data.ts`, `components/telemetry/EnergyChart.tsx` | Aligns `getTelemetryHistorical()` queries with live columns `solar_produccion_kwh`, `consumo_red_kwh`, `bateria_porcentaje`, `bateria_descarga_kwh`. Eliminates `BUG-42703`. |
| **TASK-002** | Notifications Table Migration | `supabase/migrations/20261112000001_create_notificaciones.sql`, `components/TopBar.tsx` | Creates `public.notificaciones` table with RLS and realtime subscriptions; resolves PGRST205 errors. |
| **TASK-003** | Client Portal Directory Relational Query Fix | `lib/domains/proyectos/queries.ts` | Resolves `cliente_crm_id` from profile before querying `proyectos.cliente_id`, enabling client portal users to view their energy assets. |

- **Estimated Duration**: 1 Sprint / 1 Agent Session
- **Dependencies**: None (Operates on existing baseline).
- **Exit Gate**: Zero PostgreSQL 42703 errors; zero PGRST205 polling errors; client portal displays linked projects.

---

### Phase 2: Authentication & Routing Refinement [Priority: P1]

**Objective**: Eliminate navigation latency in the edge proxy and preserve user destination links during authentication.

| Task ID | Task Title | Target Files / Subsystems | Primary Outcome |
|---|---|---|---|
| **TASK-004** | Login `returnUrl` Deep-Link Preservation & SSR Auth Hardening (GAP-06) | `app/login/page.tsx`, `app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx`, `tests/proxy-deeplinks.test.mjs` | Preserves and translates `returnUrl` deep links via `resolveCrossPortalDeepLink` with query string preservation; eliminates GAP-06 SSR security defect by upgrading `ClienteInstalacionesPage` from `getSession()` to `getUser()`. |
| **TASK-005** | Proxy JWT Custom Claims for Zero-DB RBAC | `supabase/migrations/20261112000002_sync_user_role_claim.sql`, `proxy.ts` | Database trigger synchronizes `profiles.rol` into `auth.users.raw_app_meta_data->>'user_role'`. `proxy.ts` reads role directly from verified JWT, saving 50–200ms per request. |

- **Estimated Duration**: 1 Sprint / 1 Agent Session
- **Dependencies**: Phase 1 completed.
- **Exit Gate**: All `proxy-deeplinks.test.mjs` test cases pass; login with `?returnUrl=` translates/preserves destination; client installations Server Component validates auth with `getUser()`; proxy authorization logs show zero PostgREST calls for role resolution.

---

### Phase 3: CFE Engine & Financial Calculation Hardening [Priority: P1]

**Objective**: Expand tariff resolution to industrial and residential segments, integrate SEMARNAT decarbonization metrics, and normalize multi-currency savings.

| Task ID | Task Title | Target Files / Subsystems | Primary Outcome |
|---|---|---|---|
| **TASK-006** | CFE Engine Expansion & Currency Normalization | `lib/tariffs/cfe-calculator.ts`, `supabase/migrations/20261112000003_tarifa_cfe_varchar.sql`, `components/proyectos/DetalleProyecto.tsx`, `components/marketplace/OfertasBoard.tsx` | Adds `DIST`, `DIT`, `01`, `DAC` rates; implements `calculateCo2AvoidedTonnes` (0.423 kg/kWh); converts USD savings to MXN; migrates `tarifa_actual_cfe` to `VARCHAR(20)`. |

- **Estimated Duration**: 1 Sprint / 1 Agent Session
- **Dependencies**: Phase 1 completed.
- **Exit Gate**: Comprehensive tariff unit tests pass for all 8 tariffs; CO₂ avoidance KPI calculates accurately; USD configs convert cleanly to MXN daily savings.

---

### Phase 4: Database Indexing & Performance Optimization [Priority: P2]

**Objective**: Eliminate sequential table scans during high-traffic RLS checks and achieve zero ESLint warnings across the entire repository.

| Task ID | Task Title | Target Files / Subsystems | Primary Outcome |
|---|---|---|---|
| **TASK-007** | DB Foreign Key Indexing (10 Indexes) & ESLint 0-Warning Cleanup | `supabase/migrations/20261112000004_fk_indexes.sql`, `components/TimePeriodSelector.tsx`, `tests/*.mjs` | Adds 10 B-tree indexes for foreign keys across `proyectos` (cliente_id, epcista_id, financiero_id, finder_id, responsable_nodo_id), `sitios` (cliente_id), `proyecto_sitios` (proyecto_id, sitio_id), `configuraciones_tecnicas` (proyecto_id), and `opciones_financiamiento` (proyecto_id); resolves all 13 ESLint unused-var warnings. |

- **Estimated Duration**: 0.5 Sprint / 0.5 Agent Session
- **Dependencies**: Phases 1, 2, and 3 completed.
- **Exit Gate**: `npm run lint` reports 0 errors and 0 warnings; `EXPLAIN` query plans on filtered project queries demonstrate index scans.

---

### Phase 5: Component Modernization & Portal Polish [Priority: P2 / P3]

**Objective**: Decompose monolithic components into clean sub-views and hooks, provide reusable headless UI primitives, and eliminate CSS configuration duplication.

| Task ID | Task Title | Target Files / Subsystems | Primary Outcome |
|---|---|---|---|
| **TASK-008** | Component Decomposition, UI Primitives & Tailwind Cleanup | `components/ui/Modal.tsx`, `components/ui/DropdownMenu.tsx`, `components/ui/Tabs.tsx`, `components/proyectos/ProjectWizard.tsx`, `components/InstalacionMonitor.tsx`, `tailwind.config.ts` | Decomposes 1,391-line wizard and 674-line monitor into modular hooks and leaf views; introduces headless primitives; consolidates Tailwind configuration onto v4 `@theme`. |

- **Estimated Duration**: 1.5 Sprints / 1 Agent Session
- **Dependencies**: Phases 1 through 4 completed.
- **Exit Gate**: `ProjectWizard.tsx` reduced to < 400 lines; all modals use standard `Modal` primitive; all 4 verification gates pass cleanly.

---

## 3. Dependency Graph & Phase Precedence

```
[Baseline: Sprints 1 & 2]
         │
         ▼
[Phase 1: P0 Fixes] ──────┬────────────────────────┐
(TASK-001, 002, 003)      │                        │
         │                │                        │
         ▼                ▼                        ▼
[Phase 2: Auth & Proxy] [Phase 3: CFE Engine]   (Schema Stable)
(TASK-004, 005)         (TASK-006)                 │
         │                │                        │
         └────────┬───────┘                        │
                  │                                │
                  ▼                                ▼
         [Phase 4: Indexing & Code Clean] ◄────────┘
         (TASK-007)
                  │
                  ▼
         [Phase 5: Component Polish]
         (TASK-008)
```

---

## 4. Risk Matrix & Mitigation Strategies

| Risk Description | Probability | Impact | Affected Subsystem | Mitigation Strategy |
|---|:---:|:---:|---|---|
| **R-1: Database Migration Lock contention** | Low | High | Supabase PostgreSQL | Execute all index creations using `CREATE INDEX CONCURRENTLY IF NOT EXISTS` outside of long transactions. |
| **R-2: Telemetry Data Type Incompatibility** | Low | High | `telemetria_egauge`, Recharts | Explicitly cast numeric columns (`COALESCE(solar_produccion_kwh::numeric, 0)`) in dashboard aggregations to prevent `NaN` values. |
| **R-3: JWT Claim Staleness on Role Change** | Medium | Medium | Auth & Proxy | When `admin_update_role` or user updating occurs, call `supabase.auth.admin.updateUserById()` to immediately refresh claims and trigger client session refresh. |
| **R-4: Breaking Changes in Test Suites** | Medium | High | `tests/*.mjs` | Run acceptance suite continuously during task execution. Update assertions in lockstep when fixing genuine schema bugs. |
| **R-5: Unintended Layout Shifts from UI Primitives** | Low | Medium | Components & Portals | Validate responsive views on both desktop (1440px) and mobile (375px) viewports before completing Phase 5. |

---

## 5. Supabase DDL Execution Plan (`nlqrdxwyxmgdwawedweh`)

Because `.env.local` provides `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (HTTP Data & Auth Admin APIs) without a direct Postgres `DATABASE_URL`, database schema updates are executed via a two-part strategy:

1. **Individual Versioned Migrations + Consolidated One-Click SQL Bundle**:
   - Individual migration files are authored in `supabase/migrations/`:
     - `supabase/migrations/20261112000001_create_notificaciones.sql` (`TASK-002`)
     - `supabase/migrations/20261112000002_sync_user_role_claim.sql` (`TASK-005`)
     - `supabase/migrations/20261112000003_tarifa_cfe_varchar.sql` (`TASK-006`)
     - `supabase/migrations/20261112000004_fk_indexes.sql` (`TASK-007`)
   - A single idempotent consolidated script is generated at `supabase/migrations/20261112000000_consolidated_sprint3_ddl.sql` combining all 4 migrations for one-click paste-and-run execution in the Supabase Dashboard SQL Editor (`https://supabase.com/dashboard/project/nlqrdxwyxmgdwawedweh/sql/new`).
2. **Automated Live Auth Admin API Backfill (`TASK-005`)**:
   - Using `SUPABASE_SERVICE_ROLE_KEY`, the execution agent runs `adminClient.auth.admin.updateUserById(p.id, { app_metadata: { user_role: p.rol } })` across all rows in `public.profiles` over HTTPS so that 100% of existing users immediately have their `user_role` JWT custom claim populated even before the SQL Editor script is run.
3. **Savings Calculator & Simulator Migration (`supabase/migrations/20261119000000_v29_savings_calculator.sql`)**:
   - Idempotently ensures `proyectos` columns (`consumo_anual_gwh`, `codigo_postal`, `tarifa_actual_cfe` if missing), creates `calculadora_templates` (with append-only immutability trigger and `v1` 28-field + 7-formula seed) and `simulaciones_ahorro` (with stale-simulation invalidation triggers and multi-portal RLS policies), and extends read/upload policies for simulator consumers.
4. **Live Platform QA Remediation & Post-Deploy Polish Migrations (`supabase/migrations/20261120000000_v30_live_qa_remediation.sql`, `supabase/migrations/20261120000001_v31_qa_polish.sql`)**:
   - Ensures `proyecto_sitios` foreign keys (`sitio_id`, `proyecto_id`) and aligns `proyectos` stakeholder foreign keys (`epcista_id`, `responsable_nodo_id`, `finder_id`) to `public.profiles(id)`, enables `suministrador` `SELECT` RLS on MEM-eligible `proyectos`, adds `FOR DELETE` RLS on `storage.objects` (`archivos-proyectos/<proyecto_id>/*`), removes QA template artifacts, and reloads the PostgREST schema cache (`NOTIFY pgrst, 'reload schema'`).

---

## 6. Summary of Deliverables & Verification Protocols

Every phase must satisfy the **Mandatory Verification Gates** before handoff:
1. **Type Safety**: `npx tsc --noEmit` must return code 0 (zero errors).
2. **Linting Standards**: `npm run lint` (`npx eslint . --max-warnings=0`) must return code 0 (zero errors, zero warnings).
3. **Calculator Unit Tests**: `npm run test:calculator` (`vitest run`) must pass all calculator & formula AST tests cleanly.
4. **Acceptance Test Suite**: `npm test` (`npx tsx tests/test-runner.mjs`) must pass all test cases cleanly against live Supabase.
5. **Adversarial Empirical M3 Suite**: `npx tsx tests/adversarial-m3-empirical.test.mjs` must pass all empirical tests cleanly.
6. **Production Compilation**: `npm run build` must compile all static and dynamic routes cleanly with Turbopack.
