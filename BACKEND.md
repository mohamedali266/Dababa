# BACKEND.md — Instructions for Codex (backend + Supabase + Vercel)

The **frontend is finished and final** (Next.js App Router, TypeScript, RTL Arabic, glass design). Your job: build the backend, connect Supabase, protect everything, and deploy on Vercel.
**Do not restyle or restructure UI.** Visual source of truth: `design-reference/*.html`. Security, roles, schema and test requirements: `update.json` (sections `roles_and_permissions`, `data_model`, `auth_flows`, `security_requirements`, `supabase_verification_checklist`, `testing`). Ignore the frontend-building parts of `update.json`. If anything conflicts, **this file wins**.

## 0. Product explanation (read this first)

### 0.1 Why this product exists
Gym owners in Egypt/MENA manage members and subscriptions on paper or WhatsApp. Dababa gives each gym a private workspace (owner, trainers, players, subscriptions) and gives each player a fitness app that works alone or inside one or more gyms. Revenue: each club pays the platform per active player (see section 4).

### 0.2 Who sees what
| Role | Area | Sees and does |
|---|---|---|
| Admin | `/admin` | Creates clubs, then their owner; manages every user (add, edit role, suspend, delete); sets per-player price and plans; records club payments; site settings (logo, name, brand color, toggles); audit log. |
| Owner | `/club` | Only his club. Players list with status (active, expiring within 7 days, expired, pending activation); adds a player and gets a one-time join code to share on WhatsApp; defines extra services and prices; registers players with services and an auto-computed total; manages trainers; scans membership cards. |
| Trainer | `/trainer` | Only players assigned to him. Reviews/approves the auto-suggested plans, edits workouts and nutrition. No money data, no other trainers, no other clubs. |
| Player | `/app` | His own data. Home with daily rings, workout, water, meals, supplements; club switcher (Personal / Club A / Club B); membership card per club; join another club with a code. |

### 0.3 Core journeys
1. **Club onboarding:** Admin creates club -> invites owner by email -> owner activates account -> owner adds trainers -> owner adds players.
2. **Player with a club code:** Owner creates player (name, trainer, plan, services) -> system generates single-use join code (`PLT-XXXXX`, expires, default 7 days) -> owner sends it on WhatsApp -> player signs up (Google or email) and enters the code -> membership + subscription are created -> player completes the assessment -> calories are computed by formula and a **suggested** plan is generated immediately -> trainer later approves or edits it.
3. **Player without a club:** signs up, skips the code, completes the assessment, gets the formula-based calories and a generated personal plan at once. Can join a club later from Account.
4. **Second club:** the same player enters another club's code. Result: a second membership with its own trainer, plan and subscription. The first club is untouched. Billing counts him in each club.
5. **Entering the gym:** the player shows his membership card (permanent `member_no` + barcode). Staff scan it; the screen shows valid / expired / suspended and logs attendance.
6. **Renewal:** owner marks a subscription renewed after receiving cash. Expiring/expired players surface on the owner overview.

### 0.4 Why the design is this way (do not "simplify" these)
- **Player is not owned by a club.** Personal data (body measurements, workout logs) belongs to the user and survives leaving a club; plans and subscriptions belong to the membership. Leaving or being removed from a club ends the trainer's access immediately.
- **Join code is single use; `member_no` is permanent.** The code is a temporary secret for joining; the card number must stay stable for scanning. Never reuse one for the other.
- **Role lives only in the database** (`platform_admins`, `memberships.role`) because anything in `user_metadata` is editable by the user.
- **Totals and prices are computed on the server** and snapshotted on invoices/subscriptions, so price edits never rewrite history and the client can never set a price.
- **Calories by formula, plans by rules:** numbers must be predictable and explainable; no LLM is trusted with health numbers.

### 0.5 Edge cases that must work
- Player in two clubs: separate plans, subscriptions, trainers; leaving one does not affect the other.
- Club suspended (unpaid invoice after grace): its owner, trainers and players lose access to that club only; players keep personal mode and other clubs.
- Subscription expired: player gets read-only access in that club; other clubs unaffected.
- Code used, expired, wrong, or for a club he already belongs to: generic failure to the player; the owner sees the real state.
- Two people redeem the same code at once: exactly one wins.
- Owner removed or suspended: the club stays; admin can assign a new owner (still exactly one active owner per club).
- Last active admin or last owner cannot be deleted or demoted.
- Deleting a club detaches its members (players keep their account and personal data); deleting a user cascades only that user's data.
- Trainer removed: his players become "unassigned" until the owner reassigns; their plans stay.
- Player under 18 or with injuries/health flags: apply the safe limits from section 4 and show the health warning.
- Maintenance mode on: everyone except admins sees the maintenance page.

