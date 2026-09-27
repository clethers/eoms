-- =====================================================================
-- EOMS: link a staff login (Supabase Auth user) to an app profile
--
-- HOW TO USE
--   1. Run supabase/bridge.sql first (once).
--   2. In Supabase Dashboard -> Authentication -> Users -> "Add user" ->
--      "Create new user": enter the person's email + a password and tick
--      "Auto Confirm User". Repeat for every staff member.
--   3. For EACH person, copy the block below, replace the three placeholders
--        <email>      exact email used in step 2 (lowercase)
--        <Full Name>  their display name
--        <role>       one of: admin | customer_care_manager | lead_engineer | field_inspector
--      and optionally change 'Operations' to their department.
--   4. Run it in the SQL Editor. It is safe to re-run (updates the existing profile).
--   5. Check: select id, email, full_name, role, status, auth_user_id from public.profiles;
--      auth_user_id must NOT be null, otherwise the email did not match an Auth user.
--
-- At least one person must be 'admin' - only admins can create/edit profiles from the app.
-- To suspend someone: update public.profiles set status = 'SUSPENDED',
--   data = data || '{"status":"SUSPENDED"}' where email = '<email>';
-- =====================================================================

insert into public.profiles (auth_user_id, email, full_name, role, status, data)
select id, email, '<Full Name>', '<role>', 'ACTIVE',
       jsonb_build_object('email', email, 'fullName', '<Full Name>', 'role', '<role>',
                          'status', 'ACTIVE', 'department', 'Operations')
from auth.users
where email = '<email>'
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id,
      full_name    = excluded.full_name,
      role         = excluded.role,
      status       = excluded.status,
      data         = public.profiles.data || excluded.data;

-- Example (delete or edit):
-- insert into public.profiles (auth_user_id, email, full_name, role, status, data)
-- select id, email, 'Juan Dela Cruz', 'field_inspector', 'ACTIVE',
--        jsonb_build_object('email', email, 'fullName', 'Juan Dela Cruz', 'role', 'field_inspector',
--                           'status', 'ACTIVE', 'department', 'Operations')
-- from auth.users where email = 'juan@example.com'
-- on conflict (email) do update
--   set auth_user_id = excluded.auth_user_id, full_name = excluded.full_name,
--       role = excluded.role, status = excluded.status, data = public.profiles.data || excluded.data;
