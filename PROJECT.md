# Nodo CRM — Project Architecture, Feature Inventory & Interface Contracts

**Platform**: Commercial & Industrial Solar PV (FV) & Battery Energy Storage Systems (BESS) Asset Management Platform  
**Target Environment**: Next.js 16.2.3 (App Router, Turbopack, `proxy.ts`), React 19.2.4, TypeScript 5.x, Tailwind CSS v4, Supabase PostgreSQL (`nlqrdxwyxmgdwawedweh`)  
**Document Version**: 2.1.0 (Sprint 3 Completed & Verified)  
**Last Verified Baseline**: 65/65 acceptance tests pass (9 suites); 16/16 adversarial M3 tests pass; 0 TypeScript errors; 0 ESLint errors/warnings (`--max-warnings=0`); 46 routes build cleanly.

---

## 1. Architecture Overview

Nodo CRM is a multi-tenant, multi-portal enterprise energy management system designed for the Mexican commercial and industrial (C&I) solar photovoltaic (FV) and battery energy storage system (BESS) sector. It connects all primary market actors across the lifecycle of distributed generation and energy storage assets: lead originators (Finders), engineering and construction firms (EPCs), project financiers, qualified suppliers in the Wholesale Electricity Market (MEM), platform operators (Nodo Admin & Analista), and end clients.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT BROWSERS                                      │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP / WebSocket
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        EDGE / NODE RUNTIME: proxy.ts (Next.js 16)                     │
│  - Matcher: All portal & dynamic paths (bypasses static assets & /api)                 │
│  - Public Path Fast Bypass (/login, /registro, /pendiente)                             │
│  - Session Refresh & 8s Timeout Guard (lib/supabase/middleware.ts)                     │
│  - Authoritative RBAC: app_metadata.user_role claim + profiles.rol fallback          │
│  - Smart Cross-Portal Deep-Link Translation (resolveCrossPortalDeepLink)               │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        ▼                                   ▼                                   ▼
┌───────────────────────┐       ┌───────────────────────┐       ┌───────────────────────┐
│     Public Auth       │       │    7 Portal Shells    │       │     Server Actions    │
│  /login               │       │  /admin, /analista,   │       │  app/actions/*.ts     │
│  /registro            │       │  /epc, /finder,       │       │  adminDeleteUser      │
│  /pendiente           │       │  /cliente, /financiero│       │  crearUsuarioAdmin    │
│                       │       │  /mem                 │       │  invitarUsuario       │
└───────────────────────┘       └───────────┬───────────┘       └───────────┬───────────┘
                                            │                               │
                                            ▼                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE DATA LAYER (@supabase/ssr)                         │
│  - Browser Client (lib/supabase/client.ts): NEXT_PUBLIC_SUPABASE_ANON_KEY              │
│  - Server Client (lib/supabase/server.ts): await cookies() async store                 │
│  - Admin Client (lib/supabase/admin.ts): SUPABASE_SERVICE_ROLE_KEY                     │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       SUPABASE POSTGRESQL (nlqrdxwyxmgdwawedweh)                      │
│  - 22 Relational Tables (profiles, proyectos, sitios, configuraciones, telemetria...)  │
│  - Atomic RPCs: crear_proyecto_completo, seleccionar_configuracion_tecnica...         │
│  - Security Triggers: protect_profile_role, handle_new_user, track_estado_history     │
│  - Time-series Telemetry: telemetria_egauge (solar_produccion_kwh, consumo_red_kwh)   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Tech Stack Specification
- **Framework**: Next.js 16.2.3 App Router with Turbopack bundler (`turbopack: { root: __dirname }`).
- **Runtime Rules**: Strict adherence to Next.js 16 async Request APIs (`await cookies()`, `await params`, `await searchParams`).
- **Proxy Middleware**: `proxy.ts` (Next.js 16 convention replacing deprecated `middleware.ts`).
- **UI Library**: React 19.2.4, Lucide React, Recharts (time-series telemetry), `@svar-ui/react-gantt` (construction Gantt scheduling).
- **Styling**: Tailwind CSS v4 with `@theme` CSS tokens in `app/globals.css` enforcing the official Nodo Brandbook palette (Petróleo `#072B31`, Lima `#CEDC00`, Menta `#00C19F`).
- **Database & Auth**: Supabase PostgreSQL (`nlqrdxwyxmgdwawedweh`) with Row-Level Security, database triggers, and transactional RPCs.
- **Testing & Verification**: 4-Tier Automated Acceptance Suite (`tests/test-runner.mjs`) executing against live Supabase; TypeScript `tsc --noEmit`; ESLint.

---

## 2. Complete Feature Inventory & Execution Milestones

The platform features are mapped to architectural milestones: Completed Foundations (Sprints 1–2) and Completed Hardening Phases (Sprint 3 / Phases 1–5).

| Feature ID | Category | Feature Name | Description | Current Status | Target Milestone |
|---|---|---|---|---|---|
| **FEAT-AUTH-01** | Auth / RBAC | Authoritative Role Verification | `proxy.ts` and `PortalShell.tsx` enforce verified roles, rejecting forged client `user_metadata`. | Operational | Sprint 1 (Verified) |
| **FEAT-AUTH-02** | Auth / RBAC | Cross-Portal Deep-Link Resolution | `resolveCrossPortalDeepLink` rewrites cross-portal links maintaining query strings and route aliases. | Operational | Sprint 1 (Verified) |
| **FEAT-AUTH-03** | Auth / RBAC | Privilege Escalation Guards | DB trigger `protect_profile_role` and Server Actions block role tampering and self-deletion. | Operational | Sprint 1 (Verified) |
| **FEAT-AUTH-04** | Auth / UX | Login Deep-Link Redirection | `proxy.ts` and `app/login/page.tsx` preserve `returnUrl` (with search params & open-redirect checks) and `ClienteInstalacionesPage` uses `getUser()`. | Operational | **Phase 2 (TASK-004 Verified)** |
| **FEAT-AUTH-05** | Auth / Perf | Zero-DB Proxy Claims | Syncs `profiles.rol` to JWT `app_metadata.user_role` via DB trigger + `user-provisioning.ts`; `proxy.ts` reads claim first with DB fallback. | Operational | **Phase 2 (TASK-005 Verified)** |
| **FEAT-PROJ-01** | Projects | Consolidated `ProjectWizard` | Single multi-step wizard across all portals for FV, BESS, and FV+BESS project creation. | Operational | Sprint 2 (Verified) |
| **FEAT-PROJ-02** | Projects | "Nodo busca instalador" Flow | 2-step simplified project submission setting default pending statuses for EPC assignment. | Operational | Sprint 2 (Verified) |
| **FEAT-PROJ-03** | Projects | Hybrid Inverter Association | UI validation allows omitting standalone FV inverters when hybrid BESS inverter is provisioned. | Operational | Sprint 2 (Verified) |
| **FEAT-PROJ-04** | Projects | Atomic Project Creation RPC | `crear_proyecto_completo` inserts project, sites, configurations, financing, and products in 1 transaction. | Operational | Sprint 1 (Verified) |
| **FEAT-PROJ-05** | Projects | Atomic Configuration Selection | `seleccionar_configuracion_tecnica` and `seleccionar_opcion_financiamiento` prevent orphaned selections. | Operational | Sprint 1 (Verified) |
| **FEAT-PROJ-06** | Projects | 10-Stage Pipeline Lifecycle | Formal stage state machine with prerequisite validation (`validateStageTransition`) before approval. | Operational | Sprint 2 (Verified) |
| **FEAT-PROJ-07** | Projects | Shared Directories & Views | Unified `SharedProjectDirectoryView` and `SharedProjectDetailView` across Admin, Analista, EPC, Finder. | Operational | Sprint 2 (Verified) |
| **FEAT-PROJ-08** | Projects / Client | Client Portal Directory Scoping | `fetchProyectosDirectory` in `lib/domains/proyectos/queries.ts` resolves `profiles.cliente_crm_id` before filtering `proyectos.cliente_id`. | Operational | **Phase 1 (TASK-003 Verified)** |
| **FEAT-PLAN-01** | Construction | Hierarchical EPC Gantt Scheduler | Phases (`plan_fases`), Activities (`plan_actividades`), Tasks (`plan_tareas`), and Subtasks. | Operational | Sprint 2 (Verified) |
| **FEAT-PLAN-02** | Construction | Topological Cascade Engine | `cascadeDependencies` recalculates successor start/end dates using Kahn's topological sort on dependency moves. | Operational | Sprint 2 (Verified) |
| **FEAT-PLAN-03** | Construction | Financial Disbursement Milestones | `hitos_financieros` tracks disbursement percentages tied directly to construction phases. | Operational | Sprint 2 (Verified) |
| **FEAT-INST-01** | Field Ops | Installation Evidence Monitor | `InstalacionMonitor.tsx`, `EvidenciaGallery.tsx`, and `EvidenciaLightbox.tsx` handle evidence uploads, comments, and inspection. | Operational | Sprint 2 / Phase 5 (Verified) |
| **FEAT-TELEM-01** | Telemetry | Real Telemetry Visualizer | `EnergyChart` (Recharts) renders solar generation, grid consumption, and battery discharge. | Operational | Sprint 2 (Verified) |
| **FEAT-TELEM-02** | Telemetry | Battery State & Health Gauges | `BatteryStatus` visualizes SOC %, discharge rate, nominal capacity, and cycle counts. | Operational | Sprint 2 (Verified) |
| **FEAT-TELEM-03** | Telemetry / DB | Telemetry Column Schema Alignment | `getTelemetryHistorical()` in `lib/dashboard-data.ts` selects live `telemetria_egauge` columns with typed camelCase aliases. | Operational | **Phase 1 (TASK-001 Verified)** |
| **FEAT-NOTIF-01** | System | Notifications Table Migration & Recipient Scoping | `20261112000001_create_notificaciones.sql` + `cliente_crm_id` recipient lookup in `InstalacionMonitor.tsx` / `CommentThread.tsx` + error guards in `TopBar.tsx`. | Operational | **Phase 1 (TASK-002 Verified)** |
| **FEAT-CFE-01** | Economics | Deterministic CFE Calculator | `lib/tariffs/cfe-calculator.ts` computes exact rates for GDMTH, GDMTO, PDBT, GDBT. | Operational | Sprint 2 (Verified) |
| **FEAT-CFE-02** | Economics | CFE Tariff Catalog Expansion | Added `DIST`, `DIT`, `01`, `DAC` tariffs and expanded `resolveCfeTariffLabel` across portals. | Operational | **Phase 3 (TASK-006 Verified)** |
| **FEAT-CFE-03** | Economics | SEMARNAT Environmental Factor | Integrated `SEMARNAT_EMISSIONS_FACTOR_KG_CO2_PER_KWH = 0.423` and `calculateCo2AvoidedTonnes`. | Operational | **Phase 3 (TASK-006 Verified)** |
| **FEAT-CFE-04** | Economics | Multi-Currency Normalization | Added `exchangeRateUsdMxn` (default `18.0`) USD→MXN conversion in `calculateProjectSavingsMxn`. | Operational | **Phase 3 (TASK-006 Verified)** |
| **FEAT-CFE-05** | Economics / DB | CFE Tariff Column Type Fix | Migrated `proyectos.tarifa_actual_cfe` to `VARCHAR(20)` (`20261112000003`) and wired callers + `Proyecto` type. | Operational | **Phase 3 (TASK-006 Verified)** |
| **FEAT-MEM-01** | Wholesale Market | Suministrador Marketplace Board | `OfertasBoard.tsx` uses `Modal` primitive and presents qualifying MEM projects cleanly. | Operational | Sprint 2 / Phase 5 (Verified) |
| **FEAT-DB-01** | Database / Perf | Foreign Key B-Tree Indexing | Added 10 B-tree indexes across high-traffic FKs in `20261112000004_fk_indexes.sql` and consolidated Sprint 3 DDL bundle. | Operational | **Phase 4 (TASK-007 Verified)** |
| **FEAT-CODE-01** | Code Quality | ESLint Warning Cleanup | Eliminated all remaining ESLint warnings across components and tests (`0 errors, 0 warnings`). | Operational | **Phase 4 (TASK-007 Verified)** |
| **FEAT-UI-01** | UI / Components | Headless Primitive Components | Added `Modal.tsx`, `DropdownMenu.tsx`, and `Tabs.tsx` to `components/ui/` and consolidated Tailwind tokens in `app/globals.css`. | Operational | **Phase 5 (TASK-008 Verified)** |
| **FEAT-UI-02** | UI / Components | Component Monolith Decomposition | Extracted `useProjectWizardState.ts` (`ProjectWizard.tsx` 303 lines) and `EvidenciaGallery.tsx` / `EvidenciaLightbox.tsx`. | Operational | **Phase 5 (TASK-008 Verified)** |

---

## 3. Milestones Table: Sequence, Dependencies & Status

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │ [COMPLETED] Sprint 1 & Sprint 2: Core Platform, Wizard, RBAC, RPCs     │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ [PHASE 1 - P0] Critical Bug Fixes & Schema Integrity                   │
   │  - TASK-001: Telemetry Schema Alignment (BUG-42703)                    │
   │  - TASK-002: Notifications Table Migration (PGRST205)                  │
   │  - TASK-003: Client Portal Directory Query Fix                         │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ [PHASE 2 - P1] Authentication & Routing Refinement                     │
   │  - TASK-004: Login returnUrl Deep-Link Preservation                    │
   │  - TASK-005: Proxy JWT Custom Claims for Zero-DB RBAC Verification     │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ [PHASE 3 - P1] CFE Engine & Financial Calculation Hardening            │
   │  - TASK-006: CFE Tariffs (DIST/DIT/01/DAC), SEMARNAT CO2e, USD/MXN    │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ [PHASE 4 - P2] Database Indexing & Performance Optimization            │
   │  - TASK-007: Foreign Key B-Tree Indexing & ESLint 0-Warning Cleanup    │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ [PHASE 5 - P2/P3] Component Modernization & Portal Polish              │
   │  - TASK-008: Component Decomposition, UI Primitives, Tailwind Cleanup  │
   └────────────────────────────────────────────────────────────────────────┘
```

| Milestone Phase | Focus Area | Included Tasks | Dependencies | Gate Criteria | Status |
|---|---|---|---|---|---|
| **Sprint 1 & 2** | Foundational Architecture | Core RBAC, Wizard consolidation, atomic RPCs, CFE calculator | Initial codebase | 59/59 tests pass, 0 type errors | **COMPLETED** |
| **Phase 1 (P0)** | Critical Bug Fixes & Schema Integrity | `TASK-001`, `TASK-002`, `TASK-003` | Sprint 2 baseline | Live telemetry query, `notificaciones` SQL & `cliente_crm_id` scoping verified | **COMPLETED** |
| **Phase 2 (P1)** | Authentication & Routing Refinement | `TASK-004`, `TASK-005` | Phase 1 | `returnUrl` deep links, `getUser()`, JWT `user_role` claim + fallback verified | **COMPLETED** |
| **Phase 3 (P1)** | CFE Engine & Financial Hardening | `TASK-006` | Phase 1 | 8-tariff catalog, 0.423 SEMARNAT factor, USD/MXN normalization verified | **COMPLETED** |
| **Phase 4 (P2)** | Database Indexing & Code Hygiene | `TASK-007` | Phase 1, Phase 2, Phase 3 | 10 FK indexes (`20261112000004`), 0 ESLint warnings verified | **COMPLETED** |
| **Phase 5 (P2/P3)** | Component Modernization & Polish | `TASK-008` | Phase 1–Phase 4 | `ProjectWizard.tsx` (303 lines) & UI primitives (`Modal`, `DropdownMenu`, `Tabs`) verified | **COMPLETED** |

---

## 4. Interface Contracts

### 4.1 Interface Contract 1: `proxy.ts` <──> Portals & Routing

The Next.js 16 Edge proxy serves as the authoritative network gateway.

```typescript
// Incoming Request Contract
Request: NextRequest {
  url: string;               // e.g., "https://app.nodocrm.com/admin/proyectos/123"
  cookies: RequestCookies;   // Supabase auth tokens (sb-*-auth-token)
}

// Processing Rules:
// 1. If pathname matches PUBLIC_PATHS (/login, /registro, /pendiente) -> NextResponse.next()
// 2. Refresh session with 8000ms timeout guard (updateSession)
// 3. Extract user id: user.id
// 4. Read role: inspect user.app_metadata?.user_role from verified JWT first;
//    only if absent (!rol), fall back to public.profiles: select('rol').eq('id', user.id).single()
// 5. If !role -> redirect to /login?returnUrl={encodeURIComponent(pathname + search)}
// 6. If role === 'pendiente' AND pathname !== '/pendiente' -> redirect to /pendiente
// 7. If role matches portal (e.g., 'nodo_admin' on '/admin/*') -> NextResponse.next()
// 8. If role mismatches portal -> resolveCrossPortalDeepLink(pathname, rolePortal, search)

// Outgoing Response Contract:
// NextResponse.redirect(new URL(destinationUrl, request.url), { headers: res.headers })
```

### 4.2 Interface Contract 2: Server Actions <──> PostgreSQL RPCs

Server Actions execute on the server (`'use server'`) with caller verification before executing privileged database operations.

```typescript
// 1. adminDeleteUser(targetId: string)
// Caller Requirement: Session must exist, profiles.rol === 'nodo_admin', targetId !== caller.id
// Persistence: supabaseAdmin.auth.admin.deleteUser(targetId) -> deletes auth.users and cascades to profiles.

// 2. crearUsuarioAdmin(payload: NewUserPayload)
// Caller Requirement: profiles.rol IN ('nodo_admin', 'nodo_analista')
// Restriction: nodo_analista cannot create role 'nodo_admin'
// Persistence: admin_update_role(target_id, new_rol) RPC + auth.admin.createUser

// 3. crear_proyecto_completo(p_payload JSONB) -> UUID
// Caller Requirement: Authenticated EPC, Finder, Analista, or Admin
// Transactional Payload Contract:
interface CrearProyectoPayload {
  proyecto: {
    nombre_proyecto: string;           // Required (throws P0001 if blank)
    tipo: 'FV' | 'BESS' | 'FV+BESS' | 'MEM' | 'BESS+MEM';
    estado: 'recibido';
    cliente_final_nombre: string;
    cliente_final_empresa: string;
    cliente_final_contacto: string;
    ubicacion_estado: string;
    moneda: 'MXN' | 'USD';
    epcista_id?: string;
    finder_id?: string;
    responsable_nodo_id?: string;
    cliente_id?: string;
    capex_estimado?: number;
    // ...
  };
  sitios_ids: string[];
  configuraciones: Array<{
    temp_id: string;                   // Mapped internally to real UUID
    nombre: string;
    inversion_total: number;
    moneda: 'MXN' | 'USD';
    ahorro_estimado_anual?: number;
    ahorro_estimado_mensual?: number;
    ahorro_moneda?: 'MXN' | 'USD';
    seleccionada: boolean;
  }>;
  opciones_financiamiento: Array<{
    temp_id: string;                   // Mapped internally to real UUID
    nombre: string;
    vehiculo_inversion: string;
    moneda: 'MXN' | 'USD';
    seleccionada: boolean;
  }>;
  config_financiamiento_links: Array<{
    config_temp_id: string;
    opcion_temp_id: string;
  }>;
  productos: Array<{
    config_temp_id: string;
    sitio_id: string;
    tipo: 'fv' | 'bess';
    datos: Record<string, unknown>;
  }>;
}

// 4. seleccionar_configuracion_tecnica(p_proyecto_id UUID, p_config_id UUID) -> VOID
// Operation: Sets seleccionada=true on p_config_id, false on others for project;
// syncs proyectos.capex_estimado and proyectos.moneda atomically.

// 5. seleccionar_opcion_financiamiento(p_proyecto_id UUID, p_opcion_id UUID) -> VOID
// Operation: Sets seleccionada=true on p_opcion_id, false on others for project;
// syncs proyectos.modalidad_financiamiento atomically.
```

### 4.3 Interface Contract 3: CFE Tariff Engine <──> Project Views & KPIs

The CFE calculation engine provides deterministic financial metrics for dashboards and project details.

```typescript
// Location: lib/tariffs/cfe-calculator.ts

// 1. Tariff Label Resolution
export interface ResolveCfeTariffOptions {
  tarifaActual?: string | null;
  nivelTension?: 'baja' | 'media' | 'alta' | null;
  tipoServicio?: 'domestico' | 'comercial' | 'industrial' | null;
}

export function resolveCfeTariffLabel(
  demandaKw?: number | null,
  volumenMwhAnual?: number | null,
  options?: ResolveCfeTariffOptions
): string;
// Contract: Returns 'GDMTH' | 'GDMTO' | 'PDBT' | 'GDBT' | 'DIST' | 'DIT' | '01' | 'DAC'. Defaults to 'GDMTH'.

// 2. Project Savings Calculation (MXN)
export interface ProjectSavingsInput {
  totalGeneratedKwh: number;
  selectedConfig?: {
    ahorro_estimado_anual?: number | null;
    ahorro_estimado_mensual?: number | null;
    ahorro_moneda?: string | null;
  } | null;
  tarifaCfe?: string | null;
  exchangeRateUsdMxn?: number; // Added in Phase 3 (default 18.0)
}

export function calculateProjectSavingsMxn({
  totalGeneratedKwh,
  selectedConfig,
  tarifaCfe,
  exchangeRateUsdMxn,
}: ProjectSavingsInput): number;
// Contract:
// If totalGeneratedKwh > 0: round(totalGeneratedKwh * CFE_TARIFF_RATES_MXN[tarifaCfe], 2)
// If totalGeneratedKwh == 0: daily pro-rata of config savings normalized to MXN (using exchangeRateUsdMxn when ahorro_moneda === 'USD')
// Returns 0 on negative/invalid inputs.

// 3. Battery Cycles Calculation
export function calculateBatteryCycles(
  totalBatteryDischargeKwh: number,
  nominalCapacityKwh?: number | null
): number;
// Contract: Returns round(totalBatteryDischargeKwh / effectiveCapacity, 1).
// effectiveCapacity defaults to 200 kWh if nominalCapacity is missing or <= 0.

// 4. Environmental Emission Factor (Phase 3)
export const SEMARNAT_EMISSIONS_FACTOR_KG_CO2_PER_KWH = 0.423;
export function calculateCo2AvoidedTonnes(totalGeneratedKwh: number): number;
// Contract: Returns round((totalGeneratedKwh * 0.423) / 1000, 3).
```

---

## 5. Code Layout

```
C:\Users\vmont\.gemini\antigravity\worktrees\nodocrm\platform_diagnostics_and_refactoring
├── app/
│   ├── (portals)/                      # Grouped App Router role-based portals (7 portals)
│   │   ├── admin/                      # nodo_admin portal (/admin)
│   │   ├── analista/                   # nodo_analista portal (/analista)
│   │   ├── cliente/                    # cliente_final portal (/cliente)
│   │   ├── epc/                        # epc installer portal (/epc)
│   │   ├── financiero/                 # financiero portal (/financiero)
│   │   ├── finder/                     # finder originator portal (/finder)
│   │   └── mem/                        # suministrador wholesale market portal (/mem)
│   ├── actions/                        # Server Actions ('use server' privileged RPC callers)
│   │   ├── adminDeleteUser.ts          # Admin-only account deletion
│   │   ├── adminResetPassword.ts       # Admin-only password resets
│   │   ├── adminUpdateEmail.ts         # Admin-only email changes
│   │   ├── crearUsuario.ts             # Provisioning for admins & analysts
│   │   ├── invitar.ts                  # Portal user invitations
│   │   └── vincularUsuario.ts          # Client CRM linking
│   ├── login/page.tsx                  # Public login entry point
│   ├── pendiente/page.tsx              # Account approval waiting room
│   ├── registro/page.tsx               # Public registration entry point
│   ├── error.tsx                       # Root error boundary
│   ├── loading.tsx                     # Root suspense loader
│   ├── not-found.tsx                   # Root 404 handler
│   ├── layout.tsx                      # Root HTML shell, fonts & metadata
│   ├── globals.css                     # Tailwind CSS v4 @theme tokens & brand CSS
│   └── page.tsx                        # Root redirect to /login
├── components/
│   ├── clientes/                       # Client directory, detail, and site views
│   ├── gantt/                          # Svar Gantt integration & milestone modals
│   ├── instalaciones/                  # EvidenciaGallery.tsx, EvidenciaLightbox.tsx
│   ├── layout/                         # PortalShell.tsx, Sidebar.tsx, TopBar.tsx
│   ├── marketplace/                    # OfertasBoard.tsx (MEM power supply board)
│   ├── plan/                           # PlanBuilder.tsx, GanttView.tsx, FinancialMilestones.tsx
│   ├── proyectos/                      # Unified ProjectWizard and project detail sections
│   │   ├── detalle/                    # Modular sections of DetalleProyecto.tsx
│   │   └── wizard/                     # Steps 0-3 & useProjectWizardState.ts hook
│   ├── telemetry/                      # EnergyChart.tsx, BatteryStatus.tsx
│   └── ui/                             # Modal, DropdownMenu, Tabs, Badge, Button, Card, Input...
├── docs/
│   ├── architecture/                   # Architectural assessments & execution roadmaps
│   └── tasks/                          # Modular task specifications (TASK-001 to TASK-008)
├── lib/
│   ├── domains/                        # Domain-driven architecture
│   │   ├── auth/                       # permissions.ts, user-provisioning.ts, routing.ts
│   │   ├── clientes/                   # queries.ts, mutations.ts
│   │   └── proyectos/                  # lifecycle.ts, schemas.ts, queries.ts, mutations.ts
│   ├── supabase/                       # Supabase client/server/admin instances
│   │   ├── admin.ts                    # Service-role privileged client
│   │   ├── client.ts                   # Browser SSR client
│   │   ├── middleware.ts               # Proxy session updater
│   │   └── server.ts                   # Async cookie server client
│   ├── tariffs/cfe-calculator.ts       # Deterministic CFE tariff calculation engine
│   ├── cascade-scheduler.ts            # Topological Kahn Gantt cascade engine
│   ├── dashboard-data.ts               # Analytics and KPI aggregators
│   ├── format.ts                       # Currency, number, and date formatters
│   └── types.ts                        # Global TypeScript interface definitions
├── supabase/
│   ├── migrations/                     # Production SQL migrations (Sprints 1–3 + consolidated Sprint 3 DDL)
│   ├── archive/                        # Archived development migrations (v2 - v28)
│   └── schema.sql                      # Base schema reference
├── tests/                              # 4-Tier Automated Acceptance & Domain Suites
│   ├── test-runner.mjs                 # Custom runner executing all 9 test suites
│   ├── tier1-feature-coverage.test.mjs # Feature coverage (R1 - R4)
│   ├── tier2-boundary-corner.test.mjs  # Boundary and corner cases
│   ├── tier3-cross-feature.test.mjs    # Cross-feature combinations
│   ├── tier4-real-world.test.mjs       # End-to-end transactional persistence
│   ├── domain-auth.test.mjs            # Permissions matrix & provisioning
│   ├── domain-proyectos.test.mjs       # Project lifecycle & data sanitization
│   ├── modal-validations.test.mjs      # Technical configuration modals
│   ├── scoping-security.test.mjs       # EPC client detail document scoping
│   └── proxy-deeplinks.test.mjs        # Smart cross-portal deep links
├── next.config.ts                      # Next.js 16 configuration with Turbopack root
├── package.json                        # Scripts and dependencies
├── proxy.ts                            # Next.js 16 Edge proxy interceptor
└── tsconfig.json                       # Strict TypeScript configuration
```
