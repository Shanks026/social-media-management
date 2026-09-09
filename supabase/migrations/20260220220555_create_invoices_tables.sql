
-- ============================================================
-- INVOICES TABLE
-- ============================================================
CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  client_id       uuid NOT NULL REFERENCES clients(id),
  invoice_number  text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT','SENT','PAID','OVERDUE','VOID')),
  issue_date      date NOT NULL DEFAULT CURRENT_DATE,
  due_date        date NOT NULL,
  subtotal        numeric NOT NULL DEFAULT 0,
  total           numeric NOT NULL DEFAULT 0,
  notes           text,
  payment_terms   text,
  pdf_url         text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ============================================================
-- INVOICE ITEMS TABLE
-- ============================================================
CREATE TABLE invoice_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  transaction_id  uuid REFERENCES transactions(id),
  description     text NOT NULL,
  quantity        numeric NOT NULL DEFAULT 1,
  unit_price      numeric NOT NULL,
  total           numeric NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- INVOICE NUMBER TRACKING
-- ============================================================
ALTER TABLE agency_subscriptions
  ADD COLUMN next_invoice_number integer NOT NULL DEFAULT 1;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own invoices"
  ON invoices FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own invoice items"
  ON invoice_items FOR ALL USING (
    invoice_id IN (SELECT id FROM invoices WHERE user_id = auth.uid())
  );
;
