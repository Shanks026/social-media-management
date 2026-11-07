-- D1: storage usage was counted 2-3x (two identical storage.objects triggers
-- plus client-side increment/decrement RPCs). B16: usage was credited to
-- objects.owner, so an invited member's uploads counted against nobody.
-- After this migration the storage.objects trigger is the single source of truth.

-- 1. One trigger, not two. Keep on_storage_object_changed: it also handles
--    UPDATE (upserts, metadata size updates).
drop trigger if exists track_storage_usage on storage.objects;

-- 2. Map an object's uploader to the workspace that pays for it.
create or replace function public.storage_workspace_for(p_owner uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select s.user_id from public.agency_subscriptions s where s.user_id = p_owner),
    (select m.agency_user_id from public.agency_members m
      where m.member_user_id = p_owner
      order by m.is_active desc, m.joined_at desc
      limit 1)
  )
$$;
revoke execute on function public.storage_workspace_for(uuid) from public, anon, authenticated;

-- 3. Credit/debit the workspace, not the uploader.
create or replace function public.update_storage_usage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ws uuid;
begin
  if TG_OP in ('DELETE', 'UPDATE') and OLD.owner is not null then
    v_ws := public.storage_workspace_for(OLD.owner);
    if v_ws is not null then
      update public.agency_subscriptions
      set current_storage_used = greatest(0, coalesce(current_storage_used, 0)
                                 - coalesce((OLD.metadata->>'size')::bigint, 0))
      where user_id = v_ws;
    end if;
  end if;

  if TG_OP in ('INSERT', 'UPDATE') and NEW.owner is not null then
    v_ws := public.storage_workspace_for(NEW.owner);
    if v_ws is not null then
      update public.agency_subscriptions
      set current_storage_used = coalesce(current_storage_used, 0)
                                 + coalesce((NEW.metadata->>'size')::bigint, 0)
      where user_id = v_ws;
    end if;
  end if;

  return null;
end;
$$;

-- 4. Neutralise the client-side RPCs. Still-open browsers on the old bundle
--    keep calling them until they reload; as no-ops they can't double count.
--    Drop them in the dead-code sweep (epic 2).
create or replace function public.increment_storage_used(p_user_id uuid, p_bytes bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Deprecated no-op: storage usage is tracked by the storage.objects trigger.
  null;
end;
$$;

create or replace function public.decrement_storage_used(p_user_id uuid, p_bytes bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Deprecated no-op: storage usage is tracked by the storage.objects trigger.
  null;
end;
$$;

-- 5. One-off recompute from the real objects.
update public.agency_subscriptions s
set current_storage_used = coalesce((
  select sum(coalesce((o.metadata->>'size')::bigint, 0))
  from storage.objects o
  where public.storage_workspace_for(o.owner) = s.user_id
), 0);
