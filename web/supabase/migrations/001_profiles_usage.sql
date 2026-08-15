create table if not exists profiles (
  user_id text primary key,
  plan text not null default 'free' check (plan in ('free', 'pro', 'pro_plus')),
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

create table if not exists usage_daily (
  user_id text not null,
  date date not null default current_date,
  request_count integer not null default 0,
  primary key (user_id, date)
);

create index if not exists usage_daily_user_date_idx on usage_daily (user_id, date desc);
