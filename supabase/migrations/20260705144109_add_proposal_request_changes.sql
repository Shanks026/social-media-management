ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS changes_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS changes_requested_notes text;

-- request_proposal_changes: client wants revisions, not a hard reject.
-- Unlike decline_proposal, this never touches the linked prospect's status —
-- the deal is still alive, just needs another round. Mirrors decline_proposal's
-- guard (blocked once accepted/declined/archived) so it can fire from sent,
-- viewed, or even repeatedly from changes_requested itself.
CREATE OR REPLACE FUNCTION public.request_proposal_changes(p_token text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE proposals
  SET
    status                  = 'changes_requested',
    changes_requested_at    = now(),
    changes_requested_notes = p_notes,
    updated_at               = now()
  WHERE share_token = p_token
    AND status NOT IN ('accepted', 'declined', 'archived');
END;
$function$;
;
