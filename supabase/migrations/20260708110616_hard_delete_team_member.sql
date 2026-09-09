CREATE OR REPLACE FUNCTION public.hard_delete_team_member(p_member_id uuid)
RETURNS TABLE(member_user_id uuid, other_workspaces boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_target agency_members%ROWTYPE;
  v_agency_user_id uuid;
  v_member_user_id uuid;
  v_other_count int;
BEGIN
  IF NOT public.is_workspace_owner() THEN
    RAISE EXCEPTION 'Only the workspace owner can permanently delete a member';
  END IF;

  SELECT * INTO v_target
  FROM agency_members
  WHERE id = p_member_id AND agency_user_id = public.get_my_agency_user_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_target.system_role = 'owner' OR v_target.member_user_id = v_target.agency_user_id THEN
    RAISE EXCEPTION 'The owner row cannot be deleted';
  END IF;

  v_agency_user_id := v_target.agency_user_id;
  v_member_user_id := v_target.member_user_id;

  -- Does this person belong to any OTHER workspace? If so, their auth account
  -- must be left intact (deleting it would break their access there too) —
  -- only their footprint in THIS workspace gets wiped.
  SELECT count(*) INTO v_other_count
  FROM agency_members
  WHERE agency_members.member_user_id = v_member_user_id AND id <> p_member_id;

  -- Reassign workspace-scoped "authorship" to the owner so the actual work
  -- (deliverables, tasks, chat history) survives the account being deleted —
  -- these columns are NOT NULL with a plain FK to auth.users (no cascade), so
  -- leaving them pointed at a since-deleted user would either block the auth
  -- deletion outright or leave a dangling reference. Scoped strictly to rows
  -- inside this workspace.
  UPDATE post_versions pv SET created_by = v_agency_user_id
    FROM posts p, clients c
    WHERE pv.post_id = p.id AND p.client_id = c.id AND c.user_id = v_agency_user_id
      AND pv.created_by = v_member_user_id;

  UPDATE post_versions pv SET submitted_by = v_agency_user_id
    FROM posts p, clients c
    WHERE pv.post_id = p.id AND p.client_id = c.id AND c.user_id = v_agency_user_id
      AND pv.submitted_by = v_member_user_id;

  UPDATE post_versions pv SET updated_by = v_agency_user_id
    FROM posts p, clients c
    WHERE pv.post_id = p.id AND p.client_id = c.id AND c.user_id = v_agency_user_id
      AND pv.updated_by = v_member_user_id;

  UPDATE posts p SET created_by = v_agency_user_id
    FROM clients c
    WHERE p.client_id = c.id AND c.user_id = v_agency_user_id
      AND p.created_by = v_member_user_id;

  UPDATE tasks SET created_by = v_agency_user_id
    WHERE workspace_id = v_agency_user_id AND created_by = v_member_user_id;

  UPDATE tasks SET assigned_to = NULL
    WHERE workspace_id = v_agency_user_id AND assigned_to = v_member_user_id;

  UPDATE chat_messages SET author_user_id = v_agency_user_id
    WHERE workspace_id = v_agency_user_id AND author_user_id = v_member_user_id;

  UPDATE approval_events SET actor_id = v_agency_user_id
    WHERE workspace_user_id = v_agency_user_id AND actor_id = v_member_user_id;

  UPDATE note_shares ns SET invited_by = v_agency_user_id
    FROM notes n
    WHERE ns.note_id = n.id AND n.user_id = v_agency_user_id
      AND ns.invited_by = v_member_user_id;

  UPDATE user_feedback SET submitter_user_id = v_agency_user_id
    WHERE workspace_user_id = v_agency_user_id AND submitter_user_id = v_member_user_id;

  -- Drop the membership itself — must happen before the caller can delete the
  -- auth user, since agency_members.member_user_id also has a plain FK.
  DELETE FROM agency_members WHERE id = p_member_id;

  RETURN QUERY SELECT v_member_user_id, (v_other_count > 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.hard_delete_team_member(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.hard_delete_team_member(uuid) TO authenticated;
;
