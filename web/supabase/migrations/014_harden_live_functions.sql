-- Live-database security advisor found two gaps not caught by the earlier
-- migration set (the numbered migrations in this folder had not actually
-- been applied to the live project — its real history diverged, having
-- been evolved directly rather than through this migration folder):
--
-- 1. consume_clerk_api_quota is defined with `revoke all ... grant to
--    service_role` in 002_desktop_auth_rate_limits.sql, but the live
--    database currently allows the `anon` and `authenticated` roles to
--    call it via PostgREST (/rest/v1/rpc/consume_clerk_api_quota). Since
--    it takes an arbitrary p_user_id/p_route, an unauthenticated caller
--    could otherwise manipulate another user's rate-limit counters.
--    Re-assert the intended grants.
revoke all on function public.consume_clerk_api_quota(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_clerk_api_quota(text, text, integer, integer) to service_role;

-- 2. is_active_community_member had a mutable search_path (flagged by the
--    Supabase security advisor). It's called from inside RLS policies, so
--    pin its search_path to prevent search_path hijacking.
create or replace function public.is_active_community_member(p_community_id uuid, p_user_id text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from community_members m
    where m.community_id = p_community_id
      and m.user_id = p_user_id
      and m.status = 'active'
  );
$$;
