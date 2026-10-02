-- Dababa redesign Phase 1 backend.
-- Additive compatibility migration. Does not drop existing user data or legacy tables.

create extension if not exists pgcrypto;

-- Profiles must be created automatically for every auth user without assigning roles.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists status text not null default 'active' check (status in ('active','suspended','invited'));

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_name text;
begin
  raw_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1),
    'Dababa user'
  )), '');

  insert into public.profiles (id, display_name, full_name, locale, unit_system, theme, status)
  values (new.id, left(coalesce(raw_name, 'Dababa user'), 80), left(coalesce(raw_name, 'Dababa user'), 160), 'ar', 'metric', 'system', 'active')
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name),
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Final role/club tables for the redesigned frontend contract.
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  city text,
  plan text not null default 'basic' check (plan in ('basic','pro','ent')),
  status text not null default 'active' check (status in ('active','suspended')),
  code_prefix text not null unique check (code_prefix ~ '^[A-Z0-9]{3}$'),
  logo_url text,
  legacy_gym_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  role text not null check (role in ('owner','trainer','player')),
  trainer_membership_id uuid references public.memberships(id) on delete set null,
  status text not null default 'active' check (status in ('active','invited','ended','suspended')),
  member_no text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  legacy_membership_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, club_id),
  unique (member_no),
  constraint memberships_trainer_only_for_players check ((role = 'player') or trainer_membership_id is null)
);

create unique index if not exists memberships_one_active_owner_per_club
on public.memberships(club_id)
where role = 'owner' and status in ('active','invited');

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  plan_days integer not null default 30 check (plan_days between 1 and 3660),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '30 days'),
  status text not null default 'active' check (status in ('active','expired','cancelled','pending')),
  price numeric(12,2) not null default 0 check (price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.join_codes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  code text not null unique,
  player_name text not null check (char_length(player_name) between 2 and 120),
  trainer_membership_id uuid references public.memberships(id) on delete set null,
  plan_days integer not null default 30 check (plan_days between 1 and 3660),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  legacy_access_code_id uuid unique,
  created_at timestamptz not null default now(),
  constraint join_codes_use_consistency check ((used_by is null and used_at is null) or (used_by is not null and used_at is not null))
);

create table if not exists public.join_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ip_hash text,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text,
  level text,
  training_days text[] not null default '{}',
  place text,
  injuries text[] not null default '{}',
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists clubs_status_idx on public.clubs(status);
create index if not exists memberships_user_id_idx on public.memberships(user_id);
create index if not exists memberships_club_role_idx on public.memberships(club_id, role);
create index if not exists memberships_trainer_membership_idx on public.memberships(trainer_membership_id);
create index if not exists subscriptions_membership_idx on public.subscriptions(membership_id);
create index if not exists subscriptions_ends_at_idx on public.subscriptions(ends_at);
create index if not exists join_codes_code_idx on public.join_codes(code);
create index if not exists join_codes_club_unused_idx on public.join_codes(club_id, expires_at) where used_by is null;
create index if not exists join_attempts_user_time_idx on public.join_attempts(user_id, attempted_at desc);
create index if not exists assessments_user_id_idx on public.assessments(user_id);

-- Backfill new tables from the legacy names without mutating legacy rows.
insert into public.clubs (id, name, city, plan, status, code_prefix, legacy_gym_id, created_at, updated_at)
select g.id,
       g.name,
       null,
       'basic',
       case when g.status = 'paused' then 'suspended' else 'active' end,
       upper(substr(replace(g.id::text, '-', ''), 1, 3)),
       g.id,
       g.created_at,
       g.updated_at
from public.gyms g
on conflict (id) do nothing;

insert into public.memberships (id, user_id, club_id, role, status, legacy_membership_id, created_at, updated_at)
select gm.id,
       gm.user_id,
       gm.gym_id,
       case gm.role::text when 'coach' then 'trainer' when 'athlete' then 'player' else gm.role::text end,
       case gm.status::text when 'suspended' then 'suspended' when 'invited' then 'invited' else 'active' end,
       gm.id,
       gm.created_at,
       gm.updated_at
from public.gym_memberships gm
where exists (select 1 from public.clubs c where c.id = gm.gym_id)
on conflict (id) do nothing;

insert into public.join_codes (id, club_id, code, player_name, plan_days, expires_at, used_by, used_at, created_by, legacy_access_code_id, created_at)
select aac.id,
       aac.gym_id,
       upper(aac.code),
       aac.athlete_name,
       30,
       coalesce(aac.expires_at, aac.created_at + interval '7 days'),
       aac.assigned_to_user_id,
       aac.claimed_at,
       aac.created_by_user_id,
       aac.id,
       aac.created_at
