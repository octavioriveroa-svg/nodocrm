# Nodo CRM - Platform Context & Handoff Summary

This document summarizes the current production-hardened state of the **Nodo CRM** platform, its architecture, security posture, data model, and recently completed engineering sprints. Provide this file to any new session or engineer to immediately bring them up to speed.

---

## 1. Platform Overview
**Nodo CRM** is a multi-portal web application built to manage commercial & industrial solar photovoltaic (FV) and battery energy storage system (BESS) installation projects across Mexico. It connects stakeholders across the entire lifecycle of an energy project—from lead origination and multi-site technical sizing to financing, construction milestone tracking (Gantt), and post-installation energy monitoring.

### Tech Stack
- **Framework**: Next.js 16.2.3 (App Router, `proxy.ts` request interceptor) + React 19.2.4 + TypeScript
- **Styling**: Tailwind CSS, Lucide Icons, custom responsive HTML/SVG visualizations
- **Database & Auth**: Supabase (`nlqrdxwyxmgdwawedweh` — PostgreSQL, Row Level Security, Auth, Storage, Transactional RPCs)
- **Testing & CI**: 4-Tier Automated Acceptance Suite (`npx tsx tests/test-runner.mjs` / `npm test`, 65 tests) + Empirical Security/Lifecycle Suites + GitHub Actions CI/CD (`.github/workflows/main.yml`)
- **Deployment**: Vercel

### User Roles & Portals (7 Portals)
The platform enforces strict server-side Role-Based Access Control (RBAC) via `proxy.ts` and portal layouts: `proxy.ts` inspects the signed JWT custom claim `user.app_metadata?.user_role` first (synchronized by DB trigger `trg_sync_profile_role_to_app_metadata` and Auth Admin API provisioning) and falls back to `public.profiles.rol` only when absent, never trusting client-editable `user_metadata`:
- **`nodo_admin` (`/admin`)**: Full platform visibility, global analytics dashboard, project creation & oversight, client & site management, user directory (`/admin/usuarios`), and role/account administration (`/admin/configuracion/roles`).
- **`nodo_analista` (`/analista`)**: Global analytics dashboard (`/analista`), full projects directory with search/status/type filters and `"Limpiar filtros"` controls (`/analista/proyectos`), project creation (`/analista/proyectos/nuevo`), client management, and non-admin user management.
- **`epc` (`/epc`)**: Engineering, Procurement & Construction installers. Submit and manage projects (`/epc/nuevo`), configure technical FV/BESS solutions, manage construction plans & milestones (`/epc/proyectos/[id]/plan`), and monitor installations (`/epc/instalaciones`).
- **`finder` (`/finder`)**: Lead referrers and commercial originators. Create projects (`/finder/nuevo`), invite EPC installers, track referred deals, and inspect project construction plans (`/finder/proyectos/[id]/plan`) and installations (`/finder/proyectos/[id]/instalaciones`).
- **`cliente_final` (`/cliente`)**: End-customer portal linked via `profiles.cliente_crm_id` (with `clientes.usuario_id` fallback). Displays project progress, verified CFE tariff savings, and live/historical installation metrics (`/cliente/instalaciones`).
- **`financiero` (`/financiero`)**: Financial institution portal. Displays funded portfolio KPIs, 30-day bounded telemetry performance, CFE tariff-based financial savings, and project-level financial milestones.
- **`suministrador` (`/mem`)**: Qualified Supplier portal for the Mexican Wholesale Electricity Market (*Mercado Eléctrico Mayorista* — `/mem`). Queries real high-demand sites and projects safely via `OfertasBoard.tsx`.

---

## 2. Core Architecture & Data Model

