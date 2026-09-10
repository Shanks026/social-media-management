
create or replace function public.toggle_comment_reaction(p_comment_id uuid, p_emoji text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_workspace_id uuid;
  v_existing uuid;
begin
  select workspace_id into v_workspace_id from public.comments where id = p_comment_id;

  if v_workspace_id is null then
    raise exception 'comment_not_found';
  end if;

  if v_workspace_id <> public.get_my_agency_user_id() then
    raise exception 'access_denied';
  end if;

  select id into v_existing
  from public.comment_reactions
  where comment_id = p_comment_id and user_id = auth.uid() and emoji = p_emoji;

  if v_existing is not null then
    delete from public.comment_reactions where id = v_existing;
    return false;
  else
    insert into public.comment_reactions (comment_id, user_id, emoji)
    values (p_comment_id, auth.uid(), p_emoji);
    return true;
  end if;
end;
$$;
;
