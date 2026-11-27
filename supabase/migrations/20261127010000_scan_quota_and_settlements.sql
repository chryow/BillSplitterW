-- BillSplitterW migration: DB-backed daily OCR scan quota + bill payer & settlement tracking

-- 1. Strict DB-backed daily OCR scan quota (per authenticated user, UTC calendar day)
create table if not exists public.scan_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default ((now() at time zone 'utc')::date),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.scan_usage enable row level security;

-- Users can read their own quota usage; mutations happen strictly via SECURITY DEFINER RPC
drop policy if exists "Users can view own scan usage" on public.scan_usage;
create policy "Users can view own scan usage"
  on public.scan_usage for select
  using (auth.uid() = user_id);

-- Peek today's quota for the authenticated user
create or replace function public.get_scan_quota(p_limit integer default 10)
returns table (
  used integer,
  remaining integer,
  daily_limit integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_reset timestamptz := (date_trunc('day', now() at time zone 'utc') + interval '1 day') at time zone 'utc';
  v_count integer := 0;
begin
  if v_uid is null then
    return query select 0, 0, p_limit, v_reset;
    return;
  end if;

  select coalesce(s.count, 0)
  into v_count
  from public.scan_usage s
  where s.user_id = v_uid
    and s.usage_date = v_today;

  if not found then
    v_count := 0;
  end if;

  return query
  select
    v_count,
    greatest(0, p_limit - v_count),
    p_limit,
    v_reset;
end;
$$;

grant execute on function public.get_scan_quota(integer) to authenticated;

-- Atomically consume 1 scan from today's quota (safe against concurrent requests)
create or replace function public.consume_scan_quota(p_limit integer default 10)
returns table (
  allowed boolean,
  used integer,
  remaining integer,
  daily_limit integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_reset timestamptz := (date_trunc('day', now() at time zone 'utc') + interval '1 day') at time zone 'utc';
  v_new_count integer;
  v_existing_count integer;
begin
  if v_uid is null then
    return query select false, 0, 0, p_limit, v_reset;
    return;
  end if;

  insert into public.scan_usage (user_id, usage_date, count, updated_at)
  values (v_uid, v_today, 1, now())
  on conflict (user_id, usage_date)
  do update set
    count = public.scan_usage.count + 1,
    updated_at = now()
  where public.scan_usage.count < p_limit
  returning public.scan_usage.count into v_new_count;

  if found then
    return query
    select
      true,
      v_new_count,
      greatest(0, p_limit - v_new_count),
      p_limit,
      v_reset;
    return;
  end if;

  select coalesce(s.count, p_limit)
  into v_existing_count
  from public.scan_usage s
  where s.user_id = v_uid
    and s.usage_date = v_today;

  return query
  select
    false,
    coalesce(v_existing_count, p_limit),
    0,
    p_limit,
    v_reset;
end;
$$;

grant execute on function public.consume_scan_quota(integer) to authenticated;

-- 2. Bill payer & Paid/Unpaid settlement tracking
alter table public.bills
  add column if not exists paid_by_participant_id text;

alter table public.bills
  add column if not exists settled_participant_ids jsonb not null default '[]'::jsonb;

-- 3. Expose payer & settlement status on read-only shared bill RPC
drop function if exists public.get_shared_bill(text);

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
  paid_by_participant_id text,
  settled_participant_ids jsonb,
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
    b.paid_by_participant_id,
    b.settled_participant_ids,
    b.created_at
  from public.bills b
  where b.share_slug = p_slug
    and b.is_public = true
  limit 1;
$$;

grant execute on function public.get_shared_bill(text) to anon, authenticated;