### Primary Database Entities
- **`profiles`**: Extended user data linked `1:1` to `auth.users`. Contains role (`rol`), linkage (`cliente_crm_id`), and 9 persisted company/preference columns (`rfc`, `industria`, `ubicacion_estado`, `website`, `moneda_preferida`, `timezone`, `notif_nuevo_proyecto`, `notif_cambio_estado`, `notif_comentarios`).
- **`proyectos`**: Central project entity tracking lifecycle states (`recibido` → `en_analisis` → `enviada` → `negociacion` → `ganado` → `en_ejecucion` → `completado`, plus `perdido`/`pausado`) and `historial_estados` JSONB transitions. Linked to `clientes` and `profiles` (`epcista_id`, `responsable_nodo_id`, `finder_id`).
- **`clientes` & `cliente_sitios`**: Commercial client records and physical load centers (with CFE tariff type `tarifa_cfe`, contracted demand, consumption, and uploaded CFE bill PDFs).
- **`proyecto_sitios` & `proyecto_sitio_productos`**: Multi-site project associations and legacy/summary FV/BESS product line items (`capex`, `ahorro_mensual_estimado`, `potencia_kwp`, `capacidad_kwh`).
- **`configuraciones_tecnicas` & `opciones_financiamiento` & `config_financiamiento`**: Multi-option technical configurations (FV, BESS, hybrid inverter linkages, multi-currency MXN/USD CAPEX) and financing vehicles (`ppa`, `credito_simple`, `arrendamiento`, `contado`, `otro`).
- **`plan_fases`, `plan_actividades`, `hitos_financieros`**: EPC construction schedule (with topological cascade scheduling via `lib/cascade-scheduler.ts`) and financial disbursement milestones.
- **`telemetria_egauge`**: Time-series production and consumption readings (`id`, `proyecto_id`, `timestamp`, `solar_produccion_kwh`, `consumo_red_kwh`, `bateria_descarga_kwh`, `bateria_porcentaje`) indexed by `(proyecto_id, timestamp DESC)`.
- **`notificaciones`**: Real-time user notification inbox (`id`, `usuario_id`, `proyecto_id`, `comentario_id`, `tipo` including `'evidencia'`, `titulo`, `mensaje`, `enlace`, `leido`, `created_at`) protected by user-scoped RLS policies and client-recipient resolution via `profiles.cliente_crm_id`.

### Transactional RPCs & Security Triggers (`supabase/migrations/`)
1. **`20261021000001_sprint1_security_rpcs_and_profile_prefs.sql`**:
   - **Self-Promotion Prevention (`SEC-01`, `SEC-02`)**: `protect_profile_role()` trigger blocks non-admin users from altering `profiles.rol` or `profiles.cliente_crm_id`. `handle_new_user()` hardcodes new signups to `'pendiente'`.
   - **Hardened `SECURITY DEFINER` Functions (`SEC-04`)**: Fixed `SET search_path = public` across all privileged functions (`get_my_role`, `admin_update_role`, `handle_new_user`, etc.).
   - **Atomic Project Creation (`crear_proyecto_completo`)**: Single-transaction PostgreSQL RPC inserting `proyectos`, `proyecto_sitios`, `configuraciones_tecnicas`, `opciones_financiamiento`, `config_financiamiento`, and `proyecto_sitio_productos` atomically.
   - **Atomic Option Switching (`seleccionar_configuracion_tecnica`, `seleccionar_opcion_financiamiento`)**: Prevents race conditions or orphaned active flags when switching selected technical or financing options in `DetalleProyecto.tsx`.
2. **`20261021000002_dashboard_views_and_indexes.sql`**:
   - Composite indexes `idx_telemetria_proyecto_time` and `idx_proyectos_estado_created`.
   - Explicit foreign key `proyectos_epcista_id_fkey` enabling single-roundtrip PostgREST relational joins for `epc`, `responsable`, and `finder` profiles.
3. **Sprint 3 Remediation Migrations (`20261112000001`–`20261112000004` + Consolidated Bundle `20261112000000_consolidated_sprint3_ddl.sql`)**:
   - **`20261112000001_create_notificaciones.sql`**: Creates `public.notificaciones` (`leido`, `enlace`, `comentario_id`, `'evidencia'`), indexes, and RLS policies.
   - **`20261112000002_sync_user_role_claim.sql`**: Adds `sync_profile_role_to_app_metadata()` + `trg_sync_profile_role_to_app_metadata` trigger and backfills `auth.users.raw_app_meta_data->>'user_role'` from `public.profiles.rol`.
   - **`20261112000003_tarifa_cfe_varchar.sql`**: Migrates `proyectos.tarifa_actual_cfe` to `VARCHAR(20)` idempotently.
   - **`20261112000004_fk_indexes.sql`**: Adds 10 B-tree indexes across `proyectos`, `sitios`, `proyecto_sitios`, `configuraciones_tecnicas`, and `opciones_financiamiento`.

---

## 3. Major Engineering Milestones Completed (Sprints 1–3)

