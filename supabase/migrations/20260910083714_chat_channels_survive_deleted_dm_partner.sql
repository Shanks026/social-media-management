-- Keep a DM listable after the other person is hard-deleted.
--
-- chat_channel_members.user_id cascades on auth.users deletion, so their
-- membership row disappears and other_user_id — which is derived from that
-- table — comes back null. The client then cannot resolve a partner and skips
-- the row entirely, which is why a deleted teammate's DM looked deleted even
-- though every message was still sitting in chat_messages.
--
-- other_user_name falls back to the name snapshotted on their messages, so the
-- conversation still renders with the right person on it.
--
-- last_message_author_name is exposed for the same reason: the sidebar's
-- "Name: message" preview in the shared room otherwise has nothing to read
-- once the author is gone.
--
-- DROP + CREATE because the return type changes. Note the explicit revoke from
-- anon: Supabase's default privileges grant EXECUTE on new public functions to
-- anon directly, not via PUBLIC, so REVOKE ... FROM PUBLIC does not cover it.
drop function if exists public.get_my_chat_channels();

create function public.get_my_chat_channels()
returns table(
  channel_id uuid, type text, last_read_at timestamptz, other_user_id uuid,
  other_user_name text, last_message_at timestamptz, last_message_body text,
  last_message_author_id uuid, last_message_author_name text,
  unread_count bigint, has_unread_mention boolean)
language sql stable set search_path to 'public'
as $function$
  select
    cm.channel_id,
    c.type,
    cm.last_read_at,
    (
      select cm2.user_id from public.chat_channel_members cm2
      where cm2.channel_id = cm.channel_id and cm2.user_id <> auth.uid()
      limit 1
    ) as other_user_id,
    (
      select msg.author_name from public.chat_messages msg
      where msg.channel_id = cm.channel_id
        and msg.author_user_id is distinct from auth.uid()
      order by msg.created_at desc
      limit 1
    ) as other_user_name,
    lm.created_at as last_message_at,
    lm.body as last_message_body,
    lm.author_user_id as last_message_author_id,
    lm.author_name as last_message_author_name,
    (
      select count(*) from public.chat_messages msg
      where msg.channel_id = cm.channel_id
        and msg.deleted_at is null
        -- `is distinct from` not `<>`: author_user_id is nullable now, and
        -- `null <> uuid` is null, which would drop a deleted author's
        -- messages out of the unread count entirely.
        and msg.author_user_id is distinct from auth.uid()
        and msg.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)
    ) as unread_count,
    exists (
      select 1 from public.chat_messages msg
      where msg.channel_id = cm.channel_id
        and msg.deleted_at is null
        and msg.author_user_id is distinct from auth.uid()
        and msg.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)
        and auth.uid() = any(msg.mentioned_uids)
    ) as has_unread_mention
  from public.chat_channel_members cm
  join public.chat_channels c on c.id = cm.channel_id
  left join lateral (
    select body, created_at, author_user_id, author_name
    from public.chat_messages
    where channel_id = cm.channel_id and deleted_at is null
    order by created_at desc
    limit 1
  ) lm on true
  where cm.user_id = auth.uid()
  order by coalesce(lm.created_at, cm.created_at) desc;
$function$;

revoke all on function public.get_my_chat_channels() from public;
revoke execute on function public.get_my_chat_channels() from anon;
grant execute on function public.get_my_chat_channels() to authenticated, service_role;;
