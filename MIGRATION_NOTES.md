# Migration Notes

Generated: 2026-10-03
Branch: redesign

## Removed
- Removed the old frontend implementation under `src/app`, `src/components`, and `src/features`.
- Removed old public UI/PWA assets from `public/` because the ZIP frontend did not include those assets.
- Removed old app/admin/auth UI route handlers from the replaced frontend tree.

## Kept
- Kept `.git`, Vercel/Next project configuration, package-lock history, Supabase project config, and all existing real environment files untouched by inspection.
- Kept existing Supabase migrations and added a new non-destructive Phase 1 migration.
- Kept existing Supabase helper modules by preserving/copying them into the new root `lib/supabase` structure.
- Kept existing dependencies required for Supabase (`@supabase/ssr`, `@supabase/supabase-js`) and validation (`zod`).
- Kept `next.config.mjs` security headers rather than replacing them with the smaller ZIP config.

## Changed
- Replaced the old frontend with the ZIP frontend using root `app/`, `components/`, `lib/`, `types/`, `BACKEND.md`, `update.json`, and `design-reference/`.
- Updated `tsconfig.json` path alias from `./src/*` to `./*` for the new frontend layout.
- Wired `lib/data.ts` to Supabase Auth, RLS-backed selects/inserts, and RPC functions.
- Added `/auth/callback` for Google OAuth code exchange with an allow-listed `next` parameter.
- Replaced middleware with route guards for `/app`, `/club`, `/trainer`, and `/admin` based on database roles only.
- Added `20261003120000_redesign_phase1_backend.sql` for additive Phase 1 backend tables, RLS, helpers, profile trigger, join-code preview, and atomic redeem.
- Added Playwright E2E smoke tests and SQL RLS verification queries.

## Existing Schema Conflicts
- New spec names `clubs`; existing production schema had `gyms`.
- New spec names `memberships`; existing production schema had `gym_memberships`.
- New spec names `join_codes`; existing production schema had `athlete_access_codes`.
- New spec names `assessments`; existing production schema had `health_assessments`.
- Existing `user_roles` remains for compatibility, but new role checks use `platform_admins` and `memberships.role`.

## Applied Migration
- `npx supabase db push` applied `20261003120000_redesign_phase1_backend.sql` successfully.
- `npx supabase migration list` shows the migration exists both locally and remotely.