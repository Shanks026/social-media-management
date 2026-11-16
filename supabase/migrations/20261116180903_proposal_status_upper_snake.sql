-- #144 / ADR 0006: Proposal statuses are UPPER_SNAKE text with a CHECK.
--
-- Stored values: DRAFT, SENT, VIEWED, CHANGES_REQUESTED, ACCEPTED, DECLINED,
-- ARCHIVED. EXPIRED is a display state computed from valid_until by the read
-- RPCs; it is never stored, so the CHECK excludes it.
-- Rewrites rows and the default, adds proposals_status_check, and recreates
-- every function that compares or returns a Proposal status.

UPDATE public.proposals SET status = upper(status);

ALTER TABLE public.proposals ALTER COLUMN status SET DEFAULT 'DRAFT';

ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_status_check CHECK (status = ANY (ARRAY[
        'DRAFT', 'SENT', 'VIEWED', 'CHANGES_REQUESTED', 'ACCEPTED', 'DECLINED', 'ARCHIVED'
    ]::text[]));

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
    status      = 'ACCEPTED',
    accepted_at = now(),
    updated_at  = now()
  WHERE share_token = p_token
    AND status NOT IN ('ACCEPTED', 'DECLINED', 'ARCHIVED')
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
    status         = 'DECLINED',
    declined_at    = now(),
    decline_reason = p_reason,
    updated_at     = now()
  WHERE share_token = p_token
    AND status NOT IN ('ACCEPTED', 'DECLINED', 'ARCHIVED')
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
    status                  = 'CHANGES_REQUESTED',
    changes_requested_at    = now(),
    changes_requested_notes = p_notes,
    updated_at               = now()
  WHERE share_token = p_token
    AND status NOT IN ('ACCEPTED', 'DECLINED', 'ARCHIVED')
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

CREATE OR REPLACE FUNCTION public.mark_proposal_viewed(p_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE proposals
  SET
    first_viewed_at = CASE WHEN first_viewed_at IS NULL THEN now() ELSE first_viewed_at END,
    status          = CASE WHEN status = 'SENT' THEN 'VIEWED' ELSE status END,
    updated_at      = now()
  WHERE share_token = p_token
    AND status NOT IN ('ACCEPTED', 'DECLINED', 'ARCHIVED');
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_proposal_by_token(p_token text)
 RETURNS TABLE(id uuid, agency_user_id uuid, client_id uuid, prospect_name text, prospect_email text, title text, status text, introduction text, scope_notes text, notes text, payment_terms text, contract_duration text, valid_until date, share_token text, first_viewed_at timestamp with time zone, sent_at timestamp with time zone, accepted_at timestamp with time zone, declined_at timestamp with time zone, decline_reason text, created_at timestamp with time zone, updated_at timestamp with time zone, agency_name text, logo_url text, logo_horizontal_url text, branding_agency_sidebar boolean, branding_powered_by boolean, client_name text, line_items jsonb, proposal_type text, file_url text, total_value numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    p.id,
    p.agency_user_id,
    p.client_id,
    p.prospect_name,
    p.prospect_email,
    p.title,
    CASE
      WHEN p.status NOT IN ('ACCEPTED', 'DECLINED', 'ARCHIVED')
        AND p.valid_until IS NOT NULL
        AND p.valid_until < CURRENT_DATE
      THEN 'EXPIRED'
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
    ) AS line_items,
    p.proposal_type,
    p.file_url,
    COALESCE(
      p.total_value,
      (SELECT SUM(li.amount) FROM proposal_line_items li WHERE li.proposal_id = p.id),
      0
    ) AS total_value
  FROM proposals p
  JOIN  agency_subscriptions sub ON sub.user_id = p.agency_user_id
  LEFT JOIN clients c            ON c.id = p.client_id
  WHERE p.share_token = p_token;
$function$;

CREATE OR REPLACE FUNCTION public.get_proposals_with_totals(p_user_id uuid, p_client_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, agency_user_id uuid, client_id uuid, prospect_id uuid, prospect_name text, prospect_email text, title text, status text, introduction text, scope_notes text, payment_terms text, contract_duration text, valid_until date, share_token text, first_viewed_at timestamp with time zone, sent_at timestamp with time zone, accepted_at timestamp with time zone, declined_at timestamp with time zone, decline_reason text, created_at timestamp with time zone, updated_at timestamp with time zone, total_value numeric, client_name text, client_logo_url text, proposal_type text, file_url text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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
      WHEN p.status NOT IN ('DRAFT', 'ACCEPTED', 'DECLINED', 'ARCHIVED')
        AND p.valid_until IS NOT NULL
        AND p.valid_until < CURRENT_DATE
      THEN 'EXPIRED'
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
$function$;

CREATE OR REPLACE FUNCTION public.get_client_report(p_client_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  SELECT jsonb_build_object(
    'client', (
      SELECT jsonb_build_object(
        'id', c.id, 'name', c.name, 'logo_url', c.logo_url,
        'industry', c.industry, 'email', c.email, 'website', c.website,
        'created_at', c.created_at
      )
      FROM clients c WHERE c.id = p_client_id
    ),
    'deliverables', (
      SELECT jsonb_build_object(
        'total', COALESCE(SUM(cnt), 0),
        'by_status', COALESCE(jsonb_object_agg(status, cnt) FILTER (WHERE status IS NOT NULL), '{}'::jsonb)
      )
      FROM (
        SELECT pv.status::text AS status, COUNT(*) AS cnt
        FROM posts p
        JOIN post_versions pv ON pv.id = p.current_version_id
        WHERE p.client_id = p_client_id
        GROUP BY pv.status
      ) s
    ),
    'campaigns', (
      SELECT jsonb_build_object(
        'total', COALESCE(COUNT(*), 0),
        'budget_allocated', COALESCE(SUM(budget), 0)
      )
      FROM campaigns WHERE client_id = p_client_id
    ),
    'finance', (
      SELECT jsonb_build_object(
        'billed',      COALESCE(SUM(total) FILTER (WHERE status IN ('SENT','PAID','OVERDUE')), 0),
        'collected',   COALESCE(SUM(total) FILTER (WHERE status = 'PAID'), 0),
        'outstanding', COALESCE(SUM(total) FILTER (WHERE status IN ('SENT','OVERDUE')), 0),
        'overdue',     COALESCE(SUM(total) FILTER (WHERE status = 'OVERDUE'), 0),
        'invoice_count', COALESCE(COUNT(*), 0)
      )
      FROM invoices WHERE client_id = p_client_id
    ),
    'proposals', (
      SELECT jsonb_build_object(
        'sent',      COALESCE(COUNT(*) FILTER (WHERE status <> 'DRAFT'), 0),
        'accepted',  COALESCE(COUNT(*) FILTER (WHERE status = 'ACCEPTED'), 0),
        'value_won', COALESCE(SUM(total_value) FILTER (WHERE status = 'ACCEPTED'), 0)
      )
      FROM proposals WHERE client_id = p_client_id
    ),
    'documents', (
      SELECT jsonb_build_object(
        'count', COALESCE(COUNT(*), 0),
        'total_bytes', COALESCE(SUM(file_size_bytes), 0)
      )
      FROM client_documents WHERE client_id = p_client_id
    ),
    'pipeline', (
      SELECT jsonb_build_object('next_deliverable_at', next_post_at)
      FROM client_pipeline_analytics WHERE client_id = p_client_id
    )
  );
$function$;
