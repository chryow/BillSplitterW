-- BillSplitterW migration: Organizer-managed Trips with per-member payment info & read-only /trip/[slug] sharing

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  share_slug text not null unique,
  is_public boolean not null default true,
  name text not null check (char_length(trim(name)) between 1 and 80),
  currency text not null default 'IDR',
  members jsonb not null default '[]'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  settled_transfer_keys jsonb not null default '[]'::jsonb,
  total_spend numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_user_updated_idx
  on public.trips (user_id, updated_at desc);

create index if not exists trips_share_slug_idx
  on public.trips (share_slug);

drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

alter table public.trips enable row level security;

drop policy if exists "Users can view own trips" on public.trips;
create policy "Users can view own trips"
  on public.trips for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own trips" on public.trips;
create policy "Users can insert own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own trips" on public.trips;
create policy "Users can update own trips"
  on public.trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own trips" on public.trips;
create policy "Users can delete own trips"
  on public.trips for delete
  using (auth.uid() = user_id);

-- Read-only public trip lookup by unguessable share_slug
drop function if exists public.get_shared_trip(text);

create or replace function public.get_shared_trip(p_slug text)
returns table (
  share_slug text,
  name text,
  currency text,
  members jsonb,
  expenses jsonb,
  settled_transfer_keys jsonb,
  total_spend numeric,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    t.share_slug,
    t.name,
    t.currency,
    t.members,
    t.expenses,
    t.settled_transfer_keys,
    t.total_spend,
    t.created_at,
    t.updated_at
  from public.trips t
  where t.share_slug = p_slug
    and t.is_public = true
  limit 1;
$$;

grant execute on function public.get_shared_trip(text) to anon, authenticated;
