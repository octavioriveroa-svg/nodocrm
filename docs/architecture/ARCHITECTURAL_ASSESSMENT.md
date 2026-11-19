# Architectural Assessment Report — Nodo CRM

**Document ID**: `ARCHITECTURAL_ASSESSMENT.md`  
**System Target**: Nodo CRM — Commercial & Industrial Clean Energy Management Platform  
**Target Environment**: Next.js 16.2.3 App Router, React 19.2.4, TypeScript 5.x, Tailwind CSS v4, Supabase PostgreSQL (`nlqrdxwyxmgdwawedweh`)  
**Date of Assessment**: 2026-11-12  
**Baseline Verification Status**: 
- `npx tsc --noEmit`: **0 errors**
- `npm run lint`: **0 errors**, 13 warnings
- `npm test`: **59/59 tests passed** (9 suites in 21.17s)
- `npm run build`: **46 routes compiled successfully** (Turbopack in 6.1s)

---

## 1. System Purpose & Stakeholder Portals

Nodo CRM is an enterprise-grade multi-tenant asset management and deal execution platform for commercial and industrial (C&I) solar photovoltaic (FV) and battery energy storage system (BESS) installations in Mexico. It orchestrates the end-to-end lifecycle of distributed clean energy assets, from lead generation and multi-site electrical sizing to financial underwriting, EPC milestone tracking, and operational telemetry.

### 1.1 The Seven Stakeholder Portals

The application implements seven distinct portal environments under `app/(portals)/`, each tailored to a specific actor with granular data boundaries:

```
                                  ┌─────────────────────────────┐
                                  │      Nodo CRM Platform      │
                                  └──────────────┬──────────────┘
                                                 │
         ┌───────────────┬───────────────┬───────┴───────┬───────────────┬───────────────┐
         ▼               ▼               ▼               ▼               ▼               ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │nodo_admin │   │nodo_      │   │    epc    │   │  finder   │   │ cliente_  │   │financiero │
   │  /admin   │   │ analista  │   │   /epc    │   │  /finder  │   │   final   │   │/financiero│
   └─────┬─────┘   │ /analista │   └─────┬─────┘   └─────┬─────┘   │ /cliente  │   └─────┬─────┘
         │         └─────┬─────┘         │               │         └─────┬─────┘         │
         │               │               │               │               │               │
         └───────────────┴───────────────┼───────────────┴───────────────┴───────────────┘
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │suministrador│
                                  │    /mem     │
                                  └─────────────┘
```

1. **`nodo_admin` (`/admin`)**: Platform Superadministrators.
   - *Capabilities*: Full visibility across all projects, clients, and load centers. Project deletion (`canDeleteProject`). User management and account provisioning (`/admin/usuarios`). Real-time role assignment via `admin_update_role` RPC (`/admin/configuracion/roles`). System-wide configuration.
2. **`nodo_analista` (`/analista`)**: Energy Engineers & Financial Analysts.
   - *Capabilities*: Sizing validation, CFE tariff optimization, proposal generation, construction plan auditing, and MEM offer evaluation. Cannot delete projects or create/escalate users to `nodo_admin`.
3. **`epc` (`/epc`)**: Engineering, Procurement & Construction Contractors.
   - *Capabilities*: Project submission (`/epc/nuevo`), client directory (`/epc/clientes`), technical solution sizing (FV inverters, BESS capacity), construction schedule execution with Gantt planning (`/epc/proyectos/[id]/plan`), and field evidence photo uploading (`/epc/instalaciones`). Access is strictly scoped to projects where `epcista_id = user.id`.
4. **`finder` (`/finder`)**: Deal Originators & Commercial Referrers.
   - *Capabilities*: Deal submission (`/finder/nuevo`), client registration (`/finder/clientes/nuevo`), EPC partner assignment, deal pipeline tracking, and read-only inspection of construction progress. Scoped to projects where `finder_id = user.id`.
5. **`cliente_final` (`/cliente`)**: Commercial Property Owners & Asset Hosts.
   - *Capabilities*: Project progress monitoring, verified CFE tariff savings calculations, historical and real-time generation vs. consumption monitoring (`EnergyChart`), and battery storage status (`BatteryStatus`). Scoped via `profiles.cliente_crm_id = clientes.id`.
