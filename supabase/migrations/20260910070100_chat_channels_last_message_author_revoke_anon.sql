-- The preceding DROP + CREATE picked up Supabase's default privileges for new
-- functions in `public`, which grant EXECUTE to anon directly (not via
-- PUBLIC), so the REVOKE ... FROM PUBLIC in that migration did not remove it.
-- The function had no anon grant before, and restoring that is the point here.
--
-- Not exploitable either way: the function is SECURITY INVOKER and filters on
-- cm.user_id = auth.uid(), which is null for anon, so it returns zero rows.
-- Revoked regardless — the grant surface should match what was there before.
revoke execute on function public.get_my_chat_channels() from anon;
