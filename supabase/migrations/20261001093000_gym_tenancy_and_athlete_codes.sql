-- Dababa gym tenancy, staff roles, and one-time athlete access codes.
-- Apply after the initial secure schema.

create extension if not exists pgcrypto;

do $$
begin
  alter type public.app_role add value if not exists 'platform_admin';
  alter type public.app_role add value if not exists 'gym_owner';
  alter type public.app_role add value if not exists 'coach';
  alter type public.app_role add value if not exists 'athlete';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.gym_member_role as enum ('owner', 'coach', 'athlete');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.gym_member_status as enum ('active', 'invited', 'suspended');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.athlete_code_status as enum ('unused', 'claimed', 'revoked');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'paused')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_memberships (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.gym_member_role not null,
  status public.gym_member_status not null default 'active',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, user_id, role)
);

create table if not exists public.athlete_access_codes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  athlete_name text not null check (char_length(athlete_name) between 2 and 120),
  athlete_email text,
  code text not null unique check (code ~ '^[A-Z0-9]{6,16}$'),
  status public.athlete_code_status not null default 'unused',
  claimed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_codes_claim_consistency check (
    (status = 'claimed' and assigned_to_user_id is not null and claimed_at is not null)
    or (status <> 'claimed')
  )
);

create index if not exists gyms_owner_user_id_idx on public.gyms(owner_user_id);
create index if not exists gym_memberships_user_id_idx on public.gym_memberships(user_id);
create index if not exists gym_memberships_gym_role_idx on public.gym_memberships(gym_id, role);
create index if not exists athlete_access_codes_gym_status_idx on public.athlete_access_codes(gym_id, status);
create index if not exists athlete_access_codes_assigned_user_idx on public.athlete_access_codes(assigned_to_user_id);

drop trigger if exists gyms_set_updated_at on public.gyms;
create trigger gyms_set_updated_at
before update on public.gyms
for each row execute function public.set_updated_at();

drop trigger if exists gym_memberships_set_updated_at on public.gym_memberships;
create trigger gym_memberships_set_updated_at
before update on public.gym_memberships
for each row execute function public.set_updated_at();

drop trigger if exists athlete_access_codes_set_updated_at on public.athlete_access_codes;
create trigger athlete_access_codes_set_updated_at
before update on public.athlete_access_codes
for each row execute function public.set_updated_at();

create or replace function public.is_platform_admin()
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
      and role::text in ('super_admin', 'admin', 'platform_admin')
  );
$$;

create or replace function public.has_gym_role(target_gym_id uuid, allowed_roles public.gym_member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = target_gym_id
      and gm.user_id = auth.uid()
      and gm.status = 'active'
      and gm.role = any(allowed_roles)
  );
$$;

create or replace function public.has_any_gym_membership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_memberships gm
    where gm.user_id = auth.uid()
      and gm.status = 'active'
  );
$$;

