create table if not exists hubspot_connections (
  user_id text primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  hub_id bigint,
  auto_sync_enabled boolean not null default true,
  default_contact_email text,
  default_deal_id text,
  updated_at timestamptz not null default now()
);

create table if not exists hubspot_sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  session_id text not null,
  hubspot_note_id text,
  hubspot_task_ids text[] not null default '{}',
  contact_id text,
  deal_id text,
  status text not null check (status in ('success', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now()
);

create unique index if not exists hubspot_sync_log_user_session_idx
  on hubspot_sync_log (user_id, session_id)
  where status = 'success';

create index if not exists hubspot_sync_log_user_created_idx
  on hubspot_sync_log (user_id, created_at desc);
