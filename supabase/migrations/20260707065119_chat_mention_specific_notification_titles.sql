CREATE OR REPLACE FUNCTION public.tg_notify_chat_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_channel_type text;
  v_recipients uuid[];
  v_link text;
  v_type text;
  v_title text;
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
      -- @Important / @Everyone are broadcast pseudo-mentions (see
      -- ChatThread.jsx's SPECIAL_MENTIONS) that expand to every workspace
      -- member id client-side rather than being real, individually-picked
      -- mentions. The trigger can't otherwise tell a broadcast apart from a
      -- coincidental "everyone individually mentioned" — sniffing the
      -- literal token out of body text is a pragmatic way to give each a
      -- distinct, honest notification title instead of the generic
      -- "you were mentioned" for all three cases.
      if new.body ilike '%@Important%' then
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
    end if;
  end if;

  return new;
end;
$function$;
