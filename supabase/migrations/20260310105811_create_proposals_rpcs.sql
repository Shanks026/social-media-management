
-- ─── 1. get_proposals_with_totals ─────────────────────────────────────────────
-- Authenticated. Returns proposals with calculated total + effective status
-- (expired computed from valid_until, not stored as a status).
CREATE OR REPLACE FUNCTION get_proposals_with_totals(
  p_user_id  uuid,
  p_client_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id                uuid,
  agency_user_id    uuid,
  client_id         uuid,
  prospect_name     text,
  prospect_email    text,
  title             text,
  status            text,
  introduction      text,
  scope_notes       text,
  payment_terms     text,
  contract_duration text,
  valid_until       date,
  share_token       text,
  first_viewed_at   timestamptz,
  sent_at           timestamptz,
  accepted_at       timestamptz,
  declined_at       timestamptz,
  decline_reason    text,
  created_at        timestamptz,
  updated_at        timestamptz,
  total_value       numeric,
  client_name       text,
  client_logo_url   text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.agency_user_id,
    p.client_id,
    p.prospect_name,
    p.prospect_email,
    p.title,
    -- Compute expired status on the fly so no background job is needed
    CASE
      WHEN p.status NOT IN ('accepted', 'declined', 'archived')
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
    COALESCE((
      SELECT SUM(li.amount)
      FROM proposal_line_items li
      WHERE li.proposal_id = p.id
    ), 0) AS total_value,
    c.name       AS client_name,
    c.logo_url   AS client_logo_url
  FROM proposals p
  LEFT JOIN clients c ON c.id = p.client_id
  WHERE p.agency_user_id = p_user_id
    AND (p_client_id IS NULL OR p.client_id = p_client_id)
  ORDER BY p.created_at DESC;
$$;

-- ─── 2. get_proposal_by_token ─────────────────────────────────────────────────
-- Public SECURITY DEFINER. Returns full proposal + line items + agency branding.
CREATE OR REPLACE FUNCTION get_proposal_by_token(p_token text)
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

-- ─── 3. mark_proposal_viewed ──────────────────────────────────────────────────
-- Public SECURITY DEFINER. Sets first_viewed_at (once), advances sent → viewed.
CREATE OR REPLACE FUNCTION mark_proposal_viewed(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE proposals
  SET
    first_viewed_at = CASE WHEN first_viewed_at IS NULL THEN now() ELSE first_viewed_at END,
    status          = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
    updated_at      = now()
  WHERE share_token = p_token
    AND status NOT IN ('accepted', 'declined', 'archived');
END;
$$;

-- ─── 4. accept_proposal ───────────────────────────────────────────────────────
-- Public SECURITY DEFINER. No-op if already accepted.
CREATE OR REPLACE FUNCTION accept_proposal(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE proposals
  SET
    status      = 'accepted',
    accepted_at = now(),
    updated_at  = now()
  WHERE share_token = p_token
    AND status NOT IN ('accepted', 'declined', 'archived');
END;
$$;

-- ─── 5. decline_proposal ─────────────────────────────────────────────────────
-- Public SECURITY DEFINER. Stores optional reason.
CREATE OR REPLACE FUNCTION decline_proposal(p_token text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE proposals
  SET
    status         = 'declined',
    declined_at    = now(),
    decline_reason = p_reason,
    updated_at     = now()
  WHERE share_token = p_token
    AND status NOT IN ('accepted', 'declined', 'archived');
END;
$$;

-- ─── 6. generate_proposal_token ───────────────────────────────────────────────
-- Authenticated. Creates/regenerates share_token, returns the token value.
-- Client side constructs the full URL using VITE_APP_URL.
CREATE OR REPLACE FUNCTION generate_proposal_token(p_proposal_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token            text;
  v_agency_user_id   uuid;
BEGIN
  -- Verify proposal exists and caller owns it
  SELECT agency_user_id INTO v_agency_user_id
  FROM proposals
  WHERE id = p_proposal_id;

  IF v_agency_user_id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  IF get_my_agency_user_id() IS DISTINCT FROM v_agency_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_token := gen_random_uuid()::text;

  UPDATE proposals
  SET share_token = v_token,
      updated_at  = now()
  WHERE id = p_proposal_id;

  RETURN v_token;
END;
$$;
;
