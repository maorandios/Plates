-- Full plate-project wizard (DXF, bend items, job details) for package export / re-open.
-- Same pattern as public.quotes.session_payload; no longer only in org_domain_snapshots.

alter table public.projects
  add column if not exists session_payload jsonb;

comment on column public.projects.session_payload is
  'Full PlateProjectSessionSnapshot (v1) JSON.';
