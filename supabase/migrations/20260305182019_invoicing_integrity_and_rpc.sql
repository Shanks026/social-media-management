-- 1. Add last_generated_at to recurring_invoices
ALTER TABLE recurring_invoices 
  ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMPTZ;

-- 2. Add CHECK constraint to invoices.category
-- Standard categories: Retainer, Project Fee, Ad Management, Other
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invoices_category_check'
    ) THEN
        ALTER TABLE invoices 
          ADD CONSTRAINT invoices_category_check 
          CHECK (category = ANY (ARRAY['Retainer'::text, 'Project Fee'::text, 'Ad Management'::text, 'Other'::text]));
    END IF;
END $$;

-- 3. Create/Replace the RPC
CREATE OR REPLACE FUNCTION generate_invoice_from_template(p_template_id UUID, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_template record;
    v_next_num integer;
    v_invoice_number text;
    v_issue_date date := CURRENT_DATE;
    v_due_date date;
    v_next_billing_date date;
    v_invoice_id UUID;
BEGIN
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
$$;
;
