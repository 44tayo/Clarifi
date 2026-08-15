create policy "waitlist_update_own"
  on waitlist_signups
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
