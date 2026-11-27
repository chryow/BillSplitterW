-- BillSplitterW migration: Add delivery_fee (Ongkir / App / Packaging Fee) to bills and public share RPC

alter table public.bills
  add column if not exists delivery_fee numeric not null default 0;

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
  delivery_fee numeric,
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
    b.delivery_fee,
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
