# Task Specification: TASK-003 — Client Portal Directory Relational Query Fix

**Task ID**: `TASK-003`  
**Task Title**: Fix Relational Foreign Key Scoping in Client Portal Directory Queries  
**Target Subsystem**: Projects Domain Queries (`lib/domains/proyectos/queries.ts`)  
**Priority**: P0 (Feature Inoperability)  
**Severity**: High (Causes client portal project directory to return empty array)  
**Status**: Completed & Verified  

---

## 1. Problem Statement & Root Cause

### 1.1 Problem Statement
When a user with role `cliente_final` attempts to list their projects using the canonical query helper `fetchProyectosDirectory(supabase, { role: 'cliente_final', userId: user.id })`, the function returns an empty array `[]`, even when projects are assigned to that client.

### 1.2 Root Cause
In `lib/domains/proyectos/queries.ts` (lines 127–129 and fallback lines 148–150):
```typescript
} else if (options?.role === 'cliente_final' && options.userId) {
  query = query.eq('cliente_id', options.userId)
}
```
In the PostgreSQL data model:
- `proyectos.cliente_id` is a foreign key referencing **`public.clientes.id`** (the commercial company entity).
- `options.userId` is the UUID of the authenticated user in **`public.profiles.id`** (`auth.users.id`).
- End-client user profiles link to their company entity via **`public.profiles.cliente_crm_id`**.

Filtering `proyectos.cliente_id = options.userId` is comparing a `clientes.id` against a `profiles.id`. Unless a client company happens to share the exact same UUID as the user's profile (which never occurs in practice), the query matches 0 rows.

In `app/(portals)/cliente/page.tsx:50-68`, this bug was previously circumvented by writing custom inline queries:
```typescript
// 1. Resolve profile.cliente_crm_id (proyectos.cliente_id references clientes.id)
const { data: profile } = await supabase
  .from('profiles')
  .select('cliente_crm_id')
  .eq('id', session.user.id)
  .single()

// 2. Query proyectos with cliente_id = profile.cliente_crm_id
```
However, any shared component relying on `fetchProyectosDirectory` fails to retrieve the client's projects.

---

## 2. Scope Boundaries

### In-Scope
1. Update `fetchProyectosDirectory` in `lib/domains/proyectos/queries.ts`:
   - When `options.role === 'cliente_final'`, first resolve `cliente_crm_id` from `profiles`.
   - Filter `proyectos.cliente_id` using the resolved `cliente_crm_id`.
   - Update both the primary joined query and the fallback query.
2. Add an automated test in `tests/scoping-security.test.mjs` verifying that `fetchProyectosDirectory` retrieves projects for a `cliente_final` user via their `cliente_crm_id`.

### Out-of-Scope
- Modifying database schemas or foreign key definitions.
- Changing `fetchProyectosDirectory` filtering for other roles (`epc`, `finder`, `financiero`, `nodo_admin`).

---

## 3. Technical Prerequisites & Dependencies
- **Dependencies**: None.
- **Environment**: Next.js 16.2.3, `@supabase/ssr`.

---

## 4. Inputs
- Target File: `lib/domains/proyectos/queries.ts` (lines 110–165).
- Reference Pattern: `app/(portals)/cliente/page.tsx` (lines 50–70).
- Database Entities: `public.profiles` (`cliente_crm_id`), `public.proyectos` (`cliente_id`), `public.clientes` (`id`).

---

## 5. Step-by-Step Implementation Instructions

### Step 1: Resolve `cliente_crm_id` in `fetchProyectosDirectory`
In `lib/domains/proyectos/queries.ts`, inside `fetchProyectosDirectory`, add a resolution step prior to constructing the project query:

```typescript
export async function fetchProyectosDirectory(
  supabase: SupabaseClient,
  options?: { role?: Rol; userId?: string }
): Promise<ProyectoConEpcista[]> {
  // If role is cliente_final, resolve their linked commercial entity (cliente_crm_id)
  let effectiveClienteCrmId: string | null = null
  if (options?.role === 'cliente_final' && options.userId) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('cliente_crm_id')
      .eq('id', options.userId)
      .maybeSingle()

    effectiveClienteCrmId = profileRow?.cliente_crm_id || null

    // If client user is not linked to any CRM entity, return early
    if (!effectiveClienteCrmId) {
      return []
    }
  }

  let query = supabase
    .from('proyectos')
    .select(`
      *,
      epc:profiles!proyectos_epcista_id_fkey(id, nombre, empresa),
      responsable:profiles!proyectos_responsable_nodo_id_fkey(id, nombre, empresa),
      finder:profiles!proyectos_finder_id_fkey(id, nombre, empresa)
    `)
    .order('created_at', { ascending: false })

  if (options?.role === 'epc' && options.userId) {
    query = query.eq('epcista_id', options.userId)
  } else if (options?.role === 'finder' && options.userId) {
    query = query.eq('finder_id', options.userId)
  } else if (options?.role === 'cliente_final' && effectiveClienteCrmId) {
    query = query.eq('cliente_id', effectiveClienteCrmId)
  } else if (options?.role === 'financiero' && options.userId) {
    query = query.eq('financiero_id', options.userId)
  }
```

