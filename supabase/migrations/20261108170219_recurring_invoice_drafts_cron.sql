-- #112: draft invoices from recurring templates automatically when they fall
-- due (decided in #74). A daily pg_cron job drafts — never sends — one invoice
-- per missed billing period, dated to that period, for workspaces whose plan
-- has finance_recurring_invoices, then tells the owner and admins in-app
-- (ADR 0002: fan-out lives in the database). The job is pure SQL, so it needs
-- no project URL or service key from Vault.

-- 1. The drafting logic, shared ---------------------------------------------
-- Lifted unchanged from generate_invoice_from_template (steps 2–8), except the
-- issue date is a parameter: the Generate button passes today, the job passes
-- the period being drafted. Locks the template, takes the next invoice number,
-- inserts the DRAFT invoice + its line item, and advances next_invoice_date by
-- one billing cycle. Internal: callers check access first.
CREATE OR REPLACE FUNCTION public.draft_invoice_from_template(p_template_id uuid, p_issue_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_template record;
    v_next_num integer;
    v_invoice_number text;
    v_issue_date date := p_issue_date;
    v_due_date date;
    v_next_billing_date date;
    v_invoice_id UUID;
BEGIN
    SELECT * INTO v_template
    FROM recurring_invoices
    WHERE id = p_template_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
    END IF;

    -- Invoice counter (atomic)
    UPDATE agency_subscriptions
    SET next_invoice_number = next_invoice_number + 1
    WHERE user_id = v_template.user_id
    RETURNING (next_invoice_number - 1) INTO v_next_num;

    v_invoice_number := 'INV-' || TO_CHAR(v_issue_date, 'YYYY') || '-' || LPAD(COALESCE(v_next_num, 1)::text, 3, '0');

    -- Due date from the payment terms
    v_due_date := v_issue_date;
    IF v_template.payment_terms = 'Net 15' THEN
        v_due_date := v_issue_date + INTERVAL '15 days';
    ELSIF v_template.payment_terms = 'Net 30' THEN
        v_due_date := v_issue_date + INTERVAL '30 days';
    ELSIF v_template.payment_terms = 'Net 60' THEN
        v_due_date := v_issue_date + INTERVAL '60 days';
    END IF;

    -- Next billing date: one cycle on from the template's current one
    v_next_billing_date := COALESCE(v_template.next_invoice_date, CURRENT_DATE);
    IF v_template.billing_cycle = 'MONTHLY' THEN
        v_next_billing_date := v_next_billing_date + INTERVAL '1 month';
    ELSIF v_template.billing_cycle = 'QUARTERLY' THEN
        v_next_billing_date := v_next_billing_date + INTERVAL '3 months';
    ELSIF v_template.billing_cycle = 'YEARLY' THEN
        v_next_billing_date := v_next_billing_date + INTERVAL '1 year';
    END IF;

    INSERT INTO invoices (
        user_id, client_id, invoice_number, status, issue_date, due_date,
        category, subtotal, total, notes, payment_terms
    ) VALUES (
        v_template.user_id, v_template.client_id, v_invoice_number, 'DRAFT', v_issue_date, v_due_date,
        v_template.category, v_template.amount, v_template.amount, v_template.notes, v_template.payment_terms
    ) RETURNING id INTO v_invoice_id;

    INSERT INTO invoice_items (
        invoice_id, description, quantity, unit_price, total
    ) VALUES (
        v_invoice_id, COALESCE(v_template.description, v_template.category), 1, v_template.amount, v_template.amount
    );

    UPDATE recurring_invoices
    SET next_invoice_date = v_next_billing_date,
        last_generated_at = NOW()
    WHERE id = p_template_id;

    RETURN v_invoice_id;
END;
$function$;

ALTER FUNCTION public.draft_invoice_from_template(uuid, date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.draft_invoice_from_template(uuid, date) FROM PUBLIC, anon, authenticated;

-- 2. The Generate button: same checks, same result -------------------------
-- Behaviour is unchanged: finance access when called by a user, the template
-- must belong to p_user_id, the invoice is dated today.
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

    PERFORM 1
    FROM recurring_invoices
    WHERE id = p_template_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found or access denied';
    END IF;

    RETURN public.draft_invoice_from_template(p_template_id, CURRENT_DATE);
END;
$function$;

-- 3. The daily job ------------------------------------------------------------
-- For every active template that is due, on a plan with
-- finance_recurring_invoices, draft one invoice per billing period from its
-- next_invoice_date up to today, each dated to its own period. Every pass
-- re-reads the template under FOR UPDATE and stops once next_invoice_date is
-- after today, so a second run (or a manual Generate in between) never drafts
-- a period twice. Only cycles that advance the date are picked up, so the loop
-- always ends. A failing template is skipped with a warning rather than
-- aborting the other workspaces' drafts.
--
-- Afterwards each workspace that got drafts gets one in-app notification for
-- its owner and admins. Returns the number of drafts created.
CREATE OR REPLACE FUNCTION public.draft_due_recurring_invoices()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    r record;
    v_template record;
    v_counts jsonb := '{}'::jsonb;
    v_total integer := 0;
    v_ws text;
    v_n integer;
BEGIN
    FOR r IN
        SELECT ri.id, ri.user_id
        FROM recurring_invoices ri
        JOIN agency_subscriptions s ON s.user_id = ri.user_id
        WHERE ri.is_active
          AND s.finance_recurring_invoices
          AND ri.next_invoice_date <= CURRENT_DATE
          AND ri.billing_cycle IN ('MONTHLY', 'QUARTERLY', 'YEARLY')
        ORDER BY ri.user_id, ri.id
    LOOP
        LOOP
            SELECT * INTO v_template
            FROM recurring_invoices
            WHERE id = r.id
            FOR UPDATE;

            EXIT WHEN NOT FOUND
                  OR NOT v_template.is_active
                  OR v_template.next_invoice_date > CURRENT_DATE;

            BEGIN
                PERFORM public.draft_invoice_from_template(r.id, v_template.next_invoice_date);
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'draft_due_recurring_invoices: template % skipped: %', r.id, SQLERRM;
                EXIT;
            END;

            v_total := v_total + 1;
            v_counts := jsonb_set(
                v_counts,
                ARRAY[r.user_id::text],
                to_jsonb(COALESCE((v_counts ->> r.user_id::text)::integer, 0) + 1)
            );
        END LOOP;
    END LOOP;

    FOR v_ws, v_n IN
        SELECT key, value::integer FROM jsonb_each_text(v_counts)
    LOOP
        PERFORM public.emit_notifications(
            v_ws::uuid,
            NULL,
            public.workspace_admin_uids(v_ws::uuid),
            'recurring_invoices_drafted',
            CASE WHEN v_n = 1 THEN '1 recurring invoice drafted'
                 ELSE v_n || ' recurring invoices drafted' END,
            'Review and send them from Finance → Invoices.',
            'invoice',
            NULL,
            '/finance/invoices'
        );
    END LOOP;

    RETURN v_total;
END;
$function$;

ALTER FUNCTION public.draft_due_recurring_invoices() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.draft_due_recurring_invoices() FROM PUBLIC, anon, authenticated;

-- 4. Schedule: daily 06:00 UTC, before notify-overdue-invoices (08:00) -------
SELECT cron.schedule('draft-recurring-invoices', '0 6 * * *',
  $cmd$ select public.draft_due_recurring_invoices(); $cmd$);
