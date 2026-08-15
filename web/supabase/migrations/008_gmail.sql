create table if not exists gmail_connections (
  user_id text primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  email_address text,
  updated_at timestamptz not null default now()
);
