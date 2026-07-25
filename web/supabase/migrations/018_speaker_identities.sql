-- Rich speaker identity + structured calendar attendees for Jamie-style Speakers UI.
alter table public.user_meetings
  add column if not exists speaker_identities jsonb not null default '{}'::jsonb;

alter table public.user_meetings
  add column if not exists attendees jsonb not null default '[]'::jsonb;