6. **`financiero` (`/financiero`)**: Capital Providers, Banks & Investment Funds.
   - *Capabilities*: Funded portfolio KPI tracking, debt service coverage inspection, 30-day bounded generation performance, CFE monetary savings audit, and construction milestone disbursement verification (`hitos_financieros`). Scoped to projects where `financiero_id = user.id`.
7. **`suministrador` (`/mem`)**: Qualified Suppliers (*Suministradores Calificados*) in the Wholesale Electricity Market.
   - *Capabilities*: Access to high-demand commercial load centers (demand $\ge 1,000$ kW or consumption $\ge 500$ MWh/year) via `OfertasBoard.tsx`. Submission of binding energy supply bids to `ofertas_mem`.

---

## 2. Technical Architecture & Next.js 16 App Router Compliance

### 2.1 Next.js 16 Engine & Turbopack Configuration

Nodo CRM runs on **Next.js 16.2.3** with the Turbopack engine enabled for development and production compilation.

- **Workspace Root Isolation (`next.config.ts`)**:
  ```typescript
  import type { NextConfig } from "next";

  const nextConfig: NextConfig = {
    turbopack: {
      root: __dirname,
    },
    allowedDevOrigins: ['127.0.0.1', 'localhost']
  };

  export default nextConfig;
  ```
  Setting `turbopack.root = __dirname` eliminates a known Windows path-resolution bug where Turbopack traverses upwards into parent user directories searching for extraneous `package.json` files.
- **Allowed Development Origins**: Secures cross-origin dev server requests against DNS rebinding and host-header injection.

### 2.2 Edge Interceptor: `proxy.ts` (Next.js 16 Convention)

Next.js 16 formally replaces the legacy `middleware.ts` convention with `proxy.ts` and the named export `proxy`:

```typescript
// proxy.ts
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

export async function proxy(request: NextRequest) { ... }
export const middleware = proxy // Backward-compatibility export
export default proxy
```

**Key Proxy Pipeline Mechanisms**:
1. **Public Fast-Path Bypass**: Requests to `/login`, `/registro`, and `/pendiente` return `NextResponse.next()` immediately without initiating Supabase auth calls. This guarantees that public authentication pages remain accessible even if Supabase Auth experiences intermittent latencies.
2. **Session Refresh & 8-Second Timeout Guard**: Delegated to `lib/supabase/middleware.ts` which uses `Promise.race` against an 8,000ms timer, preventing edge worker exhaustion if the auth endpoint stalls.
3. **Authoritative Database RBAC**: Resolves the user session and issues a direct database query to `public.profiles.rol`. Unverified user metadata (`user.user_metadata.rol`) is strictly disregarded.
4. **Smart Cross-Portal Deep-Link Resolution (`resolveCrossPortalDeepLink`)**:
   - Analyzes whether a foreign portal URL (e.g. an admin sharing `/admin/proyectos/uuid/plan` with an EPC) can be mapped into the user's authorized portal (`/epc/proyectos/uuid/plan`).
   - Normalizes route aliases (`/proyectos/nuevo` $\leftrightarrow$ `/nuevo`).
   - Preserves all URL query parameters (`?tab=tech&filter=active`).
   - Safely falls back to the portal root (`/${targetPath}`) if the sub-route is unsupported.

### 2.3 Strict Next.js 16 Async Request APIs Compliance

In Next.js 16, synchronous access to cookies, headers, and dynamic route parameters is removed. The codebase complies with this architectural requirement across all routes and clients:
- **Async Server Cookies**: In `lib/supabase/server.ts`, `const cookieStore = await cookies()` is consistently awaited before creating the `@supabase/ssr` client.
- **Async Dynamic Route Parameters**: Across all 20 dynamic `[id]` pages in `app/(portals)/**`, route params are typed as `Promise<{ id: string }>`:
  ```typescript
  export default function AdminDetalleProyectoPage({ params }: { params: Promise<{ id: string }> }) {
    return <SharedProjectDetailView params={params} />
  }
  ```
  Inside shared client components and server views, `const { id } = await params` or `use(params)` is applied cleanly.

### 2.4 Supabase Client Architecture

