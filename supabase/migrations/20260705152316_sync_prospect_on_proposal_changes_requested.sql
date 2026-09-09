-- request_proposal_changes: also advance the linked prospect to
-- 'changes_requested' (mirrors accept_proposal's prospect sync). Guarded to
-- only move forward — never overwrite a prospect already at
-- proposal_accepted/contract_sent/won/lost. Logs the same status_change
-- activity type used elsewhere for consistency in the prospect's timeline.
CREATE OR REPLACE FUNCTION public.request_proposal_changes(p_token text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prospect_id uuid;
  v_prospect_status text;
  v_workspace_user_id uuid;
BEGIN
  UPDATE proposals
  SET
    status                  = 'changes_requested',
    changes_requested_at    = now(),
    changes_requested_notes = p_notes,
    updated_at               = now()
  WHERE share_token = p_token
    AND status NOT IN ('accepted', 'declined', 'archived')
  RETURNING prospect_id INTO v_prospect_id;

  IF v_prospect_id IS NOT NULL THEN
    SELECT status, user_id INTO v_prospect_status, v_workspace_user_id
    FROM prospects WHERE id = v_prospect_id;

    IF v_prospect_status IS NOT NULL
       AND v_prospect_status NOT IN ('changes_requested', 'proposal_accepted', 'contract_sent', 'won', 'lost') THEN
      UPDATE prospects
      SET status = 'changes_requested', updated_at = now()
      WHERE id = v_prospect_id;

      INSERT INTO prospect_activities (prospect_id, user_id, type, body, occurred_at, metadata)
      VALUES (
        v_prospect_id,
        v_workspace_user_id,
        'status_change',
        'Status changed from ' || public.prospect_status_label(v_prospect_status) ||
          ' to Changes Requested (client requested changes to the proposal)',
        now(),
        jsonb_build_object(
          'from_status', v_prospect_status,
          'to_status', 'changes_requested',
          'trigger', 'request_proposal_changes'
        )
      );
    END IF;
  END IF;
END;
$function$;
;
