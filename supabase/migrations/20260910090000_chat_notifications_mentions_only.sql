-- Stop notifying on every DM message.
--
-- The old dm branch emitted a 'chat_dm' row per message with no mention check
-- at all, so a thirty-message exchange put thirty rows in the recipient's
-- bell. It was also the third place telling them the same thing: an unread DM
-- already shows as a dot in the chat sidebar and on the Chat nav item, both of
-- which collapse per conversation, which a per-message feed cannot do.
--
-- Both channel types now notify on the same rule the workspace room already
-- used — only when the message actually addresses someone by mention. The
-- @Important / @Everyone title-sniffing is unchanged and still applies to the
-- room only; a mention inside a DM gets its own title so the bell doesn't say
-- "in team chat" for something that wasn't.
--
-- 'chat_dm' is no longer produced. Existing rows of that type are left in
-- place rather than deleted — they are real things that really happened, and
-- the bell renders them fine.
create or replace function public.tg_notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_channel_type text;
  v_link text;
  v_type text;
  v_title text;
begin
  select type into v_channel_type from public.chat_channels where id = new.channel_id;
  v_link := '/chat?channel=' || new.channel_id || '&message=' || new.id;

  -- array_length returns null (not 0) for an empty array, so test for null.
  if new.mentioned_uids is null or array_length(new.mentioned_uids, 1) is null then
    return new;
  end if;

  if v_channel_type = 'dm' then
    v_type := 'chat_mention';
    v_title := 'You were mentioned in a direct message';
  elsif new.body ilike '%@Important%' then
    -- @Important / @Everyone are broadcast pseudo-mentions (see ChatThread's
    -- SPECIAL_MENTIONS) that expand to every workspace member id client-side
    -- rather than being individually-picked mentions. The trigger cannot
    -- otherwise tell a broadcast from a coincidental "everyone mentioned",
    -- so sniffing the literal token gives each an honest title.
    v_type := 'chat_important';
    v_title := 'Important message in team chat';
  elsif new.body ilike '%@Everyone%' then
    v_type := 'chat_everyone';
    v_title := 'Everyone was mentioned in team chat';
  else
    v_type := 'chat_mention';
    v_title := 'You were mentioned in team chat';
  end if;

  perform public.emit_notifications(
    new.workspace_id, new.author_user_id, new.mentioned_uids,
    v_type, v_title, left(new.body, 140),
    'chat_channel', new.channel_id, v_link
  );

  return new;
end;
$function$;
