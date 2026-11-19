-- #169 (stopgap for #80): three SECURITY DEFINER functions trusted a workspace
-- id passed by the caller. Signatures are unchanged so open browsers keep
-- working; #80 replaces the parameter with server-side resolution.

-- 1. set_agency_plan: any signed-in user could change any workspace's Plan.
--    Nothing in the app calls it; the service role and SQL editor still can.
revoke all on function public.set_agency_plan(uuid, text) from public, anon, authenticated;

-- 2. get_proposals_with_totals: any signed-in user could read any workspace's
--    Proposals (share tokens included). Now mirrors the proposals RLS policy:
--    the caller's own workspace, Owner/Admin only.
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
    AND p_user_id = public.get_my_agency_user_id()
    AND public.is_workspace_admin()
    AND (p_client_id IS NULL OR p.client_id = p_client_id)
  ORDER BY p.created_at DESC;
$function$
;

-- 3. generate_invoice_from_template: a finance user could draft an invoice into
--    another workspace by passing its id. User callers must name their own;
--    service-role callers (auth.uid() null) are unchanged.
CREATE OR REPLACE FUNCTION public.generate_invoice_from_template(p_template_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.can_access_finance() THEN
        RAISE EXCEPTION 'Insufficient permissions: finance access required';
    END IF;

    IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM public.get_my_agency_user_id() THEN
        RAISE EXCEPTION 'Template not found or access denied';
    END IF;

    PERFORM 1
    FROM recurring_invoices
    WHERE id = p_template_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found or access denied';
    END IF;

    RETURN public.draft_invoice_from_template(p_template_id, CURRENT_DATE);
END;
$function$

;
