ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Retainer'
    CHECK (category IN ('Retainer', 'Project Fee', 'Ad Management', 'Other'));;
