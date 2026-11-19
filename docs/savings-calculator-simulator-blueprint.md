# Nodo CRM — Energy & Monetary Savings Calculator / Simulator Technical Blueprint

**Status:** Design & Implementation Plan (Pre-Implementation)  
**Target Codebase:** `nodo` (`Next.js 16.2.3`, `React 19.2.4`, `TypeScript strict`, `Tailwind CSS v4`, `Supabase PostgreSQL + RLS`)  
**Requirements Covered:** R1 (Platform-Wide Audit & Integration), R2 (Quantitative Calculator, Persistence & Financial Preconditions), R3 (Configurable Calculation Logic, Excel Formulas & Excel File Import with Mapping Confirmation), R4 (Monthly / Quarterly / Yearly Projections & Payback Period)

---

## Table of Contents

1. [Executive Summary & Platform-Wide Audit Synthesis (R1)](#1-executive-summary--platform-wide-audit-synthesis-r1)
   - 1.1 [Audited Architecture Baseline](#11-audited-architecture-baseline)
   - 1.2 [Existing Component, Schema & Pattern Reuse Inventory](#12-existing-component-schema--pattern-reuse-inventory)
   - 1.3 [Existing Code, Data & Configuration Adjustment Matrix](#13-existing-code-data--configuration-adjustment-matrix)
2. [Database Schema, Migration (`v29_savings_calculator.sql`) & RLS Contracts (R1, R2, R3)](#2-database-schema-migration-v29_savings_calculatorsql--rls-contracts-r1-r2-r3)
   - 2.1 [Entity-Relationship Overview](#21-entity-relationship-overview)
   - 2.2 [Production Migration SQL (`supabase/v29_savings_calculator.sql`)](#22-production-migration-sql-supabasev29_savings_calculatorsql)
   - 2.3 [Row-Level Security Matrix Across All 8 Roles](#23-row-level-security-matrix-across-all-8-roles)
   - 2.4 [Strict TypeScript Interfaces (`lib/types.ts` Additions)](#24-strict-typescript-interfaces-libtypes-additions)
3. [Financial Preconditions, Data Sourcing & Strict Gating Specification (R2)](#3-financial-preconditions-data-sourcing--strict-gating-specification-r2)
   - 3.1 [Project Creation Financial & Quantitative Sourcing Priority](#31-project-creation-financial--quantitative-sourcing-priority)
   - 3.2 [Strict Gating Predicate & Multi-Layer Enforcement](#32-strict-gating-predicate--multi-layer-enforcement)
   - 3.3 [Viewer Messaging & Role-Aware Gated UI Specification](#33-viewer-messaging--role-aware-gated-ui-specification)
4. [Rational Default Formula Set & Parameter Precedence (R2, R3, R4)](#4-rational-default-formula-set--parameter-precedence-r2-r3-r4)
   - 4.1 [Canonical Platform Variable Dictionary](#41-canonical-platform-variable-dictionary)
   - 4.2 [3-Tier Context Resolution Precedence](#42-3-tier-context-resolution-precedence)
   - 4.3 [Currency FX Normalization](#43-currency-fx-normalization)
   - 4.4 [Year-1 Energy & Monetary Savings Equations (FV, BESS, MEM, Fallback)](#44-year-1-energy--monetary-savings-equations-fv-bess-mem-fallback)
   - 4.5 [Multi-Year Monthly Time-Series & Financing Cashflows (`m = 1 .. H × 12`)](#45-multi-year-monthly-time-series--financing-cashflows-m--1--h--12)
   - 4.6 [Timeframe Aggregation (`Mensual`, `Trimestral`, `Anual`) & Horizons](#46-timeframe-aggregation-mensual-trimestral-anual--horizons)
   - 4.7 [Payback Period, NPV, IRR & ROI Specifications + Edge Cases](#47-payback-period-npv-irr--roi-specifications--edge-cases)
5. [Nodo Admin Configuration, Excel-Language Formula Engine & Excel Import Pipeline (R3)](#5-nodo-admin-configuration-excel-language-formula-engine--excel-import-pipeline-r3)
   - 5.1 [Library Selection & Security Rationale](#51-library-selection--security-rationale)
   - 5.2 [Pure-TypeScript AST Excel Formula Engine (`lib/calculator/formula-engine.ts`)](#52-pure-typescript-ast-excel-formula-engine-libcalculatorformula-enginets)
   - 5.3 [Excel Workbook Upload Parser (`POST /api/calculator/excel/parse`)](#53-excel-workbook-upload-parser-post-apicalculatorexcelparse)
   - 5.4 [Server Actions & Validation Contracts (`app/actions/calculatorConfig.ts`, `app/actions/simulaciones.ts`)](#54-server-actions--validation-contracts-appactionscalculatorconfigts-appactionssimulacionests)
   - 5.5 [3-Step Admin Configuration & Excel Mapping Confirmation Workflow](#55-3-step-admin-configuration--excel-mapping-confirmation-workflow)
6. [UI/UX Component Architecture, Portal Consolidation & Client Flows (R1, R2, R4)](#6-uiux-component-architecture-portal-consolidation--client-flows-r1-r2-r4)
   - 6.1 [New & Consolidated File / Module Layout](#61-new--consolidated-file--module-layout)
   - 6.2 [Portal Consolidation & Client Solution Exposure (`/cliente/proyectos`, `/cliente/proyectos/[id]`)](#62-portal-consolidation--client-solution-exposure-clienteproyectos-clienteproyectosid)
   - 6.3 [Interactive Simulator & Projection Visualizations (`<SimuladorAhorrosSeccion />`)](#63-interactive-simulator--projection-visualizations-simuladorahorrosseccion-)
   - 6.4 [Simulation Persistence, Comparison & Stale-Input Management](#64-simulation-persistence-comparison--stale-input-management)
   - 6.5 [Brandbook & ESLint Compliance Checklist](#65-brandbook--eslint-compliance-checklist)
7. [Concrete Verification Scenarios & Phased Implementation Plan](#7-concrete-verification-scenarios--phased-implementation-plan)
   - 7.1 [Deterministic Numerical & Integration Verification Scenarios](#71-deterministic-numerical--integration-verification-scenarios)
   - 7.2 [Phased, Zero-Mock Implementation Roadmap](#72-phased-zero-mock-implementation-roadmap)
   - 7.3 [Acceptance Verification Commands](#73-acceptance-verification-commands)

---

## 1. Executive Summary & Platform-Wide Audit Synthesis (R1)

### 1.1 Audited Architecture Baseline

Nodo CRM is a Next.js `16.2.3` App Router + React `19.2.4` + Tailwind CSS v4 + Supabase PostgreSQL application (`package.json:11-30`, `tsconfig.json:1-34`, `AGENTS.md:1-5`). All source code resides directly under `app/`, `components/`, `lib/`, and `supabase/` (no `src/` directory; `@/*` maps to `./*`).

Key architectural invariants established during the workspace audit:
- **Request Proxy & Portal Isolation (`proxy.ts:1-89`)**: Next.js 16 uses `proxy.ts` (replacing `middleware.ts`), routing 8 roles (`Rol` in `lib/types.ts:1`) across isolated portal prefixes (`/admin`, `/analista`, `/epc`, `/finder`, `/financiero`, `/cliente`, `/mem`, `/pendiente`). **Critical boundary:** `proxy.ts:28` explicitly excludes `/api/*` from its matcher (`'/((?!api|_next/static|...).*)'`), so every API `route.ts` must perform its own `createClient()` + `supabase.auth.getUser()` + `profiles.rol` check.
- **Database & RLS (`supabase/schema.sql`, `v2`–`v28`)**: 23 `public` tables governed by PostgreSQL Row-Level Security using `SECURITY DEFINER` helpers `public.get_my_rol()` (`supabase/v3_fix_rls.sql:5-9`) and `public.get_my_cliente_crm_id()` (`supabase/v16_link_clientes_usuarios.sql:15-19`), plus JWT claim hook `public.custom_access_token_hook` (`supabase/v26_custom_access_token_hook.sql:14-44`).
- **Existing Backend Pattern**: Zero `route.ts` files exist today; admin/privileged mutations use `'use server'` Server Actions in `app/actions/*.ts` (`crearUsuario.ts`, `invitar.ts`, `vincularUsuario.ts`, `adminUpdateEmail.ts`, `adminResetPassword.ts`, `adminDeleteUser.ts`), while project reads/writes occur via `@/lib/supabase/server` (`await cookies()`) and `@/lib/supabase/client`.
- **Current Gaps Blocking R1–R4**:
  1. **No global platform settings or formula tables**: `components/Configuracion.tsx:86-162` persists `moneda`, `timezone`, company metadata, and notification toggles solely in browser `localStorage`.
  2. **Client portal blind spot**: `app/(portals)/cliente/page.tsx` only renders 24h `telemetria_egauge` or legacy `hitos_construccion`, has no `/cliente/proyectos` or `/cliente/proyectos/[id]` route (`components/TopBar.tsx:176` search 404s for clients), and queries `.eq('cliente_id', session.user.id)` (`cliente/page.tsx:48`, `cliente/instalaciones/page.tsx:25`) instead of `profiles.cliente_crm_id`.
  3. **Inconsistent financial validation & FX mixing**: `epc/nuevo/page.tsx:454-469` omits `capex`/`generacion_anual_kwh` validation and calls `validarPaso3()` at step 2 (`:716`); `finder/nuevo/page.tsx:819` writes `inversion_total: 0` on `nodo_busca` projects instead of `null`; `lib/dashboard-data.ts:328-386` and `components/TimePeriodSelector.tsx:106-145` sum `USD` and `MXN` amounts without FX conversion.
  4. **Hardcoded `$3.9 MXN/kWh` heuristic**: `lib/egauge.ts:83`, `app/(portals)/cliente/page.tsx:81`, and `app/(portals)/financiero/page.tsx:73,116` (`[id]/page.tsx:66`) multiply kWh by hardcoded `3.9`.
  5. **No Excel/validation/test packages**: `package.json:11-30` lacks spreadsheet parsers, `zod`, and automated test runners.
  6. **Duplicated portal wizards, modals & route loaders (11,981 lines across 41 files)**: `admin/proyectos/nuevo/page.tsx` (2,129), `epc/nuevo/page.tsx` (2,042), `finder/nuevo/page.tsx` (2,037), `EditarSolucionTecnicaModal.tsx` (893), `EditarFinanciamientoModal.tsx` (478), `proyectos/[id]/page.tsx` loaders (395 + 172), `clientes/*` pages (2,522), `configuracion/page.tsx` (148), `instalaciones` (461), `plan` (217), and `EpcistaProyectosClient`/`FinderProyectosClient` (659) copy-paste identical logic and drift on bug fixes (e.g., `hasHybridBessOnSite`, `validarPaso2()`, `v25` fields). Instead of patching duplicated files individually, this blueprint consolidates them into shared declarative schemas, loaders, and 2-line portal route re-exports matching `app/(portals)/analista/usuarios/page.tsx:1-2`.

---

### 1.2 Existing Component, Schema & Pattern Reuse Inventory

Every subsystem of the Savings Calculator / Simulator directly reuses existing Nodo CRM entities, utilities, and UI idioms:

| Target Need | Existing Asset / File | Exact Reuse Role in Simulator Feature |
|---|---|---|
| **Project & Financial Sourcing** | `public.proyectos` (`supabase/schema.sql:48-80`, `v25_schema_fixes.sql:13-21`), `public.configuraciones_tecnicas` (`v22_configuraciones_tecnicas.sql:2-14`, `v28:7-10`), `public.proyecto_sitio_productos` (`lib/types.ts:54-63`), `public.opciones_financiamiento` (`v22_opciones_financiamiento.sql:7-18`, `v28:22-23`), `public.config_financiamiento` (`v22_opciones_financiamiento.sql:21-27`), `public.sitios` (`lib/types.ts:112-126`), `public.ofertas_mem` (`v2_migration.sql:63-73`) | Authoritative quantitative inputs: `capex_estimado`, `inversion_total`, FV `num_modulos`, `potencia_modulos_w`, `generacion_anual_kwh`, BESS `potencia_kw`, `capacidad_kwh`, `uso`, `sitios.demanda_contratada_kw`, `tarifa_actual_cfe`, `consumo_anual_gwh`, `volumen_energia_mwh_anual`, `ofertas_mem.precio_kwh`, `opciones_financiamiento.vehiculo_inversion`, `plazo_meses`, and declared `ahorro_estimado_anual`. |
| **Locale & Numeric Formatting** | `lib/format.ts:1-118` (`fmtNum`, `fmtCurrency`, `fmtCurrencyCompact`, `fmtCompact`, `fmtUnit`, `fmtPct`, `parseNum`, `formatNumberInput`) | All `es-MX` currency, kWh/kWp, percentage, and live comma-separated numeric input formatting across simulator context overrides, admin baselines, and projection tables. |
| **Topological Dependency Sort** | `lib/cascade-scheduler.ts:51-86` (`topologicalSort` using Kahn's algorithm) | Direct algorithmic precedent for cell/formula dependency ordering and `#CYCLE!` circular-reference detection in `lib/calculator/formula-engine.ts`. |
| **Brand Tokens & Typography** | `app/globals.css:26-177`, `Brand/BRAND.md`, `eslint.config.mjs:21-29` | Strict CSS token usage (`--color-principal`, `--color-acento`, `--color-menta`, `--color-linea`, `--color-texto-suave`, `.glass-card`, `.glass-panel`, `.num` tabular numerals); zero raw hex literals. |
| **UI Primitives** | `components/ui/Button.tsx`, `Card.tsx`, `Input.tsx`, `Badge.tsx`, `StatFigure.tsx`, `StepIndicator.tsx` | `StatFigure` (`tone="plain" \| "menta" \| "accent"`) for Payback/Savings/NPV/IRR KPIs (matching `app/brand-preview/page.tsx:76-83`); `StepIndicator` for the 3-step Excel Upload -> Mapping -> Confirmation flow; `Card`/`Button`/`Input`/`Badge` for all controls and baseline vs custom badges. |
| **Timeframe Toggle Pills** | `components/TimePeriodSelector.tsx:14-24` (`TimePeriodButtons`) | Exact pill-button pattern (`bg-principal text-acento border-principal` active, `bg-white text-gray-500 border-borde` inactive) for `Mensual \| Trimestral \| Anual` and horizon pills (`1, 3, 5, 10, 15, 20, 25 años`). |
| **Charting Library** | `recharts ^3.8.1` (`components/telemetry/EnergyChart.tsx:3-90`) | `ResponsiveContainer`, `ComposedChart` / `AreaChart` / `BarChart`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `ReferenceLine` styled exclusively with CSS `var(--color-*)` tokens. |
| **File Dropzone** | `components/EvidenciaModal.tsx:43-66, 245-302` | Drag-and-drop `border-2 border-dashed` upload area with 10 MB size check and selected-file chip for Excel `.xlsx` / `.csv` upload in the Admin modal. |
| **Save / Load Scenario Modals & Inline Delete** | `components/plan/TemplateManager.tsx:165-336`, `components/SitiosCliente.tsx:277-315`, `components/Configuracion.tsx:228-237` | Save/Load simulation modals, inline two-step `confirmDelete === id` confirmation (no browser `confirm()`), and 3-second auto-dismissing Lima `savedMsg` (`bg-acento text-principal`) / red error banners. |
| **Gating & Empty Callouts** | `components/DetalleProyecto.tsx:1204-1212, 1422-1430`, `app/(portals)/cliente/page.tsx:150-154` | `bg-amber-50 border border-amber-200 rounded-xl` + `<AlertTriangle />` inside `glass-panel border-dashed` container when financial figures are missing. |
| **Admin Mapping Table & Modal Shell** | `app/(portals)/admin/configuracion/roles/page.tsx:225-268`, `components/EditarSolucionTecnicaModal.tsx:506-518`, `components/Configuracion.tsx:23-29, 210-221` | `fixed inset-0 z-50 bg-black/50 backdrop-blur-sm` `max-w-4xl rounded-2xl` modal shell, `bg-principal text-white` mapping table with `<select>` dropdowns, and `/admin/configuracion` nav integration. |
| **Project Detail Shell** | `components/DetalleProyecto.tsx:72-91, 1129-1518` | `Seccion` / `Campo` helpers and parallel-loaded project data passed via unified `DetalleProyectoLoader` into `<SimuladorAhorrosSeccion />`. |
| **2-Line Portal Re-Export Pattern** | `app/(portals)/analista/usuarios/page.tsx:1-2`, `app/(portals)/analista/configuracion/roles/page.tsx:1-2` | Established repo idiom (`export { default } from '...'`) used to eliminate duplicated portal `proyectos/[id]`, `clientes`, and `configuracion` pages. |
| **Server Admin Client** | `lib/supabase/admin.ts` (`createAdminClient`) | Authoritative server-side persistence in `app/actions/simulaciones.ts` after `supabase.auth.getUser()` + project membership verification, preventing client-side KPI/override forgery. |

---

### 1.3 Existing Code, Data & Configuration Adjustment Matrix

Every required change in existing code, data, and configuration to integrate the simulator cleanly without mocks, broken routes, or regressions:

| # | Target File / Migration | Exact Lines | Current Behavior / Defect | Required Adjustment | Regression Safety |
|---|---|---|---|---|---|
| 1 | `package.json` | `:11-30` | No Excel parser, runtime validator, or test runner installed. | Add `"exceljs": "^4.4.0"` (MIT) and `"zod": "^3.24.2"` (MIT) to `dependencies`; add `"vitest": "^3.0.0"` to `devDependencies`; add `"test": "vitest run"` and `"typecheck": "tsc --noEmit"` scripts. | Purely additive dependencies; zero impact on existing imports. |
| 2 | `lib/types.ts` | `:20-93` | `Proyecto` omits `v25` SQL columns (`plan_bloqueado`, `consumo_anual_gwh`, `tarifa_actual_cfe`, `codigo_postal`); `ProyectoSitioProducto.datos` is untyped `Record<string, unknown>`; `ahorro_estimado_anual?` is optional instead of `number \| null`. | Add missing SQL columns to `Proyecto`; define `ProductoFvDatos` and `ProductoBessDatos` interfaces; normalize `ahorro_estimado_anual: number \| null` (and populate `ahorro_estimado_anual: null, ahorro_estimado_mensual: null, ahorro_moneda: proyecto.moneda || 'MXN'` on the `'legacy'` fallback object literal in `DetalleProyecto.tsx:1151-1161`); add `CalculadoraCampoDef`, `CalculadoraTemplate`, `SimulacionAhorro` (slim: `template_id`, `template_version`, `parametros_override`, KPIs only), and in-memory engine IO types (`PeriodoMensualSimulacion`, `SimulationEvaluationResult`). | Backward-compatible type widening/completion; removes `(activeConfig as any)` casts in `DetalleProyecto.tsx:1283` and prevents TS compile error on `DetalleProyecto.tsx:1151`. |
| 3 | `components/Sidebar.tsx` | `:86-98, 218-225` | `navCliente` lacks `/cliente/proyectos`; Settings link `/${rol.replace('nodo_analista', 'analista').replace('nodo_admin', 'admin')}/configuracion` 404s for `cliente_final` (`/cliente_final/configuracion`), `financiero`, `suministrador`, `pendiente`. | Add `{ href: '/cliente/proyectos', label: 'Proyectos', icon: Folder }` to `navCliente`; map roles via `ROLE_TO_PATH` and render Settings link only for portals with a `/configuracion` page (`/admin`, `/analista`, `/epc`, `/finder`, plus optional `/cliente`). | Preserves all existing Admin, Analista, EPC, Finder, and MEM nav items. |
| 4 | `components/TopBar.tsx` | `:174-179` | `handleSelectProject` pushes `/${portal}/proyectos/${proj.id}`, which 404s for `cliente` (missing route) and `mem`. | With `/cliente/proyectos/[id]` created, client search works natively; guard `portal === 'mem'` in `handleSelectProject` to route to `/mem`. | Non-breaking fix for live search 404. |
| 5 | `app/(portals)/cliente/page.tsx` | `:45-48, 80-81` | Filters `proyectos` by `.eq('cliente_id', session.user.id)` (misses `profiles.cliente_crm_id` per `v16`); hardcodes `totalGenerated * 3.9` MXN. | Query `profiles.cliente_crm_id` first and filter `.or(\`cliente_id.eq.${user.id},cliente_id.eq.${crmId \|\| NIL_UUID}\`)`; replace `* 3.9` with `proyecto.tarifa_actual_cfe ?? extractTemplateDefaults(activeTemplate.campos).tarifa_cfe_default_mxn`; add `"Ver solución y simulador"` link to `/cliente/proyectos/${activeProyectoId}`. | Preserves 24h telemetry and Gantt views for operative/construction projects. |
| 6 | `lib/loaders/instalaciones.ts`, `lib/loaders/proyecto-subpages.ts` & portal `instalaciones` / `plan` pages | `cliente/instalaciones:22-27`; 6 `instalaciones/page.tsx` (203 lines); 5 `[id]/instalaciones/page.tsx` (258 lines); 4 `[id]/plan/page.tsx` (217 lines) | `cliente/instalaciones/page.tsx:25` filters `.eq('cliente_id', session.user.id)` without `cliente_crm_id`; 15 portal wrapper files copy-paste identical server auth/query boilerplate. | Consolidate into shared server loaders `lib/loaders/instalaciones.ts` (applying the `.or(...)` `cliente_crm_id` filter once for `cliente_final` and role-scoping all portals) and `lib/loaders/proyecto-subpages.ts` (`loadProjectInstallationsMonitor`, `loadProjectPlan`), reducing all 15 portal routes to 4–8 line server wrappers. | Eliminates duplicated server loaders while fixing CRM-linked client installations. |
| 7 | `app/(portals)/cliente/proyectos/page.tsx` & `[id]/page.tsx` | *(New)* | Missing routes cause `TopBar` 404 and hide `configuraciones_tecnicas` / `opciones_financiamiento` from clients. | Create client project directory and detail route; `[id]/page.tsx` reuses `components/proyectos/DetalleProyectoLoader.tsx` in read-only client mode (`isCliente`) loading technical alternatives, products, financing options, sites, active `calculadora_templates`, and saved `simulaciones_ahorro`, rendering read-only Solution + `<SimuladorAhorrosSeccion />`. | Isolated new routes under `/cliente/proyectos`; zero duplicate loader code. |
| 8–10 | **Consolidated Product Schema, Wizard & Modals**: `lib/proyectos/product-schema.ts`, `components/proyectos/{ProductoFormFields,ProductoCard,ProyectoWizard}.tsx`, `EditarSolucionTecnicaModal.tsx`, `EditarFinanciamientoModal.tsx`, `{admin/proyectos,epc,finder}/nuevo/page.tsx` | `admin/nuevo` (2,129 lines); `epc/nuevo:454-469,715-717` (2,042 lines); `finder/nuevo:748,757,817-838` (2,037 lines); `EditarSolucionTecnicaModal:217-231` (893 lines); `EditarFinanciamientoModal` (478 lines) — **7,579 lines total** | `epc/nuevo:454-469` skips `generacion_anual_kwh`/`capex`/`marca`/`uso` and `:716` calls `validarPaso3()` at step 2; `finder/nuevo:748` calls `validarPaso3()` unconditionally (`isNodoBuscaSubmit` declared later at `:757`) and `:819` writes `inversion_total: 0` for `nodo_busca`; `EditarSolucionTecnicaModal:222` omits `hasHybridBessOnSite`; `v25` fields (`tarifa_actual_cfe`, `consumo_anual_gwh`, `codigo_postal`) are missing from creation/edit UIs; 3 wizards copy-paste ~920 lines of Steps 1–3. | Consolidate into: (1) `lib/proyectos/product-schema.ts` (declarative `FV_FIELD_SCHEMA` & `BESS_FIELD_SCHEMA`, shared `FVForm`/`BESSForm`/`Producto`/`CreationConfig`/`CreationFinancingOption` types, `calcFV`/`calcBESS`, unified `validarFvForm` / `validarBessForm` with `hasHybridBessOnSite`, FV `generacion_anual_kwh`+`capex`, BESS `marca`+`uso`+`capex`); (2) `components/proyectos/ProductoFormFields.tsx` & `ProductoCard.tsx` shared by both wizard and `EditarSolucionTecnicaModal.tsx` (shrinking modal from 893 to ~350 lines); (3) `components/proyectos/ProyectoWizard.tsx` parameterized by `role: 'admin' \| 'epc' \| 'finder'` (fixing `validarPaso2()` at step 2, guarding `isNodoBuscaSubmit` before `validarPaso3()` and inserting `inversion_total: null` for `nodo_busca`, and surfacing `v25` `tarifa_actual_cfe`, `consumo_anual_gwh`, `codigo_postal`); reduce `admin/proyectos/nuevo/page.tsx`, `epc/nuevo/page.tsx`, `finder/nuevo/page.tsx` to 3–5 line wrappers (`return <ProyectoWizard role="..." />`). | Fixes all 3 wizard/modal validation & `nodo_busca` bugs in one canonical source; prevents future drift across portals. |
| 11 | **Consolidated Project Detail Loader**: `components/proyectos/DetalleProyectoLoader.tsx`, `components/DetalleProyecto.tsx`, `{admin,analista,epc,finder}/proyectos/[id]/page.tsx`, `financiero/proyectos/[id]/page.tsx` | `{admin,analista,epc,finder}/proyectos/[id]/page.tsx` (395 lines total); `financiero/[id]:66,128` (172 lines); `DetalleProyecto.tsx:151-157, 203-271, 1151-1161, 1267-1296, 1543, 1564, 1622` | 4 portal `[id]/page.tsx` files duplicate identical 9-query loaders (1–3 line diff); `DetalleProyecto.tsx` lacks `isCliente`/`isFinanciero` mode, `:1151-1161` `'legacy'` fallback lacks `ahorro_estimado_*`/`ahorro_moneda`, `:1543` truthy check hides `$0` CAPEX, and no simulator section exists. | Extract `components/proyectos/DetalleProyectoLoader.tsx` (deriving portal context via `usePathname()` or optional prop, loading project + technical/financing + active `calculadora_templates` + `simulaciones_ahorro` in parallel, rendering `<DetalleProyecto />` + `<SimuladorAhorrosSeccion />`); replace `admin/`, `analista/`, `epc/`, `finder/proyectos/[id]/page.tsx` with **2-line re-exports** (`export { default } from '@/components/proyectos/DetalleProyectoLoader'`, matching `analista/usuarios/page.tsx:1-2`). Populate `:1151-1161` fallback fields in `DetalleProyecto.tsx`, support `isCliente`/`isFinanciero` read-only mode, mount `<SimuladorAhorrosSeccion />`, and surface stale-simulation badge. | Eliminates 4 duplicated route loaders and delivers simulator + solution exposure consistently across all 6 portals. |
| 12 | `app/(portals)/financiero/page.tsx` & `financiero/proyectos/[id]/page.tsx` | `page.tsx:42,73,116,222`; `[id]/page.tsx:66,128` | Hardcodes `* 3.9` MXN/kWh; `page.tsx:222` formats `p.capex_estimado || 0` in `'MXN'` (masking `null` as `$0` and ignoring `p.moneda`). | Select `moneda, tarifa_actual_cfe`; render `fmtCurrency(p.capex_estimado, p.moneda \|\| 'MXN')`; use configured/template tariff instead of `3.9`; mount `<SimuladorAhorrosSeccion />` (or reuse `DetalleProyectoLoader`) on `financiero/proyectos/[id]/page.tsx`. | Keeps existing telemetry KPIs and charts working. |
| 13 | `lib/dashboard-data.ts`, `components/TimePeriodSelector.tsx` & `components/DashboardAnalytics.tsx` | `dashboard-data.ts:13-20, 194, 203, 223-225, 328-386, 438, 455, 512, 528-535`; `TimePeriodSelector.tsx:106-145`; `DashboardAnalytics.tsx:58` | Mixes `USD` and `MXN` without FX conversion across `activePipelineCapex` (`:223-225`), `financials` (`:328-386`, including `prod.datos.capex` / `fvCapex` / `bessCapex` / `projectCapex` at `dashboard-data.ts:332-340` and `TimePeriodSelector.tsx:113-118` without checking `d.capex_moneda`), `epcLeaderboard` (`:438`), `finderLeaderboard` (`:455`), and `geoCAPEX` (`:512`); `RawProject`/`rawProjects` (`:13-20, 528-535`) omit `moneda`; `:203` selects `moneda` on `configuraciones_tecnicas` but omits `ahorro_moneda` (`v28`); `TimePeriodSelector` ignores `configuraciones_tecnicas` gross savings unlike `dashboard-data.ts`. | Fetch active `calculadora_templates` and read `extractTemplateDefaults(template.campos).tipo_cambio_usd_mxn`; select `ahorro_moneda` alongside `moneda` on `configuraciones_tecnicas` at `:203` so gross savings FX conversion uses `c.ahorro_moneda \|\| c.moneda \|\| 'MXN'`; normalize `capex_estimado`, product `datos.capex` (via `d.capex_moneda ?? project.moneda ?? 'USD'`), and annual savings to `MXN` across all KPI/leaderboard/geo sums; include `moneda` in `RawProject`/`rawProjects` and expose `rawConfigs` + `fxRate` on `DashboardData`; update `computeFinancial(fp, data.rawProducts, data.rawFinancingOptions, data.rawConfigs, data.fxRate)` in `TimePeriodSelector.tsx:106` and its call site in `DashboardAnalytics.tsx:58`. | Keeps `<DashboardAnalytics data={data} />` top-level prop interface backward-compatible. |
| 14 | **Consolidated Settings**: `components/ConfiguracionLoader.tsx`, `components/Configuracion.tsx`, `{admin,analista,epc,finder}/configuracion/page.tsx` & `admin/configuracion/calculadora/page.tsx` | `Configuracion.tsx:23-29, 84-163, 210-221`; 4× `configuracion/page.tsx` (148 lines total) | Preferences stored only in `localStorage`; no calculator/formula config section for `nodo_admin`; 4 portals duplicate identical 37-line `configuracion/page.tsx` loaders (`admin/configuracion/page.tsx:23` defaults missing `profileRow?.rol` to `'nodo_admin'` client-side). | Extract `components/ConfiguracionLoader.tsx` (failing closed with `rol: profileRow?.rol ?? 'pendiente'` and error/redirect fallback when `profileRow` is null—**never** deriving `'nodo_admin'` from `usePathname()`) and turn `admin/`, `analista/`, `epc/`, `finder/configuracion/page.tsx` into **2-line re-exports**; add `"Calculadora y Fórmulas"` link (`/admin/configuracion/calculadora`) in `Configuracion.tsx` **strictly gated to `initialProfile.rol === 'nodo_admin'`** (never shown in `/analista/configuracion`); build `/admin/configuracion/calculadora/page.tsx` as a Server Component checking `await supabase.auth.getUser()` + `profiles.rol === 'nodo_admin'` server-side. | Zero exposure to `nodo_analista` or other roles; fail-closed on missing profile; immune to stale JWT claims; eliminates 4 duplicated settings pages. |
| 15 | `app/(portals)/analista/AnalistaDashboardClient.tsx` | `:92-100` | `cambiarEstado` updates `proyectos.estado` without verifying `configuraciones_tecnicas.seleccionada` and `opciones_financiamiento.seleccionada`. | Query/check selected technical & financing rows before allowing transition to `aprobado`, `en_construccion`, `operativo`, or `completado` (matching `DetalleProyecto.tsx:275-285`). | Closes pipeline-gating bypass. |
| 16 | `components/marketplace/OfertasBoard.tsx` | `:12` (`:40` query) | `ProyectoMEM` interface at `:12` types `tarifa_actual_cfe: string` while `v25` SQL column is `NUMERIC`. | Change `:12` type to `number \| string \| null` and format with `fmtCurrency(..., 'MXN')`. | Prevents type mismatch in strict TS. |
| 17 | `app/login/page.tsx` | `:54-61` | Missing `else if (rol === 'finder') sub = 'finder'` branch (falls through to `/epc`, relying on `proxy.ts` redirect). | Add explicit `else if (rol === 'finder') sub = 'finder'`. | Removes unnecessary redirect bounce. |
| 18 | `lib/egauge.ts` & `lib/format.ts` | `egauge.ts:1-86` (`EnergyChart.tsx:4`); `format.ts:87-90` | `lib/egauge.ts` exports unused mock generators (`getDailyTelemetry`, `getFinancialMetrics`) with hardcoded `3.9` MXN/kWh (zero callers), while `components/telemetry/EnergyChart.tsx:4` imports `type { TelemetryDataPoint }` from `@/lib/egauge`; `formatNumberInput` (`lib/format.ts:89`) strips `-`, blocking negative `escalacion_tarifa_anual` / `inflacion_anual` overrides. | Remove the unused mock functions (`getDailyTelemetry`, `getFinancialMetrics`) and their hardcoded `3.9` MXN/kWh heuristic while keeping `export interface TelemetryDataPoint` exported in `lib/egauge.ts` (or re-exported from `lib/types.ts`) for `EnergyChart.tsx:4`; add `formatSignedNumberInput` / `parseSignedNum` helper in `lib/format.ts` (preserving leading `-`) for signed `%` calculator inputs without altering existing `formatNumberInput` callers. | Zero active callers on mock functions; `EnergyChart.tsx:4` `TelemetryDataPoint` import preserved; backward-compatible `lib/format.ts` extension. |
| 19 | `components/plan/FinancialMilestoneModal.tsx`, `components/DocumentCenter.tsx`, `supabase/schema.sql`, `supabase/v15_fix_archivos_rls.sql` & `supabase/v16_link_clientes_usuarios.sql` | `FinancialMilestoneModal.tsx:85, 87`; `DocumentCenter.tsx:136-145, 189-211, 249-250`; `schema.sql:231-234`; `v15_fix_archivos_rls.sql:9-43`; `v16_link_clientes_usuarios.sql:69-87` | `FinancialMilestoneModal.tsx:85, 87` uploads payment receipts (`comprobantes/<proyecto_id>/*`) to non-existent bucket `'archivos'`; `schema.sql:231-234` defines global `TO authenticated` policy `"Subir archivos autenticados"` on `'archivos-proyectos'`, which `DocumentCenter.tsx:189-193` uses at `<proyecto_id>/*` across `/admin`, `/analista`, `/epc`, and `/finder` (`DetalleProyecto.tsx:1612`) before inserting into `public.archivos` (`:203-211`); `v15_fix_archivos_rls.sql:9-33` (updated in `v16_link_clientes_usuarios.sql:69-87` for `cliente_final` `SELECT` and project-scoped `financiero`) omits `finder` from `public.archivos` `SELECT`/`INSERT` RLS. | Migrate `FinancialMilestoneModal.tsx:85, 87` from `'archivos'` to `'archivos-proyectos'`; in `v29` §7c drop `"Subir archivos autenticados"` and enforce project/role-scoped policies on `'archivos-proyectos'` for **both** prefixes (never a global `TO authenticated` policy): (1) `comprobantes/<proyecto_id>/*` (`INSERT`/`UPDATE`/`DELETE` for `nodo_admin`, `nodo_analista`, owning `epc`, assigned `financiero` per `FinancialMilestoneModal.tsx:83-85`) and (2) `<proyecto_id>/*` (`"Subir documentos proyecto"` `INSERT` for `nodo_admin`, `nodo_analista`, owning `epc`, owning `finder`, assigned `financiero` per `DocumentCenter.tsx:189-193`). Wrap all 5 `::uuid` folder casts in `CASE WHEN ... ~ '^[0-9a-fA-F]{8}-...' THEN ...::uuid END` to prevent `22P02` planner-reordering errors, and in `v29` §7f update `public.archivos` `SELECT`/`INSERT` RLS by **preserving `v16_link_clientes_usuarios.sql:70-87`** (`cliente_final` `SELECT` via `p.cliente_id IS NOT NULL AND p.cliente_id = public.get_my_cliente_crm_id()` and project-scoped `financiero` via `p.financiero_id = auth.uid()`) while adding `finder` (`public.get_my_rol() = 'finder' AND p.finder_id = auth.uid()`) and scoping `financiero` in `"Insertar archivos"` to `p.financiero_id = auth.uid()` (matching `v29` §7c `:782`); `v15` `DELETE` (`:38-43`, `auth.uid() = autor_id`) already matches `DocumentCenter.tsx:138, 249-250`. | Fixes broken financial milestone receipt upload and preserves `DocumentCenter.tsx` uploads/queries across `/admin`, `/analista`, `/epc`, `/finder`, and `v16` `cliente_final` reads while enforcing cross-tenant storage & DB isolation. |
| 20 | `supabase/v15_fix_archivos_rls.sql`, `v16_link_clientes_usuarios.sql`, `v22_opciones_financiamiento.sql`, `v22_finder_role.sql`, `v18_admin_clientes_sitios_rls.sql`, `v2_migration.sql` | `v15:9-43`; `v16:69-87`; `v22_opt:102-113`; `v22_finder:55-79`; `v18:24-40`; `v2:78-83` | `v15` / `v16` `public.archivos` `SELECT`/`INSERT` RLS omits `finder` (and `v15` `"Insertar archivos"` used global `'financiero'`); `config_financiamiento` `SELECT` omits `cliente_final`; Finder lacks `UPDATE`/`DELETE` RLS on `proyecto_sitio_productos`; `sitios` lacks `SELECT` RLS for `cliente_final` and `financiero` (and `v22_finder_role.sql:74-79` omits `finder` read access on projects whose client was created by another finder); `ofertas_mem` `SELECT` checks legacy `pr.cliente_id = auth.uid()` (pre-`v16`) and omits `finder_id`/`financiero_id`. | In `v29` §7: add `cliente_final` `SELECT` policy on `config_financiamiento` (§7a); add Finder `UPDATE`/`DELETE` policies on `proyecto_sitio_productos` (§7b); add `cliente_final` (`get_my_cliente_crm_id()`), `financiero` (`financiero_id = auth.uid()`), and project-linked `finder` (`p.finder_id = auth.uid()`) `SELECT` policies on `sitios` (§7d); update `ofertas_mem` `SELECT` policy (§7e); and grant `finder` (`p.finder_id = auth.uid()`) `SELECT`/`INSERT` access on `public.archivos` (§7f) while preserving `v16_link_clientes_usuarios.sql:70-87` (`cliente_final` `SELECT` and project-scoped `financiero`). | Enables full client/financier/finder read access to site demand, MEM tariff, financing links, and `DocumentCenter` project documents without regressing `v16` tenant scoping. |
| 21 | **Consolidated Clients & Portfolio Routes**: `components/clientes/{ClientesDirectory,NuevoClienteForm,DetalleClienteView}.tsx`, `components/proyectos/PortfolioProyectosClient.tsx` | `{admin,analista,epc,finder}/clientes/page.tsx` (559 lines); `{epc,finder}/clientes/nuevo/page.tsx` (370 lines); `{admin,analista,epc,finder}/clientes/[id]/page.tsx` (1,593 lines); `{epc,finder}/proyectos/page.tsx` + `{Epcista,Finder}ProyectosClient.tsx` (659 lines) | 4 client directories, 2 new-client forms, 4 client detail views, and 2 portfolio lists duplicate ~3,181 lines differing by 2–23 lines (`epcista_id` vs `finder_id`, portal link prefixes, capability flags); `admin/clientes/page.tsx:97` hardcodes `/admin/clientes/${c.id}`. | Consolidate into `ClientesDirectory.tsx` (deriving `/admin` vs `/analista` row links from `usePathname()`, enabling 2-line re-export at `analista/clientes/page.tsx`, plus shared card directory for `epc`/`finder`), `NuevoClienteForm.tsx` (`epc`/`finder`), `DetalleClienteView.tsx` (unifying all 4 roles via `canEdit`/`canDelete`/`canCreateUsers`/`showOwnerBadge` flags), and `PortfolioProyectosClient.tsx` (unifying `EpcistaProyectosClient.tsx` & `FinderProyectosClient.tsx`). | Eliminates ~3,000 lines of duplicate portal CRUD pages while keeping role isolation and portal-scoped links intact. |

---

## 2. Database Schema, Migration (`v29_savings_calculator.sql`) & RLS Contracts (R1, R2, R3)

### 2.1 Entity-Relationship Overview

```text
auth.users / public.profiles (rol, cliente_crm_id)
  │
  ├──▶ public.calculadora_templates         (append-only versioned declarative campos + formulas + Excel mapping; nodo_admin RPCs)
  │       ▲
  └──▶ public.proyectos (capex_estimado, moneda, tarifa_actual_cfe, consumo_anual_gwh, ...)
          ├──▶ public.configuraciones_tecnicas (inversion_total, moneda, ahorro_estimado_anual)
          ├──▶ public.opciones_financiamiento (vehiculo_inversion, plazo_meses, moneda)
          └──▶ public.simulaciones_ahorro    (slim: template ref + sparse parametros_override + KPIs; 1..360m series evaluated on the fly in TS)
                  ├── FK proyecto_id ──────────────▶ proyectos(id) ON DELETE CASCADE
                  ├── FK configuracion_id ─────────▶ configuraciones_tecnicas(id) ON DELETE SET NULL
                  ├── FK opcion_financiamiento_id ─▶ opciones_financiamiento(id) ON DELETE SET NULL
                  ├── FK template_id ──────────────▶ calculadora_templates(id) ON DELETE RESTRICT
                  └── FK created_by ───────────────▶ profiles(id) ON DELETE SET NULL
```

### 2.2 Production Migration SQL (`supabase/v29_savings_calculator.sql`)

```sql
-- ============================================================================
-- MIGRATION: v29 — Energy & Monetary Savings Calculator / Simulator (R1-R4)
-- Dependencies: schema.sql, v3_fix_rls.sql, v15_fix_archivos_rls.sql,
--               v16_link_clientes_usuarios.sql, v22_configuraciones_tecnicas.sql,
--               v22_opciones_financiamiento.sql, v22_finder_role.sql,
--               v25_schema_fixes.sql, v28_annual_savings_and_storage.sql
-- ============================================================================

-- ── 1. Declarative Calculator Templates (append-only versioned, 1 active) ───
CREATE TABLE IF NOT EXISTS public.calculadora_templates (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version                INTEGER NOT NULL DEFAULT 1,
  nombre                 TEXT NOT NULL DEFAULT 'Plantilla Racional Nodo MX',
  descripcion            TEXT,
  modo                   TEXT NOT NULL DEFAULT 'default'
                           CHECK (modo IN ('default', 'custom_formulas', 'excel_import')),
  is_active              BOOLEAN NOT NULL DEFAULT FALSE,

  -- Declarative field schema array:
  -- [{ key, label, unit, type, group, min?, max?, step?, defaultValue, validationRules?, editableByUser, order }]
  campos                 JSONB NOT NULL CHECK (jsonb_typeof(campos) = 'array'),

  -- Ordered 7-formula expression array keyed to Platform Output Keys:
  -- [{ key, label, expression, unit, enabled, source_cell?, ast_validated }]
  formulas               JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(formulas) = 'array'),

  horizonte_opciones     INTEGER[] NOT NULL DEFAULT ARRAY[1, 3, 5, 10, 15, 20, 25],

  -- Excel import traceability (populated when modo = 'excel_import')
  excel_archivo_nombre   TEXT,
  excel_archivo_hash     TEXT,
  excel_hoja_origen      TEXT,
  excel_mapeo_campos     JSONB,
  excel_preview_snapshot JSONB,

  validation_status      TEXT NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'invalid')),
  validation_errors      JSONB NOT NULL DEFAULT '[]'::jsonb,
  notas                  TEXT,

  created_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_calc_templates_version UNIQUE (version),
  CONSTRAINT chk_calc_templates_horizonte_bounds CHECK (
    cardinality(horizonte_opciones) >= 1
    AND horizonte_opciones <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30]::integer[]
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calc_templates_active
  ON public.calculadora_templates (is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_calc_templates_version
  ON public.calculadora_templates (version DESC);

DROP TRIGGER IF EXISTS trg_calc_templates_updated_at ON public.calculadora_templates;
CREATE TRIGGER trg_calc_templates_updated_at
  BEFORE UPDATE ON public.calculadora_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Append-only immutability: existing template versions cannot mutate id, campos, formulas, or metadata;
-- only is_active (and updated_at) may rotate via atomic nodo_admin RPCs.
CREATE OR REPLACE FUNCTION public.enforce_calculadora_template_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.id IS DISTINCT FROM OLD.id)
     OR (NEW.version IS DISTINCT FROM OLD.version)
     OR (NEW.nombre IS DISTINCT FROM OLD.nombre)
     OR (NEW.descripcion IS DISTINCT FROM OLD.descripcion)
     OR (NEW.modo IS DISTINCT FROM OLD.modo)
     OR (NEW.campos IS DISTINCT FROM OLD.campos)
     OR (NEW.formulas IS DISTINCT FROM OLD.formulas)
     OR (NEW.horizonte_opciones IS DISTINCT FROM OLD.horizonte_opciones)
     OR (NEW.excel_archivo_nombre IS DISTINCT FROM OLD.excel_archivo_nombre)
     OR (NEW.excel_archivo_hash IS DISTINCT FROM OLD.excel_archivo_hash)
     OR (NEW.excel_hoja_origen IS DISTINCT FROM OLD.excel_hoja_origen)
     OR (NEW.excel_mapeo_campos IS DISTINCT FROM OLD.excel_mapeo_campos)
     OR (NEW.excel_preview_snapshot IS DISTINCT FROM OLD.excel_preview_snapshot)
     OR (NEW.validation_status IS DISTINCT FROM OLD.validation_status)
     OR (NEW.validation_errors IS DISTINCT FROM OLD.validation_errors)
     OR (NEW.notas IS DISTINCT FROM OLD.notas)
     OR (NEW.created_by IS DISTINCT FROM OLD.created_by)
     OR (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'Las versiones de calculadora_templates son inmutables; cree una nueva versión en lugar de modificarla.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_templates_immutable ON public.calculadora_templates;
CREATE TRIGGER trg_calc_templates_immutable
  BEFORE UPDATE ON public.calculadora_templates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_calculadora_template_immutability();

-- ── 2. Saved Project Savings Simulations (Slim: Sparse Overrides + KPIs) ────
-- Note: 1..360 month series is evaluated deterministically on the fly in TypeScript (< 1 ms)
-- from (template, projectData, parametros_override) — zero bloated time-series JSONB in DB.
CREATE TABLE IF NOT EXISTS public.simulaciones_ahorro (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id               UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  configuracion_id          UUID REFERENCES public.configuraciones_tecnicas(id) ON DELETE SET NULL,
  opcion_financiamiento_id  UUID REFERENCES public.opciones_financiamiento(id) ON DELETE SET NULL,

  nombre                    TEXT NOT NULL,
  descripcion               TEXT,
  usa_parametros_base       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Immutable template provenance & sparse user overrides ({} when usa_parametros_base = TRUE)
  template_id               UUID NOT NULL REFERENCES public.calculadora_templates(id) ON DELETE RESTRICT,
  template_version          INTEGER NOT NULL,
  parametros_override       JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(parametros_override) = 'object'),

  -- Calculation configuration
  moneda_calculo            TEXT NOT NULL DEFAULT 'MXN' CHECK (moneda_calculo IN ('MXN', 'USD')),
  tipo_cambio_usado         NUMERIC(10, 4) NOT NULL CHECK (tipo_cambio_usado > 0),
  horizonte_anios           INTEGER NOT NULL CHECK (horizonte_anios BETWEEN 1 AND 30),
  granularidad_default      TEXT NOT NULL DEFAULT 'anual' CHECK (granularidad_default IN ('mensual', 'trimestral', 'anual')),
  vista_financiamiento      TEXT NOT NULL DEFAULT 'bruto' CHECK (vista_financiamiento IN ('bruto', 'neto')),
  fuente_calculo            TEXT NOT NULL DEFAULT 'fisico_tarifario'
                              CHECK (fuente_calculo IN ('fisico_tarifario', 'ahorro_declarado', 'formula_personalizada')),

  -- Financial Gating Invariant: persisted simulations ALWAYS have positive CAPEX
  capex_snapshot            NUMERIC(16, 2) NOT NULL CHECK (capex_snapshot > 0),
  desembolso_inicial        NUMERIC(16, 2) NOT NULL CHECK (desembolso_inicial >= 0),

  -- Lightweight Summary KPIs
  payback_simple_meses      NUMERIC(10, 2),
  payback_simple_anios      NUMERIC(8, 2),
  payback_descontado_meses  NUMERIC(10, 2),
  payback_estado            TEXT NOT NULL CHECK (payback_estado IN ('inmediato', 'en_horizonte', 'fuera_horizonte', 'no_recuperable')),
  ahorro_energia_y1_kwh     NUMERIC(16, 2) NOT NULL DEFAULT 0,
  ahorro_energia_total_kwh  NUMERIC(18, 2) NOT NULL DEFAULT 0,
  ahorro_monetario_y1       NUMERIC(16, 2) NOT NULL DEFAULT 0,
  ahorro_monetario_total    NUMERIC(18, 2) NOT NULL DEFAULT 0,
  flujo_neto_total          NUMERIC(18, 2) NOT NULL DEFAULT 0,
  roi_pct                   NUMERIC(10, 2),
  tir_pct                   NUMERIC(10, 4),
  van                       NUMERIC(18, 2),

  -- Invalidation flag when project CAPEX / technical config / financing changes
  is_stale                  BOOLEAN NOT NULL DEFAULT FALSE,

  created_by                UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulaciones_proyecto
  ON public.simulaciones_ahorro (proyecto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulaciones_created_by
  ON public.simulaciones_ahorro (created_by);

DROP TRIGGER IF EXISTS trg_simulaciones_ahorro_updated_at ON public.simulaciones_ahorro;
CREATE TRIGGER trg_simulaciones_ahorro_updated_at
  BEFORE UPDATE ON public.simulaciones_ahorro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 2b. Cross-Project & Referential Integrity Trigger on simulaciones_ahorro ──
CREATE OR REPLACE FUNCTION public.validate_simulacion_ahorro_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.proyecto_id IS DISTINCT FROM OLD.proyecto_id THEN
    RAISE EXCEPTION 'proyecto_id es inmutable en simulaciones_ahorro';
  END IF;

  IF NEW.configuracion_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.configuraciones_tecnicas ct
     WHERE ct.id = NEW.configuracion_id
       AND ct.proyecto_id = NEW.proyecto_id
  ) THEN
    RAISE EXCEPTION 'configuracion_id (%) no pertenece al proyecto (%)', NEW.configuracion_id, NEW.proyecto_id;
  END IF;

  IF NEW.opcion_financiamiento_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.opciones_financiamiento ofin
     WHERE ofin.id = NEW.opcion_financiamiento_id
       AND ofin.proyecto_id = NEW.proyecto_id
  ) THEN
    RAISE EXCEPTION 'opcion_financiamiento_id (%) no pertenece al proyecto (%)', NEW.opcion_financiamiento_id, NEW.proyecto_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_simulaciones_ahorro_integrity ON public.simulaciones_ahorro;
CREATE TRIGGER trg_simulaciones_ahorro_integrity
  BEFORE INSERT OR UPDATE ON public.simulaciones_ahorro
  FOR EACH ROW EXECUTE FUNCTION public.validate_simulacion_ahorro_integrity();

-- ── 3. Atomic Template Versioning & Activation RPCs (nodo_admin only) ────────
CREATE OR REPLACE FUNCTION public.crear_y_activar_calculadora_template(
  p_nombre TEXT,
  p_descripcion TEXT,
  p_modo TEXT,
  p_campos JSONB,
  p_formulas JSONB,
  p_horizonte_opciones INTEGER[] DEFAULT ARRAY[1, 3, 5, 10, 15, 20, 25],
  p_excel_archivo_nombre TEXT DEFAULT NULL,
  p_excel_archivo_hash TEXT DEFAULT NULL,
  p_excel_hoja_origen TEXT DEFAULT NULL,
  p_excel_mapeo_campos JSONB DEFAULT NULL,
  p_excel_preview_snapshot JSONB DEFAULT NULL,
  p_notas TEXT DEFAULT NULL
)
RETURNS public.calculadora_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version INTEGER;
  v_horizonte_opciones INTEGER[];
  v_row public.calculadora_templates;
BEGIN
  IF public.get_my_rol() IS DISTINCT FROM 'nodo_admin' THEN
    RAISE EXCEPTION 'Solo nodo_admin puede actualizar la plantilla de calculadora';
  END IF;

  IF p_modo NOT IN ('default', 'custom_formulas', 'excel_import') THEN
    RAISE EXCEPTION 'Modo de plantilla inválido: %', p_modo;
  END IF;

  IF jsonb_typeof(p_campos) IS DISTINCT FROM 'array' OR jsonb_typeof(p_formulas) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'campos y formulas deben ser arreglos JSONB';
  END IF;

  v_horizonte_opciones := COALESCE(p_horizonte_opciones, ARRAY[1, 3, 5, 10, 15, 20, 25]);
  IF cardinality(v_horizonte_opciones) = 0 OR EXISTS (
    SELECT 1 FROM unnest(v_horizonte_opciones) AS h
    WHERE h IS NULL OR h < 1 OR h > 30
  ) THEN
    RAISE EXCEPTION 'horizonte_opciones debe contener únicamente enteros entre 1 y 30 años';
  END IF;

  LOCK TABLE public.calculadora_templates IN SHARE ROW EXCLUSIVE MODE;

  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM public.calculadora_templates;

  UPDATE public.calculadora_templates
     SET is_active = FALSE
   WHERE is_active = TRUE;

  INSERT INTO public.calculadora_templates (
    version, nombre, descripcion, modo, is_active,
    campos, formulas, horizonte_opciones,
    excel_archivo_nombre, excel_archivo_hash, excel_hoja_origen,
    excel_mapeo_campos, excel_preview_snapshot,
    validation_status, validation_errors, notas, created_by
  )
  VALUES (
    v_next_version,
    COALESCE(NULLIF(p_nombre, ''), 'Plantilla Calculadora Nodo v' || v_next_version),
    p_descripcion,
    p_modo,
    TRUE,
    p_campos,
    p_formulas,
    v_horizonte_opciones,
    p_excel_archivo_nombre,
    p_excel_archivo_hash,
    p_excel_hoja_origen,
    p_excel_mapeo_campos,
    p_excel_preview_snapshot,
    'valid',
    '[]'::jsonb,
    p_notas,
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.activar_calculadora_template(p_template_id UUID)
RETURNS public.calculadora_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.calculadora_templates;
BEGIN
  IF public.get_my_rol() IS DISTINCT FROM 'nodo_admin' THEN
    RAISE EXCEPTION 'Solo nodo_admin puede activar versiones de plantilla';
  END IF;

  LOCK TABLE public.calculadora_templates IN SHARE ROW EXCLUSIVE MODE;

  SELECT * INTO v_row
    FROM public.calculadora_templates
   WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plantilla de calculadora no encontrada (%)', p_template_id;
  END IF;

  IF v_row.validation_status IS DISTINCT FROM 'valid' THEN
    RAISE EXCEPTION 'No se puede activar una plantilla con validation_status <> valid';
  END IF;

  UPDATE public.calculadora_templates
     SET is_active = FALSE
   WHERE is_active = TRUE
     AND id <> p_template_id;

  UPDATE public.calculadora_templates
     SET is_active = TRUE
   WHERE id = p_template_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_y_activar_calculadora_template(TEXT, TEXT, TEXT, JSONB, JSONB, INTEGER[], TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activar_calculadora_template(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_y_activar_calculadora_template(TEXT, TEXT, TEXT, JSONB, JSONB, INTEGER[], TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activar_calculadora_template(UUID) TO authenticated;

-- ── 4. Stale-Simulation Invalidation Triggers ───────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_project_simulations_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proyecto_id UUID;
BEGIN
  v_proyecto_id := COALESCE(NEW.proyecto_id, OLD.proyecto_id);
  IF v_proyecto_id IS NOT NULL THEN
    UPDATE public.simulaciones_ahorro
       SET is_stale = TRUE
     WHERE proyecto_id = v_proyecto_id
       AND is_stale = FALSE;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_proyecto_row_simulations_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.capex_estimado IS DISTINCT FROM NEW.capex_estimado)
     OR (OLD.moneda IS DISTINCT FROM NEW.moneda)
     OR (OLD.tarifa_actual_cfe IS DISTINCT FROM NEW.tarifa_actual_cfe)
     OR (OLD.consumo_anual_gwh IS DISTINCT FROM NEW.consumo_anual_gwh)
     OR (OLD.demanda_kw IS DISTINCT FROM NEW.demanda_kw)
     OR (OLD.capacidad_mw IS DISTINCT FROM NEW.capacidad_mw)
     OR (OLD.capacidad_mwh IS DISTINCT FROM NEW.capacidad_mwh)
     OR (OLD.volumen_energia_mwh_anual IS DISTINCT FROM NEW.volumen_energia_mwh_anual)
     OR (OLD.incluye_mem IS DISTINCT FROM NEW.incluye_mem)
     OR (OLD.tipo IS DISTINCT FROM NEW.tipo) THEN
    UPDATE public.simulaciones_ahorro
       SET is_stale = TRUE
     WHERE proyecto_id = NEW.id
       AND is_stale = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_sitio_simulations_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.demanda_contratada_kw IS DISTINCT FROM NEW.demanda_contratada_kw THEN
    UPDATE public.simulaciones_ahorro sa
       SET is_stale = TRUE
      FROM public.proyecto_sitios ps
     WHERE ps.sitio_id = NEW.id
       AND sa.proyecto_id = ps.proyecto_id
       AND sa.is_stale = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proyectos_stale_sims ON public.proyectos;
CREATE TRIGGER trg_proyectos_stale_sims
  AFTER UPDATE OF capex_estimado, moneda, tarifa_actual_cfe, consumo_anual_gwh, demanda_kw, capacidad_mw, capacidad_mwh, volumen_energia_mwh_anual, incluye_mem, tipo
  ON public.proyectos
  FOR EACH ROW EXECUTE FUNCTION public.mark_proyecto_row_simulations_stale();

DROP TRIGGER IF EXISTS trg_configs_stale_sims ON public.configuraciones_tecnicas;
CREATE TRIGGER trg_configs_stale_sims
  AFTER INSERT OR UPDATE OR DELETE ON public.configuraciones_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.mark_project_simulations_stale();

DROP TRIGGER IF EXISTS trg_opciones_stale_sims ON public.opciones_financiamiento;
CREATE TRIGGER trg_opciones_stale_sims
  AFTER INSERT OR UPDATE OR DELETE ON public.opciones_financiamiento
  FOR EACH ROW EXECUTE FUNCTION public.mark_project_simulations_stale();

DROP TRIGGER IF EXISTS trg_productos_stale_sims ON public.proyecto_sitio_productos;
CREATE TRIGGER trg_productos_stale_sims
  AFTER INSERT OR UPDATE OR DELETE ON public.proyecto_sitio_productos
  FOR EACH ROW EXECUTE FUNCTION public.mark_project_simulations_stale();

DROP TRIGGER IF EXISTS trg_ofertas_mem_stale_sims ON public.ofertas_mem;
CREATE TRIGGER trg_ofertas_mem_stale_sims
  AFTER INSERT OR UPDATE OR DELETE ON public.ofertas_mem
  FOR EACH ROW EXECUTE FUNCTION public.mark_project_simulations_stale();

DROP TRIGGER IF EXISTS trg_proyecto_sitios_stale_sims ON public.proyecto_sitios;
CREATE TRIGGER trg_proyecto_sitios_stale_sims
  AFTER INSERT OR UPDATE OR DELETE ON public.proyecto_sitios
  FOR EACH ROW EXECUTE FUNCTION public.mark_project_simulations_stale();

DROP TRIGGER IF EXISTS trg_sitios_stale_sims ON public.sitios;
CREATE TRIGGER trg_sitios_stale_sims
  AFTER UPDATE OF demanda_contratada_kw ON public.sitios
  FOR EACH ROW EXECUTE FUNCTION public.mark_sitio_simulations_stale();

-- ── 5. Seed Initial Declarative Template & Rational Formula Set (Idempotent) ─
INSERT INTO public.calculadora_templates (
  version, nombre, descripcion, modo, is_active, campos, formulas, horizonte_opciones, notas
)
SELECT
  1,
  'Plantilla Racional Estándar Nodo MX v1',
  'Conjunto racional por defecto para FV, BESS y MEM (con fallback ahorro_declarado, crédito, arrendamiento y EnSaaS).',
  'default',
  TRUE,
  '[
    {"key":"moneda_default","label":"Moneda base por defecto","unit":"código","type":"select","group":"moneda","defaultValue":"MXN","validationRules":{"required":true,"options":["MXN","USD"],"overrideKey":"moneda_calculo"},"editableByUser":true,"order":1},
    {"key":"tipo_cambio_usd_mxn","label":"Tipo de cambio USD/MXN","unit":"MXN/USD","type":"number","group":"moneda","min":0.01,"max":100,"step":0.1,"defaultValue":17.5,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":2},
    {"key":"tarifa_cfe_default_mxn","label":"Tarifa CFE por defecto","unit":"MXN/kWh","type":"number","group":"tarifas","min":0,"max":50,"step":0.05,"defaultValue":3.2,"validationRules":{"required":true,"overrideKey":"tarifa_cfe_kwh"},"editableByUser":true,"order":3},
    {"key":"cargo_demanda_mensual_kw_mxn","label":"Cargo por demanda CFE","unit":"MXN/kW-mes","type":"number","group":"tarifas","min":0,"max":5000,"step":10,"defaultValue":380,"validationRules":{"required":true,"overrideKey":"cargo_demanda_mensual_kw"},"editableByUser":true,"order":4},
    {"key":"diferencial_punta_base_mxn","label":"Diferencial punta-base BESS","unit":"MXN/kWh","type":"number","group":"tarifas","min":0,"max":20,"step":0.05,"defaultValue":1.4,"validationRules":{"required":true,"overrideKey":"diferencial_punta_base_kwh"},"editableByUser":true,"order":5},
    {"key":"tarifa_mem_default_mxn","label":"Tarifa MEM por defecto","unit":"MXN/kWh","type":"number","group":"tarifas","min":0,"max":50,"step":0.05,"defaultValue":2.45,"validationRules":{"required":true,"overrideKey":"tarifa_mem_kwh"},"editableByUser":true,"order":6},
    {"key":"hsp_horas_dia","label":"Horas Solar Pico (HSP)","unit":"kWh/m²/día","type":"number","group":"fv","min":0.1,"max":12,"step":0.1,"defaultValue":5.2,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":7},
    {"key":"performance_ratio_fv","label":"Performance Ratio FV","unit":"%","type":"percentage","group":"fv","min":0.01,"max":1,"step":0.01,"defaultValue":0.8,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":8},
    {"key":"autoconsumo_fv_pct","label":"Autoconsumo FV","unit":"%","type":"percentage","group":"fv","min":0,"max":1,"step":0.01,"defaultValue":1.0,"validationRules":{"required":true},"editableByUser":true,"order":9},
    {"key":"degradacion_fv_anual","label":"Degradación anual FV","unit":"%/año","type":"percentage","group":"fv","min":0,"max":0.19999,"step":0.001,"defaultValue":0.005,"validationRules":{"required":true,"exclusiveMax":0.2},"editableByUser":true,"order":10},
    {"key":"pesos_estacionales_fv","label":"Pesos estacionales FV (12 meses)","unit":"fracción","type":"number_array","group":"fv","defaultValue":[0.072,0.076,0.090,0.093,0.098,0.091,0.089,0.088,0.080,0.080,0.073,0.070],"validationRules":{"required":true,"arrayLength":12,"sumEquals":1,"sumTolerance":0.001},"editableByUser":false,"order":11},
    {"key":"bess_dod","label":"Profundidad de descarga BESS (DoD)","unit":"%","type":"percentage","group":"bess","min":0.01,"max":1,"step":0.01,"defaultValue":0.85,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":12},
    {"key":"bess_eficiencia_rt","label":"Eficiencia round-trip BESS","unit":"%","type":"percentage","group":"bess","min":0.01,"max":1,"step":0.01,"defaultValue":0.88,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":13},
    {"key":"bess_ciclos_anio","label":"Ciclos anuales BESS","unit":"ciclos/año","type":"integer","group":"bess","min":0,"max":730,"step":10,"defaultValue":260,"validationRules":{"required":true,"integer":true},"editableByUser":true,"order":14},
    {"key":"factor_recorte_demanda","label":"Factor recorte de demanda BESS","unit":"%","type":"percentage","group":"bess","min":0,"max":1,"step":0.05,"defaultValue":0.7,"validationRules":{"required":true},"editableByUser":true,"order":15},
    {"key":"degradacion_bess_anual","label":"Degradación anual BESS","unit":"%/año","type":"percentage","group":"bess","min":0,"max":0.24999,"step":0.005,"defaultValue":0.02,"validationRules":{"required":true,"exclusiveMax":0.25},"editableByUser":true,"order":16},
    {"key":"escalacion_tarifa_anual","label":"Escalación anual de tarifa","unit":"%/año","type":"percentage","group":"macro","min":-0.10,"max":0.50,"step":0.005,"defaultValue":0.045,"validationRules":{"required":true,"allowNegative":true},"editableByUser":true,"order":17},
    {"key":"inflacion_anual","label":"Inflación anual O&M","unit":"%/año","type":"percentage","group":"macro","min":-0.05,"max":0.50,"step":0.005,"defaultValue":0.04,"validationRules":{"required":true,"allowNegative":true},"editableByUser":true,"order":18},
    {"key":"pct_om_anual","label":"Costo anual O&M (% CAPEX)","unit":"%/año","type":"percentage","group":"macro","min":0,"max":0.25,"step":0.0025,"defaultValue":0.01,"validationRules":{"required":true},"editableByUser":true,"order":19},
    {"key":"tasa_descuento_anual","label":"Tasa de descuento anual (WACC)","unit":"%/año","type":"percentage","group":"macro","min":0,"max":0.50,"step":0.005,"defaultValue":0.10,"validationRules":{"required":true},"editableByUser":true,"order":20},
    {"key":"credito_enganche_pct","label":"Enganche de crédito","unit":"%","type":"percentage","group":"financiamiento","min":0,"max":0.99,"step":0.05,"defaultValue":0.20,"validationRules":{"required":true,"overrideKey":"enganche_pct"},"editableByUser":true,"order":21},
    {"key":"credito_tasa_interes_anual","label":"Tasa de interés anual (Crédito)","unit":"%/año","type":"percentage","group":"financiamiento","min":0,"max":0.60,"step":0.005,"defaultValue":0.125,"validationRules":{"required":true,"overrideKey":"tasa_interes_anual"},"editableByUser":true,"order":22},
    {"key":"credito_plazo_meses_default","label":"Plazo financiamiento por defecto","unit":"meses","type":"integer","group":"financiamiento","min":1,"max":300,"step":12,"defaultValue":60,"validationRules":{"required":true,"integer":true,"overrideKey":"plazo_meses","overrideMin":0,"overrideMax":360},"editableByUser":true,"order":23},
    {"key":"arrendamiento_tasa_equivalente_anual","label":"Tasa equivalente anual arrendamiento","unit":"%/año","type":"percentage","group":"financiamiento","min":0,"max":0.60,"step":0.005,"defaultValue":0.135,"validationRules":{"required":true},"editableByUser":false,"order":24},
    {"key":"ensaas_factor_ahorro_pct","label":"Factor ahorro retenido EnSaaS","unit":"%","type":"percentage","group":"financiamiento","min":0.01,"max":1,"step":0.05,"defaultValue":0.25,"validationRules":{"required":true,"exclusiveMin":0},"editableByUser":true,"order":25},
    {"key":"horizonte_default_fv","label":"Horizonte por defecto FV","unit":"años","type":"integer","group":"horizontes","min":1,"max":30,"step":1,"defaultValue":25,"validationRules":{"required":true,"integer":true},"editableByUser":false,"order":26},
    {"key":"horizonte_default_bess","label":"Horizonte por defecto BESS","unit":"años","type":"integer","group":"horizontes","min":1,"max":30,"step":1,"defaultValue":10,"validationRules":{"required":true,"integer":true},"editableByUser":false,"order":27},
    {"key":"horizonte_default_mem","label":"Horizonte por defecto MEM","unit":"años","type":"integer","group":"horizontes","min":1,"max":30,"step":1,"defaultValue":5,"validationRules":{"required":true,"integer":true},"editableByUser":false,"order":28}
  ]'::jsonb,
  '[
    {"key":"fv_kwh_mes","label":"Generación FV Mensual (kWh)","expression":"=generacion_fv_y1_kwh * autoconsumo_fv_pct * POWER(1 - degradacion_fv_anual, anio_indice) * peso_estacional_mes","unit":"kWh","enabled":true},
    {"key":"bess_kwh_mes","label":"Energía Desplazada BESS (kWh)","expression":"=energia_bess_y1_kwh * POWER(1 - degradacion_bess_anual, anio_indice) / 12","unit":"kWh","enabled":true},
    {"key":"energia_ahorrada_kwh_mes","label":"Ahorro Energético Total (kWh)","expression":"=fv_kwh_mes + bess_kwh_mes","unit":"kWh","enabled":true},
    {"key":"ahorro_bruto_mes","label":"Ahorro Monetario Bruto","expression":"=IF((ahorro_fv_y1 + ahorro_bess_y1 + ahorro_mem_y1) > 0, (ahorro_fv_y1 * POWER(1 - degradacion_fv_anual, anio_indice) * peso_estacional_mes + (ahorro_bess_y1 * POWER(1 - degradacion_bess_anual, anio_indice) + ahorro_mem_y1) / 12) * POWER(1 + escalacion_tarifa_anual, anio_indice), (ahorro_declarado_bruto_anual / 12) * POWER(1 + escalacion_tarifa_anual, anio_indice))","unit":"currency","enabled":true},
    {"key":"om_mes","label":"Costo O&M Mensual","expression":"=(capex_total * pct_om_anual * POWER(1 + inflacion_anual, anio_indice)) / 12","unit":"currency","enabled":true},
    {"key":"cuota_financiamiento_mes","label":"Servicio de Deuda / Cuota","expression":"=IF(vista_neta=1, IF(vehiculo_inversion=\"ensaas\", MAX(0, ahorro_bruto_mes * (1 - ensaas_factor_ahorro_pct) - om_mes), IF(AND(mes_indice<=plazo_meses, plazo_meses>0, principal_financiado>0), IF(tasa_interes_mensual>0, -PMT(tasa_interes_mensual, plazo_meses, principal_financiado), principal_financiado / plazo_meses), 0)), 0)","unit":"currency","enabled":true},
    {"key":"flujo_neto_mes","label":"Flujo Neto Mensual","expression":"=ahorro_bruto_mes - om_mes - cuota_financiamiento_mes","unit":"currency","enabled":true}
  ]'::jsonb,
  ARRAY[1, 3, 5, 10, 15, 20, 25],
  'Configuración inicial racional declarativa para México (FV, BESS, MEM).'
WHERE NOT EXISTS (SELECT 1 FROM public.calculadora_templates WHERE is_active = TRUE);

-- ── 6. Enable RLS & Define Policies ─────────────────────────────────────────
ALTER TABLE public.calculadora_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulaciones_ahorro ENABLE ROW LEVEL SECURITY;

-- 6a. calculadora_templates: authorized authenticated roles read; all writes strictly via nodo_admin RPCs
REVOKE INSERT, UPDATE, DELETE ON public.calculadora_templates FROM anon, authenticated;

DROP POLICY IF EXISTS "Roles autorizados ven templates calculadora" ON public.calculadora_templates;
CREATE POLICY "Roles autorizados ven templates calculadora"
  ON public.calculadora_templates FOR SELECT
  USING (public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'finder', 'financiero', 'cliente_final'));

-- 6b. simulaciones_ahorro: authoritative server-side INSERT/UPDATE + membership-verified SELECT/DELETE
CREATE OR REPLACE FUNCTION public.has_simulacion_project_access(p_proyecto_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_rol() NOT IN ('pendiente', 'suministrador')
    AND EXISTS (
      SELECT 1
      FROM public.proyectos p
      WHERE p.id = p_proyecto_id
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'finder' AND p.finder_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
          OR (
            public.get_my_rol() = 'cliente_final'
            AND p.cliente_id IS NOT NULL
            AND p.cliente_id = public.get_my_cliente_crm_id()
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.has_simulacion_project_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_simulacion_project_access(UUID) TO authenticated;

-- Prevent direct client-side PostgREST INSERT/UPDATE forgery of KPIs, capex_snapshot, or overrides;
-- all creates/recalculations/renames run through app/actions/simulaciones.ts (createAdminClient after auth + membership checks).
REVOKE INSERT, UPDATE ON public.simulaciones_ahorro FROM anon, authenticated;

DROP POLICY IF EXISTS "Usuarios ven simulaciones de sus proyectos" ON public.simulaciones_ahorro;
CREATE POLICY "Usuarios ven simulaciones de sus proyectos"
  ON public.simulaciones_ahorro FOR SELECT
  USING (public.has_simulacion_project_access(proyecto_id));

DROP POLICY IF EXISTS "Usuarios autorizados crean simulaciones" ON public.simulaciones_ahorro;
DROP POLICY IF EXISTS "Creador o Nodo/EPC actualiza simulaciones" ON public.simulaciones_ahorro;

DROP POLICY IF EXISTS "Creador o Nodo/EPC elimina simulaciones" ON public.simulaciones_ahorro;
CREATE POLICY "Creador o Nodo/EPC elimina simulaciones"
  ON public.simulaciones_ahorro FOR DELETE
  USING (
    public.has_simulacion_project_access(proyecto_id)
    AND (
      public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
      OR (
        public.get_my_rol() = 'epc'
        AND EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id AND p.epcista_id = auth.uid())
      )
      OR created_by = auth.uid()
    )
  );

-- ── 7. Existing RLS & Storage Fixes (v2, v18, v22 & FinancialMilestoneModal) ─
-- 7a. Allow cliente_final to SELECT config_financiamiento links for their projects
DROP POLICY IF EXISTS "Usuarios ven links config-fin" ON public.config_financiamiento;
CREATE POLICY "Usuarios ven links config-fin"
  ON public.config_financiamiento FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.configuraciones_tecnicas ct
    JOIN public.proyectos p ON p.id = ct.proyecto_id
    WHERE ct.id = configuracion_id AND (
      p.epcista_id = auth.uid()
      OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
      OR p.financiero_id = auth.uid()
      OR p.finder_id = auth.uid()
      OR (
        public.get_my_rol() = 'cliente_final'
        AND p.cliente_id IS NOT NULL
        AND p.cliente_id = public.get_my_cliente_crm_id()
      )
    )
  ));

-- 7b. Complete Finder UPDATE/DELETE policies on proyecto_sitio_productos
DROP POLICY IF EXISTS "Finder actualiza productos" ON public.proyecto_sitio_productos;
CREATE POLICY "Finder actualiza productos"
  ON public.proyecto_sitio_productos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id AND p.finder_id = auth.uid()));

DROP POLICY IF EXISTS "Finder elimina productos" ON public.proyecto_sitio_productos;
CREATE POLICY "Finder elimina productos"
  ON public.proyecto_sitio_productos FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id AND p.finder_id = auth.uid()));

-- 7c. Project/role-scoped Storage policies on existing 'archivos-proyectos' bucket
--     Covers BOTH prefixes (replacing global authenticated insert):
--       1) comprobantes/<proyecto_id>/* (FinancialMilestoneModal.tsx:85,87 migrated from 'archivos')
--       2) <proyecto_id>/* (DocumentCenter.tsx:189-193 across /admin, /analista, /epc, /finder;
--          note DocumentCenter.tsx:138 deletes rows in public.archivos, not storage.objects,
--          and cliente_final has no DocumentCenter upload access)
DROP POLICY IF EXISTS "Subir archivos autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Archivos autenticados CRUD" ON storage.objects;

DROP POLICY IF EXISTS "Subir comprobantes proyecto" ON storage.objects;
CREATE POLICY "Subir comprobantes proyecto"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'archivos-proyectos'
    AND public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'financiero')
    AND (storage.foldername(name))[1] = 'comprobantes'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = CASE
        WHEN (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN ((storage.foldername(name))[2])::uuid
      END
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Subir documentos proyecto" ON storage.objects;
CREATE POLICY "Subir documentos proyecto"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'archivos-proyectos'
    AND public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'finder', 'financiero')
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN ((storage.foldername(name))[1])::uuid
      END
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'finder' AND p.finder_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Actualizar comprobantes proyecto" ON storage.objects;
CREATE POLICY "Actualizar comprobantes proyecto"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'archivos-proyectos'
    AND public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'financiero')
    AND (storage.foldername(name))[1] = 'comprobantes'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = CASE
        WHEN (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN ((storage.foldername(name))[2])::uuid
      END
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    bucket_id = 'archivos-proyectos'
    AND public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'financiero')
    AND (storage.foldername(name))[1] = 'comprobantes'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = CASE
        WHEN (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN ((storage.foldername(name))[2])::uuid
      END
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Eliminar comprobantes proyecto" ON storage.objects;
CREATE POLICY "Eliminar comprobantes proyecto"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'archivos-proyectos'
    AND public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'epc', 'financiero')
    AND (storage.foldername(name))[1] = 'comprobantes'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = CASE
        WHEN (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN ((storage.foldername(name))[2])::uuid
      END
        AND (
          public.get_my_rol() IN ('nodo_admin', 'nodo_analista')
          OR (public.get_my_rol() = 'epc' AND p.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND p.financiero_id = auth.uid())
        )
    )
  );

-- 7d. Allow cliente_final, financiero, and project-assigned finder to SELECT sitios linked to their projects
--     (enables demanda_contratada_kw sourcing on /cliente/proyectos/[id], /financiero/proyectos/[id],
--      and covers finders assigned by admin to projects of another finder's client vs v22_finder_role.sql:74-79)
DROP POLICY IF EXISTS "Cliente y Financiero ven sitios de sus proyectos" ON public.sitios;
DROP POLICY IF EXISTS "Cliente, Financiero y Finder ven sitios de sus proyectos" ON public.sitios;
CREATE POLICY "Cliente, Financiero y Finder ven sitios de sus proyectos"
  ON public.sitios FOR SELECT
  USING (
    (
      public.get_my_rol() = 'cliente_final'
      AND (
        cliente_id = public.get_my_cliente_crm_id()
        OR EXISTS (
          SELECT 1
          FROM public.proyecto_sitios ps
          JOIN public.proyectos p ON p.id = ps.proyecto_id
          WHERE ps.sitio_id = public.sitios.id
            AND p.cliente_id IS NOT NULL
            AND p.cliente_id = public.get_my_cliente_crm_id()
        )
      )
    )
    OR (
      public.get_my_rol() = 'financiero'
      AND EXISTS (
        SELECT 1
        FROM public.proyecto_sitios ps
        JOIN public.proyectos p ON p.id = ps.proyecto_id
        WHERE ps.sitio_id = public.sitios.id
          AND p.financiero_id = auth.uid()
      )
    )
    OR (
      public.get_my_rol() = 'finder'
      AND EXISTS (
        SELECT 1
        FROM public.proyecto_sitios ps
        JOIN public.proyectos p ON p.id = ps.proyecto_id
        WHERE ps.sitio_id = public.sitios.id
          AND p.finder_id = auth.uid()
      )
    )
  );

-- 7e. Fix legacy pre-v16 ofertas_mem SELECT policy (v2_migration.sql:78-83 checked pr.cliente_id = auth.uid())
DROP POLICY IF EXISTS "Suministrador ve sus ofertas y EPC/Nodo/Cliente ven todas" ON public.ofertas_mem;
CREATE POLICY "Suministrador ve sus ofertas y roles del proyecto ven ofertas"
  ON public.ofertas_mem FOR SELECT
  USING (
    (public.get_my_rol() = 'suministrador' AND suministrador_id = auth.uid())
    OR public.get_my_rol() IN ('nodo_analista', 'nodo_admin')
    OR EXISTS (
      SELECT 1 FROM public.proyectos pr
      WHERE pr.id = proyecto_id
        AND (
          (public.get_my_rol() = 'epc' AND pr.epcista_id = auth.uid())
          OR (public.get_my_rol() = 'finder' AND pr.finder_id = auth.uid())
          OR (public.get_my_rol() = 'financiero' AND pr.financiero_id = auth.uid())
          OR (
            public.get_my_rol() = 'cliente_final'
            AND pr.cliente_id IS NOT NULL
            AND pr.cliente_id = public.get_my_cliente_crm_id()
          )
        )
    )
  );

-- 7f. Grant finder SELECT & INSERT access on public.archivos while preserving
--     v16_link_clientes_usuarios.sql:70-87 (cliente_final SELECT via get_my_cliente_crm_id()
--     and project-scoped financiero p.financiero_id = auth.uid()) and v15_fix_archivos_rls.sql:9-33
--     (matching DocumentCenter.tsx:189-211 and v29 §7c "Subir documentos proyecto").
--     Note: DELETE policy "Eliminar archivos" (v15_fix_archivos_rls.sql:38-43) already authorizes
--     auth.uid() = autor_id OR get_my_rol() IN ('nodo_admin', 'nodo_analista'), matching DocumentCenter.tsx:138,249-250.
DROP POLICY IF EXISTS "Ver archivos del proyecto" ON public.archivos;
CREATE POLICY "Ver archivos del proyecto"
  ON public.archivos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = archivos.proyecto_id
        AND (
          p.epcista_id = auth.uid()
          OR p.financiero_id = auth.uid()
          OR (
            public.get_my_rol() = 'finder'
            AND p.finder_id = auth.uid()
          )
          OR public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'analista')
          OR (
            public.get_my_rol() = 'cliente_final'
            AND p.cliente_id IS NOT NULL
            AND p.cliente_id = public.get_my_cliente_crm_id()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Insertar archivos" ON public.archivos;
CREATE POLICY "Insertar archivos"
  ON public.archivos FOR INSERT
  WITH CHECK (
    auth.uid() = autor_id
    AND EXISTS (
      SELECT 1 FROM public.proyectos p
      WHERE p.id = archivos.proyecto_id
        AND (
          p.epcista_id = auth.uid()
          OR p.financiero_id = auth.uid()
          OR (
            public.get_my_rol() = 'finder'
            AND p.finder_id = auth.uid()
          )
          OR public.get_my_rol() IN ('nodo_admin', 'nodo_analista', 'analista')
        )
    )
  );
```

### 2.3 Row-Level Security Matrix Across All 8 Roles

| Role (`public.get_my_rol()`) | `calculadora_templates` | `simulaciones_ahorro` (`SELECT`) | `simulaciones_ahorro` (`INSERT` / `UPDATE` via Server Actions) | `simulaciones_ahorro` (`DELETE`) |
|---|---|---|---|---|
| **`nodo_admin`** | `SELECT` + atomic RPC write (`crear_y_activar_calculadora_template`, `activar_calculadora_template`) | All projects | All projects (`guardarSimulacion`, `recalcularSimulacion`, `renombrarSimulacion`) | All projects |
| **`nodo_analista`** | `SELECT` only | All projects | All projects | All projects |
| **`epc`** | `SELECT` only | Projects where `p.epcista_id = uid` | Own projects (`p.epcista_id = uid`) | Own projects (`p.epcista_id = uid`) or `created_by = uid` **with active project access** |
| **`finder`** | `SELECT` only | Projects where `p.finder_id = uid` | Own projects (`p.finder_id = uid`) | Only `created_by = uid` **with active project access (`p.finder_id = uid`)** |
| **`financiero`** | `SELECT` only | Projects where `p.financiero_id = uid` | Assigned projects (`p.financiero_id = uid`) | Only `created_by = uid` **with active project access (`p.financiero_id = uid`)** |
| **`cliente_final`** | `SELECT` only | Projects where `p.cliente_id = get_my_cliente_crm_id()` | Linked client projects | Only `created_by = uid` **with active project access (`p.cliente_id = get_my_cliente_crm_id()`)** |
| **`suministrador`** | Denied | Denied | Denied | Denied |
| **`pendiente`** | Denied | Denied | Denied | Denied |

**Security & Integrity Guarantees:**
1. **Zero Client-Side KPI/Override Forgery:** Direct `INSERT` and `UPDATE` on `public.simulaciones_ahorro` are revoked from `anon` and `authenticated`. All simulation writes pass through `app/actions/simulaciones.ts`, which verifies `supabase.auth.getUser()`, project membership, and `rol NOT IN ('pendiente', 'suministrador')` via `createClient()`, recomputes authoritative CAPEX/KPIs/cashflows server-side (`< 1 ms`), and persists via `createAdminClient()`.
2. **Append-Only Template Immutability:** Direct `INSERT`/`UPDATE`/`DELETE` on `public.calculadora_templates` are revoked from `anon` and `authenticated`; `trg_calc_templates_immutable` prevents mutating `campos` or `formulas` on any existing version row so historical simulations always reconstruct deterministically from `template_id` + sparse `parametros_override`.
3. **Immutable `proyecto_id` & Same-Project FKs:** `trg_simulaciones_ahorro_integrity` (`BEFORE INSERT OR UPDATE`) blocks `proyecto_id` re-parenting on `UPDATE` and verifies that `configuracion_id` and `opcion_financiamiento_id` belong to `proyecto_id`.
4. **Current-Membership Check on `DELETE`:** `DELETE` RLS evaluates `has_simulacion_project_access(proyecto_id)` even when `created_by = auth.uid()`, so demoted (`pendiente`/`suministrador`) or unassigned users lose mutation access immediately.

### 2.4 Strict TypeScript Interfaces (`lib/types.ts` & `lib/calculator/template-schema.ts`)

Add the following strict interfaces to `lib/types.ts` (and `lib/calculator/template-schema.ts`) alongside fixing `Proyecto` (`plan_bloqueado: boolean`, `consumo_anual_gwh: number | null`, `tarifa_actual_cfe: number | null`, `codigo_postal: string | null`) and `ahorro_estimado_anual: number | null`:

```ts
export interface ProductoFvDatos {
  num_modulos: number | string
  potencia_modulos_w: number | string
  marca_modulos?: string
  num_inversores?: number | string
  potencia_inversores_kw?: number | string
  marca_inversores?: string
  generacion_anual_kwh?: number | string
  capex: number | string
  capex_moneda?: Moneda
}

export interface ProductoBessDatos {
  potencia_kw: number | string
  capacidad_kwh: number | string
  marca?: string
  uso: 'load_shifting' | 'ups' | 'load_shifting_ups'
  capex: number | string
  capex_moneda?: Moneda
  inversores_hibridos?: boolean
}

export type GranularidadProyeccion = 'mensual' | 'trimestral' | 'anual'
export type VistaFinanciamiento = 'bruto' | 'neto'
export type PaybackEstado = 'inmediato' | 'en_horizonte' | 'fuera_horizonte' | 'no_recuperable'
export type ModoFormulaConfig = 'default' | 'custom_formulas' | 'excel_import'
export type FuenteCalculo = 'fisico_tarifario' | 'ahorro_declarado' | 'formula_personalizada'

export type CalculadoraCampoTipo = 'number' | 'percentage' | 'integer' | 'select' | 'number_array'
export type CalculadoraCampoGrupo =
  | 'moneda'
  | 'tarifas'
  | 'fv'
  | 'bess'
  | 'macro'
  | 'financiamiento'
  | 'horizontes'

export interface CalculadoraCampoValidationRules {
  required?: boolean
  allowNegative?: boolean
  integer?: boolean
  exclusiveMin?: number
  exclusiveMax?: number
  overrideMin?: number
  overrideMax?: number
  options?: string[]
  arrayLength?: number
  sumEquals?: number
  sumTolerance?: number
  overrideKey?: string
}

export interface CalculadoraCampoDef {
  key: string
  label: string
  unit: string
  type: CalculadoraCampoTipo
  group: CalculadoraCampoGrupo
  min?: number
  max?: number
  step?: number
  defaultValue: number | string | number[]
  validationRules?: CalculadoraCampoValidationRules
  editableByUser: boolean
  order: number
}

export interface FormulaDefinicion {
  key:
    | 'fv_kwh_mes'
    | 'bess_kwh_mes'
    | 'energia_ahorrada_kwh_mes'
    | 'ahorro_bruto_mes'
    | 'om_mes'
    | 'cuota_financiamiento_mes'
    | 'flujo_neto_mes'
  label: string
  expression: string
  unit: 'kWh' | 'currency'
  enabled: boolean
  source_cell?: string
  ast_validated?: boolean
}

export interface ExcelInputMapping {
  cellRef: string
  sheetName: string
  label: string
  platformVar: string
  sampleValue?: number | string | null
}

export interface ExcelOutputMapping {
  cellRef: string
  sheetName: string
  outputKey: FormulaDefinicion['key']
  rawFormula: string
  rewrittenExpression: string
}

export interface ExcelMapeoCampos {
  inputMappings: ExcelInputMapping[]
  outputMappings: ExcelOutputMapping[]
}

export interface CalculadoraTemplate {
  id: string
  version: number
  nombre: string
  descripcion: string | null
  modo: ModoFormulaConfig
  is_active: boolean
  campos: CalculadoraCampoDef[]
  formulas: FormulaDefinicion[]
  horizonte_opciones: number[]
  excel_archivo_nombre: string | null
  excel_archivo_hash: string | null
  excel_hoja_origen: string | null
  excel_mapeo_campos: ExcelMapeoCampos | null
  excel_preview_snapshot: Record<string, unknown> | null
  validation_status: 'valid' | 'invalid'
  validation_errors: string[]
  notas: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Strictly the 24 overridable simulation parameters stored in simulaciones_ahorro.parametros_override
// (22 editableByUser:true campos excluding top-level moneda_default -> moneda_calculo, plus 2 runtime engineering inputs).
// Top-level columns (moneda_calculo, horizonte_anios, vista_financiamiento) live on SimulacionRunRequest / DB columns.
export interface SimulacionOverrides {
  tipo_cambio_usd_mxn?: number
  tarifa_cfe_kwh?: number
  cargo_demanda_mensual_kw?: number
  diferencial_punta_base_kwh?: number
  tarifa_mem_kwh?: number
  consumo_anual_kwh?: number
  generacion_fv_y1_kwh?: number
  autoconsumo_fv_pct?: number
  hsp_horas_dia?: number
  performance_ratio_fv?: number
  degradacion_fv_anual?: number
  bess_ciclos_anio?: number
  bess_dod?: number
  bess_eficiencia_rt?: number
  factor_recorte_demanda?: number
  degradacion_bess_anual?: number
  escalacion_tarifa_anual?: number
  inflacion_anual?: number
  pct_om_anual?: number
  tasa_descuento_anual?: number
  enganche_pct?: number
  tasa_interes_anual?: number
  plazo_meses?: number
  ensaas_factor_ahorro_pct?: number
}

export interface SimulacionRunRequest {
  proyecto_id: string
  configuracion_id?: string | null
  opcion_financiamiento_id?: string | null
  moneda_calculo: Moneda
  horizonte_anios: number
  vista_financiamiento: VistaFinanciamiento
  granularidad_default?: GranularidadProyeccion
  parametros_override: SimulacionOverrides
}

// Persisted row in public.simulaciones_ahorro (slim: no serie_mensual JSONB stored in DB)
export interface SimulacionAhorro {
  id: string
  proyecto_id: string
  configuracion_id: string | null
  opcion_financiamiento_id: string | null
  nombre: string
  descripcion: string | null
  usa_parametros_base: boolean
  template_id: string
  template_version: number
  parametros_override: SimulacionOverrides
  moneda_calculo: Moneda
  tipo_cambio_usado: number
  horizonte_anios: number
  granularidad_default: GranularidadProyeccion
  vista_financiamiento: VistaFinanciamiento
  fuente_calculo: FuenteCalculo
  capex_snapshot: number
  desembolso_inicial: number
  payback_simple_meses: number | null
  payback_simple_anios: number | null
  payback_descontado_meses: number | null
  payback_estado: PaybackEstado
  ahorro_energia_y1_kwh: number
  ahorro_energia_total_kwh: number
  ahorro_monetario_y1: number
  ahorro_monetario_total: number
  flujo_neto_total: number
  roi_pct: number | null
  tir_pct: number | null
  van: number | null
  is_stale: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  creador?: Pick<Profile, 'id' | 'nombre' | 'rol'>
  template?: CalculadoraTemplate
}

// In-memory TypeScript engine output types (computed on the fly in < 1 ms, never stored in PostgreSQL)
export interface PeriodoMensualSimulacion {
  mes: number            // 1 .. H*12
  anio: number           // 1 .. H
  trimestre: number      // 1 .. H*4
  etiqueta: string       // e.g., "Mes 1", "Ene Año 1"
  energia_fv_kwh: number
  energia_bess_kwh: number
  energia_total_kwh: number
  ahorro_bruto: number
  costo_om: number
  cuota_financiamiento: number
  flujo_neto: number
  flujo_acumulado: number
  flujo_descontado_acumulado: number
}

export interface SimulationEvaluationResult {
  status: 'ok'
  fuente_calculo: FuenteCalculo
  capex_total: number
  desembolso_inicial: number
  usa_parametros_base: boolean
  parametros_override_sparse: SimulacionOverrides
  payback_simple_meses: number | null
  payback_simple_anios: number | null
  payback_descontado_meses: number | null
  payback_extendido_anios: number | null
  payback_estado: PaybackEstado
  ahorro_energia_y1_kwh: number
  ahorro_energia_total_kwh: number
  ahorro_monetario_y1: number
  ahorro_monetario_total: number
  flujo_neto_total: number
  roi_pct: number | null
  roi_desembolso_pct: number | null
  tir_pct: number | null
  van: number | null
  serie_mensual: PeriodoMensualSimulacion[]
}
```

**Declarative Template Utilities (`lib/calculator/template-schema.ts`):**
- `extractTemplateDefaults(campos: CalculadoraCampoDef[])`: converts the `campos` array into a strongly typed defaults object (`Record<string, number | string | number[]>`) keyed by `campo.key`.
- `validateOverridesAgainstTemplate(campos: CalculadoraCampoDef[], overrides: Record<string, unknown>)`: enforces a **strict allowlist** rejecting unknown keys (and prototype keys) plus `editableByUser: false` keys (`pesos_estacionales_fv`, `arrendamiento_tasa_equivalente_anual`, `horizonte_default_fv`, `horizonte_default_bess`, `horizonte_default_mem`) and top-level DB config keys (`moneda_calculo`, `horizonte_anios`, `vista_financiamiento`) with HTTP `422`. Permitted keys are strictly: (a) the 22 `editableByUser: true` `campos` (`overrideKey ?? key`, excluding `moneda_calculo`) validated against `validationRules.overrideMin ?? campo.min`, `validationRules.overrideMax ?? campo.max`, `exclusiveMin`, `exclusiveMax`, `integer`, `options`, and `allowNegative`—explicitly resolving `plazo_meses` to integer `[0, 360]` via `overrideMin: 0, overrideMax: 360` while `credito_plazo_meses_default` keeps `[1, 300]` for admin baselines—and (b) the 2 runtime engineering overrides (`consumo_anual_kwh >= 0`, `generacion_fv_y1_kwh >= 0`).
- `computeSparseOverrides(resolvedParams: Record<string, unknown>, tier2InSelectedCurrency: Record<string, unknown>)`: operates strictly over the 24 `SimulacionOverrides` keys (excluding top-level `simulaciones_ahorro` columns `moneda_calculo`, `horizonte_anios`, `vista_financiamiento`). Tier 2 currency-denominated tariff defaults (`tarifa_cfe_kwh`, `cargo_demanda_mensual_kw`, `diferencial_punta_base_kwh`, `tarifa_mem_kwh`) **must** be converted into `moneda_calculo` using resolved `fx` *before* calling `computeSparseOverrides`, guaranteeing that toggling `moneda_calculo` to `'USD'`, `horizonte_anios`, or `vista_financiamiento` keeps `parametros_override = {}` and `usa_parametros_base = true`.

---

## 3. Financial Preconditions, Data Sourcing & Strict Gating Specification (R2)

### 3.1 Project Creation Financial & Quantitative Sourcing Priority

Quantitative inputs are sourced automatically from what EPCs, Finders, and Admins declare when creating or editing a project (`components/proyectos/ProyectoWizard.tsx` via `{admin/proyectos,epc,finder}/nuevo/page.tsx`, `EditarSolucionTecnicaModal.tsx`, `EditarFinanciamientoModal.tsx`, `DetalleProyecto.tsx`):

1. **Selected Technical Alternative (`configuracion_id`) Resolution**:
   - Use the user-selected configuration in the simulator switcher, defaulting to the winning `configuraciones_tecnicas` row (`seleccionada = true`), or the first available row (`configs[0]`).
2. **Effective Investment (`capex_total` in `moneda_calculo`) Sourcing Priority**:
   - **Priority 1 (Itemized Product CAPEX — exact multi-currency support):** Sum `parseNum(p.datos.capex)` across `proyecto_sitio_productos` linked to `activeConfig.id`, converting each product individually from `p.datos.capex_moneda ?? activeConfig.moneda ?? 'USD'` into `moneda_calculo` using `tipo_cambio_usd_mxn`.
   - **Priority 2 (Configuration Total):** If no itemized product CAPEX > 0 exists, use `activeConfig.inversion_total` converted from `activeConfig.moneda ?? proyecto.moneda` to `moneda_calculo`. **Crucial Invariant:** If `activeConfig` is selected and has `inversion_total = null | 0` (with no product CAPEX `> 0`), it **MUST** return `null` (gated) and **NEVER** fall through via `??` to `proyecto.capex_estimado`.
   - **Priority 3 (Project Header CAPEX):** Only when `activeConfig` itself is absent (`null`, e.g., legacy project without `configuraciones_tecnicas` rows), use `proyecto.capex_estimado` converted from `proyecto.moneda` to `moneda_calculo`.

```ts
export function resolveCapexTotal(params: {
  activeConfig: ConfiguracionTecnica | null
  configProducts: ProyectoSitioProducto[]
  proyecto: Pick<Proyecto, 'capex_estimado' | 'moneda'>
  monedaCalculo: Moneda
  fx: number
}): number | null {
  if (!Number.isFinite(params.fx) || params.fx <= 0) return null

  if (params.activeConfig) {
    let itemizedSum = 0
    let hasPositiveItemizedCapex = false
    for (const prod of params.configProducts) {
      const datos = prod.datos as Record<string, unknown> | null
      const rawCapex = parseNum(datos?.capex as string | number | null | undefined)
      if (Number.isFinite(rawCapex) && rawCapex > 0) {
        hasPositiveItemizedCapex = true
        const srcCurrency = (datos?.capex_moneda as Moneda | undefined)
          ?? (params.activeConfig.moneda as Moneda | undefined)
          ?? 'USD'
        const converted = toCalc(rawCapex, srcCurrency, params.monedaCalculo, params.fx)
        if (!Number.isFinite(converted)) return null
        itemizedSum += converted
      }
    }
    if (hasPositiveItemizedCapex) return Number.isFinite(itemizedSum) ? itemizedSum : null

    // Priority 2 ONLY — never fall through to proyecto.capex_estimado when activeConfig exists
    const configCapex = params.activeConfig.inversion_total
    if (configCapex != null && Number.isFinite(configCapex) && configCapex > 0) {
      const srcCurrency = (params.activeConfig.moneda as Moneda | undefined)
        ?? (params.proyecto.moneda as Moneda | undefined)
        ?? 'MXN'
      const converted = toCalc(configCapex, srcCurrency, params.monedaCalculo, params.fx)
      return Number.isFinite(converted) ? converted : null
    }
    return null
  }

  // Priority 3 ONLY when no activeConfig exists
  const projCapex = params.proyecto.capex_estimado
  if (projCapex != null && Number.isFinite(projCapex) && projCapex > 0) {
    const converted = toCalc(projCapex, (params.proyecto.moneda as Moneda) ?? 'MXN', params.monedaCalculo, params.fx)
    return Number.isFinite(converted) ? converted : null
  }
  return null
}
```
3. **Declared Savings & Financing Sourcing**:
   - **Gross declared annual savings (`ahorro_declarado_bruto_anual`)**: `activeConfig.ahorro_estimado_anual ?? (activeConfig.ahorro_estimado_mensual != null ? activeConfig.ahorro_estimado_mensual * 12 : null)` converted from `activeConfig.ahorro_moneda` to `moneda_calculo`.
   - **Financing option (`opcion_financiamiento_id`)**: Winning `opciones_financiamiento` (`seleccionada = true`) or user-selected option compatible via `config_financiamiento`; sources `vehiculo_inversion`, `plazo_meses`, and net declared savings `ahorro_estimado_anual`.
4. **Declared Engineering & Tariff Inputs**:
   - FV `num_modulos`, `potencia_modulos_w`, `generacion_anual_kwh`; BESS `potencia_kw`, `capacidad_kwh`, `uso`; Site `demanda_contratada_kw` (summed across linked `proyecto_sitios` or fallback `proyectos.demanda_kw`); `proyectos.tarifa_actual_cfe`; `proyectos.consumo_anual_gwh` / `volumen_energia_mwh_anual`; accepted/selected `ofertas_mem.precio_kwh`.

### 3.2 Strict Gating Predicate & Multi-Layer Enforcement

A project lacks declared quantitative financial figures whenever:

```ts
export function hasValidFinancialFigures(capexTotalInCalcCurrency: number | null | undefined): boolean {
  return capexTotalInCalcCurrency != null
    && Number.isFinite(capexTotalInCalcCurrency)
    && capexTotalInCalcCurrency > 0
}
```

**Separation of Project-Level Gating vs. Live User-Override Validation:**
- **Project-Level Gating** resolves `projectCapexInBaselineFx = resolveCapexTotal({ ..., fx: templateDefaults.tipo_cambio_usd_mxn })` using the valid positive active template default `tipo_cambio_usd_mxn > 0`—**never** the live user-override `tipo_cambio_usd_mxn` input.
- **Live Override Validation (`validateOverridesAgainstTemplate(template.campos, overrides)`)** runs independently after project gating passes, enforcing the strict allowlist (rejecting unknown keys and `editableByUser: false` keys with HTTP `422`), checking template-declared bounds (`overrideMin ?? min`, `overrideMax ?? max`, `exclusiveMin`, `exclusiveMax`, `integer`) plus runtime bounds (`plazo_meses` integer in `[0, 360]` via `overrideMin`/`overrideMax` on `credito_plazo_meses_default` while keeping `[1, 300]` for admin baseline defaults, `consumo_anual_kwh >= 0`, `generacion_fv_y1_kwh >= 0`), and validating top-level config (`horizonte_anios` integer in `[1, 30]`, `moneda_calculo in ['MXN','USD']`, `vista_financiamiento in ['bruto','neto']`) separately on `SimulacionRunRequest`. Entering `0` or clearing `tipo_cambio_usd_mxn` while typing displays an inline field error on `<SimuladorContextPanel />` and disables `"Guardar simulación"`, **without** falsely tripping the *"Faltan cifras financieras"* missing-CAPEX banner.
- Inside `evaluateSimulation(input)`, project-level gating runs first (`{ status: 'gated', reason: 'missing_financial_figures' }`), followed by `validateOverrides(input.overrides)` (`{ status: 'invalid_override', errors }`).

This handles every real-world zero/null path identified in the audit:
- `tipo_instalacion === 'nodo_busca'` (`proyectos.capex_estimado = null`, `configuraciones_tecnicas.inversion_total = null`),
- `finder/nuevo/page.tsx:819` legacy rows where `nodo_busca` mistakenly saved `inversion_total = 0`,
- `epc/nuevo/page.tsx:454-469` legacy projects where `capex` was omitted (`0`),
- `MEM`-only projects created without declared CAPEX (`capex_estimado = null` or `0`).

**Mandatory Gating Behavior Across All 3 Layers:**
1. **Pure Engine (`lib/calculator/engine.ts`)**: `evaluateSimulation(input)` inspects `projectCapex` first. If `!hasValidFinancialFigures(projectCapex)`, it returns `{ status: 'gated', reason: 'missing_financial_figures', message: ... }` immediately—executing **zero** energy, savings, cashflow, or payback math.
2. **Server Action (`app/actions/simulaciones.ts`)**: `guardarSimulacion()` and `recalcularSimulacion()` re-resolve `capex_total` from Supabase and reject persistence with HTTP/action error `422` (`"No es posible calcular o guardar simulaciones sin cifras financieras válidas (CAPEX > 0)."`); PostgreSQL `CHECK (capex_snapshot > 0)` enforces the invariant at DB level.
3. **UI (`components/calculator/SimuladorAhorrosSeccion.tsx`)**: When gated:
   - **Zero** calculated numbers, **zero** KPIs (`StatFigure`), **zero** payback periods, **zero** `recharts` charts, and **zero** projection tables are rendered (and `<SimulacionesGuardadasPanel />` suppresses numeric KPIs on any older saved simulations for that project).
   - `"Simular"` and `"Guardar simulación"` buttons are disabled/hidden.
   - Only the viewer gating banner is rendered.

### 3.3 Viewer Messaging & Role-Aware Gated UI Specification

Matches the existing `glass-panel border-dashed` empty container + `bg-amber-50 border border-amber-200` + `AlertTriangle` callout pattern (`DetalleProyecto.tsx:1205-1211`):

- **Exact Viewer Message (`es-MX`)**:
  - Title: `"Faltan cifras financieras para generar proyecciones"`
  - Body: `"Este proyecto aún no cuenta con cifras cuantitativas de inversión (CAPEX) configuradas. Para ver las proyecciones de ahorro energético, ahorro monetario y periodo de retorno, es necesario capturar las cifras financieras en la solución técnica del proyecto."`
- **Role-Aware Secondary Action**:
  - For **`nodo_admin`**, **`nodo_analista`**, and owning **`epc`**: renders `<Button variant="primary" size="sm">` labeled `"Capturar inversión y solución técnica"` which opens `EditarSolucionTecnicaModal` directly (or focuses inline edit).
  - For **`cliente_final`**, **`financiero`**, and **`finder`**: renders read-only guidance badge `"Solicita a tu asesor Nodo o EPCista registrar los montos de inversión del proyecto para habilitar el simulador."` (never exposing edit modals they lack permission to save).

---

## 4. Rational Default Formula Set & Parameter Precedence (R2, R3, R4)

### 4.1 Canonical Platform Variable Dictionary

All default formulas (`v29` seed `formulas` JSONB), declarative template fields (`v29` seed `campos` JSONB), custom Excel-language formulas, and Excel sheet mappings resolve against this canonical dictionary (`lib/calculator/variable-dictionary.ts`):

> **Execution Model for `modo = 'default'` & `< 1 ms` On-the-Fly Series Evaluation:** When `calculadora_templates.modo === 'default'`, `lib/calculator/engine.ts` executes the typed functions in `lib/calculator/defaults.ts` directly in memory (`< 1 ms` for up to 360 months), while the seeded `v29` `formulas` JSONB represents the exact algebraic AST equivalent (every variable token in `v29` seed `formulas` and every field key in `v29` seed `campos` is defined below). Automated Vitest parity tests enforce bit-identical output (within `1e-9`) between `defaults.ts` and `formula-engine.ts` evaluating the seeded `v29` AST across FV, BESS, MEM, `ahorro_declarado`, `credito`, `arrendamiento`, and `ensaas`. When `modo` is `'custom_formulas'` or `'excel_import'`, `engine.ts` evaluates `template.formulas` via `formula-engine.ts` using `compileAndSortFormulas(template.formulas)` **memoized/cached per immutable `template_id`**, keeping full 360-month runs strictly `< 1 ms` (`~0.49 ms` cached vs `~1.20 ms` uncached). Because `calculadora_templates` rows are immutable and `serie_mensual` is never stored in PostgreSQL, both server actions and `<SimuladorAhorrosSeccion />` reconstruct the full 1..360 month series on the fly from `(template, projectData, sim.parametros_override)`.

| Canonical Key | Type | Unit / Scale | Primary Project / Site / Offer Source | Active Template Fallback (`calculadora_templates.campos`) |
|---|---|---|---|---|
| `capex_total` | `number` | `moneda_calculo` (`> 0`) | `resolveCapexTotal()` (product `capex` -> `config.inversion_total` -> `proyecto.capex_estimado`, FX converted) | *None — strict gating if `<= 0` or `null`* |
| `moneda_default` | `'MXN' \| 'USD'` | Currency code | Template field (`campos[key='moneda_default']`) | `'MXN'` |
| `moneda_calculo` | `'MXN' \| 'USD'` | Currency code | `proyecto.moneda` / simulation selector | `moneda_default` (`'MXN'`) |
| `tipo_cambio_usd_mxn` | `number` | `MXN / USD` | Simulation override (`> 0`) | `tipo_cambio_usd_mxn` (`17.50`) |
| `kwp_fv` | `number` | `kWp` | `SUM((fv.num_modulos * fv.potencia_modulos_w) / 1000)` | `0` |
| `generacion_fv_y1_kwh` | `number` | `kWh / año` | `SUM(fv.generacion_anual_kwh)` else `kwp_fv * hsp_horas_dia * 365 * performance_ratio_fv` | Computed from `hsp_horas_dia` (`5.2`) & `performance_ratio_fv` (`0.80`) |
| `autoconsumo_fv_pct` | `number` | Decimal `0..1` | Simulation override | `autoconsumo_fv_pct` (`1.00`) |
| `hsp_horas_dia` | `number` | `kWh/m²/día` | Simulation override | `hsp_horas_dia` (`5.20`) |
| `performance_ratio_fv` | `number` | Decimal `0..1` | Simulation override | `performance_ratio_fv` (`0.80`) |
| `degradacion_fv_anual` | `number` | Decimal `0..0.2` | Simulation override | `degradacion_fv_anual` (`0.005` = `0.5%`) |
| `pesos_estacionales_fv` | `number[]` | 12-month array | Template field (`campos[key='pesos_estacionales_fv']`) | `[0.072, 0.076, ..., 0.070]` (sum = `1.0`) |
| `peso_estacional_mes` | `number` | Decimal `0..1` | Monthly index `m_year = ((m-1)%12)` | `pesos_estacionales_fv[m_year]` |
| `bess_capacidad_kwh` | `number` | `kWh` | `SUM(bess.capacidad_kwh)` else `proyecto.capacidad_mwh * 1000` | `0` |
| `bess_potencia_kw` | `number` | `kW` | `SUM(bess.potencia_kw)` else `proyecto.capacidad_mw * 1000` | `0` |
| `bess_es_ups_puro` | `0 \| 1` | Flag | `1` if all BESS rows have `uso === 'ups'`, else `0` | `0` |
| `bess_dod` | `number` | Decimal `0..1` | Simulation override | `bess_dod` (`0.85`) |
| `bess_eficiencia_rt` | `number` | Decimal `0..1` | Simulation override | `bess_eficiencia_rt` (`0.88`) |
| `bess_ciclos_anio` | `number` | `ciclos / año` | Simulation override | `bess_ciclos_anio` (`260`) |
| `factor_recorte_demanda` | `number` | Decimal `0..1` | Simulation override | `factor_recorte_demanda` (`0.70`) |
| `degradacion_bess_anual` | `number` | Decimal `0..0.25` | Simulation override | `degradacion_bess_anual` (`0.020` = `2.0%`) |
| `demanda_contratada_kw` | `number` | `kW` | `SUM(sitios.demanda_contratada_kw)` else `proyecto.demanda_kw` | `0` (engine treats `0` as un-capped `bess_potencia_kw`) |
| `energia_bess_y1_kwh` | `number` | `kWh / año` | Derived Y1: `bess_es_ups_puro = 1 ? 0 : bess_capacidad_kwh * bess_dod * bess_eficiencia_rt * bess_ciclos_anio` | Derived (`0` if no BESS) |
| `consumo_anual_kwh` | `number` | `kWh / año` | Simulation override else `(proyecto.consumo_anual_gwh * 1e6)` else `(proyecto.volumen_energia_mwh_anual * 1e3)` | `0` |
| `tarifa_cfe_default_mxn` | `number` | `MXN / kWh` | Template field (`campos[key='tarifa_cfe_default_mxn']`) | `3.20` |
| `tarifa_cfe_kwh` | `number` | `calc / kWh` | `proyecto.tarifa_actual_cfe` (MXN -> `moneda_calculo`) | `tarifa_cfe_default_mxn` (`3.20 MXN/kWh`) |
| `cargo_demanda_mensual_kw_mxn` | `number` | `MXN / kW-mes` | Template field (`campos[key='cargo_demanda_mensual_kw_mxn']`) | `380.00` |
| `cargo_demanda_mensual_kw` | `number` | `calc / kW-mes` | Simulation override | `cargo_demanda_mensual_kw_mxn` (`380 MXN/kW-mes`) |
| `diferencial_punta_base_mxn` | `number` | `MXN / kWh` | Template field (`campos[key='diferencial_punta_base_mxn']`) | `1.40` |
| `diferencial_punta_base_kwh` | `number` | `calc / kWh` | Simulation override | `diferencial_punta_base_mxn` (`1.40 MXN/kWh`) |
| `tarifa_mem_default_mxn` | `number` | `MXN / kWh` | Template field (`campos[key='tarifa_mem_default_mxn']`) | `2.45` |
| `tarifa_mem_kwh` | `number` | `calc / kWh` | Accepted/selected `ofertas_mem.precio_kwh` (MXN -> `moneda_calculo`) | `tarifa_mem_default_mxn` (`2.45 MXN/kWh`) |
| `ahorro_fv_y1` | `number` | `moneda_calculo / año` | Derived Y1: `generacion_fv_y1_kwh * autoconsumo_fv_pct * tarifa_cfe_kwh` (when FV active) | Derived (`0` if no FV) |
| `ahorro_bess_y1` | `number` | `moneda_calculo / año` | Derived Y1: `ahorro_arbitraje_y1 + ahorro_demanda_y1` (when BESS active & not UPS-puro) | Derived (`0` if no BESS) |
| `ahorro_mem_y1` | `number` | `moneda_calculo / año` | Derived Y1: `consumo_anual_kwh * max(0, tarifa_cfe_kwh - tarifa_mem_kwh)` (when MEM active) | Derived (`0` if no MEM) |
| `ahorro_declarado_bruto_anual` | `number` | `moneda_calculo / año` | `activeConfig.ahorro_estimado_anual ?? (ahorro_estimado_mensual * 12)` (FX converted) | `0` |
| `escalacion_tarifa_anual` | `number` | Decimal | Simulation override | `escalacion_tarifa_anual` (`0.045` = `4.5%`) |
| `inflacion_anual` | `number` | Decimal | Simulation override | `inflacion_anual` (`0.040` = `4.0%`) |
| `pct_om_anual` | `number` | Decimal | Simulation override | `pct_om_anual` (`0.010` = `1.0%`) |
| `tasa_descuento_anual` | `number` | Decimal | Simulation override | `tasa_descuento_anual` (`0.100` = `10.0%`) |
| `vehiculo_inversion` | `string` | Enum string | `opcion_financiamiento.vehiculo_inversion` (`'credito' \| 'arrendamiento' \| 'ensaas' \| 'mem' \| 'no_sabe' \| 'contado'`) | `'contado'` (when `vista_neta = 0`) |
| `vista_neta` | `0 \| 1` | Flag | `1` if `vista_financiamiento === 'neto'` & `vehiculo_inversion` not in `['no_sabe', 'mem', 'contado']` | `0` |
| `credito_enganche_pct` | `number` | Decimal `0..1` | Template field (`campos[key='credito_enganche_pct']`) | `0.20` |
| `enganche_pct` | `number` | Decimal `0..1` | Simulation override (`0` for `arrendamiento`/`ensaas`) | `credito_enganche_pct` (`0.20` for `credito`) |
| `credito_tasa_interes_anual` | `number` | Decimal | Template field (`campos[key='credito_tasa_interes_anual']`) | `0.125` |
| `arrendamiento_tasa_equivalente_anual` | `number` | Decimal | Template field (`campos[key='arrendamiento_tasa_equivalente_anual']`) | `0.135` (`13.5%`) |
| `tasa_interes_anual` | `number` | Decimal (`0..0.60`) | Simulation override (`overrideKey` of `credito_tasa_interes_anual`; also overrides `arrendamiento` rate) | `arrendamiento_tasa_equivalente_anual` (`0.135`) when `vehiculo_inversion === 'arrendamiento'`, `credito_tasa_interes_anual` (`0.125`) when `'credito'`, else `0` |
| `tasa_interes_mensual` | `number` | Decimal | `(override.tasa_interes_anual ?? (vehiculo_inversion === 'arrendamiento' ? arrendamiento_tasa_equivalente_anual : credito_tasa_interes_anual)) / 12` | `tasa_interes_anual / 12` |
| `ensaas_factor_ahorro_pct` | `number` | Decimal `(0..1]` | Simulation override (`override.ensaas_factor_ahorro_pct`) | `ensaas_factor_ahorro_pct` (`0.25` = `25%` retained by client) |
| `credito_plazo_meses_default` | `number` | `meses` | Template field (`campos[key='credito_plazo_meses_default']`) | `60` |
| `plazo_meses` | `number` | `meses` | `opcion_financiamiento.plazo_meses` (overrideable) | `credito_plazo_meses_default` (`60`) |
| `principal_financiado` | `number` | `moneda_calculo` | `capex_total * (1 - enganche_pct)` | Derived |
| `horizonte_default_fv` | `number` | `años` | Template field (`campos[key='horizonte_default_fv']`) | `25` |
| `horizonte_default_bess` | `number` | `años` | Template field (`campos[key='horizonte_default_bess']`) | `10` |
| `horizonte_default_mem` | `number` | `años` | Template field (`campos[key='horizonte_default_mem']`) | `5` |
| `horizonte_anios` | `number` | `años` (`1..30`) | Simulation override | `horizonte_default_{fv\|bess\|mem}` (`25`/`10`/`5`) |
| `mes_indice` | `number` | `1 .. H*12` | Loop variable | Loop variable |
| `anio_indice` | `number` | `0 .. H-1` | `Math.floor((mes_indice - 1) / 12)` | Loop variable |

### 4.2 3-Tier Context Resolution Precedence

For every parameter $p$, resolution strictly follows:
$$\text{Resolved}(p) = \text{Override}_{\text{simulacion}}(p) \;\triangleright\; \text{Declared}_{\text{proyecto/sitio/producto/oferta}}(p) \;\triangleright\; \text{Baseline}_{\text{nodo\_admin}}(p)$$
- **Currency-Neutral Tier 2 Resolution & Top-Level Column Separation:** Top-level `simulaciones_ahorro` configuration columns (`moneda_calculo`, `horizonte_anios`, `vista_financiamiento`) are excluded from `parametros_override` and `computeSparseOverrides()`. Before diffing overrides in `computeSparseOverrides()`, Tier 2 currency-denominated tariff defaults (`tarifa_cfe_kwh`, `cargo_demanda_mensual_kw`, `diferencial_punta_base_kwh`, `tarifa_mem_kwh`) are converted into the selected `moneda_calculo` using resolved `fx`. Thus switching `moneda_calculo` to `'USD'`, changing `horizonte_anios`, or toggling `vista_financiamiento` preserves `usa_parametros_base = true` (`parametros_override = {}`) and allows dynamic FX re-conversion if `tipo_cambio_usd_mxn` is edited later.
- When `computeSparseOverrides()` returns `{}` (every overridable field matches its Tier 2/3 currency-converted default), the simulation is tagged `usa_parametros_base = true` (`Badge`: `"Parámetros base Nodo"`).
- When any field in `parametros_override` differs from the Tier 2/3 resolved value, `usa_parametros_base = false` (`Badge`: `"Personalizado"`), and each overridden input displays an inline `"Restablecer"` chip.

### 4.3 Currency FX Normalization

All monetary figures entering the engine are converted from their source currency ($C_{\text{src}} \in \{\text{MXN}, \text{USD}\}$) into `moneda_calculo` ($C_{\text{calc}}$) using resolved `fx = tipo_cambio_usd_mxn` (validated `> 0`):

$$\text{toCalc}(v, C_{\text{src}}, C_{\text{calc}}, \text{fx}) = \begin{cases} v & \text{if } C_{\text{src}} = C_{\text{calc}} \\ v \times \text{fx} & \text{if } C_{\text{src}} = \text{USD} \land C_{\text{calc}} = \text{MXN} \\ v / \text{fx} & \text{if } C_{\text{src}} = \text{MXN} \land C_{\text{calc}} = \text{USD} \end{cases}$$

### 4.4 Year-1 Energy & Monetary Savings Equations (FV, BESS, MEM, Fallback)

1. **Solar FV (`tipo` includes `'FV'` or `kwp_fv > 0`)**:
   - `generacion_fv_y1_kwh`: declared `SUM(fv.generacion_anual_kwh)` if `> 0`; else $\text{kwp\_fv} \times \text{hsp\_horas\_dia} \times 365 \times \text{performance\_ratio\_fv}$.
   - $\text{energia\_fv\_y1\_kwh} = \text{generacion\_fv\_y1\_kwh} \times \text{autoconsumo\_fv\_pct}$
   - $\text{ahorro\_fv\_y1} = \text{energia\_fv\_y1\_kwh} \times \text{tarifa\_cfe\_kwh}$
2. **BESS (`tipo` includes `'BESS'` or `bess_capacidad_kwh > 0`)**:
   - If `bess_es_ups_puro = 1` (pure backup UPS): $\text{energia\_bess\_y1\_kwh} = 0$, $\text{ahorro\_arbitraje\_y1} = 0$, $\text{ahorro\_demanda\_y1} = 0$ (unless admin custom formula or user override models backup-avoidance value).
   - If `load_shifting` or `load_shifting_ups`:
     - $\text{energia\_bess\_y1\_kwh} = \text{bess\_capacidad\_kwh} \times \text{bess\_dod} \times \text{bess\_eficiencia\_rt} \times \text{bess\_ciclos\_anio}$
     - $\text{ahorro\_arbitraje\_y1} = \text{energia\_bess\_y1\_kwh} \times \text{diferencial\_punta\_base\_kwh}$
     - $\text{demanda\_recortable\_kw} = \begin{cases} \min(\text{bess\_potencia\_kw},\, \text{demanda\_contratada\_kw}) & \text{if } \text{demanda\_contratada\_kw} > 0 \\ \text{bess\_potencia\_kw} & \text{otherwise} \end{cases}$
     - $\text{ahorro\_demanda\_y1} = \text{demanda\_recortable\_kw} \times \text{factor\_recorte\_demanda} \times \text{cargo\_demanda\_mensual\_kw} \times 12$
     - $\text{ahorro\_bess\_y1} = \text{ahorro\_arbitraje\_y1} + \text{ahorro\_demanda\_y1}$
3. **MEM (`tipo` in `['MEM', 'BESS+MEM']` or `proyecto.incluye_mem = true`)**:
   - $\text{ahorro\_mem\_y1} = \text{consumo\_anual\_kwh} \times \max(0,\, \text{tarifa\_cfe\_kwh} - \text{tarifa\_mem\_kwh})$
4. **Declared Savings Fallback (`fuente_calculo = 'ahorro_declarado'`)**:
   - If physical/tariff Year-1 savings sum to `0` (`ahorro_fv_y1 + ahorro_bess_y1 + ahorro_mem_y1 === 0`) and `ahorro_declarado_bruto_anual > 0`, set $\text{ahorro\_bruto\_y1} = \text{ahorro\_declarado\_bruto\_anual}$ (spread `1/12` per month before tariff escalation) and record `fuente_calculo = 'ahorro_declarado'`.
   - When both physical computation and `ahorro_declarado_bruto_anual` exist, display an informational variance chip (`Diferencia vs. ahorro declarado en propuesta: ±X%`).

### 4.5 Multi-Year Monthly Time-Series & Financing Cashflows (`m = 1 .. H × 12`)

For each month $m \in \{1, \dots, 12H\}$, let $y = \lfloor (m-1)/12 \rfloor$ (`anio_indice`) and $k = ((m-1) \bmod 12)$ (`pesos_estacionales_fv[k]`):

- **Monthly Energy Savings (kWh)**:
  $$\text{fv\_kwh}(m) = \text{energia\_fv\_y1\_kwh} \cdot (1 - d_{\text{fv}})^y \cdot w_k, \qquad \text{bess\_kwh}(m) = \frac{\text{energia\_bess\_y1\_kwh} \cdot (1 - d_{\text{bess}})^y}{12}$$
  $$\text{energia\_total\_kwh}(m) = \text{fv\_kwh}(m) + \text{bess\_kwh}(m)$$
- **Monthly Gross Monetary Savings**:
  $$\text{ahorro\_bruto}(m) = \begin{cases} \left[ \text{ahorro\_fv\_y1}(1 - d_{\text{fv}})^y w_k + \dfrac{\text{ahorro\_bess\_y1}(1 - d_{\text{bess}})^y + \text{ahorro\_mem\_y1}}{12} \right] \cdot (1 + e_{\text{tarifa}})^y & \text{if } (\text{ahorro\_fv\_y1}+\text{ahorro\_bess\_y1}+\text{ahorro\_mem\_y1}) > 0 \\ \dfrac{\text{ahorro\_declarado\_bruto\_anual}}{12} \cdot (1 + e_{\text{tarifa}})^y & \text{otherwise} \end{cases}$$
- **Monthly O&M Cost**:
  $$\text{costo\_om}(m) = \frac{\text{capex\_total} \cdot \text{pct\_om\_anual} \cdot (1 + i_{\text{inf}})^y}{12}$$
- **Financing Mode (`vista_financiamiento`: `'bruto'` vs `'neto'`)**:
  - **Bruto (Contado / Sin financiamiento)**: $\text{desembolso\_inicial} = \text{capex\_total}$, $\text{cuota}(m) = 0$.
  - **Neto — `credito`**: $\text{enganche} = \text{capex\_total} \cdot \text{enganche\_pct}$, $P = \text{capex\_total} - \text{enganche}$, $r_m = r_{\text{anual}} / 12$:
    $$\text{cuota}(m) = \begin{cases} \dfrac{P \cdot r_m}{1 - (1 + r_m)^{-N}} & \text{if } m \le N \land N > 0 \land P > 0 \land r_m > 0 \\ P / N & \text{if } m \le N \land N > 0 \land P > 0 \land r_m = 0 \\ 0 & \text{otherwise} \end{cases}$$
    with $\text{desembolso\_inicial} = \text{enganche}$.
  - **Neto — `arrendamiento`**: $\text{desembolso\_inicial} = 0$, $P = \text{capex\_total}$, $r_m = (\text{override.tasa\_interes\_anual} \triangleright \text{arrendamiento\_tasa\_equivalente\_anual}) / 12$ (bound into `tasa_interes_mensual`), same annuity over $N = \text{plazo\_meses}$.
  - **Neto — `ensaas`**: $\text{desembolso\_inicial} = 0$, $\text{cuota}(m) = \max\big(0,\, \text{ahorro\_bruto}(m) \cdot (1 - \text{ensaas\_factor\_ahorro\_pct}) - \text{costo\_om}(m)\big)$ so client retains `ensaas_factor_ahorro_pct` of gross savings with zero CAPEX outlay.
- **Net & Cumulative Cashflows (Consistent Effective Monthly Discounting)**:
  Let $r_{\text{desc},m} = (1 + \text{tasa\_descuento\_anual})^{1/12} - 1$ so monthly NPV discounting matches annual IRR compounding ($(1 + r_{\text{irr},m})^{12} - 1$):
  $$\text{flujo\_neto}(m) = \text{ahorro\_bruto}(m) - \text{costo\_om}(m) - \text{cuota}(m)$$
  $$F_{\text{acum}}(0) = -\text{desembolso\_inicial}, \qquad F_{\text{acum}}(m) = F_{\text{acum}}(m-1) + \text{flujo\_neto}(m)$$
  $$F_{\text{desc\_acum}}(0) = -\text{desembolso\_inicial}, \qquad F_{\text{desc\_acum}}(m) = F_{\text{desc\_acum}}(m-1) + \frac{\text{flujo\_neto}(m)}{(1 + r_{\text{desc},m})^m}$$

### 4.6 Timeframe Aggregation (`Mensual`, `Trimestral`, `Anual`) & Horizons

- **Horizon Selector (`horizonte_anios`)**: Pill/select options `[1, 3, 5, 10, 15, 20, 25]` years (stored in `calculadora_templates.horizonte_opciones`; default `25` for `FV`/`FV+BESS`, `10` for `BESS`, `5` for `MEM`/`BESS+MEM`).
- **Deterministic Rollup (`lib/calculator/aggregate.ts`)**:
  - **`Mensual`**: Returns rows `m = 1 .. H*12` directly (`"Mes 1"` .. `"Mes 300"`). For horizons `> 5` years, the chart defaults to a smooth scrollable/zoomed monthly curve and the table includes year pagination (`12` rows/page) + CSV export.
  - **`Trimestral`**: Groups every 3 months (`T1 Año 1` .. `T4 Año H`): sums `energia_*`, `ahorro_bruto`, `costo_om`, `cuota_financiamiento`, `flujo_neto`; takes **end-of-quarter** `flujo_acumulado` and `flujo_descontado_acumulado`.
  - **`Anual`**: Groups every 12 months (`Año 1` .. `Año H`): sums flow columns; takes **end-of-year** `flujo_acumulado` and `flujo_descontado_acumulado`.

### 4.7 Payback Period, NPV, IRR & ROI Specifications + Edge Cases

- **Permanent Break-Even Simple Payback (`payback_simple_meses` / `payback_simple_anios`)**:
  To prevent premature reporting on non-monotonic seasonal financed cashflows that cross zero twice, scan $m = 1 \dots 12H$ for the earliest **permanent** break-even month $m$ where $F_{\text{acum}}(m-1) < 0$ AND $F_{\text{acum}}(k) \ge 0$ for **all** $k \in \{m, m+1, \dots, 12H\}$:
  $$\text{payback\_simple\_meses} = (m - 1) + \frac{|F_{\text{acum}}(m-1)|}{\text{flujo\_neto}(m)}, \qquad \text{payback\_simple\_anios} = \frac{\text{payback\_simple\_meses}}{12}$$
- **Permanent Break-Even Discounted Payback (`payback_descontado_meses`)**: Identical permanent-crossing interpolation on $F_{\text{desc\_acum}}(m)$ (divided by discounted monthly cashflow $\text{flujo\_neto}(m)/(1 + r_{\text{desc},m})^m$).
- **5 Explicit Payback Edge Cases**:
  1. **Gated (`capex_total <= 0` or `null`)**: Never reaches payback engine; gating banner shown.
  2. **Immediate (`desembolso_inicial === 0 && flujo_neto(1) > 0 && Math.min(...F_acum(1..12H)) >= 0`)**: `payback_estado = 'inmediato'`, `payback_simple_meses = 0`, UI renders `"Inmediato (sin desembolso inicial)"`. (If `desembolso_inicial === 0` but cumulative cashflow dips below `0` in any month, permanent break-even scan runs instead of reporting `'inmediato'`.)
  3. **Within Horizon**: `payback_estado = 'en_horizonte'`, UI renders e.g. `"3.37 años (40.4 meses)"` via `fmtNum` and draws a vertical `ReferenceLine` on the chart.
  4. **Exceeds Selected Short Horizon** (e.g., user selects `horizonte_anios = 3`, permanent break-even is `4.8` years): Engine runs a lightweight extended probe up to `30` years; returns `payback_estado = 'fuera_horizonte'`, `payback_simple_meses = null`, plus `payback_extendido_anios = 4.8`, so UI displays `"Fuera del horizonte de 3 años (~4.8 años est.)"` with a quick button `"Ampliar horizonte a 5 años"`.
  5. **Unrecoverable Even at 30 Years** (no permanent break-even in `360` months): `payback_estado = 'no_recuperable'`, UI displays `"No recuperable en el horizonte"`.
- **NPV (`VAN`), IRR (`TIR`), Dual ROI**:
  - $\text{VAN} = F_{\text{desc\_acum}}(12H)$ (using $r_{\text{desc},m} = (1 + r_{\text{desc}})^{1/12} - 1$, guaranteeing $\text{VAN} = 0 \iff \text{TIR}_{\text{anual}} = \text{tasa\_descuento\_anual}$).
  - $\text{TIR}_{\text{anual}} = (1 + r_{\text{irr,mensual}})^{12} - 1$ solved via Newton-Raphson + bisection fallback on `[ -desembolso_inicial, flujo_neto(1), ..., flujo_neto(12H) ]` (returns `null` if cashflows never change sign).
  - **ROI sobre CAPEX (`roi_pct`, persisted)**:
    $$\text{ROI}_{\text{CAPEX}}(\%) = \frac{\sum_{m=1}^{12H} \text{flujo\_neto}(m) - \text{desembolso\_inicial}}{\text{capex\_total}} \times 100$$
  - **ROI sobre Desembolso Inicial / Cash-on-Cash (`roi_desembolso_pct`, displayed alongside when financed)**:
    When `vista_financiamiento === 'neto'` and $0 < \text{desembolso\_inicial} < \text{capex\_total}$, compute $\text{ROI}_{\text{desembolso}}(\%) = \frac{\sum \text{flujo\_neto}(m) - \text{desembolso\_inicial}}{\text{desembolso\_inicial}} \times 100$ and label KPI explicitly (`"ROI s/CAPEX"` + subtext `"Cash-on-Cash: X%"`, or `"Sin desembolso inicial"` when `desembolso_inicial === 0`).

---

## 5. Nodo Admin Configuration, Excel-Language Formula Engine & Excel Import Pipeline (R3)

### 5.1 Library Selection & Security Rationale

| Package | Role | License | Why Chosen / Rejected |
|---|---|---|---|
| **`exceljs`** (`^4.4.0`) | Server-side `.xlsx` & `.csv` parsing | **MIT** | Reads `cell.formula`, `cell.result`, `cell.value`, `workbook.definedNames`, and sheet layouts cleanly in Node.js App Router without the unpatched `xlsx@0.18.5` npm CVEs (Prototype Pollution & ReDoS). |
| **`zod`** (`^3.24.2`) | Runtime validation for formulas, overrides, and API payloads | **MIT** | Type-safe schema validation for Server Actions, API routes, and JSONB configs. |
| **First-party AST Evaluator** (`lib/calculator/formula-engine.ts`) | Safe Excel-language formula evaluation | **Internal** | Zero `eval`/`new Function`, zero GPLv3 contamination (unlike `hyperformula` which is GPLv3/Commercial), isomorphic (runs identically in browser preview and server persistence). |
| **`vitest`** (`^3.0.0`, devDep) | Automated unit & integration tests | **MIT** | Fast TypeScript native runner for testing formulas, Excel AST, FX, gating, and payback edge cases. |

> **Legacy `.xls` (BIFF8) Handling:** Because `exceljs` parses OOXML `.xlsx` and `.csv` only (avoiding `xlsx@0.18.5` CVEs), uploading a legacy binary `.xls` file returns HTTP `422` with a clear Spanish prompt: `"El formato binario .xls (Excel 97-2003) no es compatible por seguridad. Guárdalo como Libro de Excel (.xlsx) o .csv e inténtalo de nuevo."`

### 5.2 Pure-TypeScript AST Excel Formula Engine (`lib/calculator/formula-engine.ts`)

1. **Zero `eval` / Zero `new Function` & Prototype-Safe Lookups**:
   - **Lexer** -> **Recursive-Descent Parser** -> **Typed AST** (`NumberLit | StringLit | BoolLit | VarRef | CellRef | RangeRef | UnaryOp | BinaryOp | CallExpr`).
   - **Prototype-Collision Prevention**: All AST variable scopes, function allowlists, and `excel-mapper.ts` sheet/named-range/cell lookup tables **MUST** use `Map<string, ...>` (or `Object.create(null)` + `Object.hasOwn`)—never plain object bracket indexing—preventing `=constructor`, `=__proto__`, `=toString`, `=valueOf`, or `=hasOwnProperty` from resolving `Object.prototype` properties (`#NAME?` instead).
   - **Lexer & Separator Rules**: Tokenizes dotted Spanish/English function names (`SI.ERROR`, `REDONDEAR.MAS`, `REDONDEAR.MENOS`) as single identifiers before `(`, normalizes `$` anchors (`$B$5` -> `B5`, `'Hoja 1'!$B$5` -> `Hoja 1!B5`), accepts both `,` (EN/US) and `;` (ES/LATAM) argument separators, and supports trailing `%` literals (`4.5%` -> `0.045`).
   - **Operator Precedence & Associativity (Excel Standard)**: Unary `+`/`-` (binds **tighter** than `^`, so `-2^2 = 4`), `^` (**left-associative** in Excel, so `2^3^2 = 64`), `*`/`/`, `+`/`-`, `&` (concat), `=`, `<>`, `<`, `<=`, `>`, `>=` (with case-insensitive string equality, e.g., `vehiculo_inversion = "ensaas"`).
2. **Supported Function Allowlist (Case-Insensitive, English + Spanish Aliases) & Short-Circuit Semantics**:
   - **Math**: `SUM`/`SUMA`, `AVERAGE`/`PROMEDIO`, `MIN`, `MAX`, `ABS`, `ROUND`/`REDONDEAR`, `ROUNDUP`/`REDONDEAR.MAS`, `ROUNDDOWN`/`REDONDEAR.MENOS`, `POWER`/`POTENCIA`, `SQRT`/`RAIZ`, `LN`, `LOG10`, `EXP`, `MOD`/`RESIDUO`.
   - **Logic (Mandatory Lazy / Short-Circuit Evaluation)**: `IF`/`SI(cond, thenExpr, elseExpr)` and `IFERROR`/`SI.ERROR(expr, fallbackExpr)` **MUST** evaluate only the selected branch (so `IF(plazo_meses > 0, principal_financiado / plazo_meses, 0)` never triggers `#DIV/0!` when `plazo_meses = 0`), plus `AND`/`Y`, `OR`/`O`, `NOT`/`NO`, `COALESCE`.
   - **Financial**: `PMT`/`PAGO(rate, nper, pv, [fv], [type])`, `PV`/`VA(rate, nper, pmt)`, `FV`/`VF(rate, nper, pmt, [pv])`, `NPV`/`VNA(rate, v1, ...)` (strictly Excel `t = 1..n` discounting; note that project `VAN` at `t = 0` equals `-desembolso_inicial + NPV(r_desc_m, flujo_1..flujo_N)`), `IRR`/`TIR(range_or_array, [guess])`.
3. **Topological Evaluation, Template Caching & Cycle Detection**:
   - `compileAndSortFormulas(template.formulas)` parses expressions, extracts all referenced variables/cells across formulas, expands bounded `RangeRef` nodes (`<= 5,000` cells) where applicable, constructs a directed dependency graph, and runs **Kahn's topological sort** (mirroring `lib/cascade-scheduler.ts:51-86`).
   - Any non-empty remaining nodes after Kahn's loop indicate a circular dependency and fail validation with `#CYCLE!`.
   - **Per-Template Memoization (`compileAndSortFormulas`):** Because `calculadora_templates` rows are append-only immutable (`trg_calc_templates_immutable`), `formula-engine.ts` caches the compiled AST + Kahn topological order keyed by `template.id` (e.g., `Map<string, CompiledTemplateProgram>`), keeping 360-month `custom_formulas` / `excel_import` evaluations strictly `< 1 ms` (`~0.49 ms` cached vs `~1.20 ms` uncached).
4. **Structured Error Codes & Sandbox Guardrails**:
   - Errors: `#DIV/0!`, `#VALUE!`, `#REF!`, `#NAME?`, `#CYCLE!`, `#NUM!`.
   - Limits: max formula length `2,000` chars, max AST depth `32`, max AST nodes `512`, max range expansion `5,000` cells, max IRR iterations `100`.

### 5.3 Excel Workbook Upload Parser (`POST /api/calculator/excel/parse`)

- **File**: `app/api/calculator/excel/parse/route.ts` (`export const runtime = 'nodejs'`).
- **Explicit Auth Guard**: Because `proxy.ts:28` excludes `/api/*`, the handler **must**:
  1. Instantiate `createClient()` from `@/lib/supabase/server`.
  2. Call `const { data: { user }, error } = await supabase.auth.getUser()` (not `getSession()`); return `401` if absent.
  3. Query `profiles.rol` for `user.id`; return `403` if `rol !== 'nodo_admin'`.
- **Pre-Flight ZIP Bomb & Spoofed-File Protections**:
  - Accepts `multipart/form-data` with field `file`; rejects compressed uploads `> 10 MB` (`413`) and unsupported extensions (`422`).
  - **Magic-Byte Verification**: For `.xlsx`, verifies `PK\x03\x04` (`0x50 0x4B 0x03 0x04`) at bytes `0..3` before decompression (rejects spoofed/corrupt binaries with `422`). For `.csv`, rejects any buffer containing NUL (`0x00`) or non-text binary control bytes with `422` before passing to `exceljs.csv`.
  - **ZIP Bomb & Dimension Caps (Pre-Load Central Directory Scan)**: Prior to `ExcelJS.Workbook().xlsx.load(buffer)`, parses the ZIP **Central Directory (`0x02014b50`) via the End of Central Directory (`0x06054b50`)** in pure Node.js `Buffer` (avoiding Local File Header `0`-size ambiguity when Excel sets bit-3 data descriptors, and adding zero extra ZIP dependencies): rejects if total uncompressed XML size `> 50 MB` or (when total uncompressed size exceeds an uncompressed floor of **`> 1 MB`** to prevent false positives on small legitimate `.xlsx` XML entries) compression ratio `> 100:1` (`413`). Enforces `<= 20` worksheets, `<= 50,000` populated cells per `.xlsx` workbook, and `<= 10,000` rows for `.csv` uploads (`422`).
  - Computes SHA-256 hash (`crypto.createHash('sha256')`) for audit (`excel_archivo_hash`).
- **Workbook Extraction & Non-Primitive Cell Normalization**:
  - Loads workbook via `ExcelJS.Workbook().xlsx.load(buffer)` (or `.csv.read(...)`), normalizing `exceljs` non-primitive `cell.value` objects (`{ formula, result }`, `{ sharedFormula, result }`, `{ richText }` -> concatenated text, `{ hyperlink, text }` -> `text`, `{ error }` -> structured `#...` error, `Date` -> ISO/serial), and stripping `$` anchors + normalizing `Sheet!Cell` prefixes into `Map`-backed lookup tables:
    - Sheet metadata (`name`, `rowCount`, `colCount`),
    - Named ranges (`workbook.definedNames`, stored in `Map`),
    - **Input candidate cells**: collects **both** (a) numeric/constant cells with adjacent descriptive labels and no formula, **AND** (b) **all cells/ranges referenced by any candidate output formula** (including unlabeled axis/index cells or formula-driven index columns such as `A10` in Scenario S4 `=B3*B4*(1+B5)^A10/12`, tagged `isFormulaDerived: true/false`),
    - Formula cells (`cell.formula` with cached `cell.result`, row/column label context, and parsed variable/cell/range dependencies),
    - **Auto-Suggested Mappings** (fuzzy Spanish/English header matching against the Canonical Platform Variable Dictionary, e.g., `"Tarifa CFE"` -> `tarifa_cfe_kwh`, `"Inversión"` / `"CAPEX"` -> `capex_total`, `"Generación"` -> `generacion_fv_y1_kwh`, `"Degradación"` -> `degradacion_fv_anual`).
  - **Crucial R3 Constraint:** This endpoint is **purely inspect/preview**—it **never** persists formulas to the database until the `nodo_admin` reviews and confirms the mapping in Step 3.

### 5.4 Server Actions & Validation Contracts

1. **`app/actions/calculatorConfig.ts`** (`'use server'` — strictly verifies `supabase.auth.getUser()` + `profiles.rol === 'nodo_admin'`):
   - `saveCalculadoraTemplate(payload)`: Unified atomic template save supporting baseline `campos` updates (`modo: 'default'`), manual Excel-language formulas (`modo: 'custom_formulas' | 'default'`), and confirmed Excel mappings (`modo: 'excel_import'`). Zod-validates every `CalculadoraCampoDef` in `campos` (including `pesos_estacionales_fv.length === 12` and `Math.abs(sum - 1) <= 0.001`), rewrites mapped cell/range references (`$B$5` / `Hoja1!B5` -> `capex_total`) in `formulas`, parses every expression with `parseExcelFormula()`, **walks every AST and rejects with `422` if any unresolved `CellRef` or `RangeRef` node remains**, checks Kahn topological order for `#CYCLE!`, runs a deterministic dry-run against a synthetic FV+BESS fixture (`capex_total = 1_500_000`, `generacion_fv_y1_kwh = 120_000`), and if valid, creates + activates the immutable version atomically via `public.crear_y_activar_calculadora_template(...)`.
   - `activateTemplateVersion(templateId)`: Allows `nodo_admin` instant atomic rollback via `public.activar_calculadora_template(templateId)` (which acquires `SHARE ROW EXCLUSIVE` lock and enforces `validation_status = 'valid'` in SQL).

2. **`app/actions/simulaciones.ts`** (`'use server'` — verifies `getUser()`, `rol NOT IN ('pendiente', 'suministrador')`, and active project membership):
   - `guardarSimulacion(input)`: Zod-validates `proyecto_id`, `nombre`, `parametros_override`, `horizonte_anios`, `moneda_calculo`, `vista_financiamiento`; fetches authoritative project/config/product/financing/offer rows + active `calculadora_templates` row via `createClient()`; enforces **Financial Precondition Gating (`resolveCapexTotal() > 0`)** and strict-allowlist `validateOverridesAgainstTemplate(template.campos, input.parametros_override)` (rejecting unknown keys and `editableByUser: false` keys with `422`, and applying `[0, 360]` to `plazo_meses`); verifies `configuracion_id` and `opcion_financiamiento_id` belong to `proyecto_id`; resolves Tier 2 currency-denominated tariffs into `moneda_calculo` before computing sparse `parametros_override` via `computeSparseOverrides()` (excluding top-level columns `moneda_calculo`, `horizonte_anios`, `vista_financiamiento` so currency/horizon/view toggles keep `parametros_override = {}` and `usa_parametros_base = true`); runs `evaluateSimulation()` server-side (`< 1 ms`); persists slim row (`template_id`, `template_version`, `usa_parametros_base`, sparse `parametros_override`, `capex_snapshot`, `desembolso_inicial`, KPI summary) to `public.simulaciones_ahorro` via `createAdminClient()`—never storing `serie_mensual` in PostgreSQL.
   - `recalcularSimulacion(id)`: Verifies `getUser()` + project access, loads the **currently active** `calculadora_templates` row (upgrading `template_id`, `template_version`, `capex_snapshot`, `desembolso_inicial`, and KPI summary columns), **re-runs `validateOverridesAgainstTemplate(activeTemplate.campos, sim.parametros_override)`** against the upgraded template (returning `{ error: '...', status: 422 }` if stored overrides violate the new template's allowlist, `editableByUser` flags, or bounds), and re-resolves current `capex_total` **before** writing: if project CAPEX was cleared to `0` or `null`, returns `{ error: '...', status: 422 }` cleanly without triggering PostgreSQL `CHECK (capex_snapshot > 0)` (`SQLSTATE 23514`); otherwise evaluates `< 1 ms` in TS and persists via `createAdminClient()` with `is_stale = false`.
   - `renombrarSimulacion(id, nombre, descripcion)` (updates only `nombre`/`descripcion`/`updated_at` via `createAdminClient()` after verifying ownership/project access) & `eliminarSimulacion(id)` (via `createClient()` governed by `DELETE` RLS requiring active project membership).

### 5.5 3-Step Admin Configuration & Excel Mapping Confirmation Workflow

Located at `/admin/configuracion/calculadora` (`app/(portals)/admin/configuracion/calculadora/page.tsx`) and also launchable via `"Configurar Calculadora y Fórmulas"` modal (`<AdminCalculadoraConfigModal />`) from `/admin/configuracion` and `/admin/proyectos/[id]` (for `nodo_admin` only):

> **Mandatory Server-Side Auth Guard:** `app/(portals)/admin/configuracion/calculadora/page.tsx` **MUST** be a Server Component that executes `await supabase.auth.getUser()` and queries `profiles.rol === 'nodo_admin'` server-side before rendering or passing template data—never relying solely on `proxy.ts` JWT claims (which can lag after role changes) or client role fallbacks.

- **Tab A — Parámetros Base Declarativos (`template.campos`)**:
  - Dynamically renders brand cards grouped by `campo.group` (`Moneda y Tipo de Cambio`, `Tarifas CFE / MEM`, `Ingeniería FV`, `Ingeniería BESS`, `Macroeconomía, O&M y Financiamiento`, `Estacionalidad FV 12 meses`, `Horizontes`), driven directly by `template.campos` sorted by `order` (`min`, `max`, `step`, `unit`, `validationRules`).
  - **Percentage Scaling & Signed Numeric Inputs**: Any field with `type === 'percentage'` displays and edits in **percentage points (`× 100` on render, `÷ 100` on save)** (e.g., DB `0.045` displays as `4.5 %`). Fields with `validationRules.allowNegative === true` use `formatSignedNumberInput` / `parseSignedNum` (preserving leading `-` instead of `formatNumberInput`'s digit-only regex) so negative `escalacion_tarifa_anual` (`>= -10%`) and `inflacion_anual` (`>= -5%`) can be entered cleanly. Saving invokes `saveCalculadoraTemplate({ modo: activeTemplate.modo, campos: updatedCampos, formulas: activeTemplate.formulas, ... })` (creating a new immutable version).
- **Tab B — Fórmulas de Cálculo (Editor Manual Excel-Language)**:
  - Lists the 7 canonical output formulas (`fv_kwh_mes`, `bess_kwh_mes`, `energia_ahorrada_kwh_mes`, `ahorro_bruto_mes`, `om_mes`, `cuota_financiamiento_mes`, `flujo_neto_mes`).
  - Each row shows an Excel-syntax editor (`=IF(...)`, `=SI(...)`, `PMT`, `POWER`, etc.), an inline clickable **Platform Variable Dictionary** pill bar to insert canonical keys, live AST syntax/cycle validation badge (`Válida` / `#NAME?` / `#CYCLE!`), and a live dry-run preview table.
  - Includes `"Restablecer modelo racional por defecto"` action.
- **Tab C — Importar desde Excel (3-Step `StepIndicator` Wizard)**:
  - `StepIndicator` with `steps={['1. Subir archivo Excel', '2. Mapeo de campos', '3. Confirmación e importación']}`:
  - **Step 1 (Subir archivo)**: Reuses `EvidenciaModal.tsx:245-302` drag-and-drop dropzone (`accept=".xlsx,.csv"`, max 10 MB), posts to `POST /api/calculator/excel/parse`, and lets admin pick the target worksheet if multiple sheets exist.
  - **Step 2 (Mapeo de campos)**: Reuses `admin/configuracion/roles/page.tsx:225-268` bordered table (`bg-principal text-white` header):
    - *Table 1 — Entradas detectadas (Celdas / Rangos nombrados / Referencias en fórmulas → Variable de Plataforma)*: Shows Excel cell (`B4` or `A10`), detected label (`"Tarifa eléctrica"` or `"Celda referenciada por D10"`), sample value (`3.20`), and `<select>` mapped to canonical `PlatformVariable` (or `"Ignorar"`). Unmapped cells referenced by any selected output formula trigger an inline `bg-amber-50 border-amber-200` warning blocking confirmation.
    - *Table 2 — Fórmulas / Salidas detectadas (Celda de Excel → Salida del Simulador)*: Shows Excel cell (`D12`), raw Excel formula (`=B5*B6*(1-B7)^A12`), live rewritten formula (`=generacion_fv_y1_kwh * tarifa_cfe_kwh * POWER(1 - degradacion_fv_anual, anio_indice)`), and `<select>` mapped to target output (`ahorro_bruto_mes`, etc.).
  - **Step 3 (Confirmación e importación)**: Displays side-by-side summary of all mapped variables, rewritten formulas, **live test calculation against a sample project (`Payback`, `Ahorro Año 1`, `VAN`)**, and `"Confirmar e importar fórmulas"` CTA which calls `saveCalculadoraTemplate({ modo: 'excel_import', ... })`.
- **Tab D — Historial de Versiones**: Audit table of all immutable `calculadora_templates` versions (`v1, v2, ...`, mode, file name, author, timestamp, `"Activa"` badge, `"Activar esta versión"` rollback button calling `activateTemplateVersion`).

---

## 6. UI/UX Component Architecture, Portal Consolidation & Client Flows (R1, R2, R4)

### 6.1 New & Consolidated File / Module Layout

```text
app/
├── api/calculator/excel/parse/route.ts                # POST Excel/CSV parser (nodo_admin only)
├── actions/
│   ├── calculatorConfig.ts                            # Template campos + formula AST save/rollback
│   └── simulaciones.ts                                # Save/rename/delete/recalculate simulations (slim DB rows)
└── (portals)/
    ├── admin/
    │   ├── configuracion/
    │   │   ├── page.tsx                               # Thin export -> ConfiguracionLoader
    │   │   └── calculadora/page.tsx                   # Dedicated Server-Guarded Nodo Admin template/formula page
    │   └── proyectos/
    │       ├── nuevo/page.tsx                         # 3-line wrapper -> <ProyectoWizard role="admin" />
    │       └── [id]/page.tsx                          # 2-line re-export -> DetalleProyectoLoader
    ├── analista/
    │   ├── clientes/page.tsx                          # 2-line re-export -> admin/clientes/page
    │   ├── configuracion/page.tsx                     # 2-line re-export -> ConfiguracionLoader
    │   └── proyectos/[id]/page.tsx                    # 2-line re-export -> DetalleProyectoLoader
    ├── epc/
    │   ├── nuevo/page.tsx                             # 3-line wrapper -> <ProyectoWizard role="epc" />
    │   ├── clientes/nuevo/page.tsx                    # Thin wrapper -> NuevoClienteForm
    │   └── proyectos/[id]/page.tsx                    # 2-line re-export -> DetalleProyectoLoader
    ├── finder/
    │   ├── nuevo/page.tsx                             # 3-line wrapper -> <ProyectoWizard role="finder" />
    │   ├── clientes/nuevo/page.tsx                    # Thin wrapper -> NuevoClienteForm
    │   └── proyectos/[id]/page.tsx                    # 2-line re-export -> DetalleProyectoLoader
    └── cliente/proyectos/
        ├── page.tsx                                   # Client project list (fixes TopBar/Sidebar nav)
        └── [id]/page.tsx                              # Client project detail -> DetalleProyectoLoader (read-only)
components/
├── ConfiguracionLoader.tsx                            # Shared portal settings loader (replaces 4× duplicated pages)
├── clientes/
│   ├── ClientesDirectory.tsx                          # Shared directory (admin/analista + epc/finder card view)
│   ├── NuevoClienteForm.tsx                           # Shared new-client form (epc/finder)
│   └── DetalleClienteView.tsx                         # Unified client detail view via capability flags
├── proyectos/
│   ├── ProductoFormFields.tsx                         # Shared declarative FV/BESS form fields
│   ├── ProductoCard.tsx                               # Shared product summary card
│   ├── ProyectoWizard.tsx                             # Parameterized 4-step wizard (replaces 6,208 duplicated lines)
│   ├── DetalleProyectoLoader.tsx                      # Unified 9-query + template/simulation loader (2-line re-exports)
│   └── PortfolioProyectosClient.tsx                   # Unified EPC/Finder portfolio list
└── calculator/
    ├── SimuladorAhorrosSeccion.tsx                    # Project-detail wrapper (gating, solution sync, <1ms evaluation)
    ├── SimuladorContextPanel.tsx                      # Declarative template.campos override inputs + sparse diff
    ├── ProyeccionesChart.tsx                          # Recharts ComposedChart + Payback ReferenceLine
    ├── ProyeccionesTabla.tsx                          # es-MX tabular period breakdown + CSV export
    ├── SimulacionesGuardadasPanel.tsx                 # Save/Load/Rename/Compare/Delete scenarios
    ├── AdminCalculadoraConfig.tsx                     # 4-tab declarative Admin template/formula workspace + modal
    └── ExcelImportStepper.tsx                         # 3-step StepIndicator Excel upload & mapping UI
lib/
├── proyectos/
│   └── product-schema.ts                              # Declarative FV/BESS schemas, calcFV/calcBESS, unified validators
├── loaders/
│   ├── instalaciones.ts                               # Shared server loader for 6 portal instalaciones pages
│   └── proyecto-subpages.ts                           # Shared server loaders for [id]/instalaciones & [id]/plan
└── calculator/
    ├── template-schema.ts                             # CalculadoraCampoDef, extractTemplateDefaults, sparse overrides
    ├── variable-dictionary.ts                         # Canonical platform vars + Spanish labels/units
    ├── formula-engine.ts                              # Safe recursive-descent Excel AST + Kahn resolver
    ├── defaults.ts                                    # Rational default formula evaluation (FV/BESS/MEM)
    ├── engine.ts                                      # Unified <1ms simulation runner, gating, payback, VAN/TIR
    ├── aggregate.ts                                   # Monthly -> Quarterly -> Yearly rollups
    └── excel-mapper.ts                                # Suggested mapping heuristics + cell-ref rewriter
supabase/
└── v29_savings_calculator.sql                         # calculadora_templates, slim simulaciones_ahorro, triggers, RLS, storage
```

### 6.2 Portal Consolidation & Client Solution Exposure (`/cliente/proyectos`, `/cliente/proyectos/[id]`)

1. **Consolidated Wizards, Loaders & 2-Line Re-Exports**:
   - **Creation Wizards & Modals**: `admin/proyectos/nuevo/page.tsx` (2,129 lines), `epc/nuevo/page.tsx` (2,042), and `finder/nuevo/page.tsx` (2,037) collapse into 3-line wrappers rendering `<ProyectoWizard role="admin" | "epc" | "finder" />`, while `EditarSolucionTecnicaModal.tsx` (893 -> ~350 lines) reuses `lib/proyectos/product-schema.ts`, `<ProductoFormFields />`, and `<ProductoCard />`. All validation (`hasHybridBessOnSite`, FV `generacion_anual_kwh` + `capex`, BESS `marca` + `uso` + `capex`, `validarPaso2()`, `nodo_busca` `inversion_total: null`) and `v25` fields (`tarifa_actual_cfe`, `consumo_anual_gwh`, `codigo_postal`) live in one canonical place.
   - **Project Detail Loaders**: `components/proyectos/DetalleProyectoLoader.tsx` derives portal context via `usePathname()` (or prop), loads project + technical/financing + active `calculadora_templates` + `simulaciones_ahorro` in parallel, and renders `<DetalleProyecto />` + `<SimuladorAhorrosSeccion />`. `admin/`, `analista/`, `epc/`, and `finder/proyectos/[id]/page.tsx` become **2-line re-exports** (`export { default } from '@/components/proyectos/DetalleProyectoLoader'`, matching `app/(portals)/analista/usuarios/page.tsx:1-2`).
   - **Clients, Settings, Installations, Plan & Portfolio**: Consolidated via `ClientesDirectory.tsx` (deriving `/admin` vs `/analista` row click links from `usePathname()` so the 2-line re-export at `analista/clientes/page.tsx` routes to `/analista/clientes/${c.id}` instead of hardcoded `/admin/clientes/${c.id}`), `NuevoClienteForm.tsx`, `DetalleClienteView.tsx` (capability flags), `ConfiguracionLoader.tsx` (2-line re-exports across 4 portals, failing closed with `rol: profileRow?.rol ?? 'pendiente'` and error/redirect fallback when `profileRow` is missing—**never** deriving `'nodo_admin'` from `usePathname()`, while `/admin/configuracion/calculadora` remains strictly server-guarded to `nodo_admin`), `lib/loaders/{instalaciones,proyecto-subpages}.ts` (fixing `cliente/instalaciones/page.tsx:25` `cliente_crm_id` `.or(...)` once), and `PortfolioProyectosClient.tsx`.
2. **`app/(portals)/cliente/proyectos/page.tsx`**:
   - Fetches `profiles.cliente_crm_id` and queries `proyectos` using `.or(\`cliente_id.eq.${user.id},cliente_id.eq.${crmId || NIL_UUID}\`)`.
   - Renders clean `glass-card` project cards showing project name, `BadgeTipo`, `BadgeEstado`, CAPEX (if present, else `"En cotización"`), and `"Ver solución y simulador"` button linking to `/cliente/proyectos/${p.id}`.
3. **`app/(portals)/cliente/proyectos/[id]/page.tsx`**:
   - Reuses `DetalleProyectoLoader` in read-only client mode (`isCliente`), loading `proyectos`, `sitios`, `proyecto_sitio_productos`, `configuraciones_tecnicas`, `opciones_financiamiento`, `config_financiamiento` (enabled by `v29` §7a), active `calculadora_templates`, and `simulaciones_ahorro`.
   - Renders a client-appropriate read-only summary of the suggested technical alternative(s) (`configuraciones_tecnicas` + per-site equipment) and financing options (`opciones_financiamiento`), omitting internal team comments (`DetalleProyecto.tsx:1622`) and admin/EPC edit controls, followed immediately by `<SimuladorAhorrosSeccion />`.
4. **Internal Portal Integration (`DetalleProyecto.tsx` & `financiero/proyectos/[id]/page.tsx`)**:
   - Mount `<SimuladorAhorrosSeccion />` inside `DetalleProyecto.tsx` (visible to `nodo_admin`, `nodo_analista`, `epc`, `finder`) right below `"Opciones de financiamiento"` so sales/engineering teams and clients see identical projections.
   - Mount `<SimuladorAhorrosSeccion readOnlyMode={false} />` on `financiero/proyectos/[id]/page.tsx` so assigned financiers can inspect and save financial/ROI scenarios.

### 6.3 Interactive Simulator & Projection Visualizations (`<SimuladorAhorrosSeccion />`)

1. **Pre-Check Financial Gating vs. Override Validation**:
   - Evaluates `projectCapex = resolveCapexTotal({ ..., fx: templateDefaults.tipo_cambio_usd_mxn })` and `hasValidFinancialFigures(projectCapex)` immediately on active `configuracion_id`. If `false`, mounts only the dashed `glass-panel` + `bg-amber-50 border-amber-200` gating view (§3.3)—**never** falsely tripped by transient user edits to `override.tipo_cambio_usd_mxn`.
   - When `projectCapex` is valid, live user override inputs run through `validateOverridesAgainstTemplate(template.campos, overrides)`; invalid mid-keystroke values (e.g., `tipo_cambio_usd_mxn = 0`) show an inline field error and disable `"Guardar simulación"` while preserving the simulator UI.
2. **Configuration, Declarative Overrides & `< 1 ms` On-the-Fly Evaluation**:
   - Selectors for **Technical Alternative** (`configuraciones_tecnicas`), **Financing View** (`Bruto / Contado` vs `Neto con Financiamiento` + `opciones_financiamiento` selector), **Currency** (`MXN` | `USD` with FX rate readout), **Horizon** (`template.horizonte_opciones`, default `[1, 3, 5, 10, 15, 20, 25]` años), and **Parameter Mode** (`Parámetros base Nodo` badge vs `Parámetros personalizados`).
   - Collapsible `<SimuladorContextPanel />` renders editable override inputs **declaratively from `template.campos.filter(c => c.editableByUser && c.validationRules?.overrideKey !== 'moneda_calculo')`** (grouped by `group`, enforcing `overrideMin ?? min`, `overrideMax ?? max`, `step`, `unit`, `validationRules`), plus project-level engineering inputs (`consumo_anual_kwh`, `generacion_fv_y1_kwh`), with `"Restablecer a base"` and live instant recalculation (`useMemo` over pure TS `evaluateSimulation()` executing 1..360 months in `< 1 ms` in memory). **Note on `tasa_interes_anual` seeding:** `SimuladorContextPanel` initializes `tasa_interes_anual` from the resolved Tier 2/3 context value (`0.135` when `vehiculo_inversion === 'arrendamiento'`, `0.125` when `'credito'`, `0` otherwise) rather than raw `campo.defaultValue` (`0.125` on `credito_tasa_interes_anual`), preventing spurious overrides on `arrendamiento` projects.
   - **Sparse Override Persistence & Reconstruction**: Saving computes `computeSparseOverrides()` over the 24 `SimulacionOverrides` keys (with Tier 2 tariffs converted into `moneda_calculo` first and top-level `moneda_calculo`/`horizonte_anios`/`vista_financiamiento` stored in their dedicated columns), so toggling currency, horizon, or financing view keeps `parametros_override = {}` (`usa_parametros_base = true`); loading any saved simulation joins its immutable `template` (`template_id`) and reconstructs the exact 1..360 month `serie_mensual` + rollups on the fly in `< 1 ms` without DB time-series bloat.
   - **Percentage Scaling & Negative-Sign Support**: All `type === 'percentage'` inputs display/edit in percentage points (`×100` / `÷100`) and fields with `validationRules.allowNegative` use `formatSignedNumberInput` / `parseSignedNum` so negative `escalacion_tarifa_anual` and `inflacion_anual` work cleanly.
   - If `nodo_admin` is viewing, renders a subtle `"Configurar plantilla y fórmulas"` button opening `<AdminCalculadoraConfig />` modal.
3. **KPI Readout Row (`StatFigure` Grid)**:
   - 5 `StatFigure` cards (`app/brand-preview/page.tsx:76-83` pattern):
     1. **Payback Estimado** (`tone="plain"`): e.g. `3.37 años` + subtext `40.4 meses (Desc: 4.05 años)`, or `"Inmediato (sin desembolso inicial)"` / `"No recuperable"`.
     2. **Ahorro Energía (Año 1)** (`tone="menta"`): e.g. `142,800 kWh`.
     3. **Ahorro Monetario (Año 1)** (`tone="accent"`): e.g. `$456,960 MXN`.
     4. **Ahorro Acumulado (`H` años)** (`tone="menta"`): e.g. `$12,480,200 MXN`.
     5. **VAN / TIR / ROI** (`tone="plain"`): e.g. `TIR 36.8% · ROI s/CAPEX 1,073%` (and when financed with `0 < desembolso_inicial < capex_total`, explicitly shows `Cash-on-Cash: X%` alongside `ROI s/CAPEX`).
4. **Timeframe Toggle & `recharts` Visualization (`<ProyeccionesChart />`)**:
   - Pill toggle matching `TimePeriodButtons` (`TimePeriodSelector.tsx:14-24`): `Mensual` | `Trimestral` | `Anual`.
   - `recharts` `ComposedChart` (`ResponsiveContainer width="100%" height={360}`):
     - Bars: `Ahorro Monetario Bruto` (`fill="var(--color-menta)"`) and `Flujo Neto` (`fill="var(--color-acento)"`).
     - Line: `Flujo Acumulado` (`stroke="var(--color-principal)"`, `strokeWidth={2.5}`).
     - Zero / Break-Even `ReferenceLine` (`y={0}`, `stroke="var(--color-texto-suave)"`) + vertical `ReferenceLine` at the payback period (`stroke="var(--color-exito)"`).
     - Secondary toggle tab on chart: `"Flujo Monetario"` vs `"Energía (kWh)"` (`AreaChart` of FV + BESS kWh savings).
5. **Tabular Breakdown (`<ProyeccionesTabla />`) & Safe CSV Export**:
   - Zebra-striped `es-MX` table with right-aligned `.num` columns: `Periodo`, `Ahorro Energía (kWh)`, `Ahorro Bruto`, `O&M`, `Financiamiento`, `Flujo Neto`, `Flujo Acumulado`, plus `"Exportar CSV"` download button (client-side UTF-8 BOM CSV).
   - **CSV Formula-Injection Neutralization (CWE-1236)**: Every exported **string** cell (e.g., project/scenario name, period labels) is neutralized against `/^[\s\r\n]*[=+\-@]|^[\t\r\n]/` by prefixing a leading single quote (`'`) and applying RFC-4180 quoting; numeric cashflow columns remain raw unquoted numbers so negative cashflows such as `-12500.00` stay numeric and are never corrupted into text `'-12500.00`.

### 6.4 Simulation Persistence, Comparison & Stale-Input Management

Following `TemplateManager.tsx:165-336` and `SitiosCliente.tsx:277-315`:
- **Save (`"Guardar simulación"`)**: Opens modal capturing `nombre` (e.g. `"Escenario Base 25 años"`, `"Tarifa CFE +6% anual"`) and optional `descripcion`; calls `guardarSimulacion()` Server Action; shows 3-second Lima `savedMsg` (`bg-acento text-principal`).
- **Load & Manage**: Saved scenarios list card showing scenario name, creator (`creador.nombre`), badge (`Base Nodo` vs `Personalizada`), horizon, view (`Bruto`/`Neto`), Year-1 savings, Payback, and timestamp (`toLocaleDateString('es-MX', ...)`).
  - Actions: `"Cargar"` (restores `configuracion_id`, `opcion_financiamiento_id`, `parametros_override`, `horizonte_anios`, `moneda_calculo`, `vista_financiamiento`), `"Duplicar"`, `"Renombrar"`, and two-step inline `"Eliminar"` (`confirmDelete === sim.id` -> `"Confirmar"` / `"Cancelar"`).
  - **Gated-Project KPI Suppression:** When the selected configuration / project is gated (`!hasValidFinancialFigures(projectCapex)`), `<SimulacionesGuardadasPanel />` suppresses all numeric KPIs (`"— (requiere CAPEX)"`) and disables `"Cargar"`, `"Comparar"`, and `"Recalcular"` so zero calculated numbers are rendered while gated (§3.2).
- **Side-by-Side Comparison**: Checkbox toggle on up to **3** saved simulations rendering a comparison matrix (`Escenario`, `CAPEX`, `Parámetros`, `Ahorro Año 1`, `Ahorro Total`, `Payback Simple`, `VAN`, `TIR`).
- **Stale-CAPEX Detection**: When PostgreSQL triggers set `simulaciones_ahorro.is_stale = TRUE` (after `capex_estimado`, `inversion_total`, `proyecto_sitio_productos`, `ofertas_mem`, `sitios.demanda_contratada_kw`, or config/financing changes), the saved simulation card displays an amber `<Badge variant="warning">Datos del proyecto actualizados</Badge>` chip and a `"Recalcular con datos actuales"` button calling `recalcularSimulacion(sim.id)` (which upgrades to the active `calculadora_templates` version and returns `422` cleanly if project CAPEX was cleared to `0`/`null`).

### 6.5 Brandbook & ESLint Compliance Checklist

- **Zero raw hex colors** in `app/**/*.{ts,tsx}` and `components/**/*.{ts,tsx}` (`eslint.config.mjs:24-27` `no-restricted-syntax` rule) — use Tailwind token classes (`bg-principal`, `text-acento`, `bg-menta`, `border-borde`, `border-linea`, `text-texto-suave`) and `var(--color-*)` inside `recharts` props.
- **Numeric alignment**: Apply `.num` (`font-variant-numeric: tabular-nums`) to all KPIs, chart axes/tooltips, and projection table numeric cells.
- **Formatting**: All currency, kWh, and % strings must pass through `lib/format.ts` (`fmtCurrency`, `fmtNum`, `fmtUnit`, `fmtPct`).

---

## 7. Concrete Verification Scenarios & Phased Implementation Plan

### 7.1 Deterministic Numerical & Integration Verification Scenarios

| # | Scenario | Inputs & Preconditions | Expected Engine / UI Behavior & Outputs |
|---|---|---|---|
| **S1** | **Baseline Parameters vs. User-Overridden Context Parameters** | Project: `FV`, `100 kWp` (`200 × 500 W`), `generacion_anual_kwh = 160,000 kWh`, product `capex = 100,000 USD`, `moneda_calculo = 'MXN'`. Active `calculadora_templates` `v1` `campos`: `tipo_cambio_usd_mxn = 17.50`, `tarifa_cfe_default_mxn = 3.20`, `degradacion_fv_anual = 0.005`, `escalacion_tarifa_anual = 0.045`, `pct_om_anual = 0.01`, `inflacion_anual = 0.04`, `tasa_descuento_anual = 0.10`, `horizonte = 25`. | **Run A (Baseline):** `capex_total = 1,750,000 MXN`; `ahorro_bruto_y1 = 160,000 × 3.20 = 512,000 MXN`; `om_y1 = 17,500 MXN`; `flujo_neto_y1 = 494,500 MXN`. Cumulative crosses `0` permanently at Month 41 (`payback_simple = 3.37 años` / `40.42 meses`; `payback_descontado = 4.05 años` / `48.65 meses`; `VAN = 4,735,959.16 MXN`; `TIR = 36.78%`; `ROI = 1,073.11%`). Badge shows `"Parámetros base Nodo"`; `parametros_override = {}`.<br>**Run B (User Override):** Client overrides `tarifa_cfe_kwh = 4.20 MXN/kWh`, `escalacion_tarifa_anual = 0.06`, saves `"Escenario Tarifa Alta"`. `ahorro_bruto_y1 = 672,000 MXN`, `flujo_neto_y1 = 654,500 MXN`, `payback_simple = 2.53 años` (`30.40 meses`), `payback_descontado = 2.91 años` (`34.91 meses`), `VAN = 8,113,510.43 MXN`, `TIR = 51.17%`, `ROI = 1,814.42%`. Badge switches to `"Personalizado"`; both scenarios persist in `simulaciones_ahorro` with sparse `parametros_override` (`{"tarifa_cfe_kwh":4.2,"escalacion_tarifa_anual":0.06}` on Run B) and evaluate 300-month series on the fly in `< 1 ms`. |
| **S2** | **Missing Financial Figures Gating (`null` & `0` CAPEX)** | Case 2a: Project created with `tipo_instalacion = 'nodo_busca'` (`capex_estimado = null`, `inversion_total = null`).<br>Case 2b: Legacy `finder` `nodo_busca` or `epc` project with `inversion_total = 0` (including switching from a funded `proyectos.capex_estimado` to an unpriced `activeConfig` with `inversion_total = null`). | `resolveCapexTotal()` returns `null` (no fall-through to `proyectos.capex_estimado` when `activeConfig` exists) and `hasValidFinancialFigures(capex)` returns `false`. Engine returns `{ status: 'gated' }`. UI renders **zero** KPIs (and `<SimulacionesGuardadasPanel />` suppresses saved KPIs), **zero** payback, **zero** charts, **zero** tables, disables `"Simular"`/`"Guardar"`, and displays the `bg-amber-50` gating banner instructing viewers to input quantitative financial figures. `nodo_admin`/`nodo_analista`/owning `epc` see CTA to open `EditarSolucionTecnicaModal`; `cliente_final` sees read-only advisor guidance. `guardarSimulacion()` and `recalcularSimulacion()` reject server-side (`422`). |
| **S3** | **Admin-Configured Excel-Language Formulas (EN + ES + Invalid/Cycle)** | `nodo_admin` opens `/admin/configuracion/calculadora` -> Tab B. Edits `ahorro_bruto_mes` to `=SI(mes_indice<=12; energia_ahorrada_kwh_mes * tarifa_cfe_kwh * 1.05; energia_ahorrada_kwh_mes * tarifa_cfe_kwh * POTENCIA(1 + escalacion_tarifa_anual; anio_indice))`. Also tests invalid input `=ahorro_bruto_mes * 2` on `om_mes` while `ahorro_bruto_mes` references `om_mes`, `=UNKNOWN_FN(1)`, and `=constructor`. | Valid ES Excel formula (`SI`, `;` separator, `POTENCIA`) compiles to AST, passes Kahn sort, activates atomically as immutable `v2` in `calculadora_templates`, and immediately drives client/project simulations (`fuente_calculo = 'formula_personalizada'`). Circular edit fails with `#CYCLE!` before saving; unknown function and `=constructor` fail with `#NAME?`. Non-admin (`nodo_analista`, `epc`, `cliente_final`) receives `403` on save action and is redirected server-side from `/admin/configuracion/calculadora`. |
| **S4** | **Direct Excel `.xlsx` Upload -> Field Mapping -> Confirmation -> Import** | `nodo_admin` uploads `Modelo_Solar_BESS.xlsx` (`.xlsx`, `< 10 MB`, `PK\x03\x04`, `< 50 MB` uncompressed) in Step 1 (`POST /api/calculator/excel/parse`). Sheet `"Modelo"` has `B2 = 1750000` (`"Inversión CAPEX"`), `B3 = 160000` (`"Gen Anual kWh"`), `B4 = 3.50` (`"Tarifa CFE"`), `B5 = 0.045` (`"Escalación"`), `D10 = =B3*B4*(1+$B$5)^A10/12` (`"Ahorro Mensual"`). Also tests legacy `.xls` rejection. | Step 1 parses workbook, normalizes `$B$5` -> `B5`, and extracts **both** labeled constants (`B2..B5`) **and** referenced unlabeled/axis cells (`A10`), suggesting mappings (`B2 -> capex_total`, `B3 -> generacion_fv_y1_kwh`, `B4 -> tarifa_cfe_kwh`, `B5 -> escalacion_tarifa_anual`). Step 2 renders mapping table; admin maps `A10 -> anio_indice` and `D10 -> ahorro_bruto_mes` (attempting to save with unmapped `A10` triggers `422` server-side AST rejection). Step 3 shows rewritten formula `=generacion_fv_y1_kwh * tarifa_cfe_kwh * POWER(1 + escalacion_tarifa_anual, anio_indice) / 12` + live fixture preview, confirms & persists atomically as `v3` (`modo = 'excel_import'`, `excel_archivo_hash`, `excel_mapeo_campos` in `calculadora_templates`). Uploading `.xls` or spoofed binary returns `422`. |
| **S5** | **Monthly / Quarterly / Yearly Rollups, FX & Payback Edge Cases** | Case 5a (Granularity): 10-year FV+BESS simulation viewed in `Mensual` (120 rows), `Trimestral` (40 rows), `Anual` (10 rows).<br>Case 5b (Short Horizon): True payback `6.4 años`, user selects `horizonte_anios = 5`.<br>Case 5c (Unrecoverable): Low generation + high O&M (`flujo_neto < 0` or never reaches 0 in 30y).<br>Case 5d (Financed `credito` vs `bruto`, plus double-crossing seasonal series): `20%` enganche, `12.5%` APR, `60` meses. | **5a:** Sum of `flujo_neto` across 120 months === sum across 40 quarters === sum across 10 years (`±0.01` rounding); end-of-period `flujo_acumulado` matches exactly.<br>**5b:** `payback_estado = 'fuera_horizonte'`, KPI shows `"Fuera de horizonte (~6.4 años est.)"` + `"Ampliar a 10 años"` button.<br>**5c:** `payback_estado = 'no_recuperable'`, UI shows `"No recuperable en el horizonte"`.<br>**5d:** `vista = 'neto'` sets `desembolso_inicial = 0.20 * capex_total`, deducts `PMT` debt service for months `1..60`, removes debt service in months `61..120`, reports **permanent** break-even payback (ignoring transient early zero-crossings), and displays both `ROI s/CAPEX` and `Cash-on-Cash`. |

### 7.2 Phased, Zero-Mock Implementation Roadmap

1. **Phase 1 — Dependencies, Types & Database Migration (`v29`)**:
   - Install `exceljs`, `zod`, `vitest` in `package.json`.
   - Apply `supabase/v29_savings_calculator.sql` (declarative `calculadora_templates` with `campos` + `formulas` JSONB and `horizonte_opciones` `1..30` checks, `BEFORE UPDATE` immutability trigger guarding `id` and all immutable fields, atomic `SECURITY DEFINER` RPCs, slim `simulaciones_ahorro` with sparse `parametros_override` + KPIs, complete `INSERT`/`UPDATE`/`DELETE` stale triggers across 7 tables, immutable `proyecto_id` & cross-project FK integrity trigger, `v1` declarative seed, hardened RLS, `v2`/`v15`/`v16`/`v18`/`v22` RLS fixes on `sitios`/`ofertas_mem`/`config_financiamiento`/`proyecto_sitio_productos`/`archivos`, and project/role-scoped `'archivos-proyectos'` storage policies for both `comprobantes/<proyecto_id>/*` and `<proyecto_id>/*` with strict `8-4-4-4-12` UUID regexes wrapped in `CASE WHEN ... ~ ... THEN ...::uuid END`).
   - Update `lib/types.ts` with `v25` `Proyecto` columns, typed FV/BESS JSONB, `CalculadoraCampoDef`/`CalculadoraTemplate`, `SimulacionRunRequest`, slim `SimulacionAhorro`, and in-memory engine output types (plus `DetalleProyecto.tsx:1151-1161` legacy fallback fields).
2. **Phase 2 — Declarative Schema & Pure `< 1 ms` Calculation / AST Engine (`lib/calculator/`) + Unit Tests**:
   - Implement `template-schema.ts` (`extractTemplateDefaults`, strict-allowlist `validateOverridesAgainstTemplate` with `overrideMin`/`overrideMax` for `plazo_meses` `[0, 360]`, currency-neutral `computeSparseOverrides`), `variable-dictionary.ts`, `formula-engine.ts` (`Map`-backed scope, lazy `IF`/`SI`/`IFERROR`, EN/ES aliases + `;` separator + dotted names + Excel `^` / unary `-` precedence, Kahn cycle check, `compileAndSortFormulas` memoized per immutable `template_id`), `defaults.ts`, `aggregate.ts`, `engine.ts` (strict `resolveCapexTotal()` gating with `Number.isFinite` overflow guard, separated override validation, `< 1 ms` 1..360 month evaluation, permanent break-even payback, consistent `r_desc_m` VAN/TIR, dual ROI), and `excel-mapper.ts`.
   - Write comprehensive Vitest unit tests covering **S1–S5** math, `defaults.ts` ↔ `v29` seed AST bit-identity, `< 1 ms` 360-month evaluation, FX, gating, cycle detection, prototype-pollution safety (`constructor`/`__proto__`), and Spanish aliases.
3. **Phase 3 — Backend API & Server Actions**:
   - Implement `app/api/calculator/excel/parse/route.ts` (`getUser()` + `nodo_admin` check + `PK\x03\x04` / EOCD Central Directory ZIP-bomb pre-flight with `> 1 MB` floor + `.csv` NUL/binary guard + `exceljs` preview).
   - Implement `app/actions/calculatorConfig.ts` (atomic template RPC calls + server-side AST rejection of unresolved `CellRef`/`RangeRef`) and `app/actions/simulaciones.ts` (authoritative server-side KPI evaluation + strict-allowlist override validation + `recalcularSimulacion` re-validation on template upgrade + sparse `parametros_override` persistence via `createAdminClient()` + `422` cleared-CAPEX recompute guard).
4. **Phase 4 — Portal Consolidation, Existing Bug Fixes & De-Mocking**:
   - **Consolidate duplicated wizards & modals**: Extract `lib/proyectos/product-schema.ts`, `components/proyectos/ProductoFormFields.tsx`, `ProductoCard.tsx`, and `ProyectoWizard.tsx`, shrinking `admin/proyectos/nuevo`, `epc/nuevo`, and `finder/nuevo` to 3-line wrappers and shrinking `EditarSolucionTecnicaModal.tsx` while fixing `epc/nuevo:454-469,716`, `finder/nuevo:748,757,817-838`, `hasHybridBessOnSite`, and `v25` field surfacing once.
   - **Consolidate duplicated portal loaders & CRUD routes**: Extract `DetalleProyectoLoader.tsx` (+ 2-line re-exports for `admin`/`analista`/`epc`/`finder/proyectos/[id]/page.tsx` matching `analista/usuarios/page.tsx:1-2`), `ClientesDirectory.tsx`, `NuevoClienteForm.tsx`, `DetalleClienteView.tsx`, `ConfiguracionLoader.tsx` (+ 2-line re-exports), `PortfolioProyectosClient.tsx`, and `lib/loaders/{instalaciones,proyecto-subpages}.ts` (fixing `cliente/instalaciones/page.tsx:25` `cliente_crm_id` `.or(...)` once).
   - **Fix remaining platform bugs & FX/tariff normalization**: Update `Sidebar.tsx`, `TopBar.tsx`, `cliente/page.tsx`, `FinancialMilestoneModal.tsx:85,87` (`'archivos-proyectos'`), `AnalistaDashboardClient.tsx`, `OfertasBoard.tsx:12`, `login/page.tsx`, `lib/dashboard-data.ts` (active `calculadora_templates` FX rate + `ahorro_moneda` at `:203` + `capex_estimado` and product `datos.capex` FX normalization), `TimePeriodSelector.tsx` (including product `datos.capex` FX normalization), `DashboardAnalytics.tsx:58`, `financiero/*`, `lib/format.ts` (`formatSignedNumberInput`), and `lib/egauge.ts` (remove unused mock functions while preserving `export interface TelemetryDataPoint` for `EnergyChart.tsx:4`).
5. **Phase 5 — Declarative Admin Configuration UI & Client/Portal Simulator UI**:
   - Build server-guarded `/admin/configuracion/calculadora/page.tsx` + declarative `AdminCalculadoraConfig` + `ExcelImportStepper` (`StepIndicator` + `EvidenciaModal` dropzone + mapping table + `%` `×100`/`÷100` & signed inputs), gated to `nodo_admin` from `Configuracion.tsx`.
   - Build `/cliente/proyectos` & `/cliente/proyectos/[id]` (via `DetalleProyectoLoader`) + `components/calculator/*` (`SimuladorAhorrosSeccion`, declarative `SimuladorContextPanel`, `ProyeccionesChart`, `ProyeccionesTabla` with CSV injection neutralization, `SimulacionesGuardadasPanel` with gated KPI suppression) and mount in `DetalleProyecto.tsx` and `financiero/proyectos/[id]/page.tsx`.
6. **Phase 6 — End-to-End Verification & Brand QA**:
   - Run static checks, unit tests, production build, and Playwright E2E tests across `nodo_admin`, `epc`, `financiero`, and `cliente_final` portals.

### 7.3 Acceptance Verification Commands

Once dependencies are installed (`npm ci`) and `.env.local` is configured in the workspace:

```bash
# 1. TypeScript strict compilation
npx tsc --noEmit

# 2. ESLint (must report 0 errors and 0 new hex-literal warnings in new files)
npm run lint

# 3. Pure calculation, AST formula engine, FX, gating & payback unit tests
npm test

# 4. Next.js 16 production build (verifies App Router pages, route.ts & Server Actions)
npm run build
```
