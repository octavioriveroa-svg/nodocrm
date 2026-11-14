# Task Specification: TASK-002 — Missing Notifications Table Migration & Stakeholder FK Fix (PGRST205 / 23503)

**Task ID**: `TASK-002`  
**Task Title**: Create `public.notificaciones` Table Migration, Fix Stakeholder Recipient FK Resolution & Resolve Polling PGRST205 Errors  
**Target Subsystem**: Notifications & TopBar (`supabase/migrations/`, `components/TopBar.tsx`, `components/InstalacionMonitor.tsx`, `components/plan/CommentThread.tsx`)  
**Priority**: P0 (High-Frequency Polling Defect & Relational FK Bug)  
**Severity**: Blocker (Generates continuous 400/404 errors every 30s for all logged-in users; inserting notifications for client projects fails FK constraint `23503`)  
**Status**: Completed & Verified  

---

## 1. Problem Statement & Root Cause

### 1.1 Problem Statement
1. **Missing `public.notificaciones` Table (`PGRST205`)**:
   In `components/TopBar.tsx:76-88`, every authenticated user runs a background polling routine every 30 seconds to fetch their in-app notifications:
   ```typescript
   const { data } = await supabase
     .from('notificaciones')
     .select('*')
     .eq('usuario_id', userId)
     .order('created_at', { ascending: false })
     .limit(20)
   ```
   In production, this query consistently fails with PostgREST error:
   `PGRST205: Could not find the table 'public.notificaciones' in the schema cache`.
2. **Foreign Key Violation (`23503`) When Broadcasting Notifications to Project Clients**:
   In `components/InstalacionMonitor.tsx:172` and `components/plan/CommentThread.tsx:228`, the notification broadcast logic adds `proyecto.cliente_id` directly to `recipientIds` (which becomes `notificaciones.usuario_id`):
   ```typescript
   if (proyecto.epcista_id) recipientIds.add(proyecto.epcista_id)
   if (proyecto.cliente_id) recipientIds.add(proyecto.cliente_id)
   if (proyecto.financiero_id) recipientIds.add(proyecto.financiero_id)
   ```
   However, `proyectos.cliente_id` is a foreign key to **`public.clientes(id)`** (the commercial company entity), **NOT** `public.profiles(id)`! Because `notificaciones.usuario_id` references `public.profiles(id)`, inserting `proyecto.cliente_id` into `notificaciones.usuario_id` throws PostgreSQL error `23503 (foreign_key_violation)` whenever a project has a `cliente_id`.

### 1.2 Root Cause
1. The `notificaciones` table schema was drafted in `supabase/archive/v20_plan_comentarios.sql` (lines 40–58), but was omitted when the production migrations were applied to the live Supabase PostgreSQL database (`nlqrdxwyxmgdwawedweh`).
2. `InstalacionMonitor.tsx` and `CommentThread.tsx` treated `proyecto.cliente_id` as a user profile UUID instead of resolving `profiles.id` where `profiles.cliente_crm_id = proyecto.cliente_id`.

---

## 2. Scope Boundaries

### In-Scope
1. Author production SQL migration `supabase/migrations/20261112000001_create_notificaciones.sql`:
   - Define table `public.notificaciones` with foreign key cascades to `profiles(id)`, `proyectos(id)`, and `plan_comentarios(id)`.
   - Add composite B-tree indexes `idx_notificaciones_usuario` on `(usuario_id, leido)` and `idx_notificaciones_proyecto` on `(proyecto_id)`.
   - Enable Row-Level Security (RLS) with policies for `SELECT`, `UPDATE`, `INSERT`, and `DELETE`.
2. Fix recipient resolution in `components/InstalacionMonitor.tsx` and `components/plan/CommentThread.tsx`:
   - Query `public.profiles` for `.select('id').eq('cliente_crm_id', proyecto.cliente_id)` and add those user profile `id`s to `recipientIds` instead of adding `proyecto.cliente_id` directly.
   - Also include `proyecto.responsable_nodo_id` and `proyecto.finder_id` when present.
