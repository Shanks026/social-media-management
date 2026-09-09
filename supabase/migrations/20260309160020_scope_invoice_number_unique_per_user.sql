
-- Drop the global unique constraint on invoice_number
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;

-- Add a composite unique constraint scoped per user
ALTER TABLE invoices ADD CONSTRAINT invoices_user_id_invoice_number_key UNIQUE (user_id, invoice_number);
;
