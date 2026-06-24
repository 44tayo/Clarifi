-- Profile email for community invite lookup
alter table profiles add column if not exists email text;
create index if not exists profiles_email_idx on profiles (lower(email));

-- Communities
create table if not exists communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id text not null references profiles(user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists community_members (
  community_id uuid not null references communities(id) on delete cascade,
  user_id text not null references profiles(user_id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  email text not null,
  invited_by text not null references profiles(user_id) on delete cascade,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists community_invites_email_idx on community_invites (lower(email));
create index if not exists community_invites_token_idx on community_invites (token);

create table if not exists community_folders (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  parent_id uuid references community_folders(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists community_folders_community_idx on community_folders (community_id, parent_id, sort_order);

create table if not exists community_items (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  folder_id uuid references community_folders(id) on delete set null,
  type text not null check (type in ('meeting_recap', 'transcript', 'note')),
  title text not null,
  content jsonb not null default '{}'::jsonb,
  source_session_id text,
  shared_by text not null references profiles(user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists community_items_folder_idx on community_items (community_id, folder_id, created_at desc);

-- RLS
alter table communities enable row level security;
alter table community_members enable row level security;
alter table community_invites enable row level security;
alter table community_folders enable row level security;
alter table community_items enable row level security;

create or replace function public.is_active_community_member(p_community_id uuid, p_user_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from community_members m
    where m.community_id = p_community_id
      and m.user_id = p_user_id
      and m.status = 'active'
  );
$$;

create policy communities_select on communities
  for select using (public.is_active_community_member(id, auth.uid()::text));

create policy community_members_select on community_members
  for select using (public.is_active_community_member(community_id, auth.uid()::text));

create policy community_invites_select on community_invites
  for select using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.is_active_community_member(community_id, auth.uid()::text)
  );

create policy community_folders_select on community_folders
  for select using (public.is_active_community_member(community_id, auth.uid()::text));

create policy community_items_select on community_items
  for select using (public.is_active_community_member(community_id, auth.uid()::text));