The platform separates Supabase connectivity into four isolated tiers:
1. **Browser Client (`lib/supabase/client.ts`)**: `createBrowserClient` from `@supabase/ssr` with public anonymous key for client-side React components and realtime subscriptions.
2. **Server Component Client (`lib/supabase/server.ts`)**: `createServerClient` from `@supabase/ssr` utilizing the awaited Next.js `cookieStore`.
3. **Proxy Session Interceptor (`lib/supabase/middleware.ts`)**: `createServerClient` operating over `request.cookies` and mutating response headers.
4. **Privileged Admin Client (`lib/supabase/admin.ts`)**: `createClient` from `@supabase/supabase-js` using `SUPABASE_SERVICE_ROLE_KEY` with `persistSession: false` and `autoRefreshToken: false`. This client is strictly restricted to Server Actions (`app/actions/*.ts`).

---

## 3. PostgreSQL Data Model, Relational Schema & RPCs

The backend is hosted on Supabase PostgreSQL (`nlqrdxwyxmgdwawedweh`).

### 3.1 Entity Relationship Diagram

```
       auth.users
           │ (1:1 ON DELETE CASCADE)
           ▼
     public.profiles ─────────────────────────────┐
           │                                      │ (FK cliente_crm_id)
           │ (epcista_id, finder_id, etc.)        ▼
           │                               public.clientes ◄─────────────┐
           │                                      │                      │
           ▼                                      ▼ (1:N)                │
   public.proyectos ──────────────────────► public.sitios                │
     │     │     │                                │                      │
     │     │     │ (1:N)                          │                      │
     │     │     └──────────────┐                 │                      │
     │     │                    ▼                 ▼                      │
     │     │           public.proyecto_sitios (M:N)                      │
     │     │                    │                                        │
     │     │ (1:N)              ▼ (M:N junction products)                │
     │     ├──────────► public.proyecto_sitio_productos                  │
     │     │                    ▲                                        │
     │     │                    │                                        │
     │     ▼ (1:N)              │ (FK configuracion_id)                  │
     │  public.configuraciones_tecnicas                                  │
     │     │                    ▲                                        │
     │     │ (M:N)              │                                        │
     │     ▼                    │                                        │
     │  public.config_financiamiento                                     │
     │     ▲                                                             │
     │     │ (M:N)                                                       │
     │     │                                                             │
     ▼ (1:N)                                                             │
  public.opciones_financiamiento                                         │
                                                                         │
  (Other Project Dependents)                                             │
  - telemetria_egauge (Time-series)                                      │
  - hitos_construccion (Legacy milestones)                               │
  - plan_fases -> plan_actividades -> plan_tareas                        │
  - hitos_financieros (Disbursement triggers)                            │
  - archivos (Documents & CFE receipts) ─────────────────────────────────┘
  - ofertas_mem (Wholesale supplier bids)
```

### 3.2 Inventory of Operational Tables

22 tables are actively provisioned and populated in the live Supabase instance:

| Table Name | Live Rows | Primary Key | Description & Foreign Keys |
|---|:---:|---|---|
| `profiles` | 23 | `id` (UUID) | User metadata, RBAC `rol`, `cliente_crm_id`, UI preferences. FK $\to$ `auth.users.id`. |
| `proyectos` | 6 | `id` (UUID) | Master project record, stage lifecycle, totals, and FKs to `clientes`, `profiles`. |
| `clientes` | 9 | `id` (UUID) | Commercial client CRM entities with RFC, industry, contact info. |
| `sitios` | 44 | `id` (UUID) | Physical load centers with RPU, contracted demand, address. FK $\to$ `clientes.id`. |
| `proyecto_sitios` | 72 | `id` (UUID) | Junction associating projects with one or more load centers. |
| `proyecto_sitio_productos` | 13 | `id` (UUID) | Line items for solar panels and BESS racks per site and technical configuration. |
| `configuraciones_tecnicas` | 6 | `id` (UUID) | Sizing options per project (e.g., "Opción A: Solo FV"). FK $\to$ `proyectos.id`. |
| `opciones_financiamiento` | 7 | `id` (UUID) | Financing vehicles per project (`credito`, `arrendamiento`, `ensaas`, `mem`). |
| `config_financiamiento` | 7 | `id` (UUID) | Junction linking technical configurations to compatible financing options (M:N). |
| `telemetria_egauge` | 0 | `id` (UUID) | High-frequency telemetry time-series indexed by `(proyecto_id, timestamp DESC)`. |
| `archivos` | 6 | `id` (UUID) | Uploaded proposals, CFE bills, and contracts. FK $\to$ `proyectos.id`. |
| `comentarios` | 0 | `id` (UUID) | Project-level comments between Admin, Analyst, and EPC. |
| `hitos_construccion` | 12 | `id` (UUID) | Legacy construction milestone progress tracker. |
| `plan_fases` | 0 | `id` (UUID) | Hierarchical EPC Gantt construction phases with progress tracking. |
| `plan_actividades` | 0 | `id` (UUID) | Gantt activities with predecessor dependency types (`FS`, `SS`, `FF`, `SF`). |
| `plan_tareas` | 0 | `id` (UUID) | Actionable operational tasks under activities. |
| `plan_subtareas` | 0 | `id` (UUID) | Checklist items under tasks. |
| `hitos_financieros` | 0 | `id` (UUID) | Financial disbursement milestones triggered by phase completion percentages. |
| `plan_plantillas` | 2 | `id` (UUID) | Reusable JSONB Gantt schedule templates for EPCs. |
| `plan_comentarios` | 0 | `id` (UUID) | Polymorphic comment threads on phases, activities, and tasks. |
| `instalacion_evidencias` | 0 | `id` (UUID) | Photographic evidence and PDF inspection logs uploaded by field installers. |
| `ofertas_mem` | 0 | `id` (UUID) | Wholesale market binding power supply offers submitted by Qualified Suppliers. |

