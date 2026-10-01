-- Dababa platform admin source-of-truth, audit log, and settings compatibility layer.
-- Extends existing schema without dropping current tables.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists gender text check (gender is null or gender in ('male','female','prefer_not_to_say'));
alter table public.profiles add column if not exists birth_year integer check (birth_year is null or birth_year between 1900 and 2100);
alter table public.profiles add column if not exists height_cm numeric(5,2) check (height_cm is null or height_cm between 80 and 260);
alter table public.profiles add column if not exists weight_kg numeric(5,2) check (weight_kg is null or weight_kg between 20 and 350);
alter table public.profiles add column if not exists status text not null default 'active' check (status in ('active','suspended','invited'));

update public.profiles
set full_name = coalesce(full_name, display_name)
where full_name is null;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.platform_admins (user_id)
select distinct user_id
from public.user_roles
where role::text in ('admin', 'super_admin', 'platform_admin')
on conflict (user_id) do nothing;

create table if not exists public.site_settings (
  id boolean primary key default true,
  site_name text not null default 'Dababa',
  logo_path text,
  brand_color text not null default '#2F6BFF' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  google_login_enabled boolean not null default true,
  personal_signup_enabled boolean not null default true,
  maintenance_mode boolean not null default false,
  expiry_notifications boolean not null default true,
  code_expiry_days integer not null default 14 check (code_expiry_days between 1 and 365),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint site_settings_single_row check (id)
);

insert into public.site_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 2 and 120),
  target_type text not null check (char_length(target_type) between 2 and 80),
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_created_idx on public.audit_log(actor_id, created_at desc);
create index if not exists audit_log_target_idx on public.audit_log(target_type, target_id);
create index if not exists profiles_status_idx on public.profiles(status);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    join public.profiles p on p.id = pa.user_id
    where pa.user_id = auth.uid()
      and p.status = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
  );
$$;

alter table public.platform_admins enable row level security;
alter table public.site_settings enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.platform_admins from anon, authenticated;
revoke all on public.audit_log from anon, authenticated;

drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read" on public.site_settings
for select to anon, authenticated
using (true);

drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write" on public.site_settings
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "audit_log_admin_read" on public.audit_log;
create policy "audit_log_admin_read" on public.audit_log
for select to authenticated
using (public.is_platform_admin());

create or replace function public.write_audit_log(
  action_name text,
  target_kind text,
  target_identifier text default null,
  event_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), action_name, target_kind, target_identifier, coalesce(event_details, '{}'::jsonb))
  returning id into inserted_id;
  return inserted_id;
end;
$$;

revoke all on function public.write_audit_log(text, text, text, jsonb) from public;
grant execute on function public.write_audit_log(text, text, text, jsonb) to authenticated;
