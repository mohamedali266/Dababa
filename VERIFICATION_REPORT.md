# Verification Report

Generated: 2026-10-03
Branch: redesign

## Build And Static Checks
| Check | Status | Evidence |
| --- | --- | --- |
| `npm install` | PASS | Completed, 0 vulnerabilities reported at install time. |
| `npm run typecheck` | PASS | `tsc --noEmit` completed successfully. |
| `npm run lint` | PASS | ESLint completed successfully after removing unsafe `any` casts. |
| `npm run build` | PASS | Next.js build completed; routes include `/`, `/auth`, `/auth/join`, `/auth/callback`, `/app`, `/app/[section]`. |
| `npm audit --audit-level=moderate` | PASS | Found 0 vulnerabilities. |
| Service role in client bundle | PASS | Search for `SUPABASE_SERVICE_ROLE_KEY|serviceRoleKey` found only server helper files (`lib/env/server.ts`, `lib/supabase/admin.ts`), not `.next/static`. |
| Playwright E2E | PASS | 3 tests passed: auth page renders, join page renders/code input formats, anonymous `/app` redirects to `/auth`. |

## Supabase Migration Evidence
| Check | Status | Evidence |
| --- | --- | --- |
| Remote migration list | PASS | `npx supabase migration list` shows `20261003120000` applied locally and remotely. |
| Migration apply | PASS | `npx supabase db push` applied `20261003120000_redesign_phase1_backend.sql` successfully. |
| Schema dump | BLOCKED | `npx supabase db dump --schema public` requires Docker/Podman, unavailable on this machine. |

## Supabase Checklist
| Item | Status | Evidence / Notes |
| --- | --- | --- |
| RLS enabled on all public tables | PARTIAL PASS | New Phase 1 tables enable RLS in migration. Existing tables from prior migrations already enable RLS. Full live schema dump blocked by missing Docker. |
| Every table has policies per operation | PARTIAL PASS | New Phase 1 tables have explicit policies. Some legacy tables retain prior policies. Full per-operation matrix needs seeded SQL test execution. |
| Auth trigger creates exactly one profile, never assigns role | PASS BY MIGRATION | `handle_new_auth_user()` inserts/upserts `profiles` and `notification_prefs`, no role writes. |
| No code path reads role from user_metadata/client input | PASS | Middleware/root redirects use `is_platform_admin()` and `memberships.role`. |
| Player cannot self-manage memberships or read protected rows | PARTIAL PASS | RLS denies direct player access to join codes; membership insert is owner/admin policy and redeem is RPC. Needs seeded impersonation test. |
| Trainer cannot read outside assignment/revenue | PARTIAL PASS | `is_trainer_of()` exists; no trainer UI in Phase 1. Needs seeded impersonation test. |
| Owner cannot access other clubs or grant admin | PARTIAL PASS | Owner checks are club-scoped; admin role is only `platform_admins`. Needs seeded owner test. |
| Admin endpoints reject non-admins | PARTIAL PASS | Middleware guards `/admin`; new admin UI/endpoints are deferred. |
| `redeem_join_code` atomic/race/generic errors | PARTIAL PASS | SQL function uses `FOR UPDATE`, checks used/expired/same-club, generic thrown error. Race test not executed without seeded concurrent users. |
| Suspended user/club denied | PARTIAL PASS | Helpers check active profile/club; full middleware/RLS seeded test pending. |
| Deleting club/user behavior | PENDING | Phase 1 does not implement destructive admin operations. |
| Last active admin/owner protections | PENDING | Phase 1 does not implement admin demotion/delete flows. |
| Google OAuth callback/open redirect | PASS BY CODE | `/auth/callback` exchanges code and allow-lists `next`. Live provider preview still needs browser confirmation after Vercel preview. |
| Email confirmation/reset/invite links | PARTIAL | Callback route exists for OAuth; email reset/invite pages are not fully built in Phase 1. |
| FK/constraints match invariants | PARTIAL PASS | New constraints cover unique user/club, one active owner, trainer assignment trigger, subscriptions by membership. Full orphan scan pending. |
| Storage policies | PENDING | Branding/avatar storage is outside Phase 1 ZIP scope. |
| Env variable names documented | LIMITED | `.env.example` access/printing was avoided due `.env*` safety instruction. No real env files were read or changed. |

## Test Artifacts
- Playwright config: `playwright.config.ts`
- E2E tests: `tests/e2e/core.spec.ts`
- RLS SQL checks: `supabase/tests/rls_phase1.sql`

## Remaining Before Main Merge
- Confirm Vercel Preview URL manually with Google sign-in.
- Run seeded RLS impersonation tests against a staging database.
- Complete owner/trainer/admin backend phases after Phase 1 approval.
## 2026-10-04 Update

Implemented in this pass:
- Rebuilt `/auth` onboarding to follow `design-reference/dababa-assessment.html` more closely.
- Removed preselected/default onboarding answers for gender, body metrics, goal, level, activity, training days, and duration.
- Added option cards, steppers, training-day chips, optional injuries, final summary, progress persistence/resume, and sticky progress/action controls.
- Removed username from the product flow.
- Google onboarding now pre-fills email/name from the authenticated user when available.
- Added iOS Safari input and background fixes, safe-area bottom padding, and sticky progress below the status bar.
- Added rule-based nutrition and workout plan insertion after assessment completion.
- Fixed home greeting to use first name in `<bdi>` and removed supplement placeholder output for empty data.
- Added `/app/account` with profile, clubs and server-action logout.
- Added basic `/admin/login`, `/admin`, `/admin/clubs`, `/admin/users`, `/admin/billing`, `/admin/settings` pages and stricter middleware behavior for `/admin/*`.
- Added `scripts/seed-admin.ts` without credentials and with `ADMIN_SEED_CONFIRM=yes` refusal guard.

Verification run:
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run test:e2e`: PASS, 4 tests
- 390px screenshots generated locally under `test-results/screenshots/` and intentionally not committed.

Known gaps / not production-complete:
- Full admin mutation backend is not complete yet. Create/edit/suspend/delete, billing invoice creation, receipt upload, logo magic-byte validation, lockout persistence, audit writes for every mutation, and MFA enforcement hooks still need real route handlers/server actions.
- No destructive production admin cleanup was run. See `ADMIN_SETUP_REPORT.md`.
- Admin login is functional but full rate-limit/lockout persistence is not implemented yet.
- `ADMIN_MFA_REQUIRED` is documented as required before launch but not fully enforced yet.
