
DROP FUNCTION IF EXISTS public.get_proposals_with_totals(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_proposals_with_totals(p_user_id uuid, p_client_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(
   id uuid, agency_user_id uuid, client_id uuid, prospect_id uuid,
   prospect_name text, prospect_email text, title text, status text,
   introduction text, scope_notes text, payment_terms text, contract_duration text,
   valid_until date, share_token text, first_viewed_at timestamptz,
   sent_at timestamptz, accepted_at timestamptz, declined_at timestamptz,
   decline_reason text, created_at timestamptz, updated_at timestamptz,
   total_value numeric, client_name text, client_logo_url text,
   proposal_type text, file_url text
 )
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    p.id,
    p.agency_user_id,
    p.client_id,
    p.prospect_id,
    p.prospect_name,
    p.prospect_email,
    p.title,
    CASE
      WHEN p.status NOT IN ('draft', 'accepted', 'declined', 'archived')
        AND p.valid_until IS NOT NULL
        AND p.valid_until < CURRENT_DATE
      THEN 'expired'
      ELSE p.status
    END AS status,
    p.introduction,
    p.scope_notes,
    p.payment_terms,
    p.contract_duration,
    p.valid_until,
    p.share_token,
    p.first_viewed_at,
    p.sent_at,
    p.accepted_at,
    p.declined_at,
    p.decline_reason,
    p.created_at,
    p.updated_at,
    COALESCE(
      p.total_value,
      (SELECT SUM(li.amount) FROM proposal_line_items li WHERE li.proposal_id = p.id),
      0
    ) AS total_value,
    c.name       AS client_name,
    c.logo_url   AS client_logo_url,
    p.proposal_type,
    p.file_url
  FROM proposals p
  LEFT JOIN clients c ON c.id = p.client_id
  WHERE p.agency_user_id = p_user_id
    AND (p_client_id IS NULL OR p.client_id = p_client_id)
  ORDER BY p.created_at DESC;
$function$
;
