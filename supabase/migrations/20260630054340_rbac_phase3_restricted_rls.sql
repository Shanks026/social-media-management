-- ============================================================
-- Phase 3 — Restricted Sections: RLS + finance RPC guards
-- Finance = owner/admin only; Proposals/Prospects = owner/admin only.
-- agency_subscriptions deliberately NOT table-locked (admin invoice
-- flows write it); signatory protected by a surgical column trigger.
-- ============================================================

-- ---------- A. Finance table RLS (add can_access_finance) ----------
DROP POLICY IF EXISTS invoices_workspace_scoped ON public.invoices;
CREATE POLICY invoices_workspace_scoped ON public.invoices
  FOR ALL
  USING (user_id = public.get_my_agency_user_id() AND public.can_access_finance())
  WITH CHECK (user_id = public.get_my_agency_user_id() AND public.can_access_finance());

DROP POLICY IF EXISTS expenses_workspace_scoped ON public.expenses;
CREATE POLICY expenses_workspace_scoped ON public.expenses
  FOR ALL
  USING (user_id = public.get_my_agency_user_id() AND public.can_access_finance())
  WITH CHECK (user_id = public.get_my_agency_user_id() AND public.can_access_finance());

DROP POLICY IF EXISTS transactions_workspace_scoped ON public.transactions;
CREATE POLICY transactions_workspace_scoped ON public.transactions
  FOR ALL
  USING (user_id = public.get_my_agency_user_id() AND public.can_access_finance())
  WITH CHECK (user_id = public.get_my_agency_user_id() AND public.can_access_finance());

DROP POLICY IF EXISTS recurring_invoices_workspace_scoped ON public.recurring_invoices;
CREATE POLICY recurring_invoices_workspace_scoped ON public.recurring_invoices
  FOR ALL
  USING (user_id = public.get_my_agency_user_id() AND public.can_access_finance())
  WITH CHECK (user_id = public.get_my_agency_user_id() AND public.can_access_finance());

DROP POLICY IF EXISTS invoice_items_workspace_scoped ON public.invoice_items;
CREATE POLICY invoice_items_workspace_scoped ON public.invoice_items
  FOR ALL
  USING (
    public.can_access_finance()
    AND invoice_id IN (SELECT id FROM public.invoices WHERE user_id = public.get_my_agency_user_id())
  )
  WITH CHECK (
    public.can_access_finance()
    AND invoice_id IN (SELECT id FROM public.invoices WHERE user_id = public.get_my_agency_user_id())
  );

-- ---------- B. Proposals / Prospects RLS (add is_workspace_admin) ----------
DROP POLICY IF EXISTS proposals_access ON public.proposals;
CREATE POLICY proposals_access ON public.proposals
  FOR ALL
  USING (public.get_my_agency_user_id() = agency_user_id AND public.is_workspace_admin())
  WITH CHECK (public.get_my_agency_user_id() = agency_user_id AND public.is_workspace_admin());

DROP POLICY IF EXISTS proposal_line_items_access ON public.proposal_line_items;
CREATE POLICY proposal_line_items_access ON public.proposal_line_items
  FOR ALL
  USING (
    public.is_workspace_admin()
    AND EXISTS (SELECT 1 FROM public.proposals p
                WHERE p.id = proposal_line_items.proposal_id
                  AND public.get_my_agency_user_id() = p.agency_user_id)
  )
  WITH CHECK (
    public.is_workspace_admin()
    AND EXISTS (SELECT 1 FROM public.proposals p
                WHERE p.id = proposal_line_items.proposal_id
                  AND public.get_my_agency_user_id() = p.agency_user_id)
  );

DROP POLICY IF EXISTS prospects_workspace_policy ON public.prospects;
CREATE POLICY prospects_workspace_policy ON public.prospects
  FOR ALL
  USING (user_id = public.get_my_agency_user_id() AND public.is_workspace_admin())
  WITH CHECK (user_id = public.get_my_agency_user_id() AND public.is_workspace_admin());

