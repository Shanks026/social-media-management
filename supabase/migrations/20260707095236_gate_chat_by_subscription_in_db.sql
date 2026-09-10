-- Chat was previously gated 100% client-side (useSubscription()'s `chat` flag
-- only hid the nav item) — every chat RPC and RLS policy checked workspace
-- membership only, never plan tier. A Trial/Ignite user could call
-- ensure_workspace_channel()/insert into chat_messages directly from the
-- browser console. This closes that gap. `chat` is checked directly (not
-- re-derived from plan_name) since it's a standalone, override-capable flag
-- — same pattern as every other feature boolean on agency_subscriptions —
-- so a manual grant/revoke via admin_update_subscription() is respected.

create or replace function public.is_chat_enabled_for_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(chat, false)
  from public.agency_subscriptions
  where user_id = p_workspace_id;
$$;

revoke all on function public.is_chat_enabled_for_workspace(uuid) from public;
grant execute on function public.is_chat_enabled_for_workspace(uuid) to authenticated;

create or replace function public.ensure_workspace_channel()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_workspace_id uuid := public.get_my_agency_user_id();
  v_channel_id uuid;
begin
  if v_workspace_id is null then
    raise exception 'not_a_workspace_member';
  end if;

  if not public.is_chat_enabled_for_workspace(v_workspace_id) then
    raise exception 'chat_not_available_on_plan';
  end if;

  select id into v_channel_id
  from public.chat_channels
  where workspace_id = v_workspace_id and type = 'workspace';

  if v_channel_id is null then
    insert into public.chat_channels (workspace_id, type)
    values (v_workspace_id, 'workspace')
    returning id into v_channel_id;
  end if;

  insert into public.chat_channel_members (channel_id, user_id)
  values (v_channel_id, auth.uid())
  on conflict (channel_id, user_id) do nothing;

  return v_channel_id;
end;
$function$;

create or replace function public.get_or_create_dm_channel(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_workspace_id uuid := public.get_my_agency_user_id();
  v_caller uuid := auth.uid();
  v_channel_id uuid;
  v_is_valid_participant boolean;
begin
  if v_workspace_id is null then
    raise exception 'not_a_workspace_member';
  end if;

  if not public.is_chat_enabled_for_workspace(v_workspace_id) then
    raise exception 'chat_not_available_on_plan';
  end if;

  if p_other_user_id is null or p_other_user_id = v_caller then
    raise exception 'invalid_dm_participant';
  end if;

  select
    p_other_user_id = v_workspace_id
    or exists (
      select 1 from public.agency_members
      where agency_user_id = v_workspace_id
        and member_user_id = p_other_user_id
        and is_active = true
    )
  into v_is_valid_participant;

  if not v_is_valid_participant then
    raise exception 'invalid_dm_participant';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_workspace_id::text || least(v_caller, p_other_user_id)::text || greatest(v_caller, p_other_user_id)::text, 0)
  );

  select cm1.channel_id into v_channel_id
  from public.chat_channel_members cm1
  join public.chat_channel_members cm2
    on cm2.channel_id = cm1.channel_id and cm2.user_id = p_other_user_id
  join public.chat_channels c on c.id = cm1.channel_id
  where cm1.user_id = v_caller
    and c.type = 'dm'
    and c.workspace_id = v_workspace_id;

  if v_channel_id is null then
    insert into public.chat_channels (workspace_id, type)
    values (v_workspace_id, 'dm')
    returning id into v_channel_id;

    insert into public.chat_channel_members (channel_id, user_id)
    values (v_channel_id, v_caller), (v_channel_id, p_other_user_id);
  end if;

  return v_channel_id;
end;
$function$;

drop policy "chat_messages: channel member can insert" on public.chat_messages;
create policy "chat_messages: channel member can insert"
on public.chat_messages for insert
with check (
  workspace_id = get_my_agency_user_id()
  and author_user_id = auth.uid()
  and is_chat_channel_member(channel_id)
  and is_chat_enabled_for_workspace(workspace_id)
);;
