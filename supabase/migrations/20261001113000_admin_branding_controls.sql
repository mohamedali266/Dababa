-- Dababa admin branding controls and safer first-admin bootstrap.
-- Apply after gym tenancy migration.


alter table public.gyms add column if not exists owner_email text;
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values (
  'branding',
  '{
    "appName":"Dababa",
    "shortName":"Dababa",
    "iconLetter":"D",
    "themeColor":"#050A18",
    "backgroundColor":"#050A18",
    "iconBackground":"#2F6BFF",
    "iconForeground":"#FFFFFF"
  }'::jsonb
)
on conflict (key) do nothing;

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_all" on public.app_settings;
create policy "app_settings_select_all" on public.app_settings
for select using (true);

drop policy if exists "app_settings_manage_platform_admin" on public.app_settings;
create policy "app_settings_manage_platform_admin" on public.app_settings
for all using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.can_bootstrap_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.user_roles
    where role::text in ('super_admin', 'admin', 'platform_admin')
  );
$$;

grant execute on function public.can_bootstrap_platform_admin() to authenticated;

