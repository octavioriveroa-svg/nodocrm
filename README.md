# Nodo CRM

Multi-portal platform for managing commercial & industrial solar photovoltaic (FV) and battery energy storage system (BESS) projects across Mexico. Built with **Next.js 16.2.3 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL + RLS + Auth + Storage)**.

---

## Portals & Roles

| Role (`profiles.rol`) | Portal Route | Key Capabilities |
| :--- | :--- | :--- |
| `nodo_admin` | `/admin` | Global analytics dashboard, full project & client CRUD, user directory, role administration (`/admin/configuracion/roles`) |
| `nodo_analista` | `/analista` | Analytics dashboard, full project directory (`/analista/proyectos`), project creation (`/analista/proyectos/nuevo`), client & non-admin user management |
| `epc` | `/epc` | Installer portal: project submission (`/epc/nuevo`), technical FV/BESS sizing, Gantt schedule & milestones (`/epc/proyectos/[id]/plan`), installation monitor |
| `finder` | `/finder` | Lead origination (`/finder/nuevo`), EPC invitation workflow, referred deal tracking, schedule & installation read views |
| `cliente_final` | `/cliente` | End-customer portal: project status, CFE tariff-calculated savings, installation monitoring (`/cliente/instalaciones`) |
| `financiero` | `/financiero` | Financier portfolio dashboard, 30-day bounded telemetry performance, CFE savings calculation, financial milestones |
| `suministrador` | `/mem` | Wholesale Electricity Market (*MEM*) portal: high-demand site evaluation via `OfertasBoard` |

---

## Local Development

1. **Install dependencies**:
   ```bash
   npm ci
   ```

2. **Configure environment variables**:
   Create `.env.local` in the project root with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## Quality Gates & Automated Tests

Run all verification checks before opening a Pull Request:

```bash
# 1. TypeScript type-checking
npx tsc --noEmit

# 2. ESLint
npm run lint

# 3. 4-Tier Automated Acceptance Test Suite (31 tests)
npm test

# 4. Production build
npm run build
```

---

## Database Migrations

SQL migrations are stored in [`supabase/migrations/`](file:///C:/Users/vmont/.gemini/antigravity/worktrees/nodocrm/platform_diagnostics_and_refactoring/supabase/migrations) and configured via [`supabase/config.toml`](file:///C:/Users/vmont/.gemini/antigravity/worktrees/nodocrm/platform_diagnostics_and_refactoring/supabase/config.toml):
- `20261021000001_sprint1_security_rpcs_and_profile_prefs.sql` — Profile preference columns, RBAC triggers (`protect_profile_role`, `handle_new_user`), `SECURITY DEFINER` search_path hardening, and transactional RPCs (`crear_proyecto_completo`, `seleccionar_configuracion_tecnica`, `seleccionar_opcion_financiamiento`).
- `20261021000002_dashboard_views_and_indexes.sql` — Composite performance indexes (`idx_telemetria_proyecto_time`, `idx_proyectos_estado_created`) and `proyectos_epcista_id_fkey` relational join constraint.

For detailed architectural context, see [`nodo_crm_handoff.md`](file:///C:/Users/vmont/.gemini/antigravity/worktrees/nodocrm/platform_diagnostics_and_refactoring/nodo_crm_handoff.md) and [`TEST_READY.md`](file:///C:/Users/vmont/.gemini/antigravity/worktrees/nodocrm/platform_diagnostics_and_refactoring/TEST_READY.md).
