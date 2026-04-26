-- Single account per user: all business data is keyed by auth.users.id.
-- Replaces organizations + organization_members with user_id on each table.
-- public.users = per-account settings (1:1 auth.users), not the auth user table.

-- ═══ 0. Stabilize RLS: drop policies that reference organization_members or old FKs ═══

drop policy if exists "clients_all_member" on public.clients;
drop policy if exists "quotes_all_member" on public.quotes;
drop policy if exists "projects_all_member" on public.projects;
drop policy if exists "steel_types_all_member" on public.steel_types;
drop policy if exists "org_snapshots_all" on public.org_domain_snapshots;
drop policy if exists "users_all" on public.users;

-- ═══ 1. One owner user per org (prefer role = owner) ═══

create temporary table _org_to_user on commit drop as
select distinct on (om.org_id)
  om.org_id,
  om.user_id
from public.organization_members om
order by om.org_id, case when om.role = 'owner' then 0 else 1 end, om.user_id;

-- ═══ 2. public.users: add account columns, map org row → auth user, then repoint PK ═══

alter table public.users
  add column if not exists user_id uuid,
  add column if not exists name text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_pending boolean not null default true;

-- Merge organization title + flags into the settings row
update public.users u
set
  name = o.name,
  onboarding_completed = o.onboarding_completed,
  onboarding_pending = o.onboarding_pending
from public.organizations o
where o.id = u.org_id;

update public.users u
set user_id = m.user_id
from _org_to_user m
where m.org_id = u.org_id;

-- Legacy: org had data but no public.users row — create from organization + auth
insert into public.users (org_id, user_id, email, name, onboarding_completed, onboarding_pending, app_preferences, updated_at)
select
  m.org_id,
  m.user_id,
  au.email,
  o.name,
  o.onboarding_completed,
  o.onboarding_pending,
  '{}'::jsonb,
  now()
from _org_to_user m
join public.organizations o on o.id = m.org_id
join auth.users au on au.id = m.user_id
where not exists (select 1 from public.users u where u.org_id = m.org_id);

-- Deduplicate settings rows (one org per user expected; merge leftovers by ctid)
delete from public.users a using public.users b
where a.user_id = b.user_id
  and a.user_id is not null
  and a.ctid < b.ctid;

delete from public.users where user_id is null;

-- Drop old primary key
alter table public.users drop constraint if exists users_pkey;

alter table public.users drop column if exists org_id;
alter table public.users alter column user_id set not null;
alter table public.users add primary key (user_id);
alter table public.users
  add constraint users_user_id_fk foreign key (user_id) references auth.users (id) on delete cascade;

comment on table public.users is
  'Per-account workspace: preferences, company name, onboarding. PK user_id = auth user (single-tenant).';

-- ═══ 3. Child tables: org_id values → user_id, then rename column & FK to auth.users ═══

-- clients
drop index if exists clients_org_short_code_uq;
alter table public.clients drop constraint if exists clients_org_id_fkey;
update public.clients c
set org_id = m.user_id
from _org_to_user m
where c.org_id = m.org_id;
alter table public.clients rename column org_id to user_id;
alter table public.clients
  add constraint clients_user_id_fk foreign key (user_id) references auth.users (id) on delete cascade;
create index if not exists clients_user_id_idx on public.clients (user_id);
create unique index if not exists clients_user_short_code_uq
  on public.clients (user_id, short_code);
drop index if exists clients_org_id_idx;

-- quotes
alter table public.quotes drop constraint if exists quotes_org_id_fkey;
update public.quotes q
set org_id = m.user_id
from _org_to_user m
where q.org_id = m.org_id;
alter table public.quotes rename column org_id to user_id;
alter table public.quotes
  add constraint quotes_user_id_fk foreign key (user_id) references auth.users (id) on delete cascade;
create index if not exists quotes_user_id_idx on public.quotes (user_id);
drop index if exists quotes_org_id_idx;
drop index if exists quotes_updated_idx;
create index if not exists quotes_updated_idx on public.quotes (user_id, updated_at desc);

-- projects
alter table public.projects drop constraint if exists projects_org_id_fkey;
update public.projects p
set org_id = m.user_id
from _org_to_user m
where p.org_id = m.org_id;
alter table public.projects rename column org_id to user_id;
alter table public.projects
  add constraint projects_user_id_fk foreign key (user_id) references auth.users (id) on delete cascade;
create index if not exists projects_user_id_idx on public.projects (user_id);
drop index if exists projects_org_id_idx;
drop index if exists projects_updated_idx;
create index if not exists projects_updated_idx on public.projects (user_id, updated_at desc);

-- steel_types
alter table public.steel_types drop constraint if exists steel_types_org_id_fkey;
update public.steel_types s
set org_id = m.user_id
from _org_to_user m
where s.org_id = m.org_id;
alter table public.steel_types rename column org_id to user_id;
alter table public.steel_types
  add constraint steel_types_user_id_fk foreign key (user_id) references auth.users (id) on delete cascade;
drop index if exists steel_types_org_idx;
create index if not exists steel_types_user_idx on public.steel_types (user_id, family, sort_order);
drop index if exists steel_types_org_family_name_uq;
create unique index if not exists steel_types_user_family_name_uq
  on public.steel_types (user_id, family, name);

-- org_domain_snapshots
alter table public.org_domain_snapshots drop constraint if exists org_domain_snapshots_org_id_fkey;
update public.org_domain_snapshots s
set org_id = m.user_id
from _org_to_user m
where s.org_id = m.org_id;
alter table public.org_domain_snapshots rename column org_id to user_id;
-- Dedupe (user_id, data_key) before new PK
delete from public.org_domain_snapshots a using public.org_domain_snapshots b
where a.user_id = b.user_id
  and a.data_key = b.data_key
  and a.ctid < b.ctid;
alter table public.org_domain_snapshots drop constraint if exists org_domain_snapshots_pkey;
alter table public.org_domain_snapshots add primary key (user_id, data_key);
alter table public.org_domain_snapshots
  add constraint org_domain_snapshots_user_id_fk foreign key (user_id) references auth.users (id) on delete cascade;

-- ═══ 4. Drop org tables (no longer referenced) ═══

drop policy if exists "org_select_member" on public.organizations;
drop policy if exists "org_update_member" on public.organizations;
drop policy if exists "org_insert_authenticated" on public.organizations;
drop policy if exists "org_members_select" on public.organization_members;
drop policy if exists "org_members_insert_as_creator" on public.organization_members;
drop policy if exists "org_members_insert_self" on public.organization_members;

drop table if exists public.organization_members;
drop table if exists public.organizations;

-- ═══ 5. RLS: own rows only (user_id = auth.uid()) ═══

alter table public.clients enable row level security;
create policy "clients_owner_all" on public.clients for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.quotes enable row level security;
create policy "quotes_owner_all" on public.quotes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.projects enable row level security;
create policy "projects_owner_all" on public.projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.steel_types enable row level security;
create policy "steel_types_owner_all" on public.steel_types for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.org_domain_snapshots enable row level security;
create policy "org_snapshots_owner_all" on public.org_domain_snapshots for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.users enable row level security;
create policy "users_settings_own" on public.users for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
