# Dababa Deployment Runbook

## Local secrets

Keep real secrets only in `.env.local`. Do not commit `.env` or `.env.local`.

Required for the app:

```env
NEXT_PUBLIC_SUPABASE_URL="https://hktlzrujzifrhltocgox.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

## Supabase

Login once on this machine:

```powershell
npm run supabase:login
```

Link this repo to the remote project:

```powershell
npm run supabase:link
```

Apply migrations:

```powershell
npm run supabase:push
```

The initial migration is in `supabase/migrations` and enables RLS on every app table.

## Vercel

Login once on this machine:

```powershell
npm run vercel:login
```

Link the local repo to the Vercel project:

```powershell
npm run vercel:link
```

Add environment variables in Vercel for Production, Preview, and Development:

```powershell
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
```

Deploy preview:

```powershell
npm run vercel:deploy
```

Deploy production:

```powershell
npm run vercel:deploy:prod
```

## Pre-deploy checks

```powershell
npm run check
npm audit --omit=dev
```
