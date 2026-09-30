-- Dababa initial secure schema.
-- Apply with the Supabase CLI or paste into the Supabase SQL editor for the selected project.

create extension if not exists pgcrypto;

create type public.app_role as enum ('user', 'admin', 'super_admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  theme text not null default 'system' check (theme in ('dark', 'light', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.health_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid references public.health_assessments(id) on delete set null,
  title text not null,
  goal text not null,
  prompt_version text,
  source_inputs jsonb not null default '{}'::jsonb,
  plan jsonb not null,
  starts_on date,
  created_at timestamptz not null default now()
);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  training_plan_id uuid references public.training_plans(id) on delete set null,
  workout_date date not null default current_date,
  title text not null,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  exercise_name text not null,
  set_number integer not null check (set_number > 0),
  reps integer check (reps >= 0 and reps <= 1000),
  weight_kg numeric(6,2) check (weight_kg >= 0 and weight_kg <= 1000),
  duration_seconds integer check (duration_seconds >= 0 and duration_seconds <= 86400),
  created_at timestamptz not null default now()
);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,2) check (weight_kg >= 20 and weight_kg <= 350),
  waist_cm numeric(5,2) check (waist_cm >= 30 and waist_cm <= 250),
  notes text,
  created_at timestamptz not null default now()
);

create table public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calories integer not null check (calories between 1200 and 6000),
  protein_g integer not null check (protein_g between 0 and 400),
  carbs_g integer not null check (carbs_g between 0 and 800),
  fat_g integer not null check (fat_g between 0 and 300),
  formula text not null,
  prompt_version text,
  source_inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'post_workout')),
  name text not null,
  calories integer check (calories >= 0 and calories <= 3000),
  protein_g integer check (protein_g >= 0 and protein_g <= 250),
  carbs_g integer check (carbs_g >= 0 and carbs_g <= 400),
  fat_g integer check (fat_g >= 0 and fat_g <= 200),
  created_at timestamptz not null default now()
);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ml integer not null check (amount_ml > 0 and amount_ml <= 3000),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.supplement_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text not null,
  schedule jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table public.supplement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplement_plan_id uuid references public.supplement_plans(id) on delete set null,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workout_reminders boolean not null default true,
  water_reminders boolean not null default true,
  supplement_reminders boolean not null default true,
  meal_reminders boolean not null default false,
  weekly_progress boolean not null default true,
  quiet_hours jsonb not null default '{"enabled":true,"start":"23:00","end":"07:00"}'::jsonb,
  timezone text not null default 'Africa/Cairo',
  updated_at timestamptz not null default now()
);

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  prompt_version text not null,
  input_hash text not null,
  token_estimate integer check (token_estimate >= 0),
  status text not null check (status in ('started', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profiles_locale_idx on public.profiles(locale);
create index health_assessments_user_id_idx on public.health_assessments(user_id);
create index training_plans_user_id_idx on public.training_plans(user_id);
create index workout_logs_user_id_date_idx on public.workout_logs(user_id, workout_date desc);
create index set_logs_user_id_idx on public.set_logs(user_id);
create index body_metrics_user_id_date_idx on public.body_metrics(user_id, measured_on desc);
create index nutrition_plans_user_id_idx on public.nutrition_plans(user_id);
create index meal_logs_user_id_logged_at_idx on public.meal_logs(user_id, logged_at desc);
create index water_logs_user_id_logged_at_idx on public.water_logs(user_id, logged_at desc);
create index supplement_plans_user_id_idx on public.supplement_plans(user_id);
create index supplement_logs_user_id_taken_at_idx on public.supplement_logs(user_id, taken_at desc);
create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index ai_requests_user_id_created_at_idx on public.ai_requests(user_id, created_at desc);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger health_assessments_set_updated_at
before update on public.health_assessments
for each row execute function public.set_updated_at();

create trigger notification_prefs_set_updated_at
before update on public.notification_prefs
for each row execute function public.set_updated_at();

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = required_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('admin') or public.has_role('super_admin');
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.health_assessments enable row level security;
alter table public.training_plans enable row level security;
alter table public.workout_logs enable row level security;
alter table public.set_logs enable row level security;
alter table public.body_metrics enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.meal_logs enable row level security;
alter table public.water_logs enable row level security;
alter table public.supplement_plans enable row level security;
alter table public.supplement_logs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.ai_requests enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
for select using (id = auth.uid() or public.is_admin());
create policy "profiles_insert_own" on public.profiles
for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "user_roles_select_own_or_admin" on public.user_roles
for select using (user_id = auth.uid() or public.is_admin());

create policy "health_assessments_owner_all" on public.health_assessments
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "health_assessments_admin_read" on public.health_assessments
for select using (public.is_admin());

create policy "training_plans_owner_all" on public.training_plans
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workout_logs_owner_all" on public.workout_logs
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "set_logs_owner_all" on public.set_logs
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "body_metrics_owner_all" on public.body_metrics
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "nutrition_plans_owner_all" on public.nutrition_plans
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "meal_logs_owner_all" on public.meal_logs
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "water_logs_owner_all" on public.water_logs
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "supplement_plans_owner_all" on public.supplement_plans
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "supplement_logs_owner_all" on public.supplement_logs
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_subscriptions_owner_all" on public.push_subscriptions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notification_prefs_owner_all" on public.notification_prefs
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_requests_owner_read" on public.ai_requests
for select using (user_id = auth.uid() or public.is_admin());
create policy "audit_logs_admin_read" on public.audit_logs
for select using (public.is_admin());

-- Inserts into ai_requests, audit_logs, and user_roles should go through server-only code
-- using the Supabase service role after explicit authorization checks.
