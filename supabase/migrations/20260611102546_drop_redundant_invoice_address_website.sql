
ALTER TABLE agency_subscriptions
  DROP COLUMN IF EXISTS invoice_address,
  DROP COLUMN IF EXISTS invoice_website;
;
