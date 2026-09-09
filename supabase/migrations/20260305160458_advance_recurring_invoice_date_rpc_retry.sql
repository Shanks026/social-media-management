CREATE OR REPLACE FUNCTION advance_recurring_invoice_date(p_recurring_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
  rec recurring_invoices%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM recurring_invoices WHERE id = p_recurring_invoice_id;

  UPDATE recurring_invoices
  SET next_invoice_date = CASE rec.billing_cycle
    WHEN 'MONTHLY'    THEN rec.next_invoice_date + INTERVAL '1 month'
    WHEN 'QUARTERLY'  THEN rec.next_invoice_date + INTERVAL '3 months'
    WHEN 'YEARLY'     THEN rec.next_invoice_date + INTERVAL '1 year'
  END
  WHERE id = p_recurring_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;;
