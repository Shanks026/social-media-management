
ALTER TABLE agency_subscriptions
  ADD COLUMN IF NOT EXISTS invoice_address text,
  ADD COLUMN IF NOT EXISTS invoice_website text,
  ADD COLUMN IF NOT EXISTS signatory_name text,
  ADD COLUMN IF NOT EXISTS signatory_designation text,
  ADD COLUMN IF NOT EXISTS signature_url text;
;
