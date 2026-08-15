-- Synced meeting notes for paired desktop accounts (no audio blobs).
-- Accessed via service role from device-auth Next.js routes only.

create table if not exists public.user_meetings (
  user_id text not null references public.profiles (user_id) on delete cascade,
  meeting_id text not null,
  title text not null,
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  started_at_ms bigint,
  ended_at_ms bigint,
  status text not null,
  user_notes text not null default '',
  transcript jsonb not null default '[]'::jsonb,
  speaker_labels jsonb not null default '{}'::jsonb,
  calendar_event_id text,
  calendar_provider text,
  scheduled_start_ms bigint,
  attendee_emails jsonb not null default '[]'::jsonb,
  folder_ids jsonb not null default '[]'::jsonb,
  enhanced_notes text,
  summary text,
  action_items jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (user_id, meeting_id)
);

create index if not exists user_meetings_user_updated_idx
  on public.user_meetings (user_id, updated_at_ms desc);

alter table public.user_meetings enable row level security;

create policy "user_meetings_no_direct_access"
  on public.user_meetings for all using (false);
