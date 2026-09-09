-- Shared label helper for prospect_activities status_change bodies (SQL side).
-- Mirrors PROSPECT_STATUSES labels in src/api/prospects.js — keep both in sync
-- if statuses are ever renamed.
CREATE OR REPLACE FUNCTION public.prospect_status_label(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE p_status
    WHEN 'new'               THEN 'New'
    WHEN 'contacted'         THEN 'Contacted'
    WHEN 'follow_up'         THEN 'Follow-Up'
    WHEN 'demo_scheduled'    THEN 'Demo Scheduled'
    WHEN 'proposal_sent'     THEN 'Proposal Sent'
    WHEN 'proposal_accepted' THEN 'Proposal Accepted'
    WHEN 'contract_sent'     THEN 'Contract Sent'
    WHEN 'won'               THEN 'Won'
    WHEN 'lost'              THEN 'Lost'
    ELSE p_status
  END;
$$;

REVOKE ALL ON FUNCTION public.prospect_status_label(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prospect_status_label(text) TO authenticated;

-- accept_proposal: when the accepted proposal is linked to a prospect, advance
-- that prospect's pipeline status to 'proposal_accepted' — but only forward
-- (never overwrite a prospect already at contract_sent/won/lost, in case the
-- agency had already moved the pipeline ahead manually).
CREATE OR REPLACE FUNCTION public.accept_proposal(p_token text)
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
    status      = 'accepted',
    accepted_at = now(),
    updated_at  = now()
  WHERE share_token = p_token
    AND status NOT IN ('accepted', 'declined', 'archived')
  RETURNING prospect_id INTO v_prospect_id;

  IF v_prospect_id IS NOT NULL THEN
    SELECT status, user_id INTO v_prospect_status, v_workspace_user_id
    FROM prospects WHERE id = v_prospect_id;

    IF v_prospect_status IS NOT NULL
       AND v_prospect_status NOT IN ('proposal_accepted', 'contract_sent', 'won', 'lost') THEN
      UPDATE prospects
      SET status = 'proposal_accepted', updated_at = now()
      WHERE id = v_prospect_id;

      INSERT INTO prospect_activities (prospect_id, user_id, type, body, occurred_at, metadata)
      VALUES (
        v_prospect_id,
        v_workspace_user_id,
        'status_change',
        'Status changed from ' || public.prospect_status_label(v_prospect_status) ||
          ' to Proposal Accepted (client accepted the proposal)',
        now(),
        jsonb_build_object(
          'from_status', v_prospect_status,
          'to_status', 'proposal_accepted',
          'trigger', 'accept_proposal'
        )
      );
    END IF;
  END IF;
END;
$function$;

-- decline_proposal: when the declined proposal is linked to a prospect, mark
-- that prospect 'lost' — unless it's already a terminal status (won/lost).
CREATE OR REPLACE FUNCTION public.decline_proposal(p_token text, p_reason text DEFAULT NULL::text)
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
    status         = 'declined',
    declined_at    = now(),
    decline_reason = p_reason,
    updated_at     = now()
  WHERE share_token = p_token
    AND status NOT IN ('accepted', 'declined', 'archived')
  RETURNING prospect_id INTO v_prospect_id;

  IF v_prospect_id IS NOT NULL THEN
    SELECT status, user_id INTO v_prospect_status, v_workspace_user_id
    FROM prospects WHERE id = v_prospect_id;

    IF v_prospect_status IS NOT NULL
       AND v_prospect_status NOT IN ('won', 'lost') THEN
      UPDATE prospects
      SET status = 'lost', updated_at = now()
      WHERE id = v_prospect_id;

      INSERT INTO prospect_activities (prospect_id, user_id, type, body, occurred_at, metadata)
      VALUES (
        v_prospect_id,
        v_workspace_user_id,
        'status_change',
        'Status changed from ' || public.prospect_status_label(v_prospect_status) ||
          ' to Lost (client declined the proposal' ||
          CASE WHEN p_reason IS NOT NULL AND p_reason <> '' THEN ': ' || p_reason ELSE '' END ||
          ')',
        now(),
        jsonb_build_object(
          'from_status', v_prospect_status,
          'to_status', 'lost',
          'trigger', 'decline_proposal',
          'reason', p_reason
        )
      );
    END IF;
  END IF;
END;
$function$;
;
