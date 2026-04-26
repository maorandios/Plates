-- Remove public.profiles: merge display_name into public.users, drop auth trigger, drop table.
-- The app only uses public.users for workspace data; profiles was unused in application code.

-- 1) Target column for former profile.display_name (optional person name vs company `name`)
alter table public.users
  add column if not exists display_name text;

-- 2) Copy display_name for accounts that already have a public.users row
update public.users u
set display_name = p.display_name
from public.profiles p
where p.id = u.user_id
  and p.display_name is not null
  and btrim(p.display_name) <> ''
  and (u.display_name is null or btrim(coalesce(u.display_name, '')) = '');

-- 3) Auth users with a profile row but no public.users yet — create a minimal settings row
insert into public.users (
  user_id,
  email,
  name,
  display_name,
  onboarding_pending,
  onboarding_completed,
  app_preferences,
  updated_at
)
select
  p.id,
  au.email,
  'Workspace',
  nullif(btrim(p.display_name), ''),
  true,
  false,
  '{}'::jsonb,
  now()
from public.profiles p
join auth.users au on au.id = p.id
where not exists (select 1 from public.users u where u.user_id = p.id);

-- 4) Stop inserting into public.profiles on signup
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 5) Drop profiles RLS and table
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop table if exists public.profiles;

comment on column public.users.display_name is
  'Optional person display name (migrated from former public.profiles). Company/workspace title remains in `name` and app_preferences.';
