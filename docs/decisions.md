# Dababa Decisions

- The first UI build still uses local mock data, but Supabase clients and the initial secure schema are now scaffolded. Env validation only runs when a Supabase client is created so local builds do not fail before `.env.local` is filled.
- Theme choice is persisted in `localStorage` for the prototype. The guild's cookie/server-first theme rule should be implemented when authentication and user profiles are added.
- PWA files are static and conservative. The service worker only caches the app shell and never authenticated API responses or health data.
- The initial migration enables RLS on every app table. Admin and AI/audit writes are intentionally reserved for server-only code using explicit authorization checks.
