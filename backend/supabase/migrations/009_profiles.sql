-- ═══════════════════════════════════════════════════════════
--  Profiles table + auto-creation trigger
--
--  Previously created via Supabase SQL Editor.
--  This migration captures the schema in version control so
--  it can be reproduced in any environment.
-- ═══════════════════════════════════════════════════════════

-- ── Profiles table ────────────────────────────────────────
create table if not exists profiles (
  id    uuid primary key references auth.users(id) on delete cascade,
  name  text,
  role  text check (role in ('candidate', 'interviewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────
create index if not exists idx_profiles_role on profiles(role);

-- ── Row Level Security ────────────────────────────────────
alter table profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

-- Users can update their own profile (name/role)
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Users can insert their own profile (for the trigger / edge cases)
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- ── Auto-create profile on signup ─────────────────────────
-- This trigger fires whenever a new row is inserted into auth.users
-- and creates a corresponding profiles row with the user's display name.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop the trigger if it already exists (idempotent)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── updated_at auto-touch ─────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on profiles;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function public.touch_updated_at();
