-- Generic IP/key-based rate limiting for unauthenticated or pre-auth endpoints
-- (desktop device pairing, magic-link/OTP confirmation), separate from the
-- per-user LLM quota in consume_clerk_api_quota.
create table if not exists public.ip_rate_limit_events (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists ip_rate_limit_events_key_created_idx
  on public.ip_rate_limit_events (bucket_key, created_at desc);

alter table public.ip_rate_limit_events enable row level security;

create policy "ip_rate_limit_events_no_direct_access"
  on public.ip_rate_limit_events
  for all
  using (false);

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if coalesce(p_key, '') = '' or coalesce(p_limit, 0) <= 0 then
    return jsonb_build_object('allowed', true);
  end if;

  select count(*)::integer into v_count
  from public.ip_rate_limit_events
  where bucket_key = p_key
    and created_at > now() - (p_window_seconds || ' seconds')::interval;

  if v_count >= p_limit then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', p_window_seconds
    );
  end if;

  insert into public.ip_rate_limit_events (bucket_key) values (p_key);

  delete from public.ip_rate_limit_events
  where created_at < now() - interval '1 day';

  return jsonb_build_object('allowed', true);
end;
$$;

-- Supabase grants EXECUTE on new public-schema functions to anon/authenticated
-- by default privileges, separate from the PUBLIC pseudo-role — revoke both
-- explicitly or the function stays callable over PostgREST.
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
