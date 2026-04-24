-- Full quick-quote wizard payload (preview, re-edit) stored on the org-scoped row.
-- Synced with browser local key plate_quote_snapshots_v1; org_domain no longer duplicating this key.

alter table public.quotes
  add column if not exists session_payload jsonb;

comment on column public.quotes.session_payload is
  'Full QuoteSessionSnapshot (v1) JSON: draft, parts, material, slim DXF, etc.';