### 3.3 Transactional RPCs & Security Triggers

1. **`crear_proyecto_completo(p_payload JSONB) -> UUID`**:
   - `SECURITY INVOKER`, single-transaction atomic creation of `proyectos`, `proyecto_sitios`, `configuraciones_tecnicas`, `opciones_financiamiento`, `config_financiamiento`, and `proyecto_sitio_productos`.
   - Resolves temporary client-side IDs (`temp_id`) to database UUIDs.
   - Any sub-entity validation failure triggers a full PostgreSQL rollback.
2. **`seleccionar_configuracion_tecnica(p_proyecto_id UUID, p_config_id UUID) -> VOID`**:
   - Atomically updates `seleccionada = (id = p_config_id)` across all configurations of the project.
   - Synchronizes `proyectos.capex_estimado` and `proyectos.moneda` from the winning configuration.
3. **`seleccionar_opcion_financiamiento(p_proyecto_id UUID, p_opcion_id UUID) -> VOID`**:
   - Atomically sets `seleccionada = (id = p_opcion_id)` across project financing options.
   - Synchronizes `proyectos.modalidad_financiamiento = ARRAY[v_vehiculo]`.
4. **`protect_profile_role()` (`trg_protect_profile_role` ON `public.profiles`)**:
   - `BEFORE UPDATE` security trigger. Blocks any caller whose profile role is not `nodo_admin` from altering `profiles.rol` or `profiles.cliente_crm_id`.
5. **`handle_new_user()` (ON `auth.users`)**:
   - `AFTER INSERT` trigger. Initializes new profile records with `rol = 'pendiente'`, ignoring any role passed in client metadata.
6. **`admin_update_role(target_id UUID, new_rol TEXT)`**:
   - Privileged `SECURITY DEFINER` function with `search_path = public`. Permits `nodo_admin` or `nodo_analista` to modify user roles, explicitly preventing analysts from promoting anyone to `nodo_admin`.

---

## 4. UI/UX, Design System & Component Architecture

### 4.1 Brand Design System & Visual Tokens

The user interface adheres to the official **Nodo Brandbook**:
- **Color Hierarchy (`app/globals.css`)**:
  - Primary Dark Surface: `--color-principal: #072B31` (Petróleo Pantone 546 C)
  - Primary Dynamic Accent: `--color-acento: #CEDC00` (Lima Pantone 381 C)
  - Secondary Accent: `--color-menta: #00C19F` (Menta Pantone 2240 C)
  - Clean Background: `--color-fondo: #F4F7F6` with subtle multi-stop radial gradient
  - Neutrals: Salvia (`#9AB9AD`), Verde Claro (`#D1E0D7`), Arena (`#D6D9C7`), Borde (`rgba(7,43,49,0.12)`), Muted (`#5F7A77`)
