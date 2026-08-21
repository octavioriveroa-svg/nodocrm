-- ============================================================
-- v26: Custom Access Token Hook
--
-- Injects the user's role (from profiles.rol) into the JWT as
-- a custom claim called "user_role". This allows the proxy and
-- RLS policies to read the role without a separate DB query.
--
-- AFTER running this migration, enable the hook in the Supabase
-- Dashboard: Authentication → Hooks → Custom Access Token →
-- select "custom_access_token_hook".
-- ============================================================

-- 1. Create the hook function
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_role text;
begin
  -- Look up the user's role from the profiles table
  select rol into user_role
  from public.profiles
  where id = (event->>'user_id')::uuid;

  -- Get the existing claims from the event
  claims := event->'claims';

  -- Inject the role as a custom claim
  if user_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  else
    -- Default to 'pendiente' if no profile row exists yet
    claims := jsonb_set(claims, '{user_role}', '"pendiente"');
  end if;

  -- Write the modified claims back into the event
  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;

-- 2. Grant execute permission to the Supabase auth admin role
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;

-- 3. Grant SELECT on profiles so the hook can read roles
grant select on public.profiles to supabase_auth_admin;

-- 4. Revoke from public-facing roles for security
revoke execute on function public.custom_access_token_hook from authenticated;
revoke execute on function public.custom_access_token_hook from anon;
revoke execute on function public.custom_access_token_hook from public;
