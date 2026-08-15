-- Calendar OAuth connections (Google Calendar + Microsoft Outlook)
-- Tokens are server-only; accessed via service role from Next.js API routes.

create table if not exists public.calendar_connections (
  user_id text not null references public.profiles (user_id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  account_email text,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.calendar_oauth_states (
  state text primary key,
  user_id text not null references public.profiles (user_id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists calendar_oauth_states_expires_idx
  on public.calendar_oauth_states (expires_at);

alter table public.calendar_connections enable row level security;
alter table public.calendar_oauth_states enable row level security;

create policy "calendar_connections_no_direct_access"
  on public.calendar_connections for all using (false);

create policy "calendar_oauth_states_no_direct_access"
  on public.calendar_oauth_states for all using (false);
