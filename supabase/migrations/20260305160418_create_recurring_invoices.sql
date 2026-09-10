CREATE TABLE IF NOT EXISTS recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'Retainer'
    CHECK (category IN ('Retainer', 'Project Fee', 'Ad Management', 'Other')),
  description TEXT,
  billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY'
    CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
  next_invoice_date DATE NOT NULL,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recurring invoices"
  ON recurring_invoices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
;
