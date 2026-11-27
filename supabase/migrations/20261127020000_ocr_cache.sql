-- BillSplitterW migration: DB-backed SHA-256 OCR cache (24h TTL across serverless instances)

create table if not exists public.ocr_cache (
  image_hash text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ocr_cache_expires_at_idx
  on public.ocr_cache (expires_at);

alter table public.ocr_cache enable row level security;

-- No direct client SELECT/INSERT/UPDATE policies: strictly accessed via SECURITY DEFINER RPCs
-- by authenticated users from our server API route.

create or replace function public.get_ocr_cache(p_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select c.payload
  into v_payload
  from public.ocr_cache c
  where c.image_hash = p_hash
    and c.expires_at > now()
  limit 1;

  return v_payload;
end;
$$;

grant execute on function public.get_ocr_cache(text) to authenticated;

create or replace function public.set_ocr_cache(
  p_hash text,
  p_payload jsonb,
  p_ttl_hours integer default 24
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ttl integer := greatest(1, least(coalesce(p_ttl_hours, 24), 168));
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.ocr_cache (image_hash, payload, expires_at, created_at)
  values (p_hash, p_payload, now() + make_interval(hours => v_ttl), now())
  on conflict (image_hash)
  do update set
    payload = excluded.payload,
    expires_at = excluded.expires_at;

  -- Lazily clean up expired cache entries
  delete from public.ocr_cache
  where expires_at <= now();
end;
$$;

grant execute on function public.set_ocr_cache(text, jsonb, integer) to authenticated;
