-- EOMS starter accounts: one per workspace.
-- Create these 4 users first in Authentication -> Users -> Add user (Auto Confirm ON), then run this whole file.

insert into public.profiles (auth_user_id, email, full_name, role, status, data)
select id, email, 'EcoWorks Admin', 'admin', 'ACTIVE',
       jsonb_build_object('email', email, 'fullName', 'EcoWorks Admin', 'role', 'admin', 'status', 'ACTIVE', 'department', 'Management')
from auth.users where email = 'ecoworksdev+admin@gmail.com'
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id, full_name = excluded.full_name,
      role = excluded.role, status = excluded.status, data = public.profiles.data || excluded.data;

insert into public.profiles (auth_user_id, email, full_name, role, status, data)
select id, email, 'Customer Care Test', 'customer_care_manager', 'ACTIVE',
       jsonb_build_object('email', email, 'fullName', 'Customer Care Test', 'role', 'customer_care_manager', 'status', 'ACTIVE', 'department', 'Customer Care')
from auth.users where email = 'ecoworksdev+customercare@gmail.com'
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id, full_name = excluded.full_name,
      role = excluded.role, status = excluded.status, data = public.profiles.data || excluded.data;

insert into public.profiles (auth_user_id, email, full_name, role, status, data)
select id, email, 'Lead Engineer Test', 'lead_engineer', 'ACTIVE',
       jsonb_build_object('email', email, 'fullName', 'Lead Engineer Test', 'role', 'lead_engineer', 'status', 'ACTIVE', 'department', 'Engineering')
from auth.users where email = 'ecoworksdev+engineering@gmail.com'
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id, full_name = excluded.full_name,
      role = excluded.role, status = excluded.status, data = public.profiles.data || excluded.data;

insert into public.profiles (auth_user_id, email, full_name, role, status, data)
select id, email, 'Operations Crew Test', 'operations', 'ACTIVE',
       jsonb_build_object('email', email, 'fullName', 'Operations Crew Test', 'role', 'operations', 'status', 'ACTIVE', 'department', 'Operations')
from auth.users where email = 'ecoworksdev+operations@gmail.com'
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id, full_name = excluded.full_name,
      role = excluded.role, status = excluded.status, data = public.profiles.data || excluded.data;

-- Check: every row must have an auth_user_id
select id, email, full_name, role, auth_user_id from public.profiles order by id;