DROP POLICY IF EXISTS prospect_activities_workspace_policy ON public.prospect_activities;
CREATE POLICY prospect_activities_workspace_policy ON public.prospect_activities
  FOR ALL
  USING (user_id = public.get_my_agency_user_id() AND public.is_workspace_admin())
  WITH CHECK (user_id = public.get_my_agency_user_id() AND public.is_workspace_admin());

-- ---------- C. get_campaign_analytics: null finance fields for members ----------
CREATE OR REPLACE FUNCTION public.get_campaign_analytics(p_campaign_id uuid)
 RETURNS TABLE(total_posts bigint, published_posts bigint, on_time_posts bigint,
               avg_approval_days numeric, platform_distribution jsonb,
               budget numeric, total_invoiced numeric, total_collected numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_campaign campaigns%ROWTYPE;
  v_fin boolean := public.can_access_finance();
BEGIN
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  RETURN QUERY
  SELECT
    COUNT(p.id)::BIGINT,
    COUNT(p.id) FILTER (WHERE pv.status = 'PUBLISHED')::BIGINT,
    COUNT(p.id) FILTER (
      WHERE pv.status = 'PUBLISHED'
        AND pv.published_at IS NOT NULL
        AND pv.target_date  IS NOT NULL
        AND pv.published_at <= pv.target_date::TIMESTAMPTZ
    )::BIGINT,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (pv.updated_at - pv.created_at)) / 86400.0
      ) FILTER (
        WHERE pv.status IN ('SCHEDULED', 'PUBLISHED')
          AND pv.updated_at > pv.created_at
      ),
      1
    ),
    COALESCE(
      (SELECT jsonb_object_agg(plat, cnt) FROM (
        SELECT unnest(pv2.platform) AS plat, COUNT(*) AS cnt
        FROM posts p2
        JOIN post_versions pv2 ON pv2.id = p2.current_version_id
        WHERE p2.campaign_id = p_campaign_id
        GROUP BY plat
      ) sub),
      '{}'::jsonb
    ),
    CASE WHEN v_fin THEN v_campaign.budget ELSE NULL END,
    CASE WHEN v_fin THEN COALESCE(SUM(i.total) FILTER (WHERE i.status IN ('SENT','OVERDUE','PAID')), 0) ELSE NULL END,
    CASE WHEN v_fin THEN COALESCE(SUM(i.total) FILTER (WHERE i.status = 'PAID'), 0) ELSE NULL END
  FROM campaigns c
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  LEFT JOIN invoices i ON i.campaign_id = p_campaign_id
  WHERE c.id = p_campaign_id
  GROUP BY v_campaign.budget;
END;
$function$;

-- ---------- D. Finance-mutation RPC guards (SECURITY DEFINER bypasses RLS) ----------
-- Pattern: block authenticated non-finance users; allow service-role (auth.uid() NULL)
-- so any cron/automation keeps working untouched.

