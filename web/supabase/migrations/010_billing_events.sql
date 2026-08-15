-- Billing/analytics event log + MRR views for the admin dashboard.
-- Tracks account_created, trial_started, billing_started/updated/canceled.

-- 1. Account age on profiles (previously only updated_at existed)
alter table profiles add column if not exists created_at timestamptz;

update profiles p
set created_at = u.created_at
from auth.users u
where u.id::text = p.user_id
  and p.created_at is null;

update profiles
set created_at = updated_at
where created_at is null;

alter table profiles alter column created_at set default now();
alter table profiles alter column created_at set not null;

-- 2. Append-only event log.
--    No FK on user_id on purpose: profiles rows are created lazily, so an
--    account_created event can predate its profile row. Events must survive
--    independently of referential integrity.
create table if not exists billing_events (
  id                     bigint generated always as identity primary key,
  event_type             text not null check (event_type in (
                            'account_created',
                            'trial_started',
                            'trial_ended',
                            'billing_started',
                            'billing_updated',
                            'billing_canceled'
                          )),
  user_id                text,
  email                  text,
  plan                   text check (plan in ('free', 'pro', 'pro_plus')),
  quantity               integer not null default 1,
  amount_cents           integer,
  currency               text default 'usd',
  billing_interval       text check (billing_interval in ('month', 'year')),
  platform               text check (platform in ('mac', 'windows')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  stripe_event_id        text unique,
  metadata               jsonb not null default '{}'::jsonb,
  event_at               timestamptz not null default now(),
  created_at             timestamptz not null default now()
);

create index if not exists billing_events_type_time_idx
  on billing_events (event_type, event_at desc);
create index if not exists billing_events_user_time_idx
  on billing_events (user_id, event_at desc);
create index if not exists billing_events_sub_time_idx
  on billing_events (stripe_subscription_id, event_at desc);

alter table billing_events enable row level security;
revoke all on billing_events from anon, authenticated;

-- 3. account_created: driven by Supabase Auth (no Clerk webhook needed).
create or replace function public.log_account_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.billing_events (event_type, user_id, email, event_at)
  values ('account_created', new.id::text, new.email, coalesce(new.created_at, now()));
  return new;
end;
$$;

-- Trigger function is internal-only; block RPC access from API roles.
revoke execute on function public.log_account_created() from anon, authenticated, public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.log_account_created();

-- Backfill account_created for existing auth users.
insert into billing_events (event_type, user_id, email, event_at)
select 'account_created', u.id::text, u.email, u.created_at
from auth.users u;

-- 4. Dashboard views (security_invoker so they respect RLS — only the
--    service role, which bypasses RLS, can read them).

-- Daily flow: signups, trials, conversions, seats, and new MRR added.
create or replace view billing_events_daily
with (security_invoker = on) as
select
  date_trunc('day', event_at)::date as day,
  event_type,
  plan,
  count(*)                       as events,
  sum(quantity)                  as total_quantity,
  sum(coalesce(amount_cents, 0)) as total_amount_cents,
  sum(
    case when billing_interval = 'year'
      then coalesce(amount_cents, 0) / 12.0
      else coalesce(amount_cents, 0)
    end
  )                              as mrr_cents_added
from billing_events
group by 1, 2, 3;

-- Latest known state per subscription.
create or replace view billing_subscription_state
with (security_invoker = on) as
select distinct on (stripe_subscription_id)
  stripe_subscription_id,
  user_id,
  email,
  plan,
  quantity,
  amount_cents,
  billing_interval,
  currency,
  event_type,
  event_at
from billing_events
where stripe_subscription_id is not null
order by stripe_subscription_id, event_at desc, id desc;

-- Current MRR snapshot (trials and canceled subscriptions excluded).
create or replace view billing_mrr
with (security_invoker = on) as
select
  coalesce(sum(
    case when billing_interval = 'year'
      then amount_cents / 12.0
      else amount_cents
    end
  ), 0)::bigint            as mrr_cents,
  count(*)                 as active_paid_subscriptions,
  coalesce(sum(quantity), 0) as total_paid_seats
from billing_subscription_state
where event_type in ('billing_started', 'billing_updated');

revoke all on billing_events_daily from anon, authenticated;
revoke all on billing_subscription_state from anon, authenticated;
revoke all on billing_mrr from anon, authenticated;
