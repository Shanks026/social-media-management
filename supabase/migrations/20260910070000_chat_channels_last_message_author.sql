-- The chat sidebar shows "Name: message" for the shared workspace room, the
-- way a group thread does elsewhere — in a room with everyone in it, the
-- preview is ambiguous without knowing who wrote it. The last message was
-- already being fetched by the lateral join below; only its author was being
-- dropped, so this exposes that column rather than doing any new work.
--
-- Adding a column to a RETURNS TABLE is a signature change, so DROP + CREATE.
-- The prior grants were authenticated + service_role (no anon, no PUBLIC) and
-- are restored explicitly, since DROP discards them.
drop function if exists public.get_my_chat_channels();

create function public.get_my_chat_channels()
returns table(
  channel_id uuid, type text, last_read_at timestamptz, other_user_id uuid,
  last_message_at timestamptz, last_message_body text, last_message_author_id uuid,
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
    lm.created_at as last_message_at,
    lm.body as last_message_body,
    lm.author_user_id as last_message_author_id,
    (
      select count(*) from public.chat_messages msg
      where msg.channel_id = cm.channel_id
        and msg.deleted_at is null
        and msg.author_user_id <> auth.uid()
        and msg.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)
    ) as unread_count,
    exists (
      select 1 from public.chat_messages msg
      where msg.channel_id = cm.channel_id
        and msg.deleted_at is null
        and msg.author_user_id <> auth.uid()
        and msg.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)
        and auth.uid() = any(msg.mentioned_uids)
    ) as has_unread_mention
  from public.chat_channel_members cm
  join public.chat_channels c on c.id = cm.channel_id
  left join lateral (
    select body, created_at, author_user_id from public.chat_messages
    where channel_id = cm.channel_id and deleted_at is null
    order by created_at desc
    limit 1
  ) lm on true
  where cm.user_id = auth.uid()
  order by coalesce(lm.created_at, cm.created_at) desc;
$function$;

revoke all on function public.get_my_chat_channels() from public;
grant execute on function public.get_my_chat_channels() to authenticated, service_role;