- **Typography Standards**:
  - General UI & Body: `Inter` sans-serif
  - Section Headings: `Articulat CF` (with `Inter` fallback)
  - Financial Metrics & KPIs: `BC Barell 1973` with forced tabular numbers (`font-variant-numeric: tabular-nums`)
- **Glassmorphism Styling**: `.glass-panel` and `.glass-card` classes provide backdrop blur (16px to 24px) with semi-transparent petroleum borders.

### 4.2 Route Inventory & Layout Architecture (46 Routes)

All 46 routes are consolidated under App Router conventions:
- **Root & Auth (4 routes)**: `/`, `/login`, `/registro`, `/pendiente`.
- **Admin Portal (11 routes)**: `/admin`, `/admin/proyectos`, `/admin/proyectos/nuevo`, `/admin/proyectos/[id]`, `/admin/proyectos/[id]/plan`, `/admin/proyectos/[id]/instalaciones`, `/admin/instalaciones`, `/admin/clientes`, `/admin/clientes/nuevo`, `/admin/clientes/[id]`, `/admin/usuarios`, `/admin/configuracion`, `/admin/configuracion/roles`.
- **Analista Portal (11 routes)**: Mirror of Admin, scoped to exclude deletion and admin role creation.
- **EPC Portal (9 routes)**: `/epc`, `/epc/proyectos`, `/epc/nuevo`, `/epc/proyectos/[id]`, `/epc/proyectos/[id]/plan`, `/epc/proyectos/[id]/instalaciones`, `/epc/instalaciones`, `/epc/clientes`, `/epc/clientes/nuevo`, `/epc/clientes/[id]`, `/epc/configuracion`.
- **Finder Portal (9 routes)**: Mirror of EPC, with read-only Gantt/field views and locked deal attribution.
- **Cliente Portal (4 routes)**: `/cliente`, `/cliente/instalaciones`, `/cliente/proyectos/[id]/instalaciones`, `/cliente/configuracion`.
- **Financiero Portal (5 routes)**: `/financiero`, `/financiero/proyectos/[id]`, `/financiero/proyectos/[id]/plan`, `/financiero/proyectos/[id]/instalaciones`, `/financiero/instalaciones`, `/financiero/configuracion`.
- **MEM Portal (2 routes)**: `/mem`, `/mem/configuracion`.

### 4.3 Component Consolidation Success

Sprints 1 and 2 successfully eliminated approximately 6,200 lines of duplicated code:
- **`ProjectWizard` (`components/proyectos/ProjectWizard.tsx`)**: Unified multi-step project creation across Admin, Analista, EPC, and Finder. Supports hybrid BESS+FV inverter linking and the 2-step `"Nodo busca instalador"` flow.
- **Shared Directory & Detail Views**: Standardized `SharedProjectDirectoryView`, `SharedProjectDetailView`, `SharedProjectPlanView`, and `SharedClientDetailView` parameterized by user role and capabilities.
- **Field & Gantt Components**: `PlanBuilder.tsx` with dynamic SVAR Gantt import, `FinancialMilestones.tsx`, and `InstalacionMonitor.tsx` with photo lightbox viewing.

---

## 5. Current Implementation Progress vs Baseline Handoff

Evaluating current status against `nodo_crm_handoff.md` and `AGENTS.md`:

| Functional Area | Baseline Requirement | Current Status | Empirical Evidence |
|---|---|:---:|---|
| **TypeScript Strictness** | Zero compiler errors | **100% PASS** | `npx tsc --noEmit` exits code 0. |
| **ESLint Hygiene** | Zero errors | **100% PASS** | `npm run lint` exits code 0 (13 unused-var warnings). |
| **Automated Testing** | 4-Tier acceptance suite pass | **100% PASS** | 59/59 tests pass across 9 suites in 21.17s against live Supabase. |
| **Production Build** | Next.js 16 App Router build | **100% PASS** | `npm run build` compiles 46 static/dynamic routes in 6.1s. |
| **RBAC Security** | 5-layer enforcement | **100% PASS** | Verified via `proxy.ts`, `PortalShell`, and `protect_profile_role` trigger. |
| **Project Wizard** | Single consolidated wizard | **100% PASS** | Operational across 4 portals; atomic `crear_proyecto_completo` RPC verified. |
| **Construction Gantt** | Svar Gantt + Kahn cascade | **100% PASS** | `cascadeDependencies` verified across FS/SS/FF/SF dependencies. |
| **Deterministic CFE Engine**| No synthetic multipliers | **PARTIAL** | GDMTH/GDMTO/PDBT/GDBT implemented; DIST/DIT and SEMARNAT factor missing. |
| **In-App Notifications** | Realtime notification polling | **BROKEN** | Table `notificaciones` is missing from the live database. |
| **Telemetry Queries** | Historical telemetry charts | **BROKEN** | `lib/dashboard-data.ts` queries nonexistent columns (`BUG-42703`). |
| **Client Portal Projects**| Client views projects | **BROKEN** | `lib/domains/proyectos/queries.ts` joins on `profiles.id` instead of `clientes.id`. |

