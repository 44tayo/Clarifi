-- The "Only people invited" toggle in ShareNotesPanel was UI-only state: the
-- public /share/[token] page served content to anyone holding the token
-- regardless of the selected access mode. This adds real server-side
-- enforcement: link_access controls whether the public page requires the
-- viewer to be signed in as an invited email.

alter table public.shared_meeting_notes
  add column if not exists link_access text not null default 'anyone'
    check (link_access in ('anyone', 'invited'));

alter table public.shared_meeting_notes
  add column if not exists invited_emails text[] not null default '{}';
