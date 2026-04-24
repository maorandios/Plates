-- Replace org_settings with public.users (per-org row: preferences + sign-in email).
-- Strips unitSystem / companyPhoneSecondary from legacy app_preferences jsonb.

do $$
begin
  if to_regclass('public.org_settings') is not null
     and to_regclass('public.users') is null then
    alter table public.org_settings rename to users;
  end if;
end $$;

-- Column for the authenticated account email (denormalized from auth.users for clarity in SQL).
alter table if exists public.users
  add column if not exists email text;

-- Policies (rename in case an old name survived)
drop policy if exists "org_settings_all" on public.users;
drop policy if exists "users_all" on public.users;

create policy "users_all"
  on public.users for all
  using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = users.org_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = users.org_id and m.user_id = auth.uid()
    )
  );

-- Clean legacy json keys from synced preferences
update public.users
set app_preferences =
  case
    when app_preferences is null then null
    else (app_preferences - 'unitSystem' - 'companyPhoneSecondary')
  end
where true;

comment on table public.users is
  'Per-organization user/workspace settings: app_preferences, material, cutting, and sign-in email. Not auth.users.';
