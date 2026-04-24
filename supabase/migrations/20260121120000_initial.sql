-- PLATE: org-scoped data with RLS (run in Supabase SQL editor or via supabase db push)
-- Order: organizations + members must exist before policies that reference organization_members.

-- Profiles (1:1 auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

-- Organizations (table + trigger only; RLS policies that join members come after members exist)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_by uuid references auth.users (id) on delete set null,
  onboarding_completed boolean not null default false,
  onboarding_pending boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.organizations_set_created_by()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
begin
  if new.created_by is null and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_organizations_set_created_by on public.organizations;
create trigger trg_organizations_set_created_by
  before insert on public.organizations
  for each row execute function public.organizations_set_created_by();

alter table public.organizations enable row level security;

drop policy if exists "org_insert_authenticated" on public.organizations;
create policy "org_insert_authenticated"
  on public.organizations for insert
  to authenticated
  with check (true);

-- Membership (must exist before org policies that reference it)
create table if not exists public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner',
  primary key (org_id, user_id)
);

alter table public.organization_members enable row level security;

drop policy if exists "org_members_select" on public.organization_members;
drop policy if exists "org_members_insert_self" on public.organization_members;
drop policy if exists "org_members_insert_as_creator" on public.organization_members;

create policy "org_members_select"
  on public.organization_members for select
  using (user_id = auth.uid());

create policy "org_members_insert_as_creator"
  on public.organization_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organizations o
      where o.id = org_id and o.created_by = auth.uid()
    )
  );

-- Org policies that reference organization_members (only after table exists)
drop policy if exists "org_select_member" on public.organizations;
create policy "org_select_member"
  on public.organizations for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.org_id = organizations.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "org_update_member" on public.organizations;
create policy "org_update_member"
  on public.organizations for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.org_id = organizations.id and m.user_id = auth.uid()
    )
  );

-- Settings JSON (per org)
create table if not exists public.org_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  app_preferences jsonb,
  material_config jsonb,
  cutting_profiles jsonb,
  updated_at timestamptz not null default now()
);

alter table public.org_settings enable row level security;

drop policy if exists "org_settings_all" on public.org_settings;
create policy "org_settings_all"
  on public.org_settings for all
  using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = org_settings.org_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = org_settings.org_id and m.user_id = auth.uid()
    )
  );

-- Mirrors localStorage keys / large JSON blobs per org
create table if not exists public.org_domain_snapshots (
  org_id uuid not null references public.organizations (id) on delete cascade,
  data_key text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, data_key)
);

alter table public.org_domain_snapshots enable row level security;

drop policy if exists "org_snapshots_all" on public.org_domain_snapshots;
create policy "org_snapshots_all"
  on public.org_domain_snapshots for all
  using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = org_domain_snapshots.org_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = org_domain_snapshots.org_id and m.user_id = auth.uid()
    )
  );

-- New user: profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
