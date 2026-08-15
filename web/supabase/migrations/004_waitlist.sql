create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  constraint waitlist_signups_user_id_key unique (user_id),
  constraint waitlist_signups_email_key unique (email)
);

create index if not exists waitlist_signups_created_at_idx on waitlist_signups (created_at desc);

alter table waitlist_signups enable row level security;

create policy "waitlist_insert_own"
  on waitlist_signups
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "waitlist_select_own"
  on waitlist_signups
  for select
  to authenticated
  using (auth.uid() = user_id);
