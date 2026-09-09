-- ============================================================================
-- Workspace Chat — Phase 1 (Foundation: tables, RLS, RPCs, notification trigger)
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.chat_channels (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users(id) on delete cascade,
  type         text not null check (type in ('workspace','dm')),
  created_at   timestamptz not null default now()
);

-- Exactly one workspace-wide channel per workspace.
create unique index chat_channels_one_workspace_per_workspace
  on public.chat_channels (workspace_id)
  where type = 'workspace';

create table public.chat_channel_members (
  channel_id   uuid not null references public.chat_channels(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index chat_channel_members_user_idx on public.chat_channel_members (user_id);

create table public.chat_messages (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references auth.users(id) on delete cascade,
  channel_id     uuid not null references public.chat_channels(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  body           text not null,
  mentioned_uids uuid[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz,
  deleted_at     timestamptz
);

create index chat_messages_channel_created_idx
  on public.chat_messages (channel_id, created_at desc);

create table public.chat_message_reactions (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null check (emoji = any (array['👍','👎','❤️','😂','😮','😢','🎉','🙌','🔥','👀','✅','🤔','➕','➖'])),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

-- ── RLS helper functions (avoid self-referential-policy recursion) ─────────
-- Same technique as get_my_agency_user_id(): a STABLE SECURITY DEFINER
-- function's internal query is not re-subject to the caller's RLS, so it can
-- safely check membership in chat_channel_members without infinite recursion.

create or replace function public.is_chat_channel_member(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.chat_channel_members
    where channel_id = p_channel_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_chat_message_channel_member(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.chat_messages m
    where m.id = p_message_id
      and public.is_chat_channel_member(m.channel_id)
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.chat_channels enable row level security;
alter table public.chat_channel_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_reactions enable row level security;

-- chat_channels: readable by members; writes only via SECURITY DEFINER RPCs.
create policy "chat_channels: member can select"
  on public.chat_channels for select
  using (public.is_chat_channel_member(id));

-- chat_channel_members: readable by members of the same channel; writes RPC-only.
create policy "chat_channel_members: member can select"
  on public.chat_channel_members for select
  using (public.is_chat_channel_member(channel_id));

-- chat_messages
create policy "chat_messages: channel member can select"
  on public.chat_messages for select
  using (public.is_chat_channel_member(channel_id));

create policy "chat_messages: channel member can insert"
  on public.chat_messages for insert
  with check (
    workspace_id = public.get_my_agency_user_id()
    and author_user_id = auth.uid()
    and public.is_chat_channel_member(channel_id)
  );

create policy "chat_messages: author can update"
  on public.chat_messages for update
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

-- chat_message_reactions
create policy "chat_message_reactions: channel member can select"
  on public.chat_message_reactions for select
  using (public.is_chat_message_channel_member(message_id));

create policy "chat_message_reactions: user can insert own"
  on public.chat_message_reactions for insert
  with check (
    user_id = auth.uid()
    and public.is_chat_message_channel_member(message_id)
  );

create policy "chat_message_reactions: user can delete own"
  on public.chat_message_reactions for delete
  using (user_id = auth.uid());

-- ── RPCs ─────────────────────────────────────────────────────────────────────

-- Returns the workspace's single shared channel, creating it (and adding the
-- caller as a member) on first use. Also called from join_team so new members
-- are auto-added.
create or replace function public.ensure_workspace_channel()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_workspace_id uuid := public.get_my_agency_user_id();
  v_channel_id uuid;
begin
  if v_workspace_id is null then
    raise exception 'not_a_workspace_member';
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
$$;

revoke execute on function public.ensure_workspace_channel() from public, anon;
grant execute on function public.ensure_workspace_channel() to authenticated;

-- Deterministic 1:1 DM lookup/creation between the caller and another
-- workspace member (or the workspace owner). Advisory lock avoids a race
-- creating two DM channels for the same pair on simultaneous first-opens.
create or replace function public.get_or_create_dm_channel(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_workspace_id uuid := public.get_my_agency_user_id();
  v_caller uuid := auth.uid();
  v_channel_id uuid;
  v_is_valid_participant boolean;
begin
  if v_workspace_id is null then
    raise exception 'not_a_workspace_member';
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
$$;

revoke execute on function public.get_or_create_dm_channel(uuid) from public, anon;
grant execute on function public.get_or_create_dm_channel(uuid) to authenticated;

-- Atomic add-or-remove, mirrors toggle_comment_reaction.
create or replace function public.toggle_chat_reaction(p_message_id uuid, p_emoji text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_channel_id uuid;
  v_existing uuid;
begin
  select channel_id into v_channel_id
  from public.chat_messages
  where id = p_message_id and deleted_at is null;

  if v_channel_id is null then
    raise exception 'message_not_found';
  end if;

  if not public.is_chat_channel_member(v_channel_id) then
    raise exception 'access_denied';
  end if;

  select id into v_existing
  from public.chat_message_reactions
  where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;

  if v_existing is not null then
    delete from public.chat_message_reactions where id = v_existing;
    return false;
  else
    insert into public.chat_message_reactions (message_id, user_id, emoji)
    values (p_message_id, auth.uid(), p_emoji);
    return true;
  end if;
end;
$$;

revoke execute on function public.toggle_chat_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_chat_reaction(uuid, text) to authenticated;

-- Drives unread badges: bump the caller's last_read_at for a channel.
create or replace function public.mark_channel_read(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.chat_channel_members
  set last_read_at = now()
  where channel_id = p_channel_id and user_id = auth.uid();

  if not found then
    raise exception 'access_denied';
  end if;
end;
$$;

revoke execute on function public.mark_channel_read(uuid) from public, anon;
grant execute on function public.mark_channel_read(uuid) to authenticated;

-- Soft-delete: author or workspace admin. Mirrors soft_delete_comment exactly
-- (the plain author-only UPDATE RLS policy can't express the admin-override).
create or replace function public.soft_delete_chat_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_message public.chat_messages;
begin
  select * into v_message from public.chat_messages where id = p_message_id;

  if not found then
    raise exception 'message_not_found';
  end if;

  if v_message.workspace_id <> public.get_my_agency_user_id() then
    raise exception 'access_denied';
  end if;

  if v_message.author_user_id <> auth.uid() and not public.is_workspace_admin() then
    raise exception 'access_denied';
  end if;

  update public.chat_messages
  set deleted_at = now()
  where id = p_message_id;
end;
$$;

revoke execute on function public.soft_delete_chat_message(uuid) from public, anon;
grant execute on function public.soft_delete_chat_message(uuid) to authenticated;

-- ── Notification fan-out trigger ─────────────────────────────────────────────
-- DM messages notify the other participant. Workspace-channel messages notify
-- only @mentioned users — never all members (would be spam).

create or replace function public.tg_notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_channel_type text;
  v_recipients uuid[];
  v_title text;
begin
  select type into v_channel_type from public.chat_channels where id = new.channel_id;

  if v_channel_type = 'dm' then
    v_recipients := array(
      select m.user_id from public.chat_channel_members m
      where m.channel_id = new.channel_id and m.user_id <> new.author_user_id
    );

    perform public.emit_notifications(
      new.workspace_id, new.author_user_id, v_recipients,
      'chat_dm', 'New message', left(new.body, 140),
      'chat_channel', new.channel_id, '/chat'
    );
  else
    if new.mentioned_uids is not null and array_length(new.mentioned_uids, 1) > 0 then
      perform public.emit_notifications(
        new.workspace_id, new.author_user_id, new.mentioned_uids,
        'chat_mention', 'You were mentioned in team chat', left(new.body, 140),
        'chat_channel', new.channel_id, '/chat'
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_notify_chat_message
  after insert on public.chat_messages
  for each row execute function public.tg_notify_chat_message();

-- ── join_team: auto-add new members to the workspace chat channel ──────────

create or replace function public.join_team(p_token text, p_first_name text, p_last_name text, p_functional_role text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_invite        agency_invites%ROWTYPE;
  v_member_uid    uuid := auth.uid();
  v_system_role   text;
  v_permissions   jsonb;
  v_sub           agency_subscriptions%ROWTYPE;
  v_seat_count    int;
BEGIN
  IF v_member_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invite FROM agency_invites
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'This invite link is no longer valid. Ask your workspace owner for a new one.');
  END IF;

  v_system_role := coalesce(v_invite.system_role, 'member');
  v_permissions := CASE v_system_role
    WHEN 'admin' THEN '{"documents":"manage"}'::jsonb
    ELSE              coalesce(v_invite.permissions, '{"documents":"view"}'::jsonb)
  END;

  SELECT * INTO v_sub FROM agency_subscriptions WHERE user_id = v_invite.agency_user_id;
  IF v_sub.max_team_members IS NOT NULL THEN
    SELECT COUNT(*) INTO v_seat_count FROM agency_members
    WHERE agency_user_id = v_invite.agency_user_id AND is_active = true;
    IF v_seat_count >= v_sub.max_team_members THEN
      RETURN jsonb_build_object('error', 'TEAM_SEAT_LIMIT_REACHED');
    END IF;
  END IF;

  INSERT INTO agency_members (agency_user_id, member_user_id, system_role, functional_role, permissions)
  VALUES (v_invite.agency_user_id, v_member_uid, v_system_role, p_functional_role, v_permissions)
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  -- Auto-add the new member to the workspace chat channel (creates it on first use).
  PERFORM public.ensure_workspace_channel();

  UPDATE agency_invites SET accepted_at = now() WHERE id = v_invite.id;

  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'first_name', p_first_name, 'last_name', p_last_name,
    'full_name', p_first_name || ' ' || p_last_name)
  WHERE id = v_member_uid;

  PERFORM public.emit_notifications(
    v_invite.agency_user_id, v_member_uid,
    public.workspace_admin_uids(v_invite.agency_user_id),
    'team_member_joined', 'New team member joined',
    trim(p_first_name || ' ' || p_last_name) || ' joined your workspace',
    'team', NULL, '/settings');

  RETURN jsonb_build_object('success', true, 'agency_user_id', v_invite.agency_user_id);
END;
$function$;

-- ── Subscription flag ────────────────────────────────────────────────────────

alter table public.agency_subscriptions
  add column chat boolean not null default false;

update public.agency_subscriptions
  set chat = true
  where plan_name in ('velocity', 'quantum');

-- ── Realtime publication ─────────────────────────────────────────────────────

alter publication supabase_realtime add table public.chat_channels;
alter publication supabase_realtime add table public.chat_channel_members;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_message_reactions;
;