> [!NOTE]
> The diagnostic table above reflects the pre-Sprint-3 point-in-time snapshot before remediation. All gaps (`GAP-01`–`GAP-09`) were resolved in Sprint 3 (`v2.1.0`), and the Declarative Savings Calculator / Simulator (`v2.2.0`) was added atop the hardened baseline. See Section 7 below and `nodo_crm_handoff.md`.

---

## 6. Comprehensive Catalog of Architectural Gaps & Technical Debt

### 6.1 Critical Functional Defects & Schema Divergences

#### GAP-01 / BUG-42703: Telemetry Column Divergence in `lib/dashboard-data.ts`
- **Severity**: **P0 (Critical Runtime Error)**
- **Subsystem**: Telemetry & Analytics (`lib/dashboard-data.ts:201-203`)
- **Observed Defect**: The query in `getTelemetryHistorical()` selects:
  `generacion_kwh, consumo_kwh, potencia_kw, bateria_soc_pct, bateria_estado`.
  In the live database (`public.telemetria_egauge`), these columns do not exist. The actual columns are:
  `solar_produccion_kwh, consumo_red_kwh, bateria_porcentaje, bateria_descarga_kwh`.
- **Impact**: Any invocation of historical telemetry crashes with PostgreSQL error:
  `42703: column telemetria_egauge.generacion_kwh does not exist`.

#### GAP-02 / PGRST205: Missing `public.notificaciones` Table
- **Severity**: **P0 (High-Frequency Network Polling Error)**
- **Subsystem**: Layout, Communication & Notifications (`components/TopBar.tsx:43`)
- **Observed Defect**: `TopBar.tsx` sets up a 30-second interval polling `supabase.from('notificaciones')`. Because the table was never migrated to the live database, every connected client generates continuous HTTP 400/404 errors with PostgREST message:
  `PGRST205: Could not find the table 'public.notificaciones' in the schema cache`.
- **Impact**: Pollutes browser consoles, generates unnecessary request traffic, and breaks in-app notifications.

#### GAP-03: Relational Bug in Client Portal Projects Query
- **Severity**: **P0 (Feature Inoperability)**
- **Subsystem**: Client Portal Domain Queries (`lib/domains/proyectos/queries.ts:128`)
- **Observed Defect**: When filtering projects for `cliente_final`, the query executes:
  `query = query.eq('cliente_id', options.userId)`.
  However, `proyectos.cliente_id` is an FK to `public.clientes.id` (the commercial company), whereas `options.userId` is `public.profiles.id` (the authenticated user). The user profile points to the company via `profiles.cliente_crm_id`.
- **Impact**: The shared project query returns an empty list for end clients.

### 6.2 Architectural & Security Optimizations

#### GAP-04 / GAP-01: Deep-Link Parameter Ignored in `app/login/page.tsx`
- **Severity**: **P1 (User Experience Degradation)**
- **Subsystem**: Authentication & Routing (`app/login/page.tsx`, `proxy.ts:55-57`)
- **Observed Defect**: `proxy.ts` redirects unauthenticated users to `/login?returnUrl=/admin/proyectos/123`. However, `app/login/page.tsx` never reads `useSearchParams().get('returnUrl')`, and unconditionally navigates to `/${sub}` on successful login.
- **Impact**: Users clicking notification emails or bookmarks lose their destination and land at portal roots.

