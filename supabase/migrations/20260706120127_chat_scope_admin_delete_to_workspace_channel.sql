-- Phase 6 fix: soft_delete_chat_message let a workspace admin delete ANY
-- message in ANY channel, including a private DM between two other people
-- the admin isn't even a member of (RLS would normally block them from even
-- reading that DM, but this SECURITY DEFINER RPC bypassed that). Admin
-- moderation makes sense for the shared Team Chat room; it shouldn't reach
-- into private 1:1 DMs. Author-only delete is now the DM rule; the
-- author-or-admin rule is scoped to the workspace channel.
create or replace function public.soft_delete_chat_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_message public.chat_messages;
  v_channel_type text;
begin
  select * into v_message from public.chat_messages where id = p_message_id;

  if not found then
    raise exception 'message_not_found';
  end if;

  if v_message.workspace_id <> public.get_my_agency_user_id() then
    raise exception 'access_denied';
  end if;

  select type into v_channel_type from public.chat_channels where id = v_message.channel_id;

  if v_message.author_user_id <> auth.uid()
     and not (v_channel_type = 'workspace' and public.is_workspace_admin()) then
    raise exception 'access_denied';
  end if;

  update public.chat_messages
  set deleted_at = now()
  where id = p_message_id;
end;
$$;

revoke execute on function public.soft_delete_chat_message(uuid) from public, anon;
grant execute on function public.soft_delete_chat_message(uuid) to authenticated;;