### A. Security & RBAC Hardening
- **Authoritative Role Checks**: `proxy.ts` reads the signed JWT custom claim `user.app_metadata?.user_role` (synced via DB trigger and `lib/domains/auth/user-provisioning.ts`) with a conditional `public.profiles.rol` fallback when absent, while `app/login/page.tsx`, `app/pendiente/page.tsx`, and portal layouts enforce authoritative role verification and `getUser()` SSR validation (`app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx`). `proxy.ts` and `app/login/page.tsx` preserve query strings in `returnUrl` with open-redirect defense and `resolveCrossPortalDeepLink` rewriting.
- **Admin Server Actions (`app/actions/*.ts`)**: Enforced strict server-side caller verification: only `nodo_admin` can delete users (`adminDeleteUser`) or assign the `nodo_admin` role (`crearUsuarioAdmin`, `invitarUsuario`).
- **Pendiente Session Refresh**: `app/pendiente/page.tsx` calls `supabase.auth.refreshSession()` upon role approval to eliminate redirect loops.

### B. Unified `ProjectWizard`, Modular Components & UI Primitives
- **Consolidated Wizard (`components/proyectos/ProjectWizard.tsx` + `components/proyectos/wizard/useProjectWizardState.ts`)**: Decomposed wizard state, catalog loading, site CRUD, product/config/financing handlers, and RPC/fallback payload builders into `useProjectWizardState.ts`, reducing `ProjectWizard.tsx` to 303 lines while preserving atomic `crear_proyecto_completo` persistence with compensating rollback and hybrid BESS+FV inverter linking.
- **Evidence & Marketplace Decomposition**: Extracted `EvidenciaGallery.tsx` and `EvidenciaLightbox.tsx` under `components/instalaciones/` for `InstalacionMonitor.tsx`, added reusable primitives (`Modal.tsx`, `DropdownMenu.tsx`, `Tabs.tsx`) under `components/ui/`, refactored `OfertasBoard.tsx` to use `Modal`, and consolidated Tailwind v4 `@theme` design tokens in `app/globals.css`.
- **Insert-Before-Delete Modals**: `EditarSolucionTecnicaModal.tsx` and `EditarFinanciamientoModal.tsx` insert new rows before deleting removed ones to prevent data loss on network failure.

### C. Zero-Mockups, Deterministic CFE Tariffs, Telemetry & Real Persistence
- **Removed Synthetic Code**: Deleted `lib/egauge.ts` and `app/brand-preview/page.tsx`.
- **Telemetry & Client Directory Alignment**: `getTelemetryHistorical` in `lib/dashboard-data.ts` selects explicit live `telemetria_egauge` columns with camelCase aliases, and `fetchProyectosDirectory` in `lib/domains/proyectos/queries.ts` resolves `profiles.cliente_crm_id` for `cliente_final` users.
- **Deterministic CFE Tariff Calculator (`lib/tariffs/cfe-calculator.ts`)**: Supports all 8 CFE tariffs (`GDMTH`, `GDMTO`, `PDBT`, `GDBT`, `DIST`, `DIT`, `01`, `DAC`), `SEMARNAT_EMISSIONS_FACTOR_KG_CO2_PER_KWH = 0.423` (`calculateCo2AvoidedTonnes`), and `USD`->`MXN` savings normalization (`exchangeRateUsdMxn = 18.0`), wired into `cliente`, `financiero`, and `mem` portals.
- **Database-Backed Settings (`components/Configuracion.tsx`)**: Replaced `localStorage` persistence with real Supabase `profiles` updates across all 7 portals (`/{portal}/configuracion`).

### D. App Router UX Boundaries, Query Optimization & CI/CD
- **Resilience Boundaries (`REL-01`)**: Added root and per-portal `error.tsx`, `loading.tsx`, and `not-found.tsx` boundaries across all 7 portals.
- **Single-Roundtrip Project Directories & Foreign Key Indexing (`PERF-01`, `PERF-03`)**: Refactored `/admin/proyectos` and `/analista/proyectos` to use single PostgREST relational joins with automatic fallback, added `"Limpiar filtros"` empty-state controls, and added 10 B-tree foreign key indexes (`20261112000004_fk_indexes.sql`).
- **4-Tier Automated Acceptance Suite & Empirical Suites (`REL-06`)**: 65 acceptance tests in `npm test` (`npx tsx tests/test-runner.mjs`) plus 16 empirical M3 security tests (`npx tsx tests/adversarial-m3-empirical.test.mjs`), with 0 TypeScript errors and 0 ESLint warnings (`npx eslint . --max-warnings=0`).
