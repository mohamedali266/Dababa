# Notes

## Assumptions
- Existing `gyms`, `gym_memberships`, and `athlete_access_codes` are treated as the current club/membership/join-code implementation and extended rather than dropped.
- `platform_admins` is the source of truth for global admins going forward. Existing `user_roles` rows are kept only for compatibility and migration.
- When a requirement is ambiguous, the more restrictive rule is used.
- Reference mockups were provided in `style/` and copied into `design-reference/` with the filenames expected by `update.json`.

## Security Decisions
- Admin verification must happen on the server before rendering admin UI.
- Public sign-up never accepts a role.
- Client UI may hide controls, but database/server checks decide access.
- Service role usage stays in server-only modules and route handlers.
- Mutating route handlers should reject cross-origin POST requests.

## Current Limitations
- Full multi-tenant club/owner/trainer/player isolation needs additional database migration and RLS tests.
- Trainer area remains a guarded scaffold target until its schema and assignment rules are fully migrated.
- E2E and RLS tests are documented as deliverables but not yet complete.