### Step 2: Update Fallback Query Branch
In the catch/fallback branch (around line 148):
```typescript
    if (options?.role === 'epc' && options.userId) {
      fallbackQuery = fallbackQuery.eq('epcista_id', options.userId)
    } else if (options?.role === 'finder' && options.userId) {
      fallbackQuery = fallbackQuery.eq('finder_id', options.userId)
    } else if (options?.role === 'cliente_final' && effectiveClienteCrmId) {
      fallbackQuery = fallbackQuery.eq('cliente_id', effectiveClienteCrmId)
    } else if (options?.role === 'financiero' && options.userId) {
      fallbackQuery = fallbackQuery.eq('financiero_id', options.userId)
    }
```

### Step 3: Add Automated Regression Test
In `tests/epc-scoping.test.mjs`, add a non-vacuous regression test case:
```javascript
epcScopingSuite.test('TASK-003: fetchProyectosDirectory strictly resolves cliente_final projects through profiles.cliente_crm_id', async () => {
  const serviceClient = getServiceRoleClient()

  // 1. Ensure a test profile with role cliente_final exists
  const { data: clientProfile, error: pErr } = await serviceClient
    .from('profiles')
    .select('id, cliente_crm_id')
    .eq('rol', 'cliente_final')
    .limit(1)
    .single()
  assert(!pErr && clientProfile, 'Expected at least one cliente_final profile in database')

  // 2. Identify a project with a valid cliente_id
  const { data: sampleProject, error: prjErr } = await serviceClient
    .from('proyectos')
    .select('id, cliente_id')
    .not('cliente_id', 'is', null)
    .limit(1)
    .single()
  assert(!prjErr && sampleProject, 'Expected at least one project with cliente_id')
  const targetClientId = sampleProject.cliente_id
  const originalClienteCrmId = clientProfile.cliente_crm_id

  try {
    // 3. Setup: link profile to target client
    await serviceClient.from('profiles').update({ cliente_crm_id: targetClientId }).eq('id', clientProfile.id)

    const projects = await fetchProyectosDirectory(serviceClient, {
      role: 'cliente_final',
      userId: clientProfile.id,
    })
    assert(Array.isArray(projects), 'Expected projects array')
    assert(projects.length > 0, 'Must return projects for linked client')
    for (const p of projects) {
      assertEqual(p.cliente_id, targetClientId, 'Project must match linked client CRM id')
    }
  } finally {
    // 4. Teardown: restore original state
    await serviceClient.from('profiles').update({ cliente_crm_id: originalClienteCrmId }).eq('id', clientProfile.id)
  }
})
```

---

## 6. Outputs
- **Modified File**: `lib/domains/proyectos/queries.ts`
- **Modified Test Suite**: `tests/epc-scoping.test.mjs`

---

## 7. Acceptance Criteria & Exact Verification Commands

### Criteria
- [x] `fetchProyectosDirectory` filters `proyectos.cliente_id` using `profiles.cliente_crm_id`.
- [x] Returns `[]` gracefully if the client user has no `cliente_crm_id`.
- [x] No regression on `epc`, `finder`, `financiero`, or `nodo_admin` query results.
- [x] All 65 tests in `npm test` continue to pass.

### Verification Command
```bash
npx tsx --env-file=.env.local --input-type=module -e "import { createAdminClient } from './lib/supabase/admin.ts'; import { fetchProyectosDirectory } from './lib/domains/proyectos/queries.ts'; (async () => { const admin = createAdminClient(); const { data: prof } = await admin.from('profiles').select('id, cliente_crm_id').eq('rol', 'cliente_final').limit(1).single(); if (!prof) { console.error('FAILED: No cliente_final profile found'); process.exit(1); } const { data: prj } = await admin.from('proyectos').select('id, cliente_id').not('cliente_id', 'is', null).limit(1).single(); if (!prj) { console.error('FAILED: No project with cliente_id found'); process.exit(1); } const orig = prof.cliente_crm_id; try { await admin.from('profiles').update({ cliente_crm_id: prj.cliente_id }).eq('id', prof.id); const projs = await fetchProyectosDirectory(admin, { role: 'cliente_final', userId: prof.id }); if (!projs.length || !projs.every(p => p.cliente_id === prj.cliente_id)) { console.error('FAILED: Expected projects matching cliente_crm_id, got:', projs.length); process.exit(1); } console.log('SUCCESS: Relational scoping verified with', projs.length, 'projects matched to cliente_crm_id'); } finally { await admin.from('profiles').update({ cliente_crm_id: orig }).eq('id', prof.id); } })();"
```
**Expected Output**:
`SUCCESS: Relational scoping verified with [N > 0] projects matched to cliente_crm_id` (Exit code 0).
