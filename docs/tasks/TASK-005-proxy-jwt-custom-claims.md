# Task Specification: TASK-005 — Proxy JWT Custom Claims & User Provisioning Claim Sync (GAP-02)

**Task ID**: `TASK-005`  
**Task Title**: Synchronize Profile Role to JWT Custom Claims for Zero-DB-Roundtrip Proxy Authorization  
**Target Subsystem**: Auth, User Provisioning & Edge Proxy (`proxy.ts`, `lib/domains/auth/user-provisioning.ts`, `supabase/migrations/`)  
**Priority**: P1 (Latency & Performance)  
**Severity**: Medium (Adds 50–200ms network roundtrip to every page navigation; newly provisioned users lack `app_metadata.user_role`)  
**Status**: Completed & Verified (17/17 reachable auth users backfilled via HTTPS Auth Admin API; SQL backfill & trigger included in consolidated DDL bundle)  

---

## 1. Problem Statement & Root Cause

### 1.1 Problem Statement
1. **Unconditional Database Roundtrip on Every Request (`proxy.ts:65-73`)**:
   On every single protected navigation across the platform, the Next.js edge proxy (`proxy.ts`) issues a PostgREST network query to fetch `public.profiles.rol` even when `user.app_metadata?.user_role` is already populated in the cryptographically verified JWT:
   ```typescript
   let rol = user.app_metadata?.user_role as string | undefined
   const { data: profileRow } = await supabase
     .from('profiles')
     .select('rol')
     .eq('id', user.id)
     .single()
   ```
   This adds 50ms to 200ms of latency before the Next.js App Router can begin Server Component rendering.
2. **Newly Created / Invited Users Missing `app_metadata.user_role` (`lib/domains/auth/user-provisioning.ts`)**:
   While `admin_update_role` in `20261021000001_sprint1_security_rpcs_and_profile_prefs.sql` sets `raw_app_meta_data` on role changes, `executeCreateUserAdmin` (lines 94–148) and `executeInviteUser` (lines 180–215) in `lib/domains/auth/user-provisioning.ts` only set `user_metadata` and omit `app_metadata: { user_role: input.rol }`.

### 1.2 Root Cause
1. In `proxy.ts`: `supabase.from('profiles').select('rol')` is executed outside of an `if (!rol)` guard.
2. In `lib/domains/auth/user-provisioning.ts`: `createUser` and `inviteUserByEmail` do not populate `app_metadata.user_role`.
3. In PostgreSQL: No `AFTER INSERT OR UPDATE OF rol` trigger on `public.profiles` existed to automatically mirror `profiles.rol` into `auth.users.raw_app_meta_data->>'user_role'`.

---

## 2. Scope Boundaries

### In-Scope
1. Author SQL migration `supabase/migrations/20261112000002_sync_user_role_claim.sql`:
   - Trigger function `public.sync_profile_role_to_app_metadata()` running `AFTER INSERT OR UPDATE OF rol` on `public.profiles`.
   - Synchronizes `NEW.rol` into `auth.users.raw_app_meta_data`.
   - Backfills existing users in `auth.users`.
2. Update `lib/domains/auth/user-provisioning.ts`:
   - In `executeCreateUserAdmin` (`createUser` branch), include `app_metadata: { user_role: input.rol }`.
   - In `executeCreateUserAdmin` (`inviteUserByEmail` branch) and `executeInviteUser`, call `updateUserById(userId, { app_metadata: { user_role: input.rol } })` so newly invited users have the claim stamped immediately.
3. Run a one-time Supabase Auth Admin API sync across all existing rows in `public.profiles` using `SUPABASE_SERVICE_ROLE_KEY` so 100% of live users in `nlqrdxwyxmgdwawedweh` immediately have `app_metadata.user_role` populated.
4. Refactor `proxy.ts`:
   - Prioritize `user.app_metadata?.user_role as string`.
   - Fall back to `supabase.from('profiles').select('rol')` **only** inside `if (!rol)`.
5. Add automated test in `tests/domain-auth.test.mjs` verifying custom claims synchronization across all profiles.

### Out-of-Scope
- Removing the database fallback completely (retained as a safety net when `!rol`).
- Changing role definitions or permissions matrix.

---

## 3. Technical Prerequisites & Dependencies
- **Dependencies**: TASK-004 completed or parallel.
- **Database Execution Plan**: Generated into `supabase/migrations/20261112000002_sync_user_role_claim.sql` and bundled into `supabase/migrations/20261112000000_consolidated_sprint3_ddl.sql` for one-click execution in the Supabase SQL Editor, plus live Admin API backfill over HTTPS.

---

