-- Read aggregation for the channel list (workspace channel + DMs, with unread
-- counts and DM-partner resolution) — same "RPC for complex aggregation"
-- pattern as get_team_members / get_campaigns_with_post_summary.
-- SECURITY INVOKER (default): runs under the caller's own RLS, which already
-- permits reading co-members' rows in shared channels — no elevation needed.

create or replace function public.get_my_chat_channels()
returns table (
  channel_id uuid,
  type text,
  last_read_at timestamptz,
  other_user_id uuid,
  last_message_at timestamptz,
  last_message_body text,
  unread_count bigint
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select
    cm.channel_id,
    c.type,
    cm.last_read_at,
    (
      select cm2.user_id from public.chat_channel_members cm2
      where cm2.channel_id = cm.channel_id and cm2.user_id <> auth.uid()
      limit 1
    ) as other_user_id,
    lm.created_at as last_message_at,
    lm.body as last_message_body,
    (
      select count(*) from public.chat_messages msg
      where msg.channel_id = cm.channel_id
        and msg.deleted_at is null
        and msg.author_user_id <> auth.uid()
        and msg.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)
    ) as unread_count
  from public.chat_channel_members cm
  join public.chat_channels c on c.id = cm.channel_id
  left join lateral (
    select body, created_at from public.chat_messages
    where channel_id = cm.channel_id and deleted_at is null
    order by created_at desc
    limit 1
  ) lm on true
  where cm.user_id = auth.uid()
  order by coalesce(lm.created_at, cm.created_at) desc;
$$;

revoke execute on function public.get_my_chat_channels() from public, anon;
grant execute on function public.get_my_chat_channels() to authenticated;;