#### GAP-05 / GAP-02: Per-Request Database Query in `proxy.ts`
- **Severity**: **P1 (Latency & Connection Pool Pressure)**
- **Subsystem**: Edge Proxy & Auth (`proxy.ts:65-69`)
- **Observed Defect**: On every authenticated page navigation, `proxy.ts` queries `public.profiles.rol` via PostgREST to determine the user's role.
- **Impact**: Adds 50–200ms latency to every navigation and creates high connection pool churn during concurrent requests.
- **Solution**: Mirror `profiles.rol` into `auth.users.raw_app_meta_data->>'user_role'` using a PostgreSQL trigger, enabling `proxy.ts` to read the role directly from the verified JWT.

#### GAP-06 / GAP-03: Usage of `getSession()` in Server Components
- **Severity**: **P2 (SSR Security Best Practice)**
- **Subsystem**: Server Components (`app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx:8-11`)
- **Observed Defect**: Server component calls `supabase.auth.getSession()` instead of `supabase.auth.getUser()`. Per Supabase security standards, `getSession()` does not validate token authenticity against auth servers.

### 6.3 Business Logic, CFE Engine & Code Quality Debt

#### GAP-07: Incomplete CFE Tariff Catalog & Missing Emissions Metric
- **Severity**: **P1 (Economic Calculation Incompleteness)**
- **Subsystem**: Tariff Engine (`lib/tariffs/cfe-calculator.ts`)
- **Observed Defect**:
  1. Only defines 4 commercial tariffs (`GDMTH`, `GDMTO`, `PDBT`, `GDBT`). Missing industrial tariffs (`DIST`, `DIT`) and residential tariffs (`01`, `DAC`) claimed in `nodo_crm_handoff.md:65`.
  2. The official 0.423 kg CO₂e/kWh SEMARNAT environmental emissions factor is completely missing from the codebase.
  3. No multi-currency normalization: if a project's savings are configured in USD, `calculateProjectSavingsMxn` pro-rates the USD value directly without multiplying by the exchange rate.
  4. Data type mismatch: `proyectos.tarifa_actual_cfe` is defined as `NUMERIC` in the database, whereas the UI and calculator treat it as a `string` tariff code.

#### GAP-08: Unindexed Foreign Keys in PostgreSQL
- **Severity**: **P2 (Database Query Performance)**
- **Subsystem**: Database Schema & RLS
- **Observed Defect**: Foreign keys `proyectos.cliente_id`, `proyectos.epcista_id`, `proyectos.financiero_id`, `sitios.cliente_id`, `proyecto_sitios.proyecto_id`, and `configuraciones_tecnicas.proyecto_id` lack explicit B-tree indexes, forcing full table sequential scans during RLS filtering and relational joins.

#### GAP-09: Monolithic Component Files & Lack of Headless UI Primitives
- **Severity**: **P2 (Maintainability & Code Hygiene)**
- **Subsystem**: Components & Design System
- **Observed Defect**:
  1. `ProjectWizard.tsx` is 1,391 lines; `InstalacionMonitor.tsx` is 674 lines; `SharedClientDetailView.tsx` is 552 lines.
  2. `components/ui/` only provides 6 primitives; modals, dropdowns, and tabs are implemented with bespoke inline markup and state.
  3. 13 unused variable warnings exist across source files and tests.
  4. Dual Tailwind configuration (`app/globals.css` `@theme` vs legacy `tailwind.config.ts`).

---

## 7. Conclusion

Nodo CRM has established a robust, resilient foundation. Its core RBAC architecture, Next.js 16 App Router compliance, unified project wizard, and transactional RPCs pass all four verification gates with zero errors. Resolving the 9 identified technical gaps—prioritizing the P0 runtime defects and schema alignments—will elevate the platform to institutional-grade production readiness.

> [!NOTE]
> **Post-Sprint-3 & Savings Calculator Addendum (`v2.2.0`)**: All 9 architectural gaps (`GAP-01`–`GAP-09`) documented above were resolved and verified in Sprint 3 (`v2.1.0`, see `nodo_crm_handoff.md` Section 3). On `v2.2.0`, the platform was further extended with the Declarative Energy & Monetary Savings Calculator / Simulator (`supabase/migrations/20261119000000_v29_savings_calculator.sql`, `lib/calculator/*`, `components/calculator/*`, `/admin/configuracion/calculadora`, `/cliente/proyectos`, `/cliente/proyectos/[id]`, `/api/calculator/excel/parse`), verified by `29/29` Vitest unit tests alongside TypeScript, ESLint (`--max-warnings=0`), and production build gates.