create or replace function public.claim_athlete_access_code(raw_code text)
returns table(gym_id uuid, membership_id uuid, athlete_code_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  matched_code public.athlete_access_codes%rowtype;
  inserted_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  normalized_code := upper(regexp_replace(coalesce(raw_code, ''), '[^A-Za-z0-9]', '', 'g'));

  if normalized_code !~ '^[A-Z0-9]{6,16}$' then
    raise exception 'invalid_code' using errcode = '22023';
  end if;

  select * into matched_code
  from public.athlete_access_codes aac
  where aac.code = normalized_code
    and aac.status = 'unused'
    and (aac.expires_at is null or aac.expires_at > now())
  for update;

  if not found then
    raise exception 'code_not_available' using errcode = 'P0002';
  end if;

  insert into public.gym_memberships (gym_id, user_id, role, status, created_by_user_id)
  values (matched_code.gym_id, auth.uid(), 'athlete', 'active', matched_code.created_by_user_id)
  on conflict (gym_id, user_id, role)
  do update set status = 'active', updated_at = now()
  returning id into inserted_membership_id;

  update public.athlete_access_codes
  set status = 'claimed',
      assigned_to_user_id = auth.uid(),
      claimed_at = now(),
      updated_at = now()
  where id = matched_code.id;

  return query select matched_code.gym_id, inserted_membership_id, matched_code.id;
end;
$$;

create or replace function public.create_athlete_access_code(
  target_gym_id uuid,
  athlete_display_name text,
  athlete_contact_email text default null,
  expires_after_days integer default null
)
returns table(id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
  inserted_id uuid;
  attempts integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not (public.is_platform_admin() or public.has_gym_role(target_gym_id, array['owner','coach']::public.gym_member_role[])) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  loop
    attempts := attempts + 1;
    generated_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));

    begin
      insert into public.athlete_access_codes (gym_id, created_by_user_id, athlete_name, athlete_email, code, expires_at)
      values (
        target_gym_id,
        auth.uid(),
        athlete_display_name,
        nullif(athlete_contact_email, ''),
        generated_code,
        case when expires_after_days is null then null else now() + make_interval(days => expires_after_days) end
      )
      returning athlete_access_codes.id into inserted_id;

      return query select inserted_id, generated_code;
      return;
    exception
      when unique_violation then
        if attempts >= 8 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

alter table public.gyms enable row level security;
alter table public.gym_memberships enable row level security;
alter table public.athlete_access_codes enable row level security;

drop policy if exists "gyms_select_platform_or_members" on public.gyms;
create policy "gyms_select_platform_or_members" on public.gyms
for select using (
  public.is_platform_admin()
  or public.has_gym_role(id, array['owner','coach','athlete']::public.gym_member_role[])
);

drop policy if exists "gyms_insert_platform_admin" on public.gyms;
create policy "gyms_insert_platform_admin" on public.gyms
for insert with check (public.is_platform_admin());

drop policy if exists "gyms_update_platform_or_owner" on public.gyms;
create policy "gyms_update_platform_or_owner" on public.gyms
for update using (public.is_platform_admin() or public.has_gym_role(id, array['owner']::public.gym_member_role[]))
with check (public.is_platform_admin() or public.has_gym_role(id, array['owner']::public.gym_member_role[]));

drop policy if exists "gym_memberships_select_scoped" on public.gym_memberships;
create policy "gym_memberships_select_scoped" on public.gym_memberships
for select using (
  user_id = auth.uid()
  or public.is_platform_admin()
  or public.has_gym_role(gym_id, array['owner','coach']::public.gym_member_role[])
);

drop policy if exists "gym_memberships_manage_platform_or_owner" on public.gym_memberships;
create policy "gym_memberships_manage_platform_or_owner" on public.gym_memberships
for all using (
  public.is_platform_admin()
  or public.has_gym_role(gym_id, array['owner']::public.gym_member_role[])
)
with check (
  public.is_platform_admin()
  or public.has_gym_role(gym_id, array['owner']::public.gym_member_role[])
);

drop policy if exists "athlete_codes_select_staff" on public.athlete_access_codes;
create policy "athlete_codes_select_staff" on public.athlete_access_codes
for select using (
  public.is_platform_admin()
  or public.has_gym_role(gym_id, array['owner','coach']::public.gym_member_role[])
  or assigned_to_user_id = auth.uid()
);

drop policy if exists "athlete_codes_manage_staff" on public.athlete_access_codes;
create policy "athlete_codes_manage_staff" on public.athlete_access_codes
for all using (
  public.is_platform_admin()
  or public.has_gym_role(gym_id, array['owner','coach']::public.gym_member_role[])
)
with check (
  public.is_platform_admin()
  or public.has_gym_role(gym_id, array['owner','coach']::public.gym_member_role[])
);

grant execute on function public.claim_athlete_access_code(text) to authenticated;
grant execute on function public.create_athlete_access_code(uuid, text, text, integer) to authenticated;


