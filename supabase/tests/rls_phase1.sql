-- Phase 1 RLS verification notes/checks.
-- Intended for CI/staging with a seeded Supabase test database.
-- These checks avoid mutating production user data.

-- Required tables should have RLS enabled.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','platform_admins','clubs','memberships','subscriptions','join_codes','join_attempts','assessments','water_logs','nutrition_plans','workout_logs')
order by tablename;

-- Required security-definer functions should exist.
select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('is_platform_admin','is_active_user','is_club_member','is_club_owner','is_trainer_of','preview_join_code','redeem_join_code','handle_new_auth_user')
order by proname;

-- Role source audit: roles should be enforced through platform_admins/memberships.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('platform_admins','memberships');