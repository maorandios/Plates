-- Grades, stock sizes, and finishes are stored in public.users.material_config (JSONB).
-- The steel_types table duplicated one row per enabled grade per user.
drop table if exists public.steel_types;
