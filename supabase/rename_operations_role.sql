-- EOMS: rename app role 'field_inspector' -> 'operations' on an existing database
-- (one where bridge.sql already ran with the old role check constraint).
-- Idempotent: safe to re-run. Fresh installs get the new list from bridge.sql directly.

begin;

-- 1. Drop every CHECK constraint on public.profiles that covers the role column,
--    whatever its (auto-generated) name is.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any (con.conkey)
    where con.conrelid = 'public.profiles'::regclass
      and con.contype = 'c'
      and att.attname = 'role'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end
$$;

-- 2. Migrate existing rows (column and the JSON copy in data).
update public.profiles
set role = 'operations',
    data = data || '{"role":"operations"}'::jsonb
where role = 'field_inspector';

-- 3. Re-add the constraint with the new role list.
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin','customer_care_manager','lead_engineer','operations'));

commit;

-- Check: should return no rows.
-- select id, email, role, data->>'role' from public.profiles
-- where role = 'field_inspector' or data->>'role' = 'field_inspector';
