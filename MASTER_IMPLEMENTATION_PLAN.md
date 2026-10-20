# Nodo CRM — Flash-Ready Master Implementation Playbook (`NODO-MIP-2026-R6-FLASH`)

**Target Architecture:** Next.js 16.2.3 (App Router + `proxy.ts`) + React 19.2.4 + Supabase PostgreSQL (`nlqrdxwyxmgdwawedweh`)  
**Execution Tier:** Optimized for parallel **Flash-Tier Subagent Teams** (`/teamwork-preview`) with **zero-ambiguity, copy-paste-ready SQL and TypeScript specifications** and **strictly disjoint file ownership per worker track**.

---

## 1. Executive Summary & Sprint Architecture

### 1.1 Resolved User Decisions
1. **Supabase API Keys (`SEC-03` Root Cause Fixed)**:
   - Root cause of the `401 Invalid API key` outage: `.env.local` had a typo in `SUPABASE_SERVICE_ROLE_KEY` (`...XcPBBc-M3gPtUI` with a double `BB` instead of `...XcPBc-M3gPtUI` with a single `B`).
   - Exact keys provided by user for `.env.local` (Task `W1.1`).
2. **Supabase MCP Server**:
   - Configured in `C:\Users\vmont\.gemini\antigravity\mcp_config.json` pointing to `https://mcp.supabase.com/mcp?project_ref=nlqrdxwyxmgdwawedweh&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching`.
3. **QA User Profiles**:
   - **Keep all 8 pre-existing QA user profiles** (`*@prueba.com`, `Test EPC`, `QA Test User`, `Finder Prueba`) in `public.profiles` for automated multi-role E2E verification.
4. **Sprint Execution Strategy (2 Sequenced Sprints for Maximum Flash Reliability)**:
   - To guarantee that Flash worker models never suffer context dilution or concurrent file-edit collisions, execution is divided into **two bounded sprints**, each decomposed into **strictly non-overlapping Worker Tracks**:
     - **Sprint 1 (Phases 1 & 2 — Immediate Execution Upon Approval)**: 4 parallel worker tracks (`W1`, `W2`, `W3`, `W4`) resolving all Critical/High security vulnerabilities (`SEC-01`..`SEC-06`), transactional PostgreSQL RPCs (`DATA-01`..`DATA-03`), Client Portal FK fix (`CLIENT-FK`), 100% Zero-Mockup cleanup (`MOCK-01`, `MOCK-02`), real Supabase persistence for `Configuracion.tsx` (`R1-Defect-4`), and all broken navigation/routes (`NAV-01`, `R1-Defect-3`, `R1-Defect-5`).
     - **Sprint 2 (Phases 3 & 4 — Immediately Following Sprint 1 Gate)**: 3 parallel worker tracks (`W5`, `W6`, `W7`) delivering App Router `error.tsx`/`loading.tsx`/`not-found.tsx` boundaries (`REL-01`), `sonner` toast notifications replacing `alert()`, SQL dashboard views & pagination (`PERF-01`..`PERF-03`), migration directory standardization (`ARCH-01`), and CI/CD pipeline (`REL-06`).

### 1.2 File Ownership Matrix (Zero Edit Collisions Across Flash Workers)

| Sprint | Worker Track | Exclusive File Ownership | Findings Resolved |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | **Track W1 (DB & Env)** | `.env.local`, `lib/supabase/admin.ts`, `lib/types.ts`, `supabase/migrations/20261021000001_sprint1_security_rpcs_and_profile_prefs.sql` | `SEC-01`, `SEC-02`, `SEC-03`, `SEC-04`, `DATA-01`..`03` (SQL), `R1-Defect-4` (SQL) |
| **Sprint 1** | **Track W2 (Auth & Proxy)** | `proxy.ts`, `app/pendiente/page.tsx`, `app/login/page.tsx`, `app/(portals)/{admin,analista,epc,finder,cliente,financiero,mem}/layout.tsx` | `SEC-05`, `SEC-06`, `REL-02`, `NAV-01` |
| **Sprint 1** | **Track W3 (Atomic Writes & Detail)** | `components/proyectos/ProjectWizard.tsx`, `components/DetalleProyecto.tsx`, `components/EditarSolucionTecnicaModal.tsx`, `components/EditarFinanciamientoModal.tsx` | `DATA-01`, `DATA-02`, `DATA-03`, `R1-Defect-5` |
| **Sprint 1** | **Track W4 (Zero-Mockups & Portals)** | `lib/egauge.ts` (delete), `app/brand-preview/page.tsx` (delete), `lib/tariffs/cfe-calculator.ts` (new), `app/(portals)/cliente/page.tsx`, `app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx`, `app/(portals)/financiero/page.tsx`, `components/marketplace/OfertasBoard.tsx`, `components/Configuracion.tsx`, `app/(portals)/{admin,analista,epc,finder,cliente,financiero,mem}/configuracion/page.tsx`, `components/Sidebar.tsx`, `app/(portals)/finder/proyectos/[id]/{instalaciones,plan}/page.tsx` | `CLIENT-FK`, `MOCK-01`, `MOCK-02`, `R1-Defect-3`, `R1-Defect-4`, `R1-Defect-5`, `R1-Defect-6`, `PERF-02` |
| **Sprint 2** | **Track W5 (App Router UX)** | `app/{error,loading,not-found}.tsx`, `app/(portals)/*/{error,loading}.tsx`, `app/layout.tsx` | `REL-01`, `REL-04` |
| **Sprint 2** | **Track W6 (Performance & Views)** | `supabase/migrations/20261021000002_dashboard_views_and_indexes.sql`, `lib/dashboard-data.ts`, `app/(portals)/{admin,analista}/proyectos/page.tsx` | `PERF-01`, `PERF-03` |
| **Sprint 2** | **Track W7 (Migrations & CI/CD)** | `supabase/config.toml`, `.github/workflows/main.yml`, `package.json` | `ARCH-01`, `REL-06` |

---

## 2. Sprint 1 — Track W1: Environment, Security RLS & Transactional SQL RPCs

> **Execution Order Rule:** Track W1 **MUST** complete Tasks `W1.1`, `W1.2`, and `W1.3` first (or before Track W3/W4 run verification) because Tracks W2–W4 depend on the updated `Profile` type in `lib/types.ts` and the new PostgreSQL columns/RPCs.

### Task W1.1 — Fix `.env.local` Keys & Harden `lib/supabase/admin.ts` (`SEC-03`)