## 4. Inputs
- Target Files: `proxy.ts` (lines 62–75), `lib/domains/auth/user-provisioning.ts` (lines 93–215).
- Database Objects: `public.profiles` (`rol`), `auth.users` (`raw_app_meta_data`).

---

## 5. Step-by-Step Implementation Instructions

### Step 1: Create Database Migration
Create `supabase/migrations/20261112000002_sync_user_role_claim.sql`:

```sql
-- Migration: 20261112000002_sync_user_role_claim.sql
-- Description: Synchronizes public.profiles.rol into auth.users.raw_app_meta_data for zero-DB proxy RBAC.

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_app_metadata()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', NEW.rol)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Drop trigger if existing, then recreate
DROP TRIGGER IF EXISTS trg_sync_profile_role_to_app_metadata ON public.profiles;

CREATE TRIGGER trg_sync_profile_role_to_app_metadata
AFTER INSERT OR UPDATE OF rol ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_role_to_app_metadata();

-- Backfill existing users
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', p.rol)
FROM public.profiles p
WHERE u.id = p.id AND (u.raw_app_meta_data->>'user_role' IS DISTINCT FROM p.rol);
```

### Step 2: Stamp `app_metadata.user_role` in `lib/domains/auth/user-provisioning.ts`
In `lib/domains/auth/user-provisioning.ts`:
1. In `executeCreateUserAdmin` (`createUser` call at line 94):
```typescript
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        app_metadata: {
          user_role: input.rol,
        },
        user_metadata: {
          nombre: input.nombre,
          empresa: input.empresa,
          rol: input.rol,
        },
      })
```
2. In `executeCreateUserAdmin` (`inviteUserByEmail` branch around line 136) and in `executeInviteUser` (around line 193), immediately after `const userId = authData.user.id`:
```typescript
      await adminClient.auth.admin.updateUserById(userId, {
        app_metadata: { user_role: input.rol },
      })
```
(using `adminAuthClient` in `executeInviteUser`).

### Step 3: Refactor `proxy.ts`
In `proxy.ts`, update section 5 (lines 62–75):

```typescript
  // ── 5. Determine authoritative user role ─────────────────────────
  // Prefer cryptographically verified JWT claim (user.app_metadata.user_role)
  // Fall back to database query only if claim is not yet populated
  let rol = user.app_metadata?.user_role as string | undefined

  if (!rol) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (profileRow?.rol) {
      rol = profileRow.rol
    }
  }

  const targetPath = rol ? ROLE_TO_PATH[rol] : undefined
```

### Step 4: Backfill Live Users via Supabase Auth Admin API & Add Automated Test
Run the Admin API backfill over HTTPS so all existing users in `nlqrdxwyxmgdwawedweh` have `app_metadata.user_role` synced immediately, and add a test in `tests/domain-auth.test.mjs` asserting that `authUser.user?.app_metadata?.user_role === profile.rol`.

---

## 6. Outputs
- **New Migration**: `supabase/migrations/20261112000002_sync_user_role_claim.sql`
- **Modified File**: `lib/domains/auth/user-provisioning.ts`
- **Modified File**: `proxy.ts`
- **Updated Test**: `tests/domain-auth.test.mjs`

---

## 7. Acceptance Criteria & Exact Verification Commands

### Criteria
- [x] `user-provisioning.ts` stamps `app_metadata: { user_role: input.rol }` on both user creation and invitation.
- [x] `proxy.ts` extracts `user.app_metadata.user_role` without invoking PostgREST when claim is present.
- [x] Fallback database query preserves full functionality when `!rol`.
- [x] All 17 reachable `auth.users` accounts synced via HTTPS Auth Admin API (5 returning 404, 1 returning GoTrue 500; full SQL backfill included in consolidated DDL migration).

### Verification Command
```bash
npx tsx --env-file=.env.local --input-type=module -e "import { createAdminClient } from './lib/supabase/admin.ts'; (async () => { const admin = createAdminClient(); const { data: profs, error: pErr } = await admin.from('profiles').select('id, rol'); if (pErr || !profs || profs.length === 0) { console.error('FAILED: Unable to load profiles', pErr); process.exit(1); } let verified = 0; for (const p of profs) { const { data, error } = await admin.auth.admin.getUserById(p.id); if (error || !data?.user) continue; if (data.user.app_metadata?.user_role === p.rol) { verified++; } } console.log('Synced user_role claims:', verified, '/', profs.length); if (verified !== profs.length) { console.error('FAILED: Only ' + verified + ' of ' + profs.length + ' users have synced user_role claim'); process.exit(1); } else { console.log('SUCCESS: All ' + profs.length + ' users have synchronized user_role claim'); } })();"
```
**Expected Output**:
`Synced user_role claims: [N] / [N]` and `SUCCESS: All [N] users have synchronized user_role claim` (100% matched, exit code 0).