from public.athlete_access_codes aac
where exists (select 1 from public.clubs c where c.id = aac.gym_id)
on conflict (id) do nothing;

insert into public.assessments (user_id, answers, completed_at, created_at, updated_at)
select distinct on (ha.user_id)
       ha.user_id,
       ha.answers,
       ha.submitted_at,
       ha.created_at,
       ha.updated_at
from public.health_assessments ha
order by ha.user_id, ha.updated_at desc
on conflict (user_id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clubs_set_updated_at on public.clubs;
create trigger clubs_set_updated_at before update on public.clubs for each row execute function public.set_updated_at();
drop trigger if exists memberships_set_updated_at on public.memberships;
create trigger memberships_set_updated_at before update on public.memberships for each row execute function public.set_updated_at();
drop trigger if exists assessments_set_updated_at on public.assessments;
create trigger assessments_set_updated_at before update on public.assessments for each row execute function public.set_updated_at();

create or replace function public.validate_membership_trainer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  trainer_club uuid;
  trainer_role text;
begin
  if new.trainer_membership_id is null then
    return new;
  end if;

  select club_id, role into trainer_club, trainer_role
  from public.memberships
  where id = new.trainer_membership_id;

  if trainer_club is null or trainer_club <> new.club_id or trainer_role <> 'trainer' then
    raise exception 'invalid trainer assignment';
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_validate_trainer on public.memberships;
create trigger memberships_validate_trainer
before insert or update on public.memberships
for each row execute function public.validate_membership_trainer();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
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
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
  );
$$;

create or replace function public.is_club_member(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.memberships m
    join public.clubs c on c.id = m.club_id
    join public.profiles p on p.id = m.user_id
    where m.user_id = auth.uid()
      and m.club_id = target_club_id
      and m.status in ('active','invited')
      and c.status = 'active'
      and p.status = 'active'
  );
$$;

create or replace function public.is_club_owner(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.memberships m
    join public.clubs c on c.id = m.club_id
    join public.profiles p on p.id = m.user_id
    where m.user_id = auth.uid()
      and m.club_id = target_club_id
      and m.role = 'owner'
      and m.status = 'active'
      and c.status = 'active'
      and p.status = 'active'
  );
$$;

create or replace function public.is_trainer_of(player_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.memberships player_m
    join public.memberships trainer_m on trainer_m.id = player_m.trainer_membership_id
    join public.clubs c on c.id = player_m.club_id
    where player_m.user_id = player_user_id
      and trainer_m.user_id = auth.uid()
      and player_m.club_id = trainer_m.club_id
      and player_m.role = 'player'
      and trainer_m.role = 'trainer'
      and player_m.status = 'active'
      and trainer_m.status = 'active'
      and c.status = 'active'
  );
$$;

