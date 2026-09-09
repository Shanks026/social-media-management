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
    WHEN 'demo_scheduled'    THEN 'Discovery Call'
    WHEN 'proposal_sent'     THEN 'Proposal Sent'
    WHEN 'changes_requested' THEN 'Changes Requested'
    WHEN 'proposal_accepted' THEN 'Proposal Accepted'
    WHEN 'contract_sent'     THEN 'Contract Sent'
    WHEN 'won'               THEN 'Won'
    WHEN 'lost'              THEN 'Lost'
    ELSE p_status
  END;
$$;
;
