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
