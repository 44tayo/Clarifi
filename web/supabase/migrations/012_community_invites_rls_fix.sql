-- The original community_invites_select policy let any active member of a
-- community read every pending invite (including other members' invite
-- tokens), not just their own. Restrict SELECT to the invitee themself or
-- the user who created the invite.
drop policy if exists community_invites_select on community_invites;

create policy community_invites_select on community_invites
  for select using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or invited_by = auth.uid()::text
  );
