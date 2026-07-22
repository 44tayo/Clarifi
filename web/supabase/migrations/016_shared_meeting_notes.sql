-- Public share links for meeting recaps (Pro+). Token is unguessable; content is a snapshot.

create table if not exists public.shared_meeting_notes (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  owner_user_id text not null references public.profiles (user_id) on delete cascade,
  community_id uuid references public.communities (id) on delete set null,
  item_id uuid references public.community_items (id) on delete set null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists shared_meeting_notes_token_idx
  on public.shared_meeting_notes (token);

create index if not exists shared_meeting_notes_owner_idx
  on public.shared_meeting_notes (owner_user_id, created_at desc);

alter table public.shared_meeting_notes enable row level security;

create policy "shared_meeting_notes_no_direct_access"
  on public.shared_meeting_notes for all using (false);