## 1. What the product is
A multi-tenant Arabic fitness platform. Platform **admin** creates clubs and their **owner**. Owner adds **trainers** and **players**, sells subscriptions. **Players** are standalone users with memberships in 0..N clubs (each club has its own plan, subscription, trainer). A player can also use the app alone (personal mode).

## 2. Rules of engagement
- Existing production project already has Supabase linked, Google sign-in enabled, and Vercel auto-deploy from Git. **Reuse them. Do not change Supabase URL/keys or break the Google provider.** Work on a branch; use Vercel Preview before merging.
- Frontend integration point: **`lib/data.ts`** (+ `types/db.ts`). Replace function bodies with real Supabase calls; **keep names, params and return types**. You may add fields to types, never rename/remove. Put server-only code in `lib/server/` with `import "server-only"`.
- Add middleware/server guards for `/app/*`, `/club/*`, `/trainer/*`, `/admin/*`. Role comes from the DB (`platform_admins`, `memberships.role`), never from `user_metadata` or client input. Authorization = RLS + server code; the UI is cosmetic.
- Service-role key: server env only, never `NEXT_PUBLIC_`, never in client bundles.

## 3. Current contract (`lib/data.ts`)
| Function | Required behavior |
|---|---|
| `signInWithEmail / signUpWithEmail` | Supabase Auth. Sign-up creates profile via trigger, no role, no membership. Generic login errors. Enforce `personal_signup_enabled` server-side. |
| `signInWithGoogle` | Existing Google OAuth, PKCE, `/auth/callback` with allow-listed `next`. |
| `previewJoinCode(code)` | Server route/edge fn, IP rate limit. Returns only `{clubName, trainerName, planDays}` for a valid unused unexpired code; generic error otherwise. |
| `redeemJoinCode(code)` | Authenticated RPC `security definer`: one transaction, row lock, creates membership(player)+subscription, marks code used, audit log, rate limit. Same user can join other clubs; not the same club twice. |
| `getHome()` | Today's rings, workout, water, next meal, supplements for the **active context** (personal or a club). Real empty states, never fake numbers. |
| `addWater(ml)` | Insert water log (validate 1..2000), return new total. |

Frontend currently calls `router.push("/app")` after auth. Redirect by role at `/` and after login (admin→`/admin`, owner→`/club`, trainer→`/trainer`, player→`/app`, player without finished assessment→`/onboarding`).

## 4. Business rules (decided with the client)
- **Payments are manual. No payment gateway.** Players pay the club in cash/at the desk; the owner records it. Clubs pay the platform via **InstaPay or Vodafone Cash**; the admin records the payment (amount, method, reference number, optional receipt image) and marks the invoice paid.
- **Platform billing per club:** price per player is set by the admin (plan: monthly or yearly; optional per-club override). Invoice = active player memberships in that club × price. A player in two clubs counts in **each** club. Snapshot price/quantity on the invoice so later price changes never alter old invoices. Statuses: pending, paid, overdue. Grace period then automatic club suspension (suspended club blocks its members via RLS).
- **Club services:** owner defines extra services with prices (cardio, karate, ...). Registering a player = choose services, **total computed server-side**, each service subscription stores its price at purchase.
- **Membership card:** each membership has a permanent `member_no` (not the join code; the join code is single use). Card shows club, name, `member_no`, and a **Code128 barcode** of `member_no` (optionally a rotating QR later). Scanning at the club resolves to: valid/expired/suspended + attendance log. Scan endpoint is owner/staff only.
- **Calories:** computed by a deterministic formula on the server (Mifflin-St Jeor + activity factor + goal adjustment), with a safe minimum and warnings for injuries/young age. Do not use an LLM for numbers.
- **Workout suggestion:** no paid AI. Import the public-domain **Free Exercise DB** (Unlicense) into an `exercises` table (add `name_ar`), then generate plans with rules: split by days/week, level, goal, equipment/place, exclude exercises by injury. Plans start as `suggested`; the trainer approves or edits.

## 5. Phases (frontend ships each, you wire each)
1. Auth, roles, RLS, join codes, assessment save (**this ZIP covers auth + join + player home**).
2. Player app screens, membership card, plan generator.
3. Owner dashboard: players, services, registration with price total, join code + WhatsApp share.
4. Admin: clubs (create club → owner invite, atomic), users CRUD/suspend/delete, billing, settings (logo via Storage, brand color, toggles), audit log.

## 6. Definition of done
Everything in `update.json` → `supabase_verification_checklist` passes with evidence in `VERIFICATION_REPORT.md`; RLS tests per role; Playwright E2E; `.env.example` updated; `MIGRATION_NOTES.md` and `NOTES.md` written; Vercel Preview works with Google sign-in; no service-role key in the client build.
