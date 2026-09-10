
-- Soft-delete a comment. Allowed for the author OR a workspace admin.
-- SECURITY DEFINER so an admin can remove another member's comment without an
-- UPDATE policy that would otherwise have to discriminate by changed column.
create or replace function public.soft_delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_comment public.comments;
begin
  select * into v_comment from public.comments where id = p_comment_id;

  if not found then
    raise exception 'comment_not_found';
  end if;

  if v_comment.workspace_id <> public.get_my_agency_user_id() then
    raise exception 'access_denied';
  end if;

  if v_comment.author_user_id <> auth.uid() and not public.is_workspace_admin() then
    raise exception 'access_denied';
  end if;

  update public.comments
  set deleted_at = now()
  where id = p_comment_id;
end;
$$;
;
