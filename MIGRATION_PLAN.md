# Migration Plan - Redesign Phase 1

Generated: 2026-10-03
Branch: redesign

## Safety Rules
- No `.env*` files are read, printed, rewritten, or committed.
- No existing production user data is dropped or overwritten.
- Existing Supabase URL, keys, Google provider, Vercel settings, and `supabase/config.toml` remain unchanged.
- New migrations are additive or compatibility-oriented. Destructive schema changes are out of scope for this pass.

## Existing Remote State Evidence
- `npx supabase migration list` shows the remote database has applied the same four local migrations:
  - `20260930153000_initial_secure_schema`
  - `20261001093000_gym_tenancy_and_athlete_codes`
  - `20261001113000_admin_branding_controls`
  - `20261001153000_platform_admins_audit_settings`
- `npx supabase db dump --schema public` could not run because Docker/Podman is unavailable on this machine. Therefore schema inspection uses the applied migration files plus the migration list evidence above.

## Conflicts Found
- New spec expects `clubs`; existing schema has `gyms`.
- New spec expects `memberships`; existing schema has `gym_memberships`.
- New spec expects `join_codes`; existing schema has `athlete_access_codes`.
- New spec expects `assessments`; existing schema has `health_assessments`.
- New spec expects singular `audit_log`; existing schema has both old `audit_logs` and newer `audit_log`.
- New spec expects global admin only in `platform_admins`; existing compatibility table `user_roles` still exists from earlier versions.

## Phase 1 Migration Strategy
1. Keep all existing tables intact.
2. Add missing spec tables for Phase 1 with `if not exists`:
   - `clubs`
   - `memberships`
   - `subscriptions`
   - `join_codes`
   - `join_attempts`
   - `assessments`
3. Add profile creation trigger on `auth.users` with pinned `search_path`, no role assignment, tolerant of missing/null metadata.
4. Add/replace security-definer helpers:
   - `is_platform_admin()`
   - `is_active_user()`
   - `is_club_member(uuid)`
   - `is_club_owner(uuid)`
   - `is_trainer_of(uuid)`
   - `preview_join_code(text)`
   - `redeem_join_code(text)`
5. Enable RLS on every new table with default-deny posture and explicit policies.
6. Preserve legacy tables and functions so existing data remains available while the new frontend is wired to the new contract.
7. Add indexes and unique constraints needed for atomic code redemption and role isolation.

## Phase 1 Verification Targets
- Build passes for new frontend.
- Auth routes work with existing Supabase project.
- `/auth`, `/auth/join`, and `/app` render.
- Anonymous join-code preview never exposes the raw code row.
- Authenticated redemption is atomic via SQL function and cannot create duplicate membership in the same club.
- Roles are resolved from `platform_admins` and `memberships.role`, not user metadata.

## Deferred Beyond Phase 1
- Full owner dashboard, trainer workspace, billing, service subscriptions, membership card barcode, attendance scanner, exercise import, and full plan generator.
- Full destructive consolidation from legacy `gyms/*` names into final `clubs/*` names. This requires an explicit data migration window and separate approval.