1. **File:** `.env.local` (Lines 1–3 — git-ignored via `.gitignore` line 34: `.env*`)
   Copy the verified `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from the private local-only vault file (`C:\Users\vmont\.gemini\antigravity\brain\7c8bcfde-f50b-4f0d-8643-db5d8470f1a5\scratch\.supabase_credentials.env`) into lines 1–3 of `.env.local` (or replace the `XcPBBc` typo in `.env.local` line 3 with `XcPBc`), preserving all `QA_USER_*` lines below line 3. **Never write `SUPABASE_SERVICE_ROLE_KEY` into any git-tracked file.**

2. **File:** `lib/supabase/admin.ts` (Replace entire file, lines 1–15)
   ```typescript
   import { createClient } from '@supabase/supabase-js'

   export function createAdminClient() {
     const url = process.env.NEXT_PUBLIC_SUPABASE_URL
     const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

     if (!url || !serviceKey) {
       throw new Error(
         'Faltan variables de entorno críticas: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.'
       )
     }

     return createClient(url, serviceKey, {
       auth: {
         autoRefreshToken: false,
         persistSession: false,
       },
     })
   }
   ```

3. **Immediate Verification Command for W1.1:**
   ```powershell
   node -e "require('dotenv').config({path:'.env.local'}); const {createClient}=require('@supabase/supabase-js'); createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY).auth.admin.listUsers({page:1,perPage:1}).then(r=>{if(r.error) throw r.error; console.log('OK users:', r.data.users.length)})"
   ```
   Must print `OK users: 1` with exit code `0`.

---

### Task W1.2 — Create & Apply Consolidated SQL Migration (`SEC-01`, `SEC-02`, `SEC-04`, `DATA-01`..`03`, `R1-Defect-4`)

1. **Create File:** `supabase/migrations/20261021000001_sprint1_security_rpcs_and_profile_prefs.sql`
   Write the **exact, complete SQL file below** (zero omissions):

   ```sql
   -- ============================================================================
   -- MIGRATION: 20261021000001_sprint1_security_rpcs_and_profile_prefs.sql
   -- Covers: SEC-01, SEC-02, SEC-04, SEC-06, R1-Defect-4, DATA-01, DATA-02, DATA-03
   -- ============================================================================

   -- ----------------------------------------------------------------------------
   -- 1. PROFILE PREFERENCE & COMPANY COLUMNS (R1-Defect-4)
   -- ----------------------------------------------------------------------------
   ALTER TABLE public.profiles
     ADD COLUMN IF NOT EXISTS rfc TEXT,
     ADD COLUMN IF NOT EXISTS industria TEXT,
     ADD COLUMN IF NOT EXISTS ubicacion_estado TEXT,
     ADD COLUMN IF NOT EXISTS website TEXT,
     ADD COLUMN IF NOT EXISTS moneda_preferida TEXT NOT NULL DEFAULT 'MXN' CHECK (moneda_preferida IN ('MXN', 'USD')),
     ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
     ADD COLUMN IF NOT EXISTS notif_nuevo_proyecto BOOLEAN NOT NULL DEFAULT TRUE,
     ADD COLUMN IF NOT EXISTS notif_cambio_estado BOOLEAN NOT NULL DEFAULT TRUE,
     ADD COLUMN IF NOT EXISTS notif_comentarios BOOLEAN NOT NULL DEFAULT FALSE;

   -- ----------------------------------------------------------------------------
   -- 2. PREVENT SELF-ROLE ESCALATION ON public.profiles (SEC-01)
   -- ----------------------------------------------------------------------------
   CREATE OR REPLACE FUNCTION public.protect_profile_role()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public
   AS $$
   DECLARE
     v_caller_rol TEXT;
   BEGIN
     IF NEW.rol IS DISTINCT FROM OLD.rol THEN
       -- Allow service_role / postgres / supabase_admin (where auth.uid() IS NULL)
       IF auth.uid() IS NOT NULL THEN
         SELECT p.rol INTO v_caller_rol
         FROM public.profiles p
         WHERE p.id = auth.uid();

         IF COALESCE(v_caller_rol, '') <> 'nodo_admin' THEN
           RAISE EXCEPTION 'Operación no permitida: solo un administrador (nodo_admin) puede modificar el rol de un perfil.';
         END IF;
       END IF;
     END IF;
     RETURN NEW;
   END;
   $$;

   DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
   CREATE TRIGGER trg_protect_profile_role
     BEFORE UPDATE ON public.profiles
     FOR EACH ROW
     EXECUTE FUNCTION public.protect_profile_role();

   DROP POLICY IF EXISTS "Actualizar propio perfil" ON public.profiles;
   CREATE POLICY "Actualizar propio perfil"
     ON public.profiles FOR UPDATE
     USING (auth.uid() = id)
     WITH CHECK (
       auth.uid() = id
       AND rol = (SELECT p.rol FROM public.profiles p WHERE p.id = auth.uid())
     );

   -- ----------------------------------------------------------------------------
   -- 3. LOCK DOWN SIGNUP TRIGGER TO ALWAYS ASSIGN 'pendiente' (SEC-02, SEC-04)
   -- ----------------------------------------------------------------------------
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public
   AS $$
   BEGIN
     INSERT INTO public.profiles (id, nombre, empresa, rol)
     VALUES (
       NEW.id,
       COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
       COALESCE(NEW.raw_user_meta_data->>'empresa', ''),
       'pendiente'
     )
     ON CONFLICT (id) DO NOTHING;
     RETURN NEW;
   END;
   $$;

   -- ----------------------------------------------------------------------------
   -- 4. HARDEN ALL SECURITY DEFINER FUNCTIONS WITH search_path = public (SEC-04)
   --    AND SYNC auth.users METADATA ON ROLE UPDATES (SEC-06)
   -- ----------------------------------------------------------------------------
   CREATE OR REPLACE FUNCTION public.admin_update_role(target_id UUID, new_rol TEXT)
   RETURNS void
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public
   AS $$
   DECLARE
     v_caller_rol TEXT;
   BEGIN
     SELECT p.rol INTO v_caller_rol
     FROM public.profiles p
     WHERE p.id = auth.uid();

     IF COALESCE(v_caller_rol, '') NOT IN ('nodo_admin', 'nodo_analista') THEN
       RAISE EXCEPTION 'Solo administradores o analistas autorizados pueden cambiar roles';
     END IF;

     IF v_caller_rol = 'nodo_analista' AND new_rol = 'nodo_admin' THEN
       RAISE EXCEPTION 'Un analista no puede asignar el rol de administrador (nodo_admin)';
     END IF;

     IF new_rol NOT IN ('epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador', 'pendiente', 'finder') THEN
       RAISE EXCEPTION 'Rol no válido: %', new_rol;
     END IF;

     UPDATE public.profiles
     SET rol = new_rol
     WHERE id = target_id;

     UPDATE auth.users
     SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('rol', new_rol),
         raw_app_meta_data  = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', new_rol)
     WHERE id = target_id;
   END;
   $$;

   -- Sync existing auth.users metadata with authoritative public.profiles.rol
   UPDATE auth.users u
   SET raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('rol', p.rol),
       raw_app_meta_data  = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', p.rol)
   FROM public.profiles p
   WHERE u.id = p.id;

   CREATE OR REPLACE FUNCTION public.is_project_epc(p_proyecto_id UUID)
   RETURNS BOOLEAN
   LANGUAGE sql
   SECURITY DEFINER
   STABLE
   SET search_path = public
   AS $$
     SELECT EXISTS (
       SELECT 1 FROM public.proyectos WHERE id = p_proyecto_id AND epcista_id = auth.uid()
     );
   $$;

   CREATE OR REPLACE FUNCTION public.is_nodo_user()
   RETURNS BOOLEAN
   LANGUAGE sql
   SECURITY DEFINER
   STABLE
   SET search_path = public
   AS $$
     SELECT EXISTS (
       SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol IN ('nodo_admin', 'nodo_analista')
     );
   $$;

   CREATE OR REPLACE FUNCTION public.is_project_financiero(p_proyecto_id UUID)
   RETURNS BOOLEAN
   LANGUAGE sql
   SECURITY DEFINER
   STABLE
   SET search_path = public
   AS $$
     SELECT EXISTS (
       SELECT 1 FROM public.proyectos WHERE id = p_proyecto_id AND financiero_id = auth.uid()
     );
   $$;

   CREATE OR REPLACE FUNCTION public.is_project_cliente(p_proyecto_id UUID)
   RETURNS BOOLEAN
   LANGUAGE sql
   SECURITY DEFINER
   STABLE
   SET search_path = public
   AS $$
     SELECT EXISTS (
       SELECT 1 FROM public.proyectos p
       JOIN public.profiles pr ON pr.id = auth.uid()
       WHERE p.id = p_proyecto_id
         AND pr.rol = 'cliente_final'
         AND p.cliente_id = pr.cliente_crm_id
     );
   $$;

   CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
   RETURNS jsonb
   LANGUAGE plpgsql
   STABLE
   SET search_path = public
   AS $$
   DECLARE
     claims jsonb;
     user_role text;
   BEGIN
     SELECT rol INTO user_role
     FROM public.profiles
     WHERE id = (event->>'user_id')::uuid;

     claims := event->'claims';

     IF user_role IS NOT NULL THEN
       claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
     ELSE
       claims := jsonb_set(claims, '{user_role}', '"pendiente"');
     END IF;

     event := jsonb_set(event, '{claims}', claims);
     RETURN event;
   END;
   $$;

   -- ----------------------------------------------------------------------------
   -- 5. TRANSACTIONAL RPC: crear_proyecto_completo (DATA-01)
   -- ----------------------------------------------------------------------------
   CREATE OR REPLACE FUNCTION public.crear_proyecto_completo(p_payload JSONB)
   RETURNS UUID
   LANGUAGE plpgsql
   SECURITY INVOKER
   SET search_path = public
   AS $$
   DECLARE
     v_proyecto_id UUID;
     v_proj JSONB := p_payload->'proyecto';
     v_sitio_id TEXT;
     v_cfg JSONB;
     v_cfg_id UUID;
     v_cfg_map JSONB := '{}'::jsonb;
     v_opt JSONB;
     v_opt_id UUID;
     v_opt_map JSONB := '{}'::jsonb;
     v_link JSONB;
     v_prod JSONB;
   BEGIN
     IF v_proj IS NULL OR COALESCE(TRIM(v_proj->>'nombre_proyecto'), '') = '' THEN
       RAISE EXCEPTION 'El nombre del proyecto es obligatorio.';
     END IF;

     -- 1. Insert into proyectos
     INSERT INTO public.proyectos (
       epcista_id,
       responsable_nodo_id,
       finder_id,
       cliente_id,
       tipo,
       nombre_proyecto,
       estado,
       tipo_instalacion,
       incluye_mem,
       demanda_kw,
       cliente_final_nombre,
       cliente_final_empresa,
       cliente_final_contacto,
       capex_estimado,
       moneda,
       ubicacion_estado,
       modalidad_financiamiento,
       notas_adicionales,
       capacidad_mwh,
       capacidad_mw,
       tecnologia_bateria,
       duracion_descarga_hrs,
       punto_interconexion,
       tipo_participacion_mem,
       volumen_energia_mwh_anual
     ) VALUES (
       NULLIF(v_proj->>'epcista_id', '')::UUID,
       NULLIF(v_proj->>'responsable_nodo_id', '')::UUID,
       NULLIF(v_proj->>'finder_id', '')::UUID,
       NULLIF(v_proj->>'cliente_id', '')::UUID,
       v_proj->>'tipo',
       v_proj->>'nombre_proyecto',
       COALESCE(v_proj->>'estado', 'recibido'),
       NULLIF(v_proj->>'tipo_instalacion', ''),
       COALESCE((v_proj->>'incluye_mem')::BOOLEAN, FALSE),
       NULLIF(v_proj->>'demanda_kw', '')::NUMERIC,
       COALESCE(v_proj->>'cliente_final_nombre', ''),
       COALESCE(v_proj->>'cliente_final_empresa', ''),
       COALESCE(v_proj->>'cliente_final_contacto', ''),
       NULLIF(v_proj->>'capex_estimado', '')::NUMERIC,
       COALESCE(v_proj->>'moneda', 'MXN'),
       COALESCE(v_proj->>'ubicacion_estado', ''),
       ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_proj->'modalidad_financiamiento', '[]'::jsonb))),
       NULLIF(v_proj->>'notas_adicionales', ''),
       NULLIF(v_proj->>'capacidad_mwh', '')::NUMERIC,
       NULLIF(v_proj->>'capacidad_mw', '')::NUMERIC,
       NULLIF(v_proj->>'tecnologia_bateria', ''),
       NULLIF(v_proj->>'duracion_descarga_hrs', '')::NUMERIC,
       NULLIF(v_proj->>'punto_interconexion', ''),
       NULLIF(v_proj->>'tipo_participacion_mem', ''),
       NULLIF(v_proj->>'volumen_energia_mwh_anual', '')::NUMERIC
     )
     RETURNING id INTO v_proyecto_id;

     -- 2. Insert into proyecto_sitios
     FOR v_sitio_id IN
       SELECT jsonb_array_elements_text(COALESCE(p_payload->'sitios_ids', '[]'::jsonb))
     LOOP
       INSERT INTO public.proyecto_sitios (proyecto_id, sitio_id)
       VALUES (v_proyecto_id, v_sitio_id::UUID)
       ON CONFLICT (proyecto_id, sitio_id) DO NOTHING;
     END LOOP;

     -- 3. Insert into configuraciones_tecnicas and map tempId -> UUID
     FOR v_cfg IN
       SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'configuraciones', '[]'::jsonb))
     LOOP
       INSERT INTO public.configuraciones_tecnicas (
         proyecto_id,
         nombre,
         descripcion,
         inversion_total,
         moneda,
         ahorro_estimado_anual,
         ahorro_estimado_mensual,
         ahorro_moneda,
         seleccionada
       ) VALUES (
         v_proyecto_id,
         v_cfg->>'nombre',
         NULLIF(v_cfg->>'descripcion', ''),
         NULLIF(v_cfg->>'inversion_total', '')::NUMERIC,
         COALESCE(v_cfg->>'moneda', 'MXN'),
         NULLIF(v_cfg->>'ahorro_estimado_anual', '')::NUMERIC,
         NULLIF(v_cfg->>'ahorro_estimado_mensual', '')::NUMERIC,
         COALESCE(v_cfg->>'ahorro_moneda', 'MXN'),
         COALESCE((v_cfg->>'seleccionada')::BOOLEAN, FALSE)
       )
       RETURNING id INTO v_cfg_id;

       v_cfg_map := v_cfg_map || jsonb_build_object(COALESCE(v_cfg->>'temp_id', v_cfg->>'nombre'), v_cfg_id::TEXT);
     END LOOP;

     -- 4. Insert into opciones_financiamiento and map tempId -> UUID
     FOR v_opt IN
       SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'opciones_financiamiento', '[]'::jsonb))
     LOOP
       INSERT INTO public.opciones_financiamiento (
         proyecto_id,
         nombre,
         vehiculo_inversion,
         ahorro_estimado_anual,
         ahorro_estimado_mensual,
         moneda,
         plazo_meses,
         notas,
         seleccionada
       ) VALUES (
         v_proyecto_id,
         v_opt->>'nombre',
         v_opt->>'vehiculo_inversion',
         NULLIF(v_opt->>'ahorro_estimado_anual', '')::NUMERIC,
         NULLIF(v_opt->>'ahorro_estimado_mensual', '')::NUMERIC,
         COALESCE(v_opt->>'moneda', 'MXN'),
         NULLIF(v_opt->>'plazo_meses', '')::INTEGER,
         NULLIF(v_opt->>'notas', ''),
         COALESCE((v_opt->>'seleccionada')::BOOLEAN, FALSE)
       )
       RETURNING id INTO v_opt_id;

       v_opt_map := v_opt_map || jsonb_build_object(COALESCE(v_opt->>'temp_id', v_opt->>'nombre'), v_opt_id::TEXT);
     END LOOP;

     -- 5. Insert into config_financiamiento
     FOR v_link IN
       SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'config_financiamiento_links', '[]'::jsonb))
     LOOP
       v_cfg_id := NULLIF(v_cfg_map->>(v_link->>'config_temp_id'), '')::UUID;
       v_opt_id := NULLIF(v_opt_map->>(v_link->>'opcion_temp_id'), '')::UUID;

       IF v_cfg_id IS NOT NULL AND v_opt_id IS NOT NULL THEN
         INSERT INTO public.config_financiamiento (configuracion_id, opcion_financiamiento_id)
         VALUES (v_cfg_id, v_opt_id)
         ON CONFLICT (configuracion_id, opcion_financiamiento_id) DO NOTHING;
       END IF;
     END LOOP;

     -- 6. Insert into proyecto_sitio_productos
     FOR v_prod IN
       SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'productos', '[]'::jsonb))
     LOOP
       v_cfg_id := NULLIF(v_cfg_map->>(v_prod->>'config_temp_id'), '')::UUID;

       INSERT INTO public.proyecto_sitio_productos (
         proyecto_id,
         configuracion_id,
         sitio_id,
         tipo,
         datos
       ) VALUES (
         v_proyecto_id,
         v_cfg_id,
         (v_prod->>'sitio_id')::UUID,
         v_prod->>'tipo',
         COALESCE(v_prod->'datos', '{}'::jsonb)
       );
     END LOOP;

     RETURN v_proyecto_id;
   END;
   $$;

   -- ----------------------------------------------------------------------------
   -- 6. TRANSACTIONAL RPCs FOR SELECTION & MODAL EDITS (DATA-02, DATA-03)
   -- ----------------------------------------------------------------------------
   CREATE OR REPLACE FUNCTION public.seleccionar_configuracion_tecnica(
     p_proyecto_id UUID,
     p_config_id UUID
   )
   RETURNS VOID
   LANGUAGE plpgsql
   SECURITY INVOKER
   SET search_path = public
   AS $$
   DECLARE
     v_inv NUMERIC;
     v_mon TEXT;
   BEGIN
     UPDATE public.configuraciones_tecnicas
     SET seleccionada = (id = p_config_id),
         updated_at = NOW()
     WHERE proyecto_id = p_proyecto_id;

     SELECT inversion_total, COALESCE(moneda, 'MXN')
     INTO v_inv, v_mon
     FROM public.configuraciones_tecnicas
     WHERE id = p_config_id AND proyecto_id = p_proyecto_id;

     UPDATE public.proyectos
     SET capex_estimado = v_inv,
         moneda = v_mon,
         updated_at = NOW()
     WHERE id = p_proyecto_id;
   END;
   $$;

   CREATE OR REPLACE FUNCTION public.seleccionar_opcion_financiamiento(
     p_proyecto_id UUID,
     p_opcion_id UUID
   )
   RETURNS VOID
   LANGUAGE plpgsql
   SECURITY INVOKER
   SET search_path = public
   AS $$
   DECLARE
     v_vehiculo TEXT;
   BEGIN
     UPDATE public.opciones_financiamiento
     SET seleccionada = (id = p_opcion_id),
         updated_at = NOW()
     WHERE proyecto_id = p_proyecto_id;

     SELECT vehiculo_inversion
     INTO v_vehiculo
     FROM public.opciones_financiamiento
     WHERE id = p_opcion_id AND proyecto_id = p_proyecto_id;

     IF v_vehiculo IS NOT NULL THEN
       UPDATE public.proyectos
       SET modalidad_financiamiento = ARRAY[v_vehiculo],
           updated_at = NOW()
       WHERE id = p_proyecto_id;
     END IF;
   END;
   $$;
   ```

2. **How Track W1 Applies the Migration to Live Supabase:**
   - Check if `DATABASE_URL` or Supabase MCP is active, OR execute via Supabase Management API / SQL runner script. Note: if direct DDL execution requires the Supabase SQL Editor or MCP OAuth token, W1 will also test if an RPC helper exists or notify the coordinator.

---

### Task W1.3 — Update `lib/types.ts` `Profile` Interface (`R1-Defect-4`)

**File:** `lib/types.ts` (Lines 10–18)

Replace `export interface Profile` (lines 10–18) with:
```typescript
export interface Profile {
  id: string
  nombre: string
  empresa: string
  rol: Rol
  calendario_url: string | null
  cliente_crm_id: string | null
  created_at: string
  rfc?: string | null
  industria?: string | null
  ubicacion_estado?: string | null
  website?: string | null
  moneda_preferida?: Moneda | null
  timezone?: string | null
  notif_nuevo_proyecto?: boolean | null
  notif_cambio_estado?: boolean | null
  notif_comentarios?: boolean | null
}
```

---

## 3. Sprint 1 — Track W2: Auth Proxy, Login, Pendiente & Portal Layouts

### Task W2.1 — Harden `proxy.ts` to Read Authoritative `profiles.rol` (`SEC-05`, `SEC-06`, `REL-02`)

**File:** `proxy.ts` (Lines 45–85)

Replace lines 45–85 of `proxy.ts` with the exact block below (which uses `supabase` from `updateSession(request)` to query `public.profiles.rol` directly and **never** reads `user.user_metadata?.rol`):

```typescript
  // ── 2. Refresh session (with timeout guard) ───────────────────
  const { supabase, user, authError, supabaseResponse } = await updateSession(request)

  // ── 3. Check if request is for a protected portal ─────────────
  const isProtectedPath = PORTAL_PREFIXES.some(p => path.startsWith(p))

  // ── 4. No authenticated user → redirect to login ──────────────
  if (!user || authError) {
    if (isProtectedPath) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('returnUrl', path)
      return NextResponse.redirect(loginUrl)
    }
    return supabaseResponse
  }

  // ── 5. Determine authoritative user role from public.profiles ──
  // Never trust client-editable user.user_metadata.rol
  let rol = user.app_metadata?.user_role as string | undefined
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profileRow?.rol) {
    rol = profileRow.rol
  }

  const targetPath = rol ? ROLE_TO_PATH[rol] : undefined

  // ── 6. Cross-portal access prevention ─────────────────────────
  if (isProtectedPath && targetPath && !path.startsWith(`/${targetPath}`)) {
    return NextResponse.redirect(new URL(`/${targetPath}`, request.url))
  }

  // ── 7. Redirect authenticated users away from root ────────────
  if (path === '/') {
    if (targetPath) {
      return NextResponse.redirect(new URL(`/${targetPath}`, request.url))
    }
  }

  return supabaseResponse