CREATE OR REPLACE FUNCTION public.generate_invoice_from_template(p_template_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_template record;
    v_next_num integer;
    v_invoice_number text;
    v_issue_date date := CURRENT_DATE;
    v_due_date date;
    v_next_billing_date date;
    v_invoice_id UUID;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.can_access_finance() THEN
        RAISE EXCEPTION 'Insufficient permissions: finance access required';
    END IF;

    -- 1. Fetch and Lock template
    SELECT * INTO v_template
    FROM recurring_invoices
    WHERE id = p_template_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found or access denied';
    END IF;

    -- 2. Get and Increment Invoice Counter (atomic)
    UPDATE agency_subscriptions
    SET next_invoice_number = next_invoice_number + 1
    WHERE user_id = p_user_id
    RETURNING (next_invoice_number - 1) INTO v_next_num;

    -- 3. Generate Invoice Number
    v_invoice_number := 'INV-' || TO_CHAR(v_issue_date, 'YYYY') || '-' || LPAD(COALESCE(v_next_num, 1)::text, 3, '0');

    -- 4. Calculate Due Date
    v_due_date := v_issue_date;
    IF v_template.payment_terms = 'Net 15' THEN
        v_due_date := v_issue_date + INTERVAL '15 days';
    ELSIF v_template.payment_terms = 'Net 30' THEN
        v_due_date := v_issue_date + INTERVAL '30 days';
    ELSIF v_template.payment_terms = 'Net 60' THEN
        v_due_date := v_issue_date + INTERVAL '60 days';
    END IF;

    -- 5. Calculate Next Billing Date
    v_next_billing_date := COALESCE(v_template.next_invoice_date, CURRENT_DATE);
    IF v_template.billing_cycle = 'MONTHLY' THEN
        v_next_billing_date := v_next_billing_date + INTERVAL '1 month';
    ELSIF v_template.billing_cycle = 'QUARTERLY' THEN
        v_next_billing_date := v_next_billing_date + INTERVAL '3 months';
    ELSIF v_template.billing_cycle = 'YEARLY' THEN
        v_next_billing_date := v_next_billing_date + INTERVAL '1 year';
    END IF;

    -- 6. Insert Invoice
    INSERT INTO invoices (
        user_id, client_id, invoice_number, status, issue_date, due_date,
        category, subtotal, total, notes, payment_terms
    ) VALUES (
        p_user_id, v_template.client_id, v_invoice_number, 'DRAFT', v_issue_date, v_due_date,
        v_template.category, v_template.amount, v_template.amount, v_template.notes, v_template.payment_terms
    ) RETURNING id INTO v_invoice_id;

    -- 7. Insert Invoice Item
    INSERT INTO invoice_items (
        invoice_id, description, quantity, unit_price, total
    ) VALUES (
        v_invoice_id, COALESCE(v_template.description, v_template.category), 1, v_template.amount, v_template.amount
    );

    -- 8. Update Template
    UPDATE recurring_invoices
    SET next_invoice_date = v_next_billing_date,
        last_generated_at = NOW()
    WHERE id = p_template_id;

    RETURN v_invoice_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advance_recurring_invoice_date(p_recurring_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  rec recurring_invoices%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_access_finance() THEN
    RAISE EXCEPTION 'Insufficient permissions: finance access required';
  END IF;

  SELECT * INTO rec FROM recurring_invoices WHERE id = p_recurring_invoice_id;

  UPDATE recurring_invoices
  SET next_invoice_date = CASE rec.billing_cycle
    WHEN 'MONTHLY'    THEN rec.next_invoice_date + INTERVAL '1 month'
    WHEN 'QUARTERLY'  THEN rec.next_invoice_date + INTERVAL '3 months'
    WHEN 'YEARLY'     THEN rec.next_invoice_date + INTERVAL '1 year'
  END
  WHERE id = p_recurring_invoice_id;
END;
$function$;

-- ---------- E. Invoice signatory: owner-only (surgical column trigger) ----------
-- Blocks changes to the 3 signatory columns by non-owners. Exempts superadmin
-- (admin portal) and service-role (auth.uid() NULL). All other columns —
-- including next_invoice_number and agency_name — remain admin-writable.
CREATE OR REPLACE FUNCTION public.enforce_owner_only_signatory()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
BEGIN
  IF (
        NEW.signatory_name        IS DISTINCT FROM OLD.signatory_name
     OR NEW.signatory_designation IS DISTINCT FROM OLD.signatory_designation
     OR NEW.signature_url         IS DISTINCT FROM OLD.signature_url
     )
     AND auth.uid() IS NOT NULL
     AND NOT public.is_workspace_owner()
     AND NOT public.is_superadmin()
  THEN
    RAISE EXCEPTION 'Only the workspace owner can change the invoice signatory';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_owner_only_signatory ON public.agency_subscriptions;
CREATE TRIGGER trg_enforce_owner_only_signatory
  BEFORE UPDATE ON public.agency_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_owner_only_signatory();;
