-- Phase 5 fix: the Phase 1 trigger linked every chat notification to a bare
-- '/chat', which silently defaults to the workspace channel (per ChatPage's
-- Phase 3 auto-select) regardless of which conversation the message was
-- actually in — wrong for every DM notification and every mention. Now
-- includes ?channel=<id>&message=<id> so ChatSidebar/ChatPage select the
-- right conversation and ChatThread scrolls to the specific message.
create or replace function public.tg_notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_channel_type text;
  v_recipients uuid[];
  v_link text;
begin
  select type into v_channel_type from public.chat_channels where id = new.channel_id;
  v_link := '/chat?channel=' || new.channel_id || '&message=' || new.id;

  if v_channel_type = 'dm' then
    v_recipients := array(
      select m.user_id from public.chat_channel_members m
      where m.channel_id = new.channel_id and m.user_id <> new.author_user_id
    );

    perform public.emit_notifications(
      new.workspace_id, new.author_user_id, v_recipients,
      'chat_dm', 'New message', left(new.body, 140),
      'chat_channel', new.channel_id, v_link
    );
  else
    if new.mentioned_uids is not null and array_length(new.mentioned_uids, 1) > 0 then
      perform public.emit_notifications(
        new.workspace_id, new.author_user_id, new.mentioned_uids,
        'chat_mention', 'You were mentioned in team chat', left(new.body, 140),
        'chat_channel', new.channel_id, v_link
      );
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.tg_notify_chat_message() from public, anon, authenticated;;
