-- #143 / ADR 0006: Prospect stages are UPPER_SNAKE text with a CHECK.
--
-- Rewrites prospects.status (rows + default) and the stage names recorded in
-- prospect_activities.metadata (from_status / to_status), adds
-- prospects_status_check, and renames the booked-call stage to DISCOVERY_CALL
-- to match the glossary term "Discovery call" (was demo_scheduled).
-- prospect_status_label() and the three public Proposal RPCs that move a
-- Prospect's stage are recreated with the new values; their Proposal status
-- literals are unchanged here (#144 does those).

UPDATE public.prospects SET status = CASE status WHEN 'demo_scheduled' THEN 'DISCOVERY_CALL' ELSE upper(status) END;

ALTER TABLE public.prospects ALTER COLUMN status SET DEFAULT 'NEW';

ALTER TABLE public.prospects
    ADD CONSTRAINT prospects_status_check CHECK (status = ANY (ARRAY[
        'NEW', 'CONTACTED', 'FOLLOW_UP', 'DISCOVERY_CALL', 'PROPOSAL_SENT',
        'CHANGES_REQUESTED', 'PROPOSAL_ACCEPTED', 'CONTRACT_SENT', 'WON', 'LOST'
    ]::text[]));

UPDATE public.prospect_activities
SET metadata = jsonb_set(metadata, '{from_status}', to_jsonb(CASE (metadata->>'from_status') WHEN 'demo_scheduled' THEN 'DISCOVERY_CALL' ELSE upper((metadata->>'from_status')) END))
WHERE type = 'status_change' AND metadata->>'from_status' IS NOT NULL;

UPDATE public.prospect_activities
SET metadata = jsonb_set(metadata, '{to_status}', to_jsonb(CASE (metadata->>'to_status') WHEN 'demo_scheduled' THEN 'DISCOVERY_CALL' ELSE upper((metadata->>'to_status')) END))
WHERE type = 'status_change' AND metadata->>'to_status' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prospect_status_label(p_status text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE p_status
    WHEN 'NEW'               THEN 'New'
    WHEN 'CONTACTED'         THEN 'Contacted'
    WHEN 'FOLLOW_UP'         THEN 'Follow-Up'
    WHEN 'DISCOVERY_CALL'    THEN 'Discovery Call'
    WHEN 'PROPOSAL_SENT'     THEN 'Proposal Sent'
    WHEN 'CHANGES_REQUESTED' THEN 'Changes Requested'
    WHEN 'PROPOSAL_ACCEPTED' THEN 'Proposal Accepted'
    WHEN 'CONTRACT_SENT'     THEN 'Contract Sent'
    WHEN 'WON'               THEN 'Won'
    WHEN 'LOST'              THEN 'Lost'
    ELSE p_status
  END;
$function$;

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
       AND v_prospect_status NOT IN ('PROPOSAL_ACCEPTED', 'CONTRACT_SENT', 'WON', 'LOST') THEN
      UPDATE prospects
      SET status = 'PROPOSAL_ACCEPTED', updated_at = now()
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
          'to_status', 'PROPOSAL_ACCEPTED',
          'trigger', 'accept_proposal'
        )
      );
    END IF;
  END IF;
END;
$function$;

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
       AND v_prospect_status NOT IN ('WON', 'LOST') THEN
      UPDATE prospects
      SET status = 'LOST', updated_at = now()
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
          'to_status', 'LOST',
          'trigger', 'decline_proposal',
          'reason', p_reason
        )
      );
    END IF;
  END IF;
END;
$function$;

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
       AND v_prospect_status NOT IN ('CHANGES_REQUESTED', 'PROPOSAL_ACCEPTED', 'CONTRACT_SENT', 'WON', 'LOST') THEN
      UPDATE prospects
      SET status = 'CHANGES_REQUESTED', updated_at = now()
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
          'to_status', 'CHANGES_REQUESTED',
          'trigger', 'request_proposal_changes'
        )
      );
    END IF;
  END IF;
END;
$function$;
