-- Profiles + usage (Clerk user ids as text)
create table if not exists public.profiles (
  user_id text primary key,
  plan text not null default 'free' check (plan in ('free', 'pro', 'pro_plus')),
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_daily (
  user_id text not null,
  date date not null default current_date,
  request_count integer not null default 0,
  primary key (user_id, date)
);

-- Desktop device pairing (opaque credentials — users never see API keys or JWTs)
create table if not exists public.desktop_devices (
  device_id uuid primary key,
  secret_hash text not null,
  pairing_code text unique,
  pairing_expires_at timestamptz,
  clerk_user_id text references public.profiles (user_id) on delete set null,
  paired_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists desktop_devices_pairing_code_idx
  on public.desktop_devices (pairing_code)
  where pairing_code is not null;

-- Server-enforced API quotas per Clerk user
create table if not exists public.api_rate_limit_events (
  id bigint generated always as identity primary key,
  user_id text not null,
  route text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_rate_limit_events_user_route_created_idx
  on public.api_rate_limit_events (user_id, route, created_at desc);

alter table public.profiles enable row level security;
alter table public.usage_daily enable row level security;
alter table public.desktop_devices enable row level security;
alter table public.api_rate_limit_events enable row level security;

create policy "profiles_no_direct_access" on public.profiles for all using (false);
create policy "usage_daily_no_direct_access" on public.usage_daily for all using (false);
create policy "desktop_devices_no_direct_access" on public.desktop_devices for all using (false);
create policy "api_rate_limit_events_no_direct_access" on public.api_rate_limit_events for all using (false);

create or replace function public.consume_clerk_api_quota(
  p_user_id text,
  p_route text,
  p_hourly_limit integer,
  p_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hourly_count integer;
  v_daily_count integer;
begin
  if coalesce(p_user_id, '') = '' then
    return jsonb_build_object('allowed', false, 'reason', 'unauthorized');
  end if;

  if coalesce(p_hourly_limit, 0) <= 0 and coalesce(p_daily_limit, 0) <= 0 then
    return jsonb_build_object('allowed', true);
  end if;

  select count(*)::integer into v_hourly_count
  from public.api_rate_limit_events
  where user_id = p_user_id
    and route = p_route
    and created_at > now() - interval '1 hour';

  if coalesce(p_hourly_limit, 0) > 0 and v_hourly_count >= p_hourly_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limit',
      'window', 'hour',
      'retry_after_seconds', 3600
    );
  end if;

  select count(*)::integer into v_daily_count
  from public.api_rate_limit_events
  where user_id = p_user_id
    and route = p_route
    and created_at > now() - interval '1 day';

  if coalesce(p_daily_limit, 0) > 0 and v_daily_count >= p_daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limit',
      'window', 'day',
      'retry_after_seconds', 86400
    );
  end if;

  insert into public.api_rate_limit_events (user_id, route)
  values (p_user_id, p_route);

  delete from public.api_rate_limit_events
  where created_at < now() - interval '3 days';

  return jsonb_build_object('allowed', true);
end;
$$;

-- Supabase grants EXECUTE on new public-schema functions to anon/authenticated
-- by default privileges, separate from the PUBLIC pseudo-role — revoke both
-- explicitly or the function stays callable over PostgREST.
revoke all on function public.consume_clerk_api_quota(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_clerk_api_quota(text, text, integer, integer) to service_role;
