create table if not exists public.desktop_auth_tokens (
  token text primary key,
  clerk_user_id text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists desktop_auth_tokens_expires_idx
  on public.desktop_auth_tokens (expires_at);

alter table public.desktop_auth_tokens enable row level security;

create policy "desktop_auth_tokens_no_direct_access"
  on public.desktop_auth_tokens
  for all
  using (false);