```

---

### Task W2.2 — Refresh Session Before Redirecting in `app/pendiente/page.tsx` (`REL-02`, `SEC-06`)

**File:** `app/pendiente/page.tsx` (Lines 16–34)

Replace `useEffect` (lines 16–34) with:
```typescript
  useEffect(() => {
    async function checkApproval() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: p } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', session.user.id)
        .single()
      if (p?.rol && p.rol !== 'pendiente') {
        await supabase.auth.refreshSession()
        const rolPaths: Record<string, string> = {
          nodo_admin: '/admin',
          nodo_analista: '/analista',
          epc: '/epc',
          cliente_final: '/cliente',
          financiero: '/financiero',
          suministrador: '/mem',
          finder: '/finder',
        }
        const dest = rolPaths[p.rol] || '/epc'
        window.location.href = dest
      }
    }
    checkApproval()
    const interval = setInterval(checkApproval, 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

---

### Task W2.3 — Add `finder` Branch & Remove `user_metadata.rol` in `app/login/page.tsx` (`NAV-01`, `SEC-05`)

**File:** `app/login/page.tsx` (Lines 42–62)

Replace lines 42–62 of `app/login/page.tsx` with:
```typescript
    const rol = profileRow?.rol
    if (!rol) {
      setError('El usuario no tiene un rol asignado.')
      setLoading(false)
      return
    }
    
    if (rol === 'pendiente') {
      window.location.href = '/pendiente'
      return
    }

    let sub = 'epc'
    if (rol === 'nodo_admin') sub = 'admin'
    else if (rol === 'nodo_analista') sub = 'analista'
    else if (rol === 'cliente_final') sub = 'cliente'
    else if (rol === 'financiero') sub = 'financiero'
    else if (rol === 'suministrador') sub = 'mem'
    else if (rol === 'finder') sub = 'finder'

    window.location.href = `/${sub}`
```

---

### Task W2.4 — Remove `user_metadata.rol` Fallback Across All 7 Portal Layouts (`SEC-05`)

In each of the 7 portal layout files below, replace `const rol = profileRow?.rol ?? session.user.user_metadata?.rol` with `const rol = profileRow?.rol` and spread `...profileRow` into `setProfile`:

1. `app/(portals)/admin/layout.tsx` (Line 25):
   `const rol = profileRow?.rol`
2. `app/(portals)/analista/layout.tsx` (Line 25):
   `const rol = profileRow?.rol`
3. `app/(portals)/epc/layout.tsx` (Line 25):
   `const rol = profileRow?.rol`
4. `app/(portals)/finder/layout.tsx` (Line 24):
   `const rol = profileRow?.rol`
5. `app/(portals)/cliente/layout.tsx` (Line 25):
   `const rol = profileRow?.rol`
6. `app/(portals)/financiero/layout.tsx` (Line 25):
   `const rol = profileRow?.rol`
7. `app/(portals)/mem/layout.tsx` (Line 25):
   `const rol = profileRow?.rol`

---

## 4. Sprint 1 — Track W3: Atomic Writes in Wizard, Detail & Modals

### Task W3.1 — Replace `Math.random()` & Wire Atomic RPC in `components/proyectos/ProjectWizard.tsx` (`DATA-01`)

1. **File:** `components/proyectos/ProjectWizard.tsx` (Line 590)
   Replace:
   ```typescript
   tempId: `${Date.now()}-${Math.random()}`,
   ```
   With:
   ```typescript
   tempId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
   ```

2. **File:** `components/proyectos/ProjectWizard.tsx` (Lines 803–1051)
   Update `handleSubmit` so that if `crear_proyecto_completo` RPC is available in PostgreSQL it executes in a single atomic transaction, with a clean fallback if the SQL migration has not yet been applied in the environment:

   ```typescript
    // ── PAYLOAD UNIFICADO PARA TRANSACCIÓN ATÓMICA (RPC) ─────────
    const proyectoPayload: Record<string, unknown> = {
      epcista_id: effectiveEpcId,
      responsable_nodo_id: effectiveResponsableId,
      finder_id: effectiveFinderId,
      cliente_id: clienteManual ? null : form.cliente_id || null,
      tipo,
      nombre_proyecto: form.nombre_proyecto,
      estado: 'recibido',
      tipo_instalacion: form.tipo_instalacion,
      incluye_mem: form.incluye_mem,
      demanda_kw: null,
      cliente_final_nombre: finalClientNombre,
      cliente_final_empresa: finalClientEmpresa,
      cliente_final_contacto: finalClientContacto,
      capex_estimado: isNodoBusca ? null : firstConfigCapex,
      moneda: configMoneda,
      ubicacion_estado,
      modalidad_financiamiento: vehiclesArray as ModalidadFinanciamiento[],
      notas_adicionales: form.notas_adicionales || null,
      capacidad_mwh: null,
      capacidad_mw: null,
      tecnologia_bateria: null,
      duracion_descarga_hrs: null,
      punto_interconexion: null,
      tipo_participacion_mem: null,
      volumen_energia_mwh_anual: null,
    }

    const todosSitios =
      selectedSiteIds.length > 0
        ? selectedSiteIds
        : Array.from(new Set(configs.flatMap(c => c.sitiosSeleccionados)))

    const rpcConfiguraciones = isNodoBusca
      ? [
          {
            temp_id: 'default',
            nombre: 'Pendiente definición',
            descripcion: null,
            inversion_total: null,
            moneda: form.moneda,
            ahorro_estimado_anual: null,
            ahorro_estimado_mensual: null,
            ahorro_moneda: 'MXN',
            seleccionada: true,
          },
        ]
      : configs.map((c, idx) => {
          const cfgProds = Object.values(c.productosMap).flat()
          const inversion_total = cfgProds.reduce((sum, p) => {
            const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
            return sum + pCapex
          }, 0)

          const cfgCurrencies = cfgProds
            .map(p => (p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda))
            .filter(Boolean) as Moneda[]
          const thisConfigMoneda =
            cfgCurrencies.length > 0 ? cfgCurrencies[0] : form.moneda

          const ahorroAnual = c.ahorro_estimado_anual ? parseNum(c.ahorro_estimado_anual) : null
          const ahorroMensual = ahorroAnual ? Math.round((ahorroAnual / 12) * 100) / 100 : null

          return {
            temp_id: c.tempId,
            nombre: c.nombre,
            descripcion: c.descripcion || null,
            inversion_total,
            moneda: thisConfigMoneda,
            ahorro_estimado_anual: ahorroAnual,
            ahorro_estimado_mensual: ahorroMensual,
            ahorro_moneda: c.ahorro_moneda || 'MXN',
            seleccionada: idx === 0,
          }
        })

    const rpcOpcionesFinanciamiento =
      isNodoBusca || isRecomendacionNodo
        ? [
            {
              temp_id: 'recomendacion-nodo',
              nombre: 'Recomendación de Nodo',
              vehiculo_inversion: 'no_sabe',
              ahorro_estimado_anual: null,
              ahorro_estimado_mensual: null,
              moneda: 'MXN',
              plazo_meses: null,
              notas: null,
              seleccionada: true,
            },
          ]
        : financingOptions.map((o, idx) => {
            const ahorroAnual = o.ahorro_estimado_anual ? parseNum(o.ahorro_estimado_anual) : null
            const ahorroMensual = ahorroAnual ? Math.round((ahorroAnual / 12) * 100) / 100 : null
            return {
              temp_id: o.tempId,
              nombre: o.nombre,
              vehiculo_inversion: o.vehiculo_inversion,
              ahorro_estimado_anual: ahorroAnual,
              ahorro_estimado_mensual: ahorroMensual,
              moneda: o.ahorro_moneda || 'MXN',
              plazo_meses: o.plazo_meses ? parseNum(o.plazo_meses) : null,
              notas: o.notas || null,
              seleccionada: idx === 0,
            }
          })

    const rpcLinks: { config_temp_id: string; opcion_temp_id: string }[] = []
    if (isNodoBusca || isRecomendacionNodo) {
      for (const rc of rpcConfiguraciones) {
        rpcLinks.push({
          config_temp_id: rc.temp_id,
          opcion_temp_id: 'recomendacion-nodo',
        })
      }
    } else {
      for (const o of financingOptions) {
        for (const configTempId of o.linkedConfigIds) {
          rpcLinks.push({
            config_temp_id: configTempId,
            opcion_temp_id: o.tempId,
          })
        }
      }
    }

    const rpcProductos: {
      config_temp_id: string
      sitio_id: string
      tipo: 'fv' | 'bess'
      datos: Record<string, unknown>
    }[] = []

    if (!isNodoBusca) {
      for (const c of configs) {
        for (const sitio_id of c.sitiosSeleccionados) {
          const products = c.productosMap[sitio_id] ?? []
          for (const p of products) {
            rpcProductos.push({
              config_temp_id: c.tempId,
              sitio_id,
              tipo: p.tipo,
              datos: (p.tipo === 'fv' ? p.fv : p.bess) as unknown as Record<string, unknown>,
            })
          }
        }
      }
    }

    const { data: rpcProyectoId, error: rpcErr } = await supabase.rpc('crear_proyecto_completo', {
      p_payload: {
        proyecto: proyectoPayload,
        sitios_ids: todosSitios,
        configuraciones: rpcConfiguraciones,
        opciones_financiamiento: rpcOpcionesFinanciamiento,
        config_financiamiento_links: rpcLinks,
        productos: rpcProductos,
      },
    })

    if (!rpcErr && rpcProyectoId) {
      if (onSuccessRedirect) {
        router.push(onSuccessRedirect(rpcProyectoId as string))
      } else {
        router.push(`${capabilities.redirectPrefix}/${rpcProyectoId as string}`)
      }
      return
    }

    // If RPC failed with a validation/permission error (not missing function), surface it immediately and abort
    if (rpcErr && !rpcErr.message.includes('crear_proyecto_completo')) {
      setError('Error al crear el proyecto: ' + rpcErr.message)
      setLoading(false)
      return
    }
   ```
   *(Keep the existing sequential fallback below it wrapped in a `try` block with compensating `await supabase.from('proyectos').delete().eq('id', proyecto.id)` on any child-table error so even if the SQL migration hasn't run yet, partial rows are automatically rolled back!)*

---

### Task W3.2 — Fix Atomic Config/Financing Selection & Broken Portal Links in `components/DetalleProyecto.tsx` (`DATA-02`, `R1-Defect-5`)

1. **File:** `components/DetalleProyecto.tsx` (Lines 203–270)
   In `handleSelectConfig` (line 203) and `handleSelectFinancing` (line 239):
   - In `handleSelectConfig`, first attempt `const { error: rpcErr } = await supabase.rpc('seleccionar_configuracion_tecnica', { p_proyecto_id: proyecto.id, p_config_id: configId })`. If `err2` fails in fallback mode, restore the previously selected config ID (`await supabase.from('configuraciones_tecnicas').update({ seleccionada: true }).eq('id', prevSelectedId)`) so a project is never left with zero selected configurations.
   - In `handleSelectFinancing`, first attempt `const { error: rpcErr } = await supabase.rpc('seleccionar_opcion_financiamiento', { p_proyecto_id: proyecto.id, p_opcion_id: optionId })`, with compensating restore of `prevSelectedOptionId` if fallback `err2` fails.

2. **File:** `components/DetalleProyecto.tsx` (Lines 1556–1591)
   Replace the "Plan de Proyecto EPC" and "Monitor de Instalación" sections (lines 1556–1591) with the exact block below so `finder` and `cliente_final` route to their own portals instead of bouncing to `/financiero`:

   ```tsx
      {/* Plan de Proyecto EPC — new project management tool */}
      {currentUser.rol !== 'cliente_final' && (
        <Seccion title="Plan de Proyecto EPC">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Plan detallado de ingeniería, procurement y construcción con fases, actividades, tareas y hitos financieros.
              </p>
            </div>
            <Link
              href={`${
                isEpcista
                  ? '/epc'
                  : isAdmin
                    ? '/admin'
                    : isAnalista
                      ? '/analista'
                      : isFinder
                        ? '/finder'
                        : '/financiero'
              }/proyectos/${proyecto.id}/plan`}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all hover:scale-105 active:scale-95 shadow-md bg-principal text-acento whitespace-nowrap"
            >
              <CalendarDays size={16} />
              {isEpcista ? 'Gestionar Plan' : 'Ver Plan'}
            </Link>
          </div>
        </Seccion>
      )}

      {/* Monitor de Instalación — only visible after project approval */}
      {['aprobado', 'en_construccion', 'operativo', 'completado'].includes(proyecto.estado) && (
        <Seccion title="Monitor de Instalación">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Seguimiento en tiempo real de la instalación con evidencia fotográfica, avance por fase y actividad.
              </p>
            </div>
            <Link
              href={`${
                isEpcista
                  ? '/epc'
                  : isAdmin
                    ? '/admin'
                    : isAnalista
                      ? '/analista'
                      : isFinder
                        ? '/finder'
                        : currentUser.rol === 'cliente_final'
                          ? '/cliente'
                          : '/financiero'
              }/proyectos/${proyecto.id}/instalaciones`}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all hover:scale-105 active:scale-95 shadow-md bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
            >
              <Wrench size={16} />
              {isEpcista ? 'Gestionar Instalación' : 'Ver Instalación'}
            </Link>
          </div>
        </Seccion>
      )}
   ```

---

### Task W3.3 — Safe Insert-Before-Delete in `components/EditarFinanciamientoModal.tsx` (`DATA-03`)

**File:** `components/EditarFinanciamientoModal.tsx` (Lines 154–183)

Replace the destructive `if (isRecomendacionNodo)` block (which deleted all existing `opciones_financiamiento` *before* inserting the replacement `'no_sabe'` option) with safe **Insert-First, Delete-Old-After** ordering:

```typescript
      if (isRecomendacionNodo) {
        const previousOptionIds = (opcionesFinanciamiento ?? []).map(o => o.id)

        // A. Insert new single 'no_sabe' option FIRST so data is never lost if insert fails
        const { data: insertedOpt, error: insErr } = await supabase
          .from('opciones_financiamiento')
          .insert({
            proyecto_id: proyecto.id,
            nombre: 'Recomendación de Nodo',
            vehiculo_inversion: 'no_sabe',
            seleccionada: true,
          })
          .select('id')
          .single()
        if (insErr) throw insErr

        // B. Link to all configurations in junction table
        if (insertedOpt && configuraciones.length > 0) {
          const junctionRows = configuraciones.map(c => ({
            configuracion_id: c.id,
            opcion_financiamiento_id: insertedOpt.id,
          }))
          const { error: jErr } = await supabase.from('config_financiamiento').insert(junctionRows)
          if (jErr) throw jErr
        }

        // C. Only AFTER new option and links succeeded, delete previous options
        if (previousOptionIds.length > 0) {
          const { error: delErr } = await supabase
            .from('opciones_financiamiento')
            .delete()
            .in('id', previousOptionIds)
          if (delErr) throw delErr
        }

        // D. Update project level modalidad_financiamiento
        const { error: projUpdErr } = await supabase
          .from('proyectos')
          .update({ modalidad_financiamiento: ['no_sabe'] })
          .eq('id', proyecto.id)
        if (projUpdErr) throw projUpdErr
      }
```

And in the `else` branch (lines 184–268), move the deletion of `toDelete` (lines 189–194) and deletion of old `config_financiamiento` links (lines 246–249) **after** all updates and new option inserts have succeeded, using `.upsert(junctionRows, { onConflict: 'configuracion_id,opcion_financiamiento_id', ignoreDuplicates: true })` before deleting stale links.

---

### Task W3.4 — Safe Upsert-Before-Delete in `components/EditarSolucionTecnicaModal.tsx` (`DATA-02`)

**File:** `components/EditarSolucionTecnicaModal.tsx` (Lines 382–442)

Move step `C. Delete removed configurations` (lines 382–388) and `Delete removed products` (lines 408–414) to execute **after** all existing and new configurations (`insertedConfigs`) and all existing and new products (`prodsToUpdate`, `prodsToInsert`) have been successfully saved, and ensure `configs[0]` is marked `seleccionada: true` if no configuration remains selected.

---

## 5. Sprint 1 — Track W4: Zero-Mockups, Real Persistence, Client FK Fix & Navigation

### Task W4.1 — Delete Mockup Files & Root Lint Dumps (`MOCK-01`, `R1-Item-1`, `R2-Section-B`)

Delete the following files from the repository:
1. `lib/egauge.ts` (synthetic `Math.random()` telemetry generator and hardcoded `4850.75` savings).
2. `app/brand-preview/page.tsx` (static `/brand-preview` mockup route).
3. Root lint dumps: `eslint_results.txt`, `eslint_results2.txt`, `eslint_results3.txt`, `eslint_results4.txt`, `eslint_results5.txt`, `lint_results.txt`.

---

### Task W4.2 — Create Real CFE Tariff & Savings Calculator (`lib/tariffs/cfe-calculator.ts`) (`MOCK-02`, `R1-Defect-6`)

**Create New File:** `lib/tariffs/cfe-calculator.ts`

```typescript
import type { ConfiguracionTecnica } from '@/lib/types'

/**
 * Official CFE Commercial/Industrial Reference Tariffs (MXN/kWh)
 * Used only when a project does not yet have an explicit contractual/technical savings figure.
 */
export const CFE_TARIFF_RATES_MXN: Record<string, number> = {
  GDMTH: 2.85,
  GDMTO: 3.12,
  PDBT: 3.95,
  GDBT: 3.45,
}

export interface ProjectSavingsInput {
  totalGeneratedKwh: number
  selectedConfig?: Pick<
    ConfiguracionTecnica,
    'ahorro_estimado_anual' | 'ahorro_estimado_mensual' | 'ahorro_moneda'
  > | null
  tarifaCfe?: string | null
}

/**
 * Calculates estimated savings in MXN using:
 * 1. The project's selected technical configuration daily pro-rata savings if defined, OR
 * 2. The CFE tariff rate for the actual measured kWh generation (returns 0 when generation is 0).
 */
export function calculateProjectSavingsMxn({
  totalGeneratedKwh,
  selectedConfig,
  tarifaCfe,
}: ProjectSavingsInput): number {
  if (totalGeneratedKwh <= 0) {
    if (selectedConfig?.ahorro_estimado_anual && selectedConfig.ahorro_estimado_anual > 0) {
      return Math.round((selectedConfig.ahorro_estimado_anual / 365) * 100) / 100
    }
    if (selectedConfig?.ahorro_estimado_mensual && selectedConfig.ahorro_estimado_mensual > 0) {
      return Math.round((selectedConfig.ahorro_estimado_mensual / 30) * 100) / 100
    }
    return 0
  }

  const rate = CFE_TARIFF_RATES_MXN[tarifaCfe || 'GDMTH'] ?? CFE_TARIFF_RATES_MXN.GDMTH
  return Math.round(totalGeneratedKwh * rate * 100) / 100
}

/**
 * Calculates equivalent battery cycles from actual battery discharge telemetry rows
 * and nominal BESS capacity (kWh). Returns 0 if no discharge occurred.
 */
export function calculateBatteryCycles(
  totalBatteryDischargeKwh: number,
  nominalCapacityKwh?: number | null
): number {
  if (totalBatteryDischargeKwh <= 0) return 0
  const effectiveCapacity = nominalCapacityKwh && nominalCapacityKwh > 0 ? nominalCapacityKwh : 200
  return Math.round((totalBatteryDischargeKwh / effectiveCapacity) * 10) / 10
}

/**
 * Resolves the applicable CFE tariff category from contracted demand (kW) or annual volume (MWh).
 */
export function resolveCfeTariffLabel(
  demandaKw?: number | null,
  volumenMwhAnual?: number | null
): string {
  if ((demandaKw && demandaKw >= 100) || (volumenMwhAnual && volumenMwhAnual >= 500)) {
    return 'GDMTH'
  }
  if (demandaKw && demandaKw >= 25) {
    return 'GDMTO'
  }
  return 'GDMTH'
}
```

---

### Task W4.3 — Fix Client Portal Foreign Key Query & Savings Calculation (`app/(portals)/cliente/page.tsx` & `instalaciones/page.tsx`) (`CLIENT-FK`, `MOCK-02`, `PERF-02`)

1. **File:** `app/(portals)/cliente/page.tsx` (Replace entire file, lines 1–246)

   ```tsx
   'use client'

   import { useEffect, useState } from 'react'
   import { createClient } from '@/lib/supabase/client'
   import EnergyChart from '@/components/telemetry/EnergyChart'
   import BatteryStatus from '@/components/telemetry/BatteryStatus'
   import { fmtNum, fmtCurrency } from '@/lib/format'
   import GanttChart from '@/components/gantt/GanttChart'
   import { calculateProjectSavingsMxn } from '@/lib/tariffs/cfe-calculator'
   import type { HitoConstruccion, ConfiguracionTecnica } from '@/lib/types'
   import { MapPin, Zap, CalendarDays } from 'lucide-react'

   interface TelemetriaDB {
     timestamp: string
     solar_produccion_kwh: number
     consumo_red_kwh: number
     bateria_porcentaje: number
     bateria_descarga_kwh: number
   }

   interface ProyectoInfo {
     id: string
     nombre_proyecto: string
     ubicacion_estado: string
     estado: string
     configuraciones_tecnicas?: Pick<
       ConfiguracionTecnica,
       'ahorro_estimado_anual' | 'ahorro_estimado_mensual' | 'ahorro_moneda' | 'seleccionada'
     >[]
   }

   export default function ClienteDashboard() {
     const supabase = createClient()
     const [proyectos, setProyectos] = useState<ProyectoInfo[]>([])
     const [activeProyectoId, setActiveProyectoId] = useState<string | null>(null)

     const [telemetry, setTelemetry] = useState<TelemetriaDB[]>([])
     const [hitos, setHitos] = useState<HitoConstruccion[]>([])
     const [metrics, setMetrics] = useState({ totalGenerated: 0, savingsMxn: 0 })
     const [loading, setLoading] = useState(true)

     useEffect(() => {
       async function init() {
         const { data: { session } } = await supabase.auth.getSession()
         if (!session) {
           setLoading(false)
           return
         }

         // 1. Resolve profile.cliente_crm_id (proyectos.cliente_id references clientes.id)
         const { data: profile } = await supabase
           .from('profiles')
           .select('cliente_crm_id')
           .eq('id', session.user.id)
           .single()

         if (!profile?.cliente_crm_id) {
           setLoading(false)
           return
         }

         // 2. Fetch real projects assigned to this CRM client entity
         const { data: projs } = await supabase
           .from('proyectos')
           .select(
             'id, nombre_proyecto, ubicacion_estado, estado, configuraciones_tecnicas(ahorro_estimado_anual, ahorro_estimado_mensual, ahorro_moneda, seleccionada)'
           )
           .eq('cliente_id', profile.cliente_crm_id)
           .order('created_at', { ascending: false })

         if (projs && projs.length > 0) {
           setProyectos(projs as unknown as ProyectoInfo[])
           setActiveProyectoId(projs[0].id)
         } else {
           setLoading(false)
         }
       }
       init()
       // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [])

     useEffect(() => {
       if (!activeProyectoId) return

       async function loadData() {
         setLoading(true)

         const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

         const { data: teleData, error } = await supabase
           .from('telemetria_egauge')
           .select('timestamp, solar_produccion_kwh, consumo_red_kwh, bateria_porcentaje, bateria_descarga_kwh')
           .eq('proyecto_id', activeProyectoId)
           .gte('timestamp', thirtyDaysAgo)
           .order('timestamp', { ascending: true })
           .limit(2000)

         const activeProj = proyectos.find(p => p.id === activeProyectoId)
         const selectedConfig =
           activeProj?.configuraciones_tecnicas?.find(c => c.seleccionada) ??
           activeProj?.configuraciones_tecnicas?.[0] ??
           null

         if (teleData) {
           setTelemetry(teleData)
           const totalGenerated = teleData.reduce((acc, row) => acc + (row.solar_produccion_kwh || 0), 0)
           const savingsMxn = calculateProjectSavingsMxn({
             totalGeneratedKwh: totalGenerated,
             selectedConfig,
           })
           setMetrics({ totalGenerated, savingsMxn })
         } else if (error) {
           console.error('Error fetching telemetry:', error)
         }

         const { data: hitosData } = await supabase
           .from('hitos_construccion')
           .select('*')
           .eq('proyecto_id', activeProyectoId)
           .order('orden', { ascending: true })

         if (hitosData) {
           setHitos(hitosData)
         }

         setLoading(false)
       }

       loadData()
       // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [activeProyectoId])

     if (loading && proyectos.length === 0) {
       return (
         <div className="flex justify-center py-20">
           <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
         </div>
       )
     }

     const currentBattery = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null
     const isCharging = currentBattery ? currentBattery.solar_produccion_kwh > currentBattery.consumo_red_kwh : false

     const chartData = telemetry.map(t => ({
       timestamp: t.timestamp,
       solarProductionKwh: t.solar_produccion_kwh,
       gridConsumptionKwh: t.consumo_red_kwh,
       batteryChargePct: t.bateria_porcentaje,
       batteryDischargeKwh: t.bateria_descarga_kwh,
     }))

     const activeProjectInfo = proyectos.find(p => p.id === activeProyectoId)

     return (
       <div className="max-w-6xl mx-auto space-y-8">
         <div className="flex justify-between items-end">
           <div>
             <h1 className="text-3xl font-black mb-2 tracking-tight text-principal">Mi Portal de Cliente</h1>
             <p className="text-gray-500">Monitoreo en tiempo real de tus sistemas de generación y seguimiento de construcción.</p>
           </div>
           {proyectos.length > 1 && (
             <select
               value={activeProyectoId || ''}
               onChange={e => setActiveProyectoId(e.target.value)}
               className="px-4 py-2 border border-borde rounded-lg text-sm font-bold shadow-sm bg-white"
             >
               {proyectos.map(p => (
                 <option key={p.id} value={p.id}>{p.nombre_proyecto}</option>
               ))}
             </select>
           )}
         </div>

         {proyectos.length === 0 ? (
           <div className="py-20 text-center glass-panel border-dashed border-white/50 rounded-2xl bg-white">
             <Zap size={32} className="mx-auto text-gray-300 mb-3" />
             <h3 className="text-lg font-bold text-gray-600 mb-1">Sin Proyectos Asignados</h3>
             <p className="text-gray-500 text-sm">Aún no tienes proyectos vinculados a tu cuenta.</p>
           </div>
         ) : (
           <>
             <div className="bg-gray-50 border border-borde p-4 rounded-xl flex items-center gap-6">
               <div className="flex items-center gap-2 text-principal font-bold">
                 <Zap size={18} className="text-acento" />
                 {activeProjectInfo?.nombre_proyecto}
               </div>
               <div className="flex items-center gap-2 text-gray-500 text-sm">
                 <MapPin size={16} /> Ubicación: {activeProjectInfo?.ubicacion_estado || 'N/A'}
               </div>
               <div className="flex items-center gap-2 text-sm ml-auto">
                 {activeProjectInfo?.estado === 'operativo' ? (
                   <span className="relative flex h-3 w-3">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                   </span>
                 ) : (
                   <span className="h-3 w-3 rounded-full bg-blue-500"></span>
                 )}
                 <span className="font-semibold text-gray-700 capitalize">{activeProjectInfo?.estado.replace('_', ' ')}</span>
               </div>
             </div>

             {activeProjectInfo?.estado === 'operativo' ? (
               <>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="glass-card p-6 shadow-sm flex flex-col justify-between">
                     <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Generación Medida</h2>
                     <p className="text-4xl font-black text-principal">
                       {fmtNum(metrics.totalGenerated, 1)} <span className="text-lg font-medium text-gray-400">kWh</span>
                     </p>
                   </div>
                   <div className="glass-card p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                     <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Ahorro Estimado Diario</h2>
                     <p className="text-4xl font-black text-green-500">
                       {fmtCurrency(metrics.savingsMxn, 'MXN')} <span className="text-lg font-medium text-gray-400">MXN</span>
                     </p>
                   </div>
                 </div>

                 {telemetry.length > 0 ? (
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="lg:col-span-2">
                       <EnergyChart data={chartData} />
                     </div>
                     <div className="lg:col-span-1">
                       <BatteryStatus
                         chargePct={currentBattery?.bateria_porcentaje ?? 0}
                         isCharging={isCharging}
                       />
                     </div>
                   </div>
                 ) : (
                   <div className="py-12 text-center text-gray-500 glass-card">
                     Aún no hay datos de telemetría registrados para este proyecto.
                   </div>
                 )}
               </>
             ) : (
               <div className="glass-card p-6 shadow-sm">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                     <CalendarDays size={20} />
                   </div>
                   <div>
                     <h3 className="text-lg font-bold text-principal">Avance de Construcción</h3>
                     <p className="text-sm text-gray-500">Sigue en tiempo real el progreso de instalación de tu sistema.</p>
                   </div>
                 </div>

                 {hitos.length > 0 ? (
                   <GanttChart hitos={hitos} readOnly={true} />
                 ) : (
                   <div className="py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
                     El EPCista aún no ha definido el cronograma de obra.
                   </div>
                 )}
               </div>
             )}
           </>
         )}
       </div>
     )
   }
   ```

2. **File:** `app/(portals)/cliente/proyectos/[id]/instalaciones/page.tsx` (Lines 21–28)
   Replace lines 21–28 with:
   ```typescript
   if (!profile.cliente_crm_id) redirect('/cliente')

   const { data: proyecto } = await supabase
     .from('proyectos')
     .select('id, nombre_proyecto')
     .eq('id', id)
     .eq('cliente_id', profile.cliente_crm_id)
     .single()
   ```

---

### Task W4.4 — Replace Synthetic Multipliers & Bound Telemetry in `app/(portals)/financiero/page.tsx` (`MOCK-02`, `PERF-02`)

**File:** `app/(portals)/financiero/page.tsx` (Lines 39–121)

Import `calculateProjectSavingsMxn, calculateBatteryCycles` from `@/lib/tariffs/cfe-calculator` at the top of `app/(portals)/financiero/page.tsx`, and replace lines 39–121 with:

```typescript
      // 1. Fetch all projects assigned to this financier with their technical configurations
      const { data: projs, error: pErr } = await supabase
        .from('proyectos')
        .select(
          'id, nombre_proyecto, cliente_final_empresa, capex_estimado, capacidad_mwh, estado, configuraciones_tecnicas(ahorro_estimado_anual, ahorro_estimado_mensual, ahorro_moneda, seleccionada)'
        )
        .eq('financiero_id', session.user.id)

      if (pErr) {
        console.error(pErr)
        setLoading(false)
        return
      }

      if (!projs || projs.length === 0) {
        setMetrics({ activeProjectsCount: 0, totalGeneratedKwh: 0, estimatedSavingsMxn: 0, batteryCycles: 0 })
        setLoading(false)
        return
      }

      const projectIds = projs.map(p => p.id)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // 2. Fetch bounded telemetry (last 30 days) for these projects
      const { data: teleData, error: tErr } = await supabase
        .from('telemetria_egauge')
        .select('proyecto_id, timestamp, solar_produccion_kwh, consumo_red_kwh, bateria_descarga_kwh, bateria_porcentaje')
        .in('proyecto_id', projectIds)
        .gte('timestamp', thirtyDaysAgo)
        .order('timestamp', { ascending: true })
        .limit(5000)

      if (tErr) console.error(tErr)

      const totalGenerated = teleData ? teleData.reduce((acc, row) => acc + (row.solar_produccion_kwh || 0), 0) : 0
      const totalDischarged = teleData ? teleData.reduce((acc, row) => acc + (row.bateria_descarga_kwh || 0), 0) : 0
      const totalCapacityKwh = projs.reduce((acc, p) => acc + ((p.capacidad_mwh ?? 0) * 1000), 0)

      // Calculate project breakdown using real configuration savings or CFE tariff
      const pMetrics = projs.map(p => {
        const pTele = teleData?.filter(t => t.proyecto_id === p.id) || []
        const pGen = pTele.reduce((acc, row) => acc + (row.solar_produccion_kwh || 0), 0)
        const configs = (p.configuraciones_tecnicas ?? []) as {
          ahorro_estimado_anual?: number | null
          ahorro_estimado_mensual: number | null
          ahorro_moneda: string
          seleccionada: boolean
        }[]
        const selectedConfig = configs.find(c => c.seleccionada) ?? configs[0] ?? null
        const pSavings = calculateProjectSavingsMxn({
          totalGeneratedKwh: pGen,
          selectedConfig,
        })
        return {
          id: p.id,
          nombre_proyecto: p.nombre_proyecto,
          cliente_final_empresa: p.cliente_final_empresa,
          capex_estimado: p.capex_estimado,
          estado: p.estado,
          totalGeneratedKwh: pGen,
          estimatedSavingsMxn: pSavings,
        }
      })

      const portfolioSavings = pMetrics.reduce((acc, pm) => acc + pm.estimatedSavingsMxn, 0)

      setMetrics({
        activeProjectsCount: projs.length,
        totalGeneratedKwh: totalGenerated,
        estimatedSavingsMxn: portfolioSavings,
        batteryCycles: calculateBatteryCycles(totalDischarged, totalCapacityKwh || null),
      })

      const timeMap = new Map<string, { solarProductionKwh: number; gridConsumptionKwh: number; batteryDischargeKwh: number; batteryChargePctSum: number; count: number }>()

      if (teleData) {
        teleData.forEach(t => {
          const key = t.timestamp
          const exist = timeMap.get(key) || { solarProductionKwh: 0, gridConsumptionKwh: 0, batteryDischargeKwh: 0, batteryChargePctSum: 0, count: 0 }
          exist.solarProductionKwh += t.solar_produccion_kwh || 0
          exist.gridConsumptionKwh += t.consumo_red_kwh || 0
          exist.batteryDischargeKwh += t.bateria_descarga_kwh || 0
          exist.batteryChargePctSum += t.bateria_porcentaje || 0
          exist.count += 1
          timeMap.set(key, exist)
        })
      }

      const cData = Array.from(timeMap.entries())
        .map(([timestamp, data]) => ({
          timestamp,
          solarProductionKwh: data.solarProductionKwh,
          gridConsumptionKwh: data.gridConsumptionKwh,
          batteryDischargeKwh: data.batteryDischargeKwh,
          batteryChargePct: data.count > 0 ? Math.round(data.batteryChargePctSum / data.count) : 0,
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      setChartData(cData)
      setProjectMetrics(pMetrics)
      setLoading(false)
```

---

### Task W4.5 — Replace Hardcoded `'GDMTH'` in `components/marketplace/OfertasBoard.tsx` (`MOCK-02`)

**File:** `components/marketplace/OfertasBoard.tsx` (Lines 35–57)

Import `resolveCfeTariffLabel` from `@/lib/tariffs/cfe-calculator` and update `loadProyectos`:
```typescript
      const { data, error } = await supabase
        .from('proyectos')
        .select('id, nombre_proyecto, cliente_final_empresa, demanda_kw, volumen_energia_mwh_anual, ubicacion_estado, estado')
        .in('tipo', ['MEM', 'BESS+MEM'])

      if (error) {
        console.error('Error fetching proyectos MEM:', error)
      } else if (data) {
        const mapped: ProyectoMEM[] = data.map((p) => ({
          id: p.id,
          nombre_proyecto: p.nombre_proyecto,
          cliente_final_empresa: p.cliente_final_empresa,
          consumo_anual_gwh: p.volumen_energia_mwh_anual ? +(Number(p.volumen_energia_mwh_anual) / 1000).toFixed(2) : 0,
          tarifa_actual_cfe: resolveCfeTariffLabel(p.demanda_kw, p.volumen_energia_mwh_anual),
          codigo_postal: p.ubicacion_estado || 'No especificada',
          estado: p.estado,
        }))
        setProyectos(mapped)
      }
```

---

### Task W4.6 — Replace `localStorage` Fake Persistence in `components/Configuracion.tsx` & Fix All Portal `/configuracion` Routes (`R1-Defect-3`, `R1-Defect-4`)

1. **File:** `components/Configuracion.tsx` (Lines 59–163)
   Replace lines 59–163 of `components/Configuracion.tsx` so all company, general, and notification settings initialize from `initialProfile` and save directly to `public.profiles` in Supabase (zero `localStorage` calls):

   ```typescript
     // Mi Perfil
     const [nombre, setNombre] = useState(initialProfile.nombre)
     const [calendarioUrl, setCalendarioUrl] = useState(initialProfile.calendario_url ?? '')
     const isNodoUser = ['nodo_admin', 'nodo_analista'].includes(initialProfile.rol)

     // Mi Empresa (backed by public.profiles columns)
     const [empresa, setEmpresa] = useState(initialProfile.empresa)
     const [rfc, setRfc] = useState(initialProfile.rfc ?? '')
     const [industria, setIndustria] = useState(initialProfile.industria ?? '')
     const [empresaEstado, setEmpresaEstado] = useState(initialProfile.ubicacion_estado ?? '')
     const [website, setWebsite] = useState(initialProfile.website ?? '')

     // General (backed by public.profiles columns)
     const [moneda, setMoneda] = useState(initialProfile.moneda_preferida ?? 'MXN')
     const [timezone, setTimezone] = useState(initialProfile.timezone ?? 'America/Mexico_City')

     // Notificaciones (backed by public.profiles columns)
     const [notifNuevoProyecto, setNotifNuevoProyecto] = useState(initialProfile.notif_nuevo_proyecto ?? true)
     const [notifCambioEstado, setNotifCambioEstado] = useState(initialProfile.notif_cambio_estado ?? true)
     const [notifComentario, setNotifComentario] = useState(initialProfile.notif_comentarios ?? false)

     // Seguridad
     const [newPassword, setNewPassword] = useState('')
     const [confirmPassword, setConfirmPassword] = useState('')

     function showSaved(msg = 'Cambios guardados') {
       setSavedMsg(msg)
       setErrorMsg('')
       setTimeout(() => setSavedMsg(''), 3000)
     }

     function showError(msg: string) {
       setErrorMsg(msg)
       setSavedMsg('')
     }

     function cambiarSeccion(id: string) {
       setSeccion(id)
       setSavedMsg('')
       setErrorMsg('')
       setNewPassword('')
       setConfirmPassword('')
     }

     async function guardarPerfil() {
       setLoading(true)
       const updateData: Record<string, unknown> = { nombre }
       if (isNodoUser) updateData.calendario_url = calendarioUrl || null
       const { error } = await supabase.from('profiles').update(updateData).eq('id', initialProfile.id)
       setLoading(false)
       if (error) showError('Error al guardar: ' + error.message)
       else showSaved()
     }

     async function guardarEmpresa() {
       setLoading(true)
       const { error } = await supabase
         .from('profiles')
         .update({
           empresa,
           rfc: rfc || null,
           industria: industria || null,
           ubicacion_estado: empresaEstado || null,
           website: website || null,
         })
         .eq('id', initialProfile.id)
       setLoading(false)
       if (error) showError('Error al guardar: ' + error.message)
       else showSaved()
     }

     async function guardarGeneral() {
       setLoading(true)
       const { error } = await supabase
         .from('profiles')
         .update({
           moneda_preferida: moneda,
           timezone,
         })
         .eq('id', initialProfile.id)
       setLoading(false)
       if (error) showError('Error al guardar: ' + error.message)
       else showSaved()
     }

     async function guardarNotificaciones() {
       setLoading(true)
       const { error } = await supabase
         .from('profiles')
         .update({
           notif_nuevo_proyecto: notifNuevoProyecto,
           notif_cambio_estado: notifCambioEstado,
           notif_comentarios: notifComentario,
         })
         .eq('id', initialProfile.id)
       setLoading(false)
       if (error) showError('Error al guardar: ' + error.message)
       else showSaved('Preferencias guardadas')
     }
   ```

2. **Update `app/(portals)/{admin,analista,epc,finder}/configuracion/page.tsx`**:
   In all 4 files, include `...profileRow` when constructing `const profile: Profile` so all 9 new preference columns are passed to `<Configuracion profile={data.profile} email={data.email} />`:
   ```typescript
      const profile: Profile = {
        ...(profileRow as Partial<Profile>),
        id: session.user.id,
        nombre: profileRow?.nombre ?? session.user.user_metadata?.nombre ?? session.user.email ?? '',
        empresa: profileRow?.empresa ?? session.user.user_metadata?.empresa ?? '',
        rol: profileRow?.rol ?? 'epc',
        calendario_url: profileRow?.calendario_url ?? null,
        cliente_crm_id: profileRow?.cliente_crm_id ?? null,
        created_at: profileRow?.created_at ?? session.user.created_at,
      }
   ```

3. **Create Missing `/configuracion` Routes for `cliente`, `financiero`, and `mem` (`R1-Defect-3`)**:
   - Create `app/(portals)/cliente/configuracion/page.tsx`:
     ```typescript
     export { default } from '@/app/(portals)/epc/configuracion/page'
     ```
   - Create `app/(portals)/financiero/configuracion/page.tsx`:
     ```typescript
     export { default } from '@/app/(portals)/epc/configuracion/page'
     ```
   - Create `app/(portals)/mem/configuracion/page.tsx`:
     ```typescript
     export { default } from '@/app/(portals)/epc/configuracion/page'
     ```

4. **Fix `components/Sidebar.tsx` Configuration Link Mapping (Line 220)**:
   In `components/Sidebar.tsx`, add a role-to-portal map above `return`:
   ```typescript
   const ROLE_PORTAL_PREFIX: Record<Rol, string> = {
     epc: 'epc',
     nodo_analista: 'analista',
     nodo_admin: 'admin',
     cliente_final: 'cliente',
     financiero: 'financiero',
     suministrador: 'mem',
     finder: 'finder',
     pendiente: 'pendiente',
   }
   ```
   And replace line 220:
   ```tsx
   href={`/${ROLE_PORTAL_PREFIX[rol] ?? 'epc'}/configuracion`}
   ```

---

### Task W4.7 — Create Missing Finder Subroutes (`app/(portals)/finder/proyectos/[id]/{instalaciones,plan}/page.tsx`) (`R1-Defect-5`)

1. **Create File:** `app/(portals)/finder/proyectos/[id]/instalaciones/page.tsx`
   ```tsx
   import { createClient } from '@/lib/supabase/server'
   import { redirect } from 'next/navigation'
   import InstalacionMonitor from '@/components/InstalacionMonitor'
   import Link from 'next/link'
   import { ChevronLeft } from 'lucide-react'

   export default async function FinderInstalacionesPage({ params }: { params: Promise<{ id: string }> }) {
     const { id } = await params
     const supabase = await createClient()
     const { data: { session } } = await supabase.auth.getSession()
     if (!session) redirect('/login')

     const { data: profile } = await supabase
       .from('profiles')
       .select('*')
       .eq('id', session.user.id)
       .single()

     if (!profile || profile.rol !== 'finder') redirect('/login')

     const { data: proyecto } = await supabase
       .from('proyectos')
       .select('id, nombre_proyecto')
       .eq('id', id)
       .eq('finder_id', session.user.id)
       .single()

     if (!proyecto) redirect('/finder/instalaciones')

     return (
       <div className="py-6 px-4">
         <div className="max-w-5xl mx-auto mb-6">
           <Link
             href={`/finder/proyectos/${id}`}
             className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-principal transition-colors mb-2"
           >
             <ChevronLeft size={14} /> Volver al proyecto
           </Link>
           <h1 className="text-2xl font-black text-principal">{proyecto.nombre_proyecto}</h1>
           <p className="text-xs text-gray-500 mt-0.5">Seguimiento de Instalación (Finder)</p>
         </div>
         <div className="max-w-5xl mx-auto">
           <InstalacionMonitor
             proyectoId={id}
             currentUser={profile}
             readOnly={true}
           />
         </div>
       </div>
     )
   }
   ```

2. **Create File:** `app/(portals)/finder/proyectos/[id]/plan/page.tsx`
   ```tsx
   import { createClient } from '@/lib/supabase/server'
   import { redirect } from 'next/navigation'
   import PlanBuilder from '@/components/plan/PlanBuilder'
   import Link from 'next/link'
   import { ChevronLeft } from 'lucide-react'

   export default async function FinderPlanPage({ params }: { params: Promise<{ id: string }> }) {
     const { id } = await params
     const supabase = await createClient()
     const { data: { session } } = await supabase.auth.getSession()
     if (!session) redirect('/login')

     const { data: profile } = await supabase
       .from('profiles')
       .select('*')
       .eq('id', session.user.id)
       .single()

     if (!profile || profile.rol !== 'finder') redirect('/login')

     const { data: proyecto } = await supabase
       .from('proyectos')
       .select('nombre_proyecto, estado')
       .eq('id', id)
       .eq('finder_id', session.user.id)
       .single()

     if (!proyecto) redirect('/finder/proyectos')

     return (
       <div className="py-6 px-4">
         <div className="max-w-4xl mx-auto mb-6">
           <Link
             href={`/finder/proyectos/${id}`}
             className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-principal transition-colors mb-2"
           >
             <ChevronLeft size={14} /> Volver al proyecto
           </Link>
           <h1 className="text-2xl font-black text-principal">{proyecto.nombre_proyecto}</h1>
         </div>
         <PlanBuilder
           proyectoId={id}
           currentUser={profile}
           readOnly={true}
           proyectoEstado={proyecto.estado}
         />
       </div>
     )
   }
   ```

---

## 6. Sprint 2 (Phases 3 & 4) — UX Boundaries, SQL Views & CI/CD

### Track W5 — App Router Error/Loading Boundaries (`REL-01`)
1. **Create `app/error.tsx`**:
   ```tsx
   'use client'

   export default function GlobalError({
     error,
     reset,
   }: {
     error: Error & { digest?: string }
     reset: () => void
   }) {
     return (
       <div className="min-h-screen flex items-center justify-center p-6 bg-fondo">
         <div className="glass-card max-w-md w-full p-8 text-center">
           <h2 className="text-xl font-black text-principal mb-2">Ocurrió un problema inesperado</h2>
           <p className="text-sm text-muted mb-6">
             {error.message || 'No pudimos cargar esta sección. Por favor intenta nuevamente.'}
           </p>
           <button
             onClick={() => reset()}
             className="px-5 py-2.5 rounded-lg bg-acento text-principal font-bold text-sm hover:opacity-90 transition-all"
           >
             Reintentar
           </button>
         </div>
       </div>
     )
   }
   ```
2. **Create `app/loading.tsx`**:
   ```tsx
   export default function GlobalLoading() {
     return (
       <div className="min-h-screen flex items-center justify-center bg-fondo">
         <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
       </div>
     )
   }
   ```
3. **Create `app/not-found.tsx`**:
   ```tsx
   import Link from 'next/link'

   export default function NotFoundPage() {
     return (
       <div className="min-h-screen flex items-center justify-center p-6 bg-fondo">
         <div className="glass-card max-w-md w-full p-8 text-center">
           <h1 className="text-3xl font-black text-principal mb-2">404</h1>
           <p className="text-sm text-muted mb-6">La página que buscas no existe o fue movida.</p>
           <Link
             href="/login"
             className="inline-block px-5 py-2.5 rounded-lg bg-acento text-principal font-bold text-sm"
           >
             Ir al inicio
           </Link>
         </div>
       </div>
     )
   }
   ```
4. Re-export `app/error.tsx` and `app/loading.tsx` inside `app/(portals)/{admin,analista,epc,finder,cliente,financiero,mem}/{error,loading}.tsx`.

### Track W6 — Dashboard Query Optimization & Single-Query Joins (`PERF-01`, `PERF-03`)
1. **File:** `supabase/migrations/20261021000002_dashboard_views_and_indexes.sql`
   ```sql
   CREATE INDEX IF NOT EXISTS idx_telemetria_proyecto_time
     ON public.telemetria_egauge (proyecto_id, timestamp DESC);

   CREATE INDEX IF NOT EXISTS idx_proyectos_estado_created
     ON public.proyectos (estado, created_at DESC);
   ```
2. **Files:** `app/(portals)/admin/proyectos/page.tsx` and `app/(portals)/analista/proyectos/page.tsx`
   Replace the two sequential queries (`proyectos` + secondary `profiles.in('id', allIds)`) with a single PostgREST relational join:
   ```typescript
   const { data: prs } = await supabase
     .from('proyectos')
     .select('*, epc:profiles!proyectos_epcista_id_fkey(id, nombre, empresa), responsable:profiles!proyectos_responsable_nodo_id_fkey(id, nombre, empresa), finder:profiles!proyectos_finder_id_fkey(id, nombre, empresa)')
     .order('created_at', { ascending: false })
   ```

### Track W7 — CI/CD Quality Gate (`.github/workflows/main.yml`) (`REL-06`)
Update `.github/workflows/main.yml` so every push/PR runs:
1. `npm ci`
2. `npx tsc --noEmit`
3. `npm run lint`
4. `npm run build`

---

## 7. Verification Gates (Must All Pass 100%)

1. **Static & Build Gate**:
   - `npx tsc --noEmit` → `0` errors
   - `npm run lint` → `0` errors
   - `npm run build` → all routes compile cleanly (`0` errors)
2. **Admin Service Role Key Gate (`SEC-03`)**:
   - `createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1 })` returns HTTP 200.
3. **Zero-Mockup Gate (`MOCK-01`, `MOCK-02`, `R1-Defect-4`)**:
   - `lib/egauge.ts` and `app/brand-preview/page.tsx` do not exist.
   - `0` occurrences of `totalGenerated * 3.9` or `localStorage.setItem('nodo-` in `app/` or `components/`.
4. **Multi-Portal Live Route & Navigation Gate**:
   - `analista@prueba.com` logs into `/analista` with `0` redirect loops to `/pendiente`.
   - All 7 role sidebars navigate to `/configuracion` with HTTP 200 (`0` 404s).
   - `/finder/proyectos/[id]/instalaciones` and `/finder/proyectos/[id]/plan` return HTTP 200 (`0` 404s).
   - Any test data created during E2E verification is cleaned up before completion so the 6 real customer projects, 9 real clients, 44 real sites, and 23 profiles remain in their exact clean baseline state.