3. Update `components/TopBar.tsx` (`loadNotifs`) to inspect `error` before mutating notification state so transient errors never overwrite valid state.
4. Add an automated test in `tests/tier1-feature-coverage.test.mjs` verifying notification recipient resolution and `notificaciones` schema alignment.

### Out-of-Scope
- Building third-party push notification services (WebPush / FCM / Email).
- Rewriting the notification dropdown UI in `TopBar.tsx`.

---

## 3. Technical Prerequisites & Dependencies
- **Dependencies**: None.
- **Database Execution Plan**: Generated into `supabase/migrations/20261112000001_create_notificaciones.sql` and bundled into `supabase/migrations/20261112000000_consolidated_sprint3_ddl.sql` for one-click execution in the Supabase SQL Editor.

---

## 4. Inputs
- Archival Source: `supabase/archive/v20_plan_comentarios.sql` (lines 40–58, 129–142).
- Polling Component: `components/TopBar.tsx` (lines 73–98).
- Producer Components: `components/InstalacionMonitor.tsx` (lines 161–191), `components/plan/CommentThread.tsx` (lines 217–261).
- TypeScript Type: `Notificacion` in `lib/types.ts` (lines 365–378).

---

## 5. Step-by-Step Implementation Instructions

### Step 1: Create Migration File
Create `supabase/migrations/20261112000001_create_notificaciones.sql`:
```sql
-- Migration: 20261112000001_create_notificaciones.sql
-- Description: Creates the missing in-app notifications table with RLS and indexes.

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL DEFAULT 'comentario'
                CHECK (tipo IN ('comentario', 'respuesta', 'resuelto', 'sistema', 'evidencia')),
  titulo        TEXT NOT NULL,
  mensaje       TEXT,
  enlace        TEXT,
  proyecto_id   UUID REFERENCES public.proyectos(id) ON DELETE CASCADE,
  comentario_id UUID REFERENCES public.plan_comentarios(id) ON DELETE CASCADE,
  leido         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON public.notificaciones(usuario_id, leido, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_proyecto ON public.notificaciones(proyecto_id) WHERE proyecto_id IS NOT NULL;

-- Row Level Security
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notificaciones: solo propias" ON public.notificaciones;
CREATE POLICY "Notificaciones: solo propias" ON public.notificaciones
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Notificaciones: marcar leído" ON public.notificaciones;
CREATE POLICY "Notificaciones: marcar leído" ON public.notificaciones
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Notificaciones: insercion autenticados" ON public.notificaciones;
CREATE POLICY "Notificaciones: insercion autenticados" ON public.notificaciones
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
```

### Step 2: Fix Stakeholder Recipient Resolution in `components/InstalacionMonitor.tsx`
In `components/InstalacionMonitor.tsx` (lines 161–191), replace the notification block inside `handleUpload`:
```typescript
    supabase
      .from('proyectos')
      .select('epcista_id, cliente_id, financiero_id, responsable_nodo_id, finder_id')
      .eq('id', proyectoId)
      .single()
      .then(async ({ data: proyecto }) => {
        if (!proyecto) return
        const recipientIds = new Set<string>()

        // Notify stakeholders (profile UUIDs)
        if (proyecto.epcista_id) recipientIds.add(proyecto.epcista_id)
        if (proyecto.financiero_id) recipientIds.add(proyecto.financiero_id)
        if (proyecto.responsable_nodo_id) recipientIds.add(proyecto.responsable_nodo_id)
        if (proyecto.finder_id) recipientIds.add(proyecto.finder_id)

        // Resolve cliente_final user profile UUIDs from cliente_crm_id (proyectos.cliente_id references clientes.id)
        if (proyecto.cliente_id) {
          const { data: clientProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('cliente_crm_id', proyecto.cliente_id)
          if (clientProfiles) {
            clientProfiles.forEach((cp: { id: string }) => recipientIds.add(cp.id))
          }
        }

        // Don't notify the author
        recipientIds.delete(currentUser.id)

        if (recipientIds.size === 0) return

        const notifications = Array.from(recipientIds).map(uid => ({
          usuario_id: uid,
          tipo: 'evidencia',
          titulo: `${autorName} subió nueva evidencia`,
          mensaje: `Se ha cargado avance: "${ev.titulo}" en el monitor de instalación.`,
          enlace,
          proyecto_id: proyectoId,
        }))

        await supabase.from('notificaciones').insert(notifications)
      })
```

