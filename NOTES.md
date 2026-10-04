# Notes

Generated: 2026-10-03
Branch: redesign

## Assumptions
- The ZIP frontend is the source of truth for UI. I did not merge old UI screens into it.
- Existing production data must remain intact, so the Phase 1 schema is additive and keeps legacy tables available.
- Because Docker/Podman is not installed, `supabase db dump --schema public` could not be used. Remote schema evidence comes from `npx supabase migration list` plus local migration files that match the remote applied migration list.
- `BACKEND.md` wins over `update.json` when the two conflict.
- Email confirmation behavior follows `BACKEND.md`; if Supabase email delivery is not configured, email signup can return a confirmation-needed message.
- Full owner/trainer/admin UI phases are not implemented in this Phase 1 pass because `BACKEND.md` says the ZIP covers auth + join + player home.

## Security Decisions
- Service-role usage remains only in server-only helper modules.
- Client-side `lib/data.ts` uses browser Supabase Auth, RLS-backed database operations, and RPC. It does not import service-role helpers.
- Join-code preview and redeem use SQL functions; preview returns only club/trainer/plan-days and redeem is atomic in one transaction.
- Middleware resolves roles from `platform_admins` and `memberships.role`, never from user metadata.
- OAuth callback validates the `next` path against a local allow-list.

## Known Limitations
- Full Supabase checklist cannot be completely proven without seeded role users and a staging database test harness.
- Google sign-in Preview confirmation requires opening the Vercel Preview URL after push and using the configured Google provider in a browser.
- `.env.example` was not printed or inspected because `.env*` access was treated as prohibited by the safety instruction. No real `.env` values were read or changed.
- The Next.js 16 build warns that `middleware.ts` is deprecated in favor of `proxy.ts`; this is a warning, not a build failure.
## 2026-10-04 Notes

- Do not enable production launch until admin MFA is enforced. `ADMIN_MFA_REQUIRED` must default false during development but be set true before launch, with Supabase AAL2/TOTP enrollment enforced for `/admin/*`.
- The current admin panel has read views and guarded routing; high-risk mutations intentionally remain pending rather than implemented partially without complete validation, audit logging, and rollback behavior.
- Admin cleanup/revocation was not executed because it requires a verified backup and manual review of accounts that may contain personal/player data.
- The onboarding flow persists draft progress in localStorage, excluding password fields.
