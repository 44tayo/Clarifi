-- Track Stripe trial end so desktop can show a 30-day trial progress bar.
alter table public.profiles
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_status text;

comment on column public.profiles.trial_ends_at is
  'Stripe subscription.trial_end when status is trialing; cleared when trial ends.';
comment on column public.profiles.subscription_status is
  'Latest Stripe subscription.status (trialing, active, canceled, …).';
