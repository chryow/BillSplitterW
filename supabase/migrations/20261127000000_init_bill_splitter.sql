-- BillSplitterW initial schema for Supabase (Postgres + RLS)
-- Automatically applied when connected to Supabase GitHub Integration,
-- or run manually once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

-- 1. User profiles (synced payment info + default currency)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  default_currency text not null default 'IDR',
  payment_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Frequent friends for quick-pick chips in Step 3
create table if not exists public.saved_friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  color text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists saved_friends_user_name_idx
  on public.saved_friends (user_id, lower(trim(name)));

-- 3. Saved bills (split history + optional public share links)
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  share_slug text not null unique,
  is_public boolean not null default true,
  merchant_name text not null default '',
  currency text not null default 'IDR',
  fee_split_mode text not null default 'proportional'
    check (fee_split_mode in ('proportional', 'equal')),
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  service_charge numeric not null default 0,
  discount numeric not null default 0,
  grand_total numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  participants jsonb not null default '[]'::jsonb,
  payment_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bills_user_created_idx
  on public.bills (user_id, created_at desc);

create index if not exists bills_share_slug_idx
  on public.bills (share_slug);

-- Updated-at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists bills_set_updated_at on public.bills;
create trigger bills_set_updated_at
  before update on public.bills
  for each row execute function public.set_updated_at();

-- Auto-create profile row on Google / OAuth signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.saved_friends enable row level security;
alter table public.bills enable row level security;

-- Profiles policies
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Saved friends policies
drop policy if exists "Users can view own saved friends" on public.saved_friends;
create policy "Users can view own saved friends"
  on public.saved_friends for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own saved friends" on public.saved_friends;
create policy "Users can insert own saved friends"
  on public.saved_friends for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own saved friends" on public.saved_friends;
create policy "Users can update own saved friends"
  on public.saved_friends for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own saved friends" on public.saved_friends;
create policy "Users can delete own saved friends"
  on public.saved_friends for delete
  using (auth.uid() = user_id);

-- Bills policies (strictly owner-scoped; public viewing goes through get_shared_bill RPC)
drop policy if exists "Users can view own bills" on public.bills;
create policy "Users can view own bills"
  on public.bills for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own bills" on public.bills;
create policy "Users can insert own bills"
  on public.bills for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own bills" on public.bills;
create policy "Users can update own bills"
  on public.bills for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own bills" on public.bills;
create policy "Users can delete own bills"
  on public.bills for delete
  using (auth.uid() = user_id);

-- Read-only public bill lookup by unguessable share_slug (prevents listing all public bills)
create or replace function public.get_shared_bill(p_slug text)
returns table (
  share_slug text,
  merchant_name text,
  currency text,
  fee_split_mode text,
  subtotal numeric,
  tax numeric,
  service_charge numeric,
  discount numeric,
  grand_total numeric,
  items jsonb,
  participants jsonb,
  payment_info jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    b.share_slug,
    b.merchant_name,
    b.currency,
    b.fee_split_mode,
    b.subtotal,
    b.tax,
    b.service_charge,
    b.discount,
    b.grand_total,
    b.items,
    b.participants,
    b.payment_info,
    b.created_at
  from public.bills b
  where b.share_slug = p_slug
    and b.is_public = true
  limit 1;
$$;

grant execute on function public.get_shared_bill(text) to anon, authenticated;
