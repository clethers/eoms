-- =====================================================================
-- EOMS: let an Admin set a new password for any staff login
--
-- HOW TO USE
--   1. Run supabase/bridge.sql first (once) - this relies on public.profiles.
--   2. Paste this whole file into Supabase Dashboard -> SQL Editor and run it.
--      It is safe to re-run.
--   3. In the app: Admin -> Users -> "Set password" next to a user.
--
-- The browser never holds a service-role key. The app calls this function with
-- the signed-in admin's session; the function checks the caller is an ACTIVE
-- admin and then updates auth.users directly (SECURITY DEFINER).
-- =====================================================================

create or replace function public.admin_set_user_password(target_profile_id bigint, new_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  caller_role text;
  target_auth uuid;
begin
  -- 1. caller must be an active admin (current_app_role() reads profiles via auth.uid())
  select role into caller_role
  from public.profiles
  where auth_user_id = auth.uid() and status = 'ACTIVE'
  limit 1;
  if caller_role is distinct from 'admin' then
    raise exception 'Only an active admin can set passwords' using errcode = '42501';
  end if;

  -- 2. password rules
  if new_password is null or length(new_password) < 8 then
    raise exception 'Password must be at least 8 characters' using errcode = '22023';
  end if;

  -- 3. resolve the target's auth user
  select auth_user_id into target_auth
  from public.profiles
  where id = target_profile_id;
  if target_auth is null then
    raise exception 'User has no linked login account' using errcode = 'P0002';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = target_auth;
end;
$$;

revoke all on function public.admin_set_user_password(bigint, text) from public, anon;
grant execute on function public.admin_set_user_password(bigint, text) to authenticated;
