-- Phase 1 follow-up: persist onboarding identity fields collected by the new registration journey.
-- Additive only; does not rewrite existing profiles or auth data.

alter table public.profiles
  add column if not exists username text,
  add column if not exists birth_date date;

alter table public.profiles
  drop constraint if exists profiles_username_format_check;

alter table public.profiles
  add constraint profiles_username_format_check
  check (username is null or username ~ '^[A-Za-z0-9_]{3,30}$');

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;
