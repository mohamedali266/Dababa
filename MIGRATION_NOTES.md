# Migration Notes

## Kept
- Existing Next.js App Router structure under `src/app`.
- Existing Supabase Auth integration through `@supabase/ssr`.
- Existing personal-mode dashboard features: workout, tracking, nutrition, hydration, supplements, progress, settings.
- Existing PWA branding endpoints and admin branding controls.
- Existing gym tenancy tables (`gyms`, `gym_memberships`, `athlete_access_codes`) to avoid destructive rewrites.
- Existing secure server-only Supabase service-role module.

## Changed
- Admin access remains separated at `/admin/login` and `/admin`, with stricter server-side checks.
- Global platform admin authority is being moved to/verified through `platform_admins` as required by `update.json`, while keeping `user_roles` compatibility during migration.
- Admin and owner mutations are handled through server route handlers only, with zod validation.
- Dashboard avoids fake numbers when real user data is missing; empty states are preferred.
- Onboarding/auth flow is being split toward the requested route model, while preserving working Google/email auth.
- Security headers and environment documentation are being tightened to match the spec.

## Removed / Avoided
- No role selection in public sign-up.
- No admin creation from public routes.
- No admin email/password/user hints in public UI.
- No client-side trust for role checks.
- No fake demo metrics before real data exists.

## Pending By Design
- Reference mockups are available in `design-reference/`, copied from the provided `style/` directory. Pixel-faithful reproduction remains pending as a UI implementation task.
- Full replacement of the existing schema with the exact `update.json` data model would be destructive; current work extends existing tables safely.
- Full pgTAP/Playwright coverage requires adding test harnesses and fixtures beyond the current project setup.
