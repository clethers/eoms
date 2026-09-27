-- EOMS: link every Supabase Auth login to an app profile, choosing the role from the email.
--   email contains "admin"                    -> admin          (Admin workspace)
--   email contains "customer" or "care"       -> customer_care_manager (Customer Care workspace)
--   email contains "engineer"                 -> lead_engineer  (Engineering)
--   email contains "operation" or "ops"       -> operations (Operations workspace)
-- Case-insensitive. Safe to re-run. Logins whose email matches none of these are skipped
-- (they show up as linked = false in the check at the bottom).

insert into public.profiles (auth_user_id, email, full_name, role, status, data)
select u.id,
       lower(u.email),
       m.full_name,
       m.role,
       'ACTIVE',
       jsonb_build_object('email', lower(u.email), 'fullName', m.full_name, 'role', m.role,
                          'status', 'ACTIVE', 'department', m.department)
from auth.users u
cross join lateral (
  select * from (values
    (1, 'admin',                 'EcoWorks Admin',       'Management',    u.email ilike '%admin%'),
    (2, 'customer_care_manager', 'Customer Care',        'Customer Care', u.email ilike '%customer%' or u.email ilike '%care%'),
    (3, 'lead_engineer',         'Lead Engineer',        'Engineering',   u.email ilike '%engineer%'),
    (4, 'operations',            'Operations Crew',      'Operations',    u.email ilike '%operation%' or u.email ilike '%ops%')
  ) as r(priority, role, full_name, department, matches)
  where r.matches
  order by r.priority
  limit 1
) m
where not exists (select 1 from public.profiles p where p.auth_user_id = u.id)
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id,
      role         = excluded.role,
      status       = 'ACTIVE',
      full_name    = coalesce(public.profiles.full_name, excluded.full_name),
      data         = public.profiles.data || excluded.data;

-- Check: every login should show linked = true with the right role.
select u.email as login_email, p.id as profile_id, p.role, p.auth_user_id is not null as linked
from auth.users u
left join public.profiles p on p.auth_user_id = u.id
order by u.email;
