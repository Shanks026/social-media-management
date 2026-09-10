
DROP FUNCTION IF EXISTS get_proposal_by_token(text);

CREATE FUNCTION get_proposal_by_token(p_token text)
RETURNS TABLE (
  id                    uuid,
  agency_user_id        uuid,
  client_id             uuid,
  prospect_name         text,
  prospect_email        text,
  title                 text,
  status                text,
  introduction          text,
  scope_notes           text,
  notes                 text,
  payment_terms         text,
  contract_duration     text,
  valid_until           date,
  share_token           text,
  first_viewed_at       timestamptz,
  sent_at               timestamptz,
  accepted_at           timestamptz,
  declined_at           timestamptz,
  decline_reason        text,
  created_at            timestamptz,
  updated_at            timestamptz,
  agency_name           text,
  logo_url              text,
  logo_horizontal_url   text,
  branding_agency_sidebar boolean,
  branding_powered_by   boolean,
  client_name           text,
  line_items            jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.agency_user_id,
    p.client_id,
    p.prospect_name,
    p.prospect_email,
    p.title,
    CASE
      WHEN p.status NOT IN ('accepted', 'declined', 'archived')
        AND p.valid_until IS NOT NULL
        AND p.valid_until < CURRENT_DATE
      THEN 'expired'
      ELSE p.status
    END AS status,
    p.introduction,
    p.scope_notes,
    p.notes,
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
    sub.agency_name,
    sub.logo_url,
    sub.logo_horizontal_url,
    sub.branding_agency_sidebar,
    sub.branding_powered_by,
    c.name AS client_name,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',          li.id,
            'description', li.description,
            'amount',      li.amount,
            'sort_order',  li.sort_order
          )
          ORDER BY li.sort_order, li.id
        )
        FROM proposal_line_items li
        WHERE li.proposal_id = p.id
      ),
      '[]'::jsonb
    ) AS line_items
  FROM proposals p
  JOIN  agency_subscriptions sub ON sub.user_id = p.agency_user_id
  LEFT JOIN clients c            ON c.id = p.client_id
  WHERE p.share_token = p_token;
$$;
;