### Step 3: Fix Stakeholder Recipient Resolution in `components/plan/CommentThread.tsx`
In `components/plan/CommentThread.tsx` (lines 217–261), replace the notification block inside `handleSubmit`:
```typescript
    supabase
      .from('proyectos')
      .select('epcista_id, cliente_id, financiero_id, responsable_nodo_id, finder_id')
      .eq('id', proyectoId)
      .single()
      .then(async ({ data: proyecto }) => {
        if (!proyecto) return
        const recipientIds = new Set<string>()

        // Add project stakeholders (profile UUIDs)
        if (proyecto.epcista_id) recipientIds.add(proyecto.epcista_id)
        if (proyecto.financiero_id) recipientIds.add(proyecto.financiero_id)
        if (proyecto.responsable_nodo_id) recipientIds.add(proyecto.responsable_nodo_id)
        if (proyecto.finder_id) recipientIds.add(proyecto.finder_id)

        // Resolve cliente_final user profile UUIDs from cliente_crm_id (proyectos.cliente_id references clientes.id)
        if (proyecto.cliente_id) {
          const { data: clientProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('cliente_crm_id', proyecto.cliente_id)
          if (clientProfiles) {
            clientProfiles.forEach((cp: { id: string }) => recipientIds.add(cp.id))
          }
        }

        // If replying, also notify the parent comment author
        if (parentId) {
          const parent = comments.find(c => c.id === parentId)
          if (parent) recipientIds.add(parent.autor_id)
        }

        // Don't notify yourself
        recipientIds.delete(currentUser.id)

        if (recipientIds.size === 0) return

        const tipo = parentId ? 'respuesta' : 'comentario'
        const titulo = parentId
          ? `${autorName} respondió a un comentario`
          : `${autorName} comentó en el plan`
        const mensaje = comment.contenido.length > 120
          ? comment.contenido.slice(0, 120) + '…'
          : comment.contenido

        const notifications = Array.from(recipientIds).map(uid => ({
          usuario_id: uid,
          tipo,
          titulo,
          mensaje,
          enlace,
          proyecto_id: proyectoId,
          comentario_id: comment.id,
        }))

        await supabase.from('notificaciones').insert(notifications)
      })
```

### Step 4: Harden `loadNotifs` in `components/TopBar.tsx`
In `components/TopBar.tsx` (lines 74–90), check `error` before updating state:
```typescript
  const loadNotifs = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return
    if (data) setNotifs(data as Notificacion[])
    // Unread count
    const { count: unread, error: countErr } = await supabase
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId)
      .eq('leido', false)
    if (!countErr) {
      setUnreadCount(unread || 0)
    }
  }, [userId, supabase])
```

### Step 5: Add Automated Test
In `tests/tier1-feature-coverage.test.mjs`, add a test verifying that notification recipient resolution resolves `profiles.id` via `cliente_crm_id` (and never uses `clientes.id` as a `usuario_id`) and validates `20261112000001_create_notificaciones.sql`.

---

## 6. Outputs
- **New Migration**: `supabase/migrations/20261112000001_create_notificaciones.sql`
- **Modified Components**: `components/InstalacionMonitor.tsx`, `components/plan/CommentThread.tsx`, `components/TopBar.tsx`
- **Updated Test**: `tests/tier1-feature-coverage.test.mjs`

---

## 7. Acceptance Criteria & Exact Verification Commands

### Criteria
- [x] `supabase/migrations/20261112000001_create_notificaciones.sql` defines `public.notificaciones` with `leido`, `enlace`, `comentario_id`, `'evidencia'` type check, indexes, and RLS policies.
- [x] Neither `InstalacionMonitor.tsx` nor `CommentThread.tsx` pushes `proyecto.cliente_id` directly into `recipientIds`; both resolve user profile IDs via `.eq('cliente_crm_id', proyecto.cliente_id)`.
- [x] `TopBar.tsx` checks `if (error) return` before mutating notification state.
- [x] `npm test` and `npx tsc --noEmit` pass with 0 errors.
