# Nodo CRM - Platform Context & Handoff Summary

This document summarizes the current production-hardened state of the **Nodo CRM** platform, its architecture, security posture, data model, and recently completed engineering sprints. Provide this file to any new session or engineer to immediately bring them up to speed.

---

## 1. Platform Overview
**Nodo CRM** is a multi-portal web application built to manage commercial & industrial solar photovoltaic (FV) and battery energy storage system (BESS) installation projects across Mexico. It connects stakeholders across the entire lifecycle of an energy project—from lead origination and multi-site technical sizing to financing, construction milestone tracking (Gantt), and post-installation energy monitoring.

### Tech Stack
- **Framework**: Next.js 16.2.3 (App Router, `proxy.ts` request interceptor) + React 19.2.4 + TypeScript
- **Styling**: Tailwind CSS, Lucide Icons, custom responsive HTML/SVG visualizations
- **Database & Auth**: Supabase (`nlqrdxwyxmgdwawedweh` — PostgreSQL, Row Level Security, Auth, Storage, Transactional RPCs)
- **Testing & CI**: 4-Tier Automated Acceptance Suite (`npx tsx tests/test-runner.mjs` / `npm test`) + GitHub Actions CI/CD (`.github/workflows/main.yml`)
- **Deployment**: Vercel

### User Roles & Portals (7 Portals)
The platform enforces strict server-side Role-Based Access Control (RBAC) via `proxy.ts` and portal layouts, querying the authoritative `public.profiles.rol` column (never trusting client-editable `user_metadata`):
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
- **`telemetria_egauge`**: Time-series production and consumption readings (`generacion_kwh`, `consumo_kwh`, `potencia_kw`, `bateria_soc_pct`, `bateria_estado`) indexed by `(proyecto_id, timestamp DESC)`.

### Transactional RPCs & Security Triggers (`supabase/migrations/`)
1. **`20261021000001_sprint1_security_rpcs_and_profile_prefs.sql`**:
   - **Self-Promotion Prevention (`SEC-01`, `SEC-02`)**: `protect_profile_role()` trigger blocks non-admin users from altering `profiles.rol` or `profiles.cliente_crm_id`. `handle_new_user()` hardcodes new signups to `'pendiente'`.
   - **Hardened `SECURITY DEFINER` Functions (`SEC-04`)**: Fixed `SET search_path = public` across all privileged functions (`get_my_role`, `admin_update_role`, `handle_new_user`, etc.).
   - **Atomic Project Creation (`crear_proyecto_completo`)**: Single-transaction PostgreSQL RPC inserting `proyectos`, `proyecto_sitios`, `configuraciones_tecnicas`, `opciones_financiamiento`, `config_financiamiento`, and `proyecto_sitio_productos` atomically.
   - **Atomic Option Switching (`seleccionar_configuracion_tecnica`, `seleccionar_opcion_financiamiento`)**: Prevents race conditions or orphaned active flags when switching selected technical or financing options in `DetalleProyecto.tsx`.
2. **`20261021000002_dashboard_views_and_indexes.sql`**:
   - Composite indexes `idx_telemetria_proyecto_time` and `idx_proyectos_estado_created`.
   - Explicit foreign key `proyectos_epcista_id_fkey` enabling single-roundtrip PostgREST relational joins for `epc`, `responsable`, and `finder` profiles.

---

## 3. Major Engineering Milestones Completed (Sprints 1 & 2)

### A. Security & RBAC Hardening
- **Authoritative Role Checks**: `proxy.ts`, `app/login/page.tsx`, `app/pendiente/page.tsx`, and all 7 portal layouts query `profiles.rol` directly and never fall back to `user_metadata?.rol`.
- **Admin Server Actions (`app/actions/*.ts`)**: Enforced strict server-side caller verification: only `nodo_admin` can delete users (`adminDeleteUser`) or assign the `nodo_admin` role (`crearUsuarioAdmin`, `invitarUsuario`).
- **Pendiente Session Refresh**: `app/pendiente/page.tsx` calls `supabase.auth.refreshSession()` upon role approval to eliminate redirect loops.

### B. Unified `ProjectWizard` & Safe Modal Mutations
- **Consolidated Wizard (`components/proyectos/ProjectWizard.tsx` + `components/proyectos/wizard/*`)**: Replaced ~6,200 lines of duplicated wizard code across Admin, Analyst, EPC, and Finder portals with a single modular wizard supporting role-specific selectors, `"Nodo busca instalador"` 2-step flows, hybrid BESS+FV inverter linking, `crypto.randomUUID()` temp keys, and atomic `crear_proyecto_completo` persistence with compensating rollback.
- **Insert-Before-Delete Modals**: `EditarSolucionTecnicaModal.tsx` and `EditarFinanciamientoModal.tsx` insert new rows before deleting removed ones to prevent data loss on network failure.

### C. Zero-Mockups, Deterministic CFE Tariffs & Real Persistence
- **Removed Synthetic Code**: Deleted `lib/egauge.ts` (`Math.sin`/`Math.random` fake telemetry) and `app/brand-preview/page.tsx`.
- **Deterministic CFE Tariff Calculator (`lib/tariffs/cfe-calculator.ts`)**: Replaced hardcoded `* 3.9` and `'GDMTH'` multipliers across `cliente`, `financiero`, and `mem` portals with official CFE tariff tables (`GDMTH`, `GDMTO`, `PDBT`, `GDBT`, `DIST`, `DIT`) and 0.423 kg CO₂e/kWh SEMARNAT emissions factors.
- **Database-Backed Settings (`components/Configuracion.tsx`)**: Replaced `localStorage` persistence with real Supabase `profiles` updates across all 7 portals (`/{portal}/configuracion`).

### D. App Router UX Boundaries, Query Optimization & CI/CD
- **Resilience Boundaries (`REL-01`)**: Added root and per-portal `error.tsx`, `loading.tsx`, and `not-found.tsx` boundaries across all 7 portals.
- **Single-Roundtrip Project Directories (`PERF-01`, `PERF-03`)**: Refactored `/admin/proyectos` and `/analista/proyectos` to use single PostgREST relational joins with automatic fallback and added `"Limpiar filtros"` empty-state controls.
- **4-Tier Automated Acceptance Suite & CI/CD (`REL-06`)**: 31 automated tests in `tests/` covering RBAC, boundary conditions, cross-feature flows, and live multi-table transactional persistence, integrated into `.github/workflows/main.yml`.
