# Admin Setup Report

Status: partial implementation, no destructive production cleanup was run.

Safety notes:
- No `.env` files were read or committed.
- No Supabase URL/key values were printed.
- No admin privileges were revoked automatically.
- No user accounts were deleted.

Implemented:
- Added `scripts/seed-admin.ts` as an idempotent one-time admin seeder.
- Script refuses to run unless `ADMIN_SEED_CONFIRM=yes`.
- Script reads `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` from environment only.
- If password is missing, script generates and prints one 28-character password once to terminal only.
- Script inserts/updates `platform_admins` and sets `must_change_password` in auth metadata.

Pending before launch:
- Export backup of auth users, profiles, platform_admins, memberships to a gitignored temp folder.
- Dry-run list of current admin-capable accounts, including legacy admin flags and metadata.
- Revoke legacy admin privileges after manual review.
- Delete only admin-only accounts with no personal/player data.
- Enable and enforce admin MFA (`ADMIN_MFA_REQUIRED=true`) before launch.
