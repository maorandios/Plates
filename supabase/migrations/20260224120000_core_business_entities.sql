-- Core business data (org-scoped). "Users" = public.profiles (1:1 auth.users) + auth.users.

-- ─── Clients ──────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id text primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null,
  short_code text not null,
  company_registration_number text,
  contact_name text,
  email text,
  phone text,
  city text,
  notes text,
  status text not null check (status in ('active', 'inactive')),
  uploaded_file_ids jsonb not null default '[]',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists clients_org_short_code_uq
  on public.clients (org_id, short_code);

create index if not exists clients_org_id_idx on public.clients (org_id);

alter table public.clients enable row level security;

drop policy if exists "clients_all_member" on public.clients;
create policy "clients_all_member"
  on public.clients for all
  using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = clients.org_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = clients.org_id and m.user_id = auth.uid()
    )
  );

-- ─── Quick-quote sessions (list / overview) ───────────────────────────────
create table if not exists public.quotes (
  id text primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  reference_number text not null,
  customer_name text not null,
  status text not null check (status in ('in_progress', 'complete')),
  current_step int not null,
  wizard_schema int,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  customer_client_id text references public.clients (id) on delete set null,
  project_name text,
  total_weight_kg double precision,
  total_area_m2 double precision,
  total_item_qty double precision,
  total_incl_vat double precision
);

create index if not exists quotes_org_id_idx on public.quotes (org_id);
create index if not exists quotes_updated_idx on public.quotes (org_id, updated_at desc);

alter table public.quotes enable row level security;

drop policy if exists "quotes_all_member" on public.quotes;
create policy "quotes_all_member"
  on public.quotes for all
  using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = quotes.org_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = quotes.org_id and m.user_id = auth.uid()
    )
  );

-- ─── Plate project sessions (projects overview) ──────────────────────────
create table if not exists public.projects (
  id text primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  reference_number text not null,
  customer_name text not null,
  project_name text,
  status text not null check (status in ('in_progress', 'complete')),
  current_step int not null,
  material_type text not null
    check (material_type in ('carbonSteel', 'stainlessSteel', 'aluminum')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  total_item_qty double precision,
  total_weight_kg double precision,
  total_area_m2 double precision
);

create index if not exists projects_org_id_idx on public.projects (org_id);
create index if not exists projects_updated_idx on public.projects (org_id, updated_at desc);

alter table public.projects enable row level security;

drop policy if exists "projects_all_member" on public.projects;
create policy "projects_all_member"
  on public.projects for all
  using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = projects.org_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = projects.org_id and m.user_id = auth.uid()
    )
  );

-- ─── Steel types (סיווג per family, org-scoped catalog) ─────────────────
create table if not exists public.steel_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  family text not null check (family in ('carbonSteel', 'stainlessSteel', 'aluminum')),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists steel_types_org_family_name_uq
  on public.steel_types (org_id, family, name);

create index if not exists steel_types_org_idx on public.steel_types (org_id, family, sort_order);

alter table public.steel_types enable row level security;

drop policy if exists "steel_types_all_member" on public.steel_types;
create policy "steel_types_all_member"
  on public.steel_types for all
  using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = steel_types.org_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = steel_types.org_id and m.user_id = auth.uid()
    )
  );

comment on table public.profiles is 'App users (1:1 auth.users). Email lives on auth.users.';
comment on table public.clients is 'Directory of clients (לקוחות) for the org.';
comment on table public.quotes is 'Quick quote list rows (הצעות מחיר).';
comment on table public.projects is 'Plate project list rows (פרויקטים).';
comment on table public.steel_types is 'Steel grade / סיווג catalog per material family.';