create or replace function public.normalize_join_code(raw_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(raw_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.preview_join_code(raw_code text)
returns table (club_name text, trainer_name text, plan_days integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := public.normalize_join_code(raw_code);
begin
  return query
  select c.name,
         p.display_name,
         jc.plan_days
  from public.join_codes jc
  join public.clubs c on c.id = jc.club_id
  left join public.memberships tm on tm.id = jc.trainer_membership_id and tm.role = 'trainer'
  left join public.profiles p on p.id = tm.user_id
  where public.normalize_join_code(jc.code) = normalized
    and jc.used_by is null
    and jc.used_at is null
    and jc.expires_at > now()
    and c.status = 'active'
  limit 1;
end;
$$;

create or replace function public.redeem_join_code(raw_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := public.normalize_join_code(raw_code);
  code_row public.join_codes%rowtype;
  membership_id uuid;
  failures integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select count(*) into failures
  from public.join_attempts ja
  where ja.user_id = auth.uid()
    and ja.success = false
    and ja.attempted_at > now() - interval '15 minutes';

  if failures >= 5 then
    raise exception 'join code unavailable';
  end if;

  select * into code_row
  from public.join_codes jc
  where public.normalize_join_code(jc.code) = normalized
  for update;

  if code_row.id is null
     or code_row.used_by is not null
     or code_row.used_at is not null
     or code_row.expires_at <= now()
     or not exists (select 1 from public.clubs c where c.id = code_row.club_id and c.status = 'active')
     or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.club_id = code_row.club_id and m.status <> 'ended') then
    insert into public.join_attempts (user_id, success) values (auth.uid(), false);
    raise exception 'join code unavailable';
  end if;

  insert into public.memberships (user_id, club_id, role, trainer_membership_id, status)
  values (auth.uid(), code_row.club_id, 'player', code_row.trainer_membership_id, 'active')
  returning id into membership_id;

  insert into public.subscriptions (membership_id, plan_days, starts_at, ends_at, status, price)
  values (membership_id, code_row.plan_days, now(), now() + make_interval(days => code_row.plan_days), 'active', 0);

  update public.join_codes
  set used_by = auth.uid(), used_at = now()
  where id = code_row.id;

  insert into public.join_attempts (user_id, success) values (auth.uid(), true);

  perform public.write_audit_log('redeem_join_code', 'membership', membership_id::text, jsonb_build_object('club_id', code_row.club_id, 'join_code_id', code_row.id));

  return membership_id;
end;
$$;

revoke all on function public.preview_join_code(text) from public;
grant execute on function public.preview_join_code(text) to anon, authenticated;
revoke all on function public.redeem_join_code(text) from public;
grant execute on function public.redeem_join_code(text) to authenticated;

alter table public.clubs enable row level security;
alter table public.memberships enable row level security;
alter table public.subscriptions enable row level security;
alter table public.join_codes enable row level security;
alter table public.join_attempts enable row level security;
alter table public.assessments enable row level security;

-- Clubs
DROP POLICY IF EXISTS "clubs_select_scoped" on public.clubs;
create policy "clubs_select_scoped" on public.clubs
for select using (public.is_platform_admin() or public.is_club_member(id));
DROP POLICY IF EXISTS "clubs_admin_insert" on public.clubs;
create policy "clubs_admin_insert" on public.clubs
for insert with check (public.is_platform_admin());
DROP POLICY IF EXISTS "clubs_admin_owner_update" on public.clubs;
create policy "clubs_admin_owner_update" on public.clubs
for update using (public.is_platform_admin() or public.is_club_owner(id)) with check (public.is_platform_admin() or public.is_club_owner(id));

-- Memberships
DROP POLICY IF EXISTS "memberships_select_scoped" on public.memberships;
create policy "memberships_select_scoped" on public.memberships
for select using (public.is_platform_admin() or user_id = auth.uid() or public.is_club_owner(club_id) or public.is_trainer_of(user_id));
DROP POLICY IF EXISTS "memberships_admin_owner_insert" on public.memberships;
create policy "memberships_admin_owner_insert" on public.memberships
for insert with check (public.is_platform_admin() or public.is_club_owner(club_id));
DROP POLICY IF EXISTS "memberships_admin_owner_update" on public.memberships;
create policy "memberships_admin_owner_update" on public.memberships
for update using (public.is_platform_admin() or public.is_club_owner(club_id)) with check (public.is_platform_admin() or public.is_club_owner(club_id));

-- Subscriptions
DROP POLICY IF EXISTS "subscriptions_select_scoped" on public.subscriptions;
create policy "subscriptions_select_scoped" on public.subscriptions
for select using (
  public.is_platform_admin() or exists (
    select 1 from public.memberships m
    where m.id = membership_id
      and (m.user_id = auth.uid() or public.is_club_owner(m.club_id))
  )
);
DROP POLICY IF EXISTS "subscriptions_admin_owner_write" on public.subscriptions;
create policy "subscriptions_admin_owner_write" on public.subscriptions
for all using (
  public.is_platform_admin() or exists (select 1 from public.memberships m where m.id = membership_id and public.is_club_owner(m.club_id))
) with check (
  public.is_platform_admin() or exists (select 1 from public.memberships m where m.id = membership_id and public.is_club_owner(m.club_id))
);

-- Join codes are never readable by players; preview goes through function.
DROP POLICY IF EXISTS "join_codes_staff_select" on public.join_codes;
create policy "join_codes_staff_select" on public.join_codes
for select using (public.is_platform_admin() or public.is_club_owner(club_id));
DROP POLICY IF EXISTS "join_codes_staff_write" on public.join_codes;
create policy "join_codes_staff_write" on public.join_codes
for all using (public.is_platform_admin() or public.is_club_owner(club_id)) with check (public.is_platform_admin() or public.is_club_owner(club_id));

-- Attempts: users can insert their own attempts through RPC; admins can inspect.
DROP POLICY IF EXISTS "join_attempts_admin_read" on public.join_attempts;
create policy "join_attempts_admin_read" on public.join_attempts
for select using (public.is_platform_admin());
DROP POLICY IF EXISTS "join_attempts_own_insert" on public.join_attempts;
create policy "join_attempts_own_insert" on public.join_attempts
for insert with check (user_id = auth.uid());

-- Assessments
DROP POLICY IF EXISTS "assessments_owner_all" on public.assessments;
create policy "assessments_owner_all" on public.assessments
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
DROP POLICY IF EXISTS "assessments_staff_read" on public.assessments;
create policy "assessments_staff_read" on public.assessments
for select using (public.is_platform_admin() or public.is_trainer_of(user_id